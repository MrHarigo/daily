import { create } from 'zustand';
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  username: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  
  // Email verification flow state
  verifiedEmail: string | null;
  isNewUser: boolean;
  
  checkAuth: () => Promise<void>;
  // Direct passkey login (no email needed)
  directPasskeyLogin: () => Promise<void>;
  // Email-based flow
  sendCode: (email: string) => Promise<{ isNewUser: boolean }>;
  verifyCode: (email: string, code: string) => Promise<{ isNewUser: boolean; username?: string }>;
  registerPasskey: (username?: string) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  logout: () => Promise<void>;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  verifiedEmail: null,
  isNewUser: false,

  checkAuth: async () => {
    try {
      const statusRes = await api.get<{ authenticated: boolean; user?: User }>('/auth/status');

      set({
        isAuthenticated: statusRes.authenticated,
        user: statusRes.user || null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to check auth:', error);
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  // Direct passkey login - no email required, uses discoverable credentials
  directPasskeyLogin: async () => {
    try {
      // Get authentication options (no email needed)
      const options = await api.get<PublicKeyCredentialRequestOptionsJSON>('/auth/passkey-login/options');

      // Start WebAuthn authentication - browser will show available passkeys
      const credential = await startAuthentication({ optionsJSON: options });

      // Verify with server - server looks up user from credential
      const result = await api.post<{ verified: boolean }>('/auth/passkey-login/verify', credential);

      if (result.verified) {
        await get().checkAuth();
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Direct passkey login error:', error);
      throw error;
    }
  },

  sendCode: async (email: string) => {
    const result = await api.post<{ success: boolean; isNewUser: boolean }>('/auth/send-code', { email });
    set({ isNewUser: result.isNewUser });
    return { isNewUser: result.isNewUser };
  },

  verifyCode: async (email: string, code: string) => {
    const result = await api.post<{ success: boolean; isNewUser: boolean; username?: string }>(
      '/auth/verify-code',
      { email, code }
    );
    set({ verifiedEmail: email, isNewUser: result.isNewUser });
    return { isNewUser: result.isNewUser, username: result.username };
  },

  registerPasskey: async (username?: string) => {
    try {
      // Get registration options (will use verified email from session)
      const options = await api.post<PublicKeyCredentialCreationOptionsJSON>(
        '/auth/register/options',
        { username }
      );

      // Start WebAuthn registration
      const credential = await startRegistration({ optionsJSON: options });

      // Verify with server
      const result = await api.post<{ verified: boolean }>('/auth/register/verify', credential);

      if (result.verified) {
        set({ verifiedEmail: null, isNewUser: false });
        await get().checkAuth();
      } else {
        throw new Error('Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  loginWithPasskey: async () => {
    try {
      // Get authentication options (will use verified email from session)
      const options = await api.get<PublicKeyCredentialRequestOptionsJSON>('/auth/login/options');

      // Start WebAuthn authentication
      const credential = await startAuthentication({ optionsJSON: options });

      // Verify with server
      const result = await api.post<{ verified: boolean }>('/auth/login/verify', credential);

      if (result.verified) {
        set({ verifiedEmail: null, isNewUser: false });
        await get().checkAuth();
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', {});
      set({ isAuthenticated: false, user: null, verifiedEmail: null, isNewUser: false });
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  reset: () => {
    set({ verifiedEmail: null, isNewUser: false });
  },
}));

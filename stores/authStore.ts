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

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { id: string; username: string } | null;
  hasExistingUser: boolean;
  checkAuth: () => Promise<void>;
  register: (username: string) => Promise<void>;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  hasExistingUser: false,

  checkAuth: async () => {
    try {
      const [statusRes, hasUserRes] = await Promise.all([
        api.get<{ authenticated: boolean; user?: { id: string; username: string } }>(
          '/auth/status'
        ),
        api.get<{ hasUser: boolean }>('/auth/has-user'),
      ]);

      set({
        isAuthenticated: statusRes.authenticated,
        user: statusRes.user || null,
        hasExistingUser: hasUserRes.hasUser,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to check auth:', error);
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  register: async (username: string) => {
    try {
      // Get registration options from server
      const options = await api.get<PublicKeyCredentialCreationOptionsJSON>('/auth/register/options');

      // Start WebAuthn registration
      const credential = await startRegistration({ optionsJSON: options });

      // Verify with server
      const result = await api.post<{ verified: boolean }>(
        '/auth/register/verify',
        credential
      );

      if (result.verified) {
        set({ isAuthenticated: true, hasExistingUser: true });
        await get().checkAuth();
      } else {
        throw new Error('Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  login: async () => {
    try {
      // Get authentication options from server
      const options = await api.get<PublicKeyCredentialRequestOptionsJSON>('/auth/login/options');

      // Start WebAuthn authentication
      const credential = await startAuthentication({ optionsJSON: options });

      // Verify with server
      const result = await api.post<{ verified: boolean }>(
        '/auth/login/verify',
        credential
      );

      if (result.verified) {
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
      set({ isAuthenticated: false, user: null });
    } catch (error) {
      console.error('Logout error:', error);
    }
  },
}));


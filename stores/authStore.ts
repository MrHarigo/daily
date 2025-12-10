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

export interface Device {
  id: string;
  device_name: string;
  created_at: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;

  // Email verification flow state
  verifiedEmail: string | null;
  isNewUser: boolean;

  // Devices
  devices: Device[];
  devicesLoading: boolean;

  checkAuth: () => Promise<void>;
  // Direct passkey login (no email needed)
  directPasskeyLogin: () => Promise<void>;
  // Email-based flow
  sendCode: (email: string) => Promise<{ isNewUser: boolean }>;
  verifyCode: (email: string, code: string) => Promise<{ isNewUser: boolean; username?: string }>;
  registerPasskey: (username?: string) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  finalizeEmailLogin: () => Promise<void>;
  logout: () => Promise<void>;
  reset: () => void;

  // Device management
  fetchDevices: () => Promise<void>;
  addDevice: () => Promise<boolean>;
  removeDevice: (deviceId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  verifiedEmail: null,
  isNewUser: false,
  devices: [],
  devicesLoading: false,

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
      // Don't log user cancellation - it's expected behavior
      const err = error as { name?: string };
      if (err?.name !== 'NotAllowedError') {
        console.error('Direct passkey login error:', error);
      }
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
      const err = error as { name?: string; message?: string };
      // Don't log "already registered" or user cancellation errors
      if (err?.name !== 'InvalidStateError' && 
          err?.name !== 'NotAllowedError' &&
          !err?.message?.includes('previously registered')) {
        console.error('Registration error:', error);
      }
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

  // Finalize login after email verification (for users who already have a passkey registered)
  finalizeEmailLogin: async () => {
    try {
      const result = await api.post<{ success: boolean }>('/auth/finalize-email-login', {});
      if (result.success) {
        set({ verifiedEmail: null, isNewUser: false });
        await get().checkAuth();
      } else {
        throw new Error('Failed to finalize login');
      }
    } catch (error) {
      console.error('Finalize email login error:', error);
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

  fetchDevices: async () => {
    try {
      set({ devicesLoading: true });
      const devices = await api.get<Device[]>('/auth/devices');
      set({ devices, devicesLoading: false });
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      set({ devicesLoading: false });
    }
  },

  addDevice: async () => {
    try {
      // Get registration options
      const options = await api.get<PublicKeyCredentialCreationOptionsJSON>('/auth/add-device');

      // Start WebAuthn registration
      const credential = await startRegistration({ optionsJSON: options });

      // Verify with server
      const result = await api.post<{ verified: boolean; deviceName: string }>('/auth/add-device', credential);

      if (result.verified) {
        await get().fetchDevices();
        return true;
      }
      return false;
    } catch (error) {
      const err = error as { name?: string };
      if (err?.name !== 'NotAllowedError') {
        console.error('Add device error:', error);
      }
      throw error;
    }
  },

  removeDevice: async (deviceId: string) => {
    try {
      await api.delete(`/auth/devices?id=${encodeURIComponent(deviceId)}`);
      await get().fetchDevices();
    } catch (error) {
      console.error('Failed to remove device:', error);
      throw error;
    }
  },
}));

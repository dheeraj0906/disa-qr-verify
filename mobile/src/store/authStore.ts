import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { AuthUser } from '@/types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
}

interface AuthActions {
  hydrate: () => Promise<void>;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  token: null,
  user: null,
  hydrated: false,

  hydrate: async () => {
    const token = await SecureStore.getItemAsync('disa_jwt');
    const raw   = await SecureStore.getItemAsync('disa_user');
    set({ token, user: raw ? JSON.parse(raw) : null, hydrated: true });
  },

  login: async (token, user) => {
    await SecureStore.setItemAsync('disa_jwt', token);
    await SecureStore.setItemAsync('disa_user', JSON.stringify(user));
    set({ token, user });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('disa_jwt');
    await SecureStore.deleteItemAsync('disa_user');
    set({ token: null, user: null });
  },
}));

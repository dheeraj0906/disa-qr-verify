import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://disa-qr-verify-api.onrender.com';

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 45000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('disa_jwt');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('disa_jwt');
      await SecureStore.deleteItemAsync('disa_user');
    }
    return Promise.reject(err);
  },
);

export default api;

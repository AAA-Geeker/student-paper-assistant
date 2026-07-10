import { create } from 'zustand';

interface AuthState {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
}

const getInitialToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export const useAuthStore = create<AuthState>((set) => ({
  token: getInitialToken(),
  setToken: (token) => { localStorage.setItem('token', token); set({ token }); },
  logout: () => { localStorage.removeItem('token'); set({ token: null }); },
}));

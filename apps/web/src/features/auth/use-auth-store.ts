import { create } from "zustand";

interface UserSession {
  id: string;
  email?: string;
}

interface AuthState {
  user: UserSession | null;
  isLoading: boolean;
  setUser: (user: UserSession | null) => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
}));

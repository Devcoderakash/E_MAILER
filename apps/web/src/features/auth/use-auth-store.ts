import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";
import type { UserProfile, Workspace } from "@/types";
import { supabase } from "@/lib/supabase";

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;

  setAuth: (params: {
    user: User | null;
    session: Session | null;
    profile?: UserProfile | null;
    activeWorkspace?: Workspace | null;
    workspaces?: Workspace[];
  }) => void;
  setProfile: (profile: UserProfile | null) => void;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setLoading: (isLoading: boolean) => void;
  clearAuth: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  profile: null,
  activeWorkspace: null,
  workspaces: [],
  isLoading: true,

  setAuth: ({ user, session, profile, activeWorkspace, workspaces }) =>
    set((state) => ({
      user,
      session,
      profile: profile !== undefined ? profile : state.profile,
      activeWorkspace:
        activeWorkspace !== undefined ? activeWorkspace : state.activeWorkspace,
      workspaces: workspaces !== undefined ? workspaces : state.workspaces,
      isLoading: false,
    })),

  setProfile: (profile) => set({ profile }),

  setActiveWorkspace: (activeWorkspace) =>
    set((state) => ({
      activeWorkspace,
      workspaces: state.workspaces.map((ws) => ({
        ...ws,
        isActive: ws.id === activeWorkspace?.id,
      })),
    })),

  setWorkspaces: (workspaces) => set({ workspaces }),

  setLoading: (isLoading) => set({ isLoading }),

  clearAuth: () =>
    set({
      user: null,
      session: null,
      profile: null,
      activeWorkspace: null,
      workspaces: [],
      isLoading: false,
    }),

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      set({
        user: null,
        session: null,
        profile: null,
        activeWorkspace: null,
        workspaces: [],
        isLoading: false,
      });
    }
  },
}));

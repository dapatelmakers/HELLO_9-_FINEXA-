import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LocalUser, UserRole } from '@/types';
import { storage, hashPassword, verifyPassword, generateId } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  localUser: LocalUser | null;
  isAuthenticated: boolean;
  isCloudMode: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginLocal: (username: string, password: string) => { success: boolean; error?: string };
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  registerLocal: (data: LocalRegisterData) => { success: boolean; error?: string };
  logout: () => Promise<void>;
  hasPermission: (requiredRole: UserRole) => boolean;
  switchToCloudMode: () => void;
  switchToLocalMode: () => void;
}

interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  gstState: string;
  role?: UserRole;
}

interface LocalRegisterData {
  username: string;
  password: string;
  role: UserRole;
  companyName: string;
  gstState: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [localUser, setLocalUser] = useState<LocalUser | null>(null);
  const [localUsers, setLocalUsers] = useState<LocalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCloudMode, setIsCloudMode] = useState<boolean>(() => {
    return storage.get<boolean>('cloudMode', false);
  });

  // Initialize local users
  useEffect(() => {
    const storedUsers = storage.get<LocalUser[]>('users', []);
    setLocalUsers(storedUsers);
    
    const currentUserId = storage.get<string>('currentUser', '');
    if (currentUserId && !isCloudMode) {
      const currentUser = storedUsers.find(u => u.id === currentUserId);
      if (currentUser) {
        setLocalUser(currentUser);
      }
    }
  }, [isCloudMode]);

  // Initialize cloud auth
  useEffect(() => {
    if (!isCloudMode) {
      setLoading(false);
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // Defer profile fetch to avoid deadlock
          setTimeout(async () => {
            await fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        await fetchUserProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isCloudMode]);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (profile) {
        setUser({
          id: userId,
          email: profile.email,
          fullName: profile.full_name,
          companyName: profile.company_name,
          gstState: profile.gst_state,
          avatarUrl: profile.avatar_url,
          role: (roleData?.role as UserRole) || 'viewer',
          createdAt: profile.created_at,
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const switchToCloudMode = () => {
    setIsCloudMode(true);
    storage.set('cloudMode', true);
    setLocalUser(null);
    setLoading(true);
  };

  const switchToLocalMode = () => {
    setIsCloudMode(false);
    storage.set('cloudMode', false);
    setUser(null);
    setSession(null);
    setLoading(false);
  };

  // Cloud login
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  // Local login
  const loginLocal = (username: string, password: string): { success: boolean; error?: string } => {
    const foundUser = localUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (!foundUser) {
      return { success: false, error: 'User not found' };
    }

    if (!verifyPassword(password, foundUser.passwordHash)) {
      return { success: false, error: 'Invalid password' };
    }

    const updatedUser = { ...foundUser, lastLogin: new Date().toISOString() };
    const updatedUsers = localUsers.map(u => u.id === foundUser.id ? updatedUser : u);
    
    setLocalUser(updatedUser);
    setLocalUsers(updatedUsers);
    storage.set('users', updatedUsers);
    storage.set('currentUser', updatedUser.id);

    return { success: true };
  };

  // Cloud register
  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string }> => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: data.fullName,
            company_name: data.companyName,
            gst_state: data.gstState,
            role: data.role || 'admin',
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Registration failed' };
    }
  };

  // Local register
  const registerLocal = (data: LocalRegisterData): { success: boolean; error?: string } => {
    const existingUser = localUsers.find(u => u.username.toLowerCase() === data.username.toLowerCase());
    
    if (existingUser) {
      return { success: false, error: 'Username already exists' };
    }

    if (data.password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters' };
    }

    const newUser: LocalUser = {
      id: generateId(),
      username: data.username,
      passwordHash: hashPassword(data.password),
      role: data.role,
      companyName: data.companyName,
      gstState: data.gstState,
      createdAt: new Date().toISOString(),
    };

    const updatedUsers = [...localUsers, newUser];
    setLocalUsers(updatedUsers);
    storage.set('users', updatedUsers);

    return { success: true };
  };

  const logout = async () => {
    if (isCloudMode) {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    } else {
      setLocalUser(null);
      storage.remove('currentUser');
    }
  };

  const hasPermission = (requiredRole: UserRole): boolean => {
    const currentUser = isCloudMode ? user : localUser;
    if (!currentUser) return false;
    
    const roleHierarchy: Record<UserRole, number> = {
      admin: 3,
      accountant: 2,
      viewer: 1,
    };

    return roleHierarchy[currentUser.role] >= roleHierarchy[requiredRole];
  };

  const isAuthenticated = isCloudMode ? !!user : !!localUser;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        localUser,
        isAuthenticated,
        isCloudMode,
        loading,
        login,
        loginLocal,
        register,
        registerLocal,
        logout,
        hasPermission,
        switchToCloudMode,
        switchToLocalMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

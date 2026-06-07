// @ts-nocheck - Supabase type inference issues with generated types
// ============================================================
// Auth Context Provider
// ============================================================
//
// Provides authentication state and actions to all components.
// Wraps your app with this provider to access auth functionality.
// ------------------------------------------------------------

'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase/client';
import type { AuthUser, AuthContextValue, PermissionAction, PermissionResource, RoleSlug } from './types';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user with roles and permissions
  const fetchUser = useCallback(async () => {
    const isAuthDisabled = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                           process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://mock-supabase-url.supabase.co' ||
                           process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

    if (isAuthDisabled) {
      const mockUser: AuthUser = {
        id: 'mock-admin-id',
        email: 'admin@factory.local',
        profile: { id: 'mock-admin-id', email: 'admin@factory.local', full_name: 'Super Admin' },
        roles: [{ id: 'super_admin_role', name: 'Super Admin', slug: 'super_admin', level: 100 }],
        permissions: [{ id: 'manage_all', action: 'manage', resource: 'all' }],
        can: (action: PermissionAction, resource: PermissionResource) => true,
        hasRole: (role: RoleSlug) => true,
      };
      setUser(mockUser);
      setLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .throwOnError();

      // Get user roles
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role_id, roles(*)')
        .eq('user_id', session.user.id)
        .throwOnError();

      // Get permissions for all user roles
      const roleIds = userRoles?.map(ur => ur.role_id) || [];
      const { data: rolePermissions } = await supabase
        .from('role_permissions')
        .select('permission_id, permissions(*)')
        .in('role_id', roleIds)
        .throwOnError();

      const roles = userRoles?.map((ur: any) => ur.roles).filter(Boolean) || [];
      const permissions = rolePermissions?.map((rp: any) => rp.permissions).filter(Boolean) || [];

      const authUser: AuthUser = {
        id: session.user.id,
        email: session.user.email!,
        profile: profile as any,
        roles,
        permissions,
        can: (action: PermissionAction, resource: PermissionResource) => {
          const hasSpecific = permissions.some(
            (p: any) => p.resource === resource && p.action === action
          );
          const hasManage = permissions.some(
            (p: any) => p.resource === resource && p.action === 'manage'
          );
          const hasAll = permissions.some(
            (p: any) => p.resource === 'all' && (p.action === action || p.action === 'manage')
          );
          return hasSpecific || hasManage || hasAll;
        },
        hasRole: (role: RoleSlug) => {
          return roles.some((r: any) => r.slug === role);
        },
      };

      setUser(authUser);
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial auth check
  useEffect(() => {
    fetchUser();

    const isAuthDisabled = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                           process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://mock-supabase-url.supabase.co' ||
                           process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

    if (isAuthDisabled) {
      return;
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          fetchUser();
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUser]);

  // Sign in with email and password
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // fetchUser will be called by the auth state change listener
  }, []);

  // Sign up with email and password
  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      throw error;
    }

    // Create profile entry
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email!,
        full_name: fullName,
      });
    }
  }, []);

  // Sign in with OAuth provider
  const signInWithOAuth = useCallback(async (provider: 'google' | 'github') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw error;
    }
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  // Refresh user data
  const refresh = useCallback(() => {
    setLoading(true);
    return fetchUser();
  }, [fetchUser]);

  const value: AuthContextValue = {
    user,
    loading,
    signIn,
    signUp,
    signInWithOAuth,
    signOut,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// Hook to require authentication (redirects to login if not authenticated)
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.push('/login');
    }
  }, [auth.loading, auth.user, router]);

  return auth;
}

// Helper for checking permissions in components
export function useCan(action: PermissionAction, resource: PermissionResource): boolean {
  const { user } = useAuth();
  return user?.can(action, resource) ?? false;
}

// Helper for checking roles in components
export function useHasRole(role: RoleSlug): boolean {
  const { user } = useAuth();
  return user?.hasRole(role) ?? false;
}

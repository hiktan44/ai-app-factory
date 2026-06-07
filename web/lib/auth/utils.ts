// @ts-nocheck - Supabase type inference issues with generated types
// ============================================================
// Auth Utilities
// ============================================================
//
// Helper functions for authentication, user management,
// role checking, and permission verification.
// ------------------------------------------------------------

import { supabase } from '../supabase/client';
import type { 
  AuthUser, 
  UserProfile, 
  Role, 
  Permission,
  PermissionAction,
  PermissionResource,
  RoleSlug
} from './types';

// ------------------------------------------------------------
// Get current user with roles and permissions
// ------------------------------------------------------------

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.user) {
    return null;
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  // Get user roles
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id, roles(*)')
    .eq('user_id', session.user.id);

  // Get permissions for all user roles
  const roleIds = userRoles?.map(ur => ur.role_id) || [];
  const { data: rolePermissions } = await supabase
    .from('role_permissions')
    .select('permission_id, permissions(*)')
    .in('role_id', roleIds);

  const roles = userRoles?.map(ur => ur.roles as Role).filter(Boolean) || [];
  const permissions = rolePermissions?.map(rp => rp.permissions as Permission).filter(Boolean) || [];

  return {
    id: session.user.id,
    email: session.user.email!,
    profile: profile as UserProfile,
    roles,
    permissions,
    can: (action: PermissionAction, resource: PermissionResource) => 
      checkPermission(permissions, action, resource),
    hasRole: (role: RoleSlug) => 
      roles.some(r => r.slug === role),
  };
}

// ------------------------------------------------------------
// Permission checking
// ------------------------------------------------------------

export function checkPermission(
  permissions: Permission[],
  action: PermissionAction,
  resource: PermissionResource
): boolean {
  // Check for specific permission
  const hasSpecific = permissions.some(
    p => p.resource === resource && p.action === action
  );

  // Check for 'manage' permission (grants all actions)
  const hasManage = permissions.some(
    p => p.resource === resource && p.action === 'manage'
  );

  // Check for 'all' resource permission
  const hasAll = permissions.some(
    p => p.resource === 'all' && (p.action === action || p.action === 'manage')
  );

  return hasSpecific || hasManage || hasAll;
}

// ------------------------------------------------------------
// Role checking
// ------------------------------------------------------------

export function hasRole(user: AuthUser | null, role: RoleSlug): boolean {
  return user?.roles.some(r => r.slug === role) ?? false;
}

export function hasAnyRole(user: AuthUser | null, roles: RoleSlug[]): boolean {
  if (!user) return false;
  return roles.some(role => hasRole(user, role));
}

export function hasAllRoles(user: AuthUser | null, roles: RoleSlug[]): boolean {
  if (!user) return false;
  return roles.every(role => hasRole(user, role));
}

// ------------------------------------------------------------
// Get highest role level (for UI display)
// ------------------------------------------------------------

export function getHighestRole(user: AuthUser | null): Role | null {
  if (!user || user.roles.length === 0) return null;
  
  return user.roles.reduce((highest, current) => 
    current.level > highest.level ? current : highest
  );
}

// ------------------------------------------------------------
// Check if user is super admin
// ------------------------------------------------------------

export function isSuperAdmin(user: AuthUser | null): boolean {
  return hasRole(user, 'super_admin');
}

// ------------------------------------------------------------
// Auth helpers for API routes
// ------------------------------------------------------------

export async function requireAuth(request: Request): Promise<AuthUser> {
  // This would be called from API routes to verify authentication
  // Implementation depends on how we handle server-side auth
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    throw new Error('Unauthorized: No authorization header');
  }

  // Extract token and verify with Supabase
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error('Unauthorized: Invalid token');
  }

  // Return full user with roles and permissions
  const fullUser = await getCurrentUser();
  
  if (!fullUser) {
    throw new Error('Unauthorized: User not found');
  }

  return fullUser;
}

export async function requireSuperAdmin(request: Request): Promise<AuthUser> {
  const user = await requireAuth(request);
  
  if (!isSuperAdmin(user)) {
    throw new Error('Forbidden: Super admin required');
  }

  return user;
}

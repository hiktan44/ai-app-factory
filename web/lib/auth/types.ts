import type { NextRequest } from 'next/server';

// ============================================================
// Auth System - Type Definitions
// ============================================================

// ------------------------------------------------------------
// Role Types
// ------------------------------------------------------------

export type RoleSlug = 'super_admin' | 'admin' | 'editor' | 'viewer';

export interface Role {
  id: string;
  name: string;
  slug: RoleSlug;
  description: string;
  level: number; // Higher = more permissions (super_admin: 100, admin: 50, etc.)
  is_system: boolean; // Cannot be deleted if true
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// Permission Types
// ------------------------------------------------------------

export type PermissionResource = 
  | 'runs'
  | 'ideas'
  | 'prompts'
  | 'settings'
  | 'users'
  | 'roles'
  | 'learnings'
  | 'all';

export type PermissionAction = 
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'manage'; // create + read + update + delete

export interface Permission {
  id: string;
  name: string;
  resource: PermissionResource;
  action: PermissionAction;
  description: string;
  created_at: string;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
  granted_at: string;
}

// ------------------------------------------------------------
// User Types
// ------------------------------------------------------------

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string;
}

export interface UserRole {
  user_id: string;
  role_id: string;
  granted_by: string; // User ID who granted this role
  granted_at: string;
  expires_at?: string;
}

export interface UserWithRoles extends UserProfile {
  roles: Role[];
  permissions: Permission[];
}

// ------------------------------------------------------------
// Auth Context Types
// ------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  profile: UserProfile;
  roles: Role[];
  permissions: Permission[];
  can: (action: PermissionAction, resource: PermissionResource) => boolean;
  hasRole: (role: RoleSlug) => boolean;
}

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

// ------------------------------------------------------------
// Middleware Types
// ------------------------------------------------------------

export interface AuthMiddlewareRequest extends NextRequest {
  user: AuthUser;
}

export interface RouteProtection {
  requireAuth: boolean;
  requiredRoles?: RoleSlug[];
  requiredPermissions?: { action: PermissionAction; resource: PermissionResource }[];
}

// ------------------------------------------------------------
// API Response Types
// ------------------------------------------------------------

export interface AuthError {
  code: string;
  message: string;
  details?: unknown;
}

export interface UserListResponse {
  users: UserWithRoles[];
  total: number;
  page: number;
  per_page: number;
}

export interface RoleListResponse {
  roles: Role[];
  total: number;
}

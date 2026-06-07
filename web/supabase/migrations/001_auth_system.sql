-- ============================================================
-- AI App Factory - Auth System Database Schema
-- ============================================================
-- 
-- Run this in your Supabase SQL Editor to set up the auth system.
-- This creates tables for profiles, roles, permissions, and their relationships.
-- ------------------------------------------------------------

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES TABLE
-- Stores user profile data (linked to auth.users)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profile policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. ROLES TABLE
-- Defines available roles in the system
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Insert default roles
INSERT INTO public.roles (name, slug, description, level, is_system) VALUES
  ('Super Admin', 'super_admin', 'Full system access including user management', 100, true),
  ('Admin', 'admin', 'Administrative access with limited user management', 50, true),
  ('Editor', 'editor', 'Can create and edit content', 25, true),
  ('Viewer', 'viewer', 'Read-only access', 10, true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 3. PERMISSIONS TABLE
-- Defines granular permissions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default permissions
INSERT INTO public.permissions (name, resource, action, description) VALUES
  ('Create Runs', 'runs', 'create', 'Create new pipeline runs'),
  ('View Runs', 'runs', 'read', 'View pipeline runs'),
  ('Edit Runs', 'runs', 'update', 'Edit pipeline runs'),
  ('Delete Runs', 'runs', 'delete', 'Delete pipeline runs'),
  ('Execute Runs', 'runs', 'execute', 'Execute pipeline runs'),
  ('Manage Runs', 'runs', 'manage', 'Full control over runs'),
  
  ('Create Ideas', 'ideas', 'create', 'Create new ideas'),
  ('View Ideas', 'ideas', 'read', 'View ideas'),
  ('Edit Ideas', 'ideas', 'update', 'Edit ideas'),
  ('Delete Ideas', 'ideas', 'delete', 'Delete ideas'),
  ('Manage Ideas', 'ideas', 'manage', 'Full control over ideas'),
  
  ('View Prompts', 'prompts', 'read', 'View prompts'),
  ('Edit Prompts', 'prompts', 'update', 'Edit prompts'),
  ('Manage Prompts', 'prompts', 'manage', 'Full control over prompts'),
  
  ('View Settings', 'settings', 'read', 'View settings'),
  ('Edit Settings', 'settings', 'update', 'Edit settings'),
  ('Manage Settings', 'settings', 'manage', 'Full control over settings'),
  
  ('View Users', 'users', 'read', 'View users'),
  ('Create Users', 'users', 'create', 'Create new users'),
  ('Edit Users', 'users', 'update', 'Edit users'),
  ('Delete Users', 'users', 'delete', 'Delete users'),
  ('Manage Users', 'users', 'manage', 'Full control over users'),
  
  ('View Roles', 'roles', 'read', 'View roles'),
  ('Edit Roles', 'roles', 'update', 'Edit roles'),
  ('Manage Roles', 'roles', 'manage', 'Full control over roles'),
  
  ('View Learnings', 'learnings', 'read', 'View learnings'),
  ('Edit Learnings', 'learnings', 'update', 'Edit learnings'),
  ('Manage Learnings', 'learnings', 'manage', 'Full control over learnings'),
  
  ('All Access', 'all', 'manage', 'Full system access')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. ROLE_PERMISSIONS TABLE
-- Maps permissions to roles
-- ============================================================

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Grant default permissions

-- Super Admin: All
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.slug = 'super_admin'
ON CONFLICT DO NOTHING;

-- Admin: All except manage roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.slug = 'admin' 
  AND p.action != 'manage' 
  AND (p.resource != 'roles' OR p.action = 'read')
  AND p.resource != 'all'
ON CONFLICT DO NOTHING;

-- Editor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.slug = 'editor'
  AND (
    (p.resource IN ('runs', 'ideas') AND p.action IN ('create', 'read', 'update'))
    OR (p.resource = 'prompts' AND p.action = 'read')
  )
ON CONFLICT DO NOTHING;

-- Viewer
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.slug = 'viewer' AND p.action = 'read'
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. USER_ROLES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, role_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. FUNCTIONS & TRIGGERS
-- ============================================================

-- Create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  
  INSERT INTO public.user_roles (user_id, role_id, granted_by)
  SELECT NEW.id, id, NEW.id
  FROM public.roles
  WHERE slug = 'viewer';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 7. VIEWS
-- ============================================================

CREATE OR REPLACE VIEW public.users_with_roles AS
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.avatar_url,
  p.created_at,
  p.updated_at,
  p.last_sign_in_at,
  COALESCE(
    json_agg(
      json_build_object(
        'id', r.id,
        'name', r.name,
        'slug', r.slug,
        'level', r.level
      ) ORDER BY r.level DESC
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) as roles
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
LEFT JOIN public.roles r ON ur.role_id = r.id
GROUP BY p.id;

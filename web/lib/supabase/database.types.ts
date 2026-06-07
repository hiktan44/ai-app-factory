// ============================================================
// Supabase Database Types
// ============================================================
// 
// This file defines the TypeScript types for the Supabase database schema.
// Update these types when you modify your Supabase schema.
//
// To regenerate from your Supabase project:
// npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/database.types.ts
// ------------------------------------------------------------

export type Json = string | number | boolean | null | { [key: string]: Json | Json[] } | Json[];

export interface Database {
  public: {
    Tables: {
      // ----------------------------------------------------------
      // Custom tables (you'll create these in Supabase SQL editor)
      // ----------------------------------------------------------
      
      profiles: {
        Row: {
          id: string; // References auth.users.id
          email: string;
          full_name?: string;
          avatar_url?: string;
          created_at: string;
          updated_at: string;
          last_sign_in_at?: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          avatar_url?: string;
          created_at?: string;
          updated_at?: string;
          last_sign_in_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string;
          updated_at?: string;
          last_sign_in_at?: string;
        };
      };

      roles: {
        Row: {
          id: string;
          name: string;
          slug: 'super_admin' | 'admin' | 'editor' | 'viewer';
          description: string;
          level: number;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: 'super_admin' | 'admin' | 'editor' | 'viewer';
          description: string;
          level: number;
          is_system?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: 'super_admin' | 'admin' | 'editor' | 'viewer';
          description?: string;
          level?: number;
          is_system?: boolean;
          updated_at?: string;
        };
      };

      permissions: {
        Row: {
          id: string;
          name: string;
          resource: 'runs' | 'ideas' | 'prompts' | 'settings' | 'users' | 'roles' | 'learnings' | 'all';
          action: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'manage';
          description: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          resource: 'runs' | 'ideas' | 'prompts' | 'settings' | 'users' | 'roles' | 'learnings' | 'all';
          action: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'manage';
          description: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          resource?: 'runs' | 'ideas' | 'prompts' | 'settings' | 'users' | 'roles' | 'learnings' | 'all';
          action?: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'manage';
          description?: string;
        };
      };

      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
          granted_at: string;
        };
        Insert: {
          role_id: string;
          permission_id: string;
          granted_at?: string;
        };
        Update: {
          role_id?: string;
          permission_id?: string;
        };
      };

      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          granted_by: string;
          granted_at: string;
          expires_at?: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
          granted_by: string;
          granted_at?: string;
          expires_at?: string;
        };
        Update: {
          role_id?: string;
          expires_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

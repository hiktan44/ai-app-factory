// @ts-nocheck - Supabase type inference issues with generated types
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// GET /api/users/[id] - Get user details
// ============================================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to view users
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_id, roles(slug)')
      .eq('user_id', user.id);

    const isAdmin = userRoles?.some((ur: any) => 
      ['admin', 'super_admin'].includes(ur.roles?.slug)
    );

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin required' }, { status: 403 });
    }

    // Get user details
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        avatar_url,
        created_at,
        updated_at,
        last_sign_in_at,
        user_roles(role_id, granted_by, granted_at, expires_at, roles(id, name, slug, level))
      `)
      .eq('id', id)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...(profile as any),
      roles: (profile as any).user_roles?.map((ur: any) => ({
        ...ur.roles,
        granted_at: ur.granted_at,
        granted_by: ur.granted_by,
        expires_at: ur.expires_at,
      })) || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// PATCH /api/users/[id] - Update user or assign role
// ============================================================
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_id, roles(slug)')
      .eq('user_id', user.id);

    const isAdmin = userRoles?.some((ur: any) => 
      ['admin', 'super_admin'].includes(ur.roles?.slug)
    );

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin required' }, { status: 403 });
    }

    const body = await request.json();
    const { full_name, avatar_url, role_id, action } = body;

    // Handle role assignment/removal
    if (action === 'assign_role' && role_id) {
      // Super admin required for role assignment
      const isSuperAdmin = userRoles?.some((ur: any) => ur.roles?.slug === 'super_admin');
      if (!isSuperAdmin) {
        return NextResponse.json({ error: 'Forbidden: Super Admin required' }, { status: 403 });
      }

      // Remove existing roles
      await supabase.from('user_roles').delete().eq('user_id', id);

      // Assign new role
      const { error } = await supabase.from('user_roles').insert({
        user_id: id,
        role_id,
        granted_by: user.id,
      } as any);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    // Handle profile update
    const updateData: any = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    if (Object.keys(updateData).length > 0) {
      const { error } = await (supabase
        .from('profiles')
        .update(updateData) as any)
        .eq('id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/users/[id] - Delete user
// ============================================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_id, roles(slug)')
      .eq('user_id', user.id);

    const isSuperAdmin = userRoles?.some((ur: any) => ur.roles?.slug === 'super_admin');

    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden: Super Admin required' }, { status: 403 });
    }

    // Cannot delete yourself
    if (id === user.id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    // Delete user (this will cascade to profile and user_roles)
    const { error } = await supabase.auth.admin.deleteUser(id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

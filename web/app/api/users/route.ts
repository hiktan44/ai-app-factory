// @ts-nocheck - Supabase type inference issues with generated types
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// GET /api/users - List all users (Super Admin only)
// ============================================================
export async function GET(request: NextRequest) {
  try {
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

    // Get all users with roles
    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        avatar_url,
        created_at,
        updated_at,
        last_sign_in_at,
        user_roles(role_id, roles(id, name, slug, level))
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      users: users?.map((u: any) => ({
        ...u,
        roles: u.user_roles?.map((ur: any) => ur.roles).filter(Boolean) || [],
      })) || [],
      total: users?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// POST /api/users - Create new user (Super Admin only)
// ============================================================
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { email, password, full_name, role_slug = 'viewer' } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Create user via Supabase Admin (using service role would be better, but staying with client for now)
    const { data: newUser, error: createError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name },
      },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    if (!newUser.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Assign role
    const { data: role } = await supabase
      .from('roles')
      .select('id')
      .eq('slug', role_slug)
      .single();

    if (role) {
      await supabase.from('user_roles').insert({
        user_id: newUser.user.id,
        role_id: role.id,
        granted_by: user.id,
      });
    }

    return NextResponse.json({
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        full_name,
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

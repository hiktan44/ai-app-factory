import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// GET /api/roles - List all roles
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to view roles
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

    // Get all roles with permissions
    const { data: roles, error } = await supabase
      .from('roles')
      .select(`
        id,
        name,
        slug,
        description,
        level,
        is_system,
        created_at,
        updated_at,
        role_permissions(
          permission_id,
          permissions(id, name, resource, action, description)
        )
      `)
      .order('level', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      roles: roles?.map((r: any) => ({
        ...r,
        permissions: r.role_permissions?.map((rp: any) => rp.permissions).filter(Boolean) || [],
      })) || [],
      total: roles?.length || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ============================================================
// POST /api/roles - Create new role (Super Admin only)
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
    const { name, slug, description, level, permission_ids } = body;

    if (!name || !slug || !level) {
      return NextResponse.json({ error: 'Name, slug, and level required' }, { status: 400 });
    }

    // Create role
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .insert({ name, slug, description, level } as any)
      .select()
      .single();

    if (roleError) {
      return NextResponse.json({ error: roleError.message }, { status: 400 });
    }

    // Assign permissions
    if (permission_ids && permission_ids.length > 0 && (role as any)?.id) {
      const permissions = permission_ids.map((permission_id: string) => ({
        role_id: (role as any).id,
        permission_id,
      }));

      const { error: permError } = await supabase
        .from('role_permissions')
        .insert(permissions);

      if (permError) {
        // Rollback role creation
        await supabase.from('roles').delete().eq('id', (role as any).id);
        return NextResponse.json({ error: permError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ role }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

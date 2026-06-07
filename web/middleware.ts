import { createMiddlewareClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================================
// Route Protection Configuration
// ============================================================
// Define which routes require authentication and/or specific roles

interface RouteRule {
  requireAuth: boolean;
  roles?: string[]; // Required roles
  permissions?: { action: string; resource: string }[]; // Required permissions
}

const routeRules: Record<string, RouteRule> = {
  // Public routes
  '/login': { requireAuth: false },
  '/signup': { requireAuth: false },
  '/api/health': { requireAuth: false },
  '/auth/callback': { requireAuth: false },

  // Protected routes (require auth)
  '/': { requireAuth: true },
  '/runs': { requireAuth: true },
  '/ideas': { requireAuth: true },
  '/prompts': { requireAuth: true },
  '/new': { requireAuth: true },

  // Admin-only routes
  '/settings': { requireAuth: true, roles: ['admin', 'super_admin'] },
  '/api/settings': { requireAuth: true, roles: ['admin', 'super_admin'] },
  '/api/learnings': { requireAuth: true, roles: ['editor', 'admin', 'super_admin'] },
};

// ============================================================
// Helper Functions
// ============================================================

function getRouteRule(pathname: string): RouteRule {
  // Check for exact match
  if (routeRules[pathname]) {
    return routeRules[pathname];
  }

  // Check for prefix matches (e.g., /runs/123)
  for (const [route, rule] of Object.entries(routeRules)) {
    if (pathname.startsWith(route + '/')) {
      return rule;
    }
  }

  // Check for API routes
  if (pathname.startsWith('/api/')) {
    const apiPath = pathname.slice(5); // Remove '/api/'
    const parts = apiPath.split('/');
    
    // /api/settings requires admin
    if (parts[0] === 'settings') {
      return { requireAuth: true, roles: ['admin', 'super_admin'] };
    }
    
    // /api/users and /api/roles require super_admin
    if (parts[0] === 'users' || parts[0] === 'roles') {
      return { requireAuth: true, roles: ['super_admin'] };
    }
    
    // /api/learnings requires editor+
    if (parts[0] === 'learnings') {
      return { requireAuth: true, roles: ['editor', 'admin', 'super_admin'] };
    }
    
    // Other API routes require auth
    return { requireAuth: true };
  }

  // Default: require auth
  return { requireAuth: true };
}

async function getUserPermissions(supabase: any, userId: string) {
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role_id, roles(slug)')
    .eq('user_id', userId);

  const { data: rolePermissions } = await supabase
    .from('role_permissions')
    .select('permission_id, permissions(action, resource)')
    .in(
      'role_id',
      userRoles?.map((ur: any) => ur.role_id) || []
    );

  return {
    roles: userRoles?.map((ur: any) => ur.roles?.slug).filter(Boolean) || [],
    permissions: rolePermissions?.map((rp: any) => rp.permissions).filter(Boolean) || [],
  };
}

function hasPermission(
  permissions: any[],
  required: { action: string; resource: string }
): boolean {
  return permissions.some(
    (p) =>
      (p.resource === required.resource || p.resource === 'all') &&
      (p.action === required.action || p.action === 'manage')
  );
}

async function handleUnauthenticated(
  request: NextRequest,
  isApi: boolean
): Promise<NextResponse> {
  if (isApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

async function handleForbidden(
  request: NextRequest,
  isApi: boolean
): Promise<NextResponse> {
  if (isApi) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.redirect(new URL('/?forbidden=true', request.url));
}

// ============================================================
// Middleware
// ============================================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/');
  
  // Auth devre dışı bırakılmışsa (mock url, boş url veya explicit flag) tüm istekleri doğrudan geçir
  const isAuthDisabled = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                         process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://mock-supabase-url.supabase.co' ||
                         process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  if (isAuthDisabled) {
    return NextResponse.next();
  }

  // Get route rule
  const rule = getRouteRule(pathname);

  // Public route - let it through
  if (!rule.requireAuth) {
    return NextResponse.next();
  }

  // Create Supabase client
  const supabase = createMiddlewareClient(request);

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // No session - redirect to login
  if (!session) {
    return handleUnauthenticated(request, isApi);
  }

  // Check role requirements
  if (rule.roles && rule.roles.length > 0) {
    const { roles } = await getUserPermissions(supabase, session.user.id);
    const hasRequiredRole = rule.roles.some((role) => roles.includes(role));

    if (!hasRequiredRole) {
      return handleForbidden(request, isApi);
    }
  }

  // Check permission requirements
  if (rule.permissions && rule.permissions.length > 0) {
    const { permissions } = await getUserPermissions(supabase, session.user.id);
    const hasRequiredPermission = rule.permissions.every((required) =>
      hasPermission(permissions, required)
    );

    if (!hasRequiredPermission) {
      return handleForbidden(request, isApi);
    }
  }

  // All checks passed - let request through
  const response = NextResponse.next();

  // Add user info to headers for downstream use
  response.headers.set('x-user-id', session.user.id);
  response.headers.set('x-user-email', session.user.email || '');

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

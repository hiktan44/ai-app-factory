# AI App Factory - Auth System Setup Guide

## Overview

The AI App Factory now features a complete authentication and authorization system with:
- **Supabase Auth** for secure user authentication
- **Role-Based Access Control (RBAC)** for granular permissions
- **Multi-user support** with role management
- **OAuth providers** (Google, GitHub)
- **Admin panel** for user and role management

## Prerequisites

1. **Supabase Account**: Create a free account at [supabase.com](https://supabase.com)
2. **Supabase Project**: Create a new project in Supabase dashboard

## Setup Steps

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose your organization and region
4. Set a strong database password (save it!)
5. Wait for project provisioning (~2 minutes)

### 2. Configure Environment Variables

Copy your Supabase credentials from **Settings > API**:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Important**: Never commit `.env.local` to git. It's already in `.gitignore`.

### 3. Run Database Migration

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** (left sidebar)
3. Click "New Query"
4. Copy and paste the contents of `supabase/migrations/001_auth_system.sql`
5. Click "Run" to execute the migration

This creates:
- `profiles` table (user profiles)
- `roles` table (system roles)
- `permissions` table (granular permissions)
- `user_roles` table (role assignments)
- `role_permissions` table (permission mappings)
- Default roles and permissions
- Trigger for auto-creating profiles on signup

### 4. Configure OAuth Providers (Optional)

#### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Set:
   - **Application name**: AI App Factory
   - **Homepage URL**: `http://localhost:3000` (or your domain)
   - **Authorization callback URL**: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and generate Client Secret
5. In Supabase: **Authentication > Providers > GitHub**
6. Enable GitHub provider and paste the credentials

#### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new OAuth 2.0 client ID
3. Add authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
4. Copy Client ID and Client Secret
5. In Supabase: **Authentication > Providers > Google**
6. Enable Google provider and paste the credentials

### 5. Configure Email Templates (Optional)

1. In Supabase: **Authentication > Email Templates**
2. Customize the confirmation email template
3. Update the redirect URL to point to your app

### 6. Create First Super Admin

After running the migration:

1. Sign up a new user through the app (`/signup`)
2. This user will automatically get the "viewer" role
3. To make them super admin, run in Supabase SQL Editor:

```sql
-- Get the role_id for super_admin
SELECT id, slug FROM roles WHERE slug = 'super_admin';

-- Update the user's role (replace USER_ID and ROLE_ID)
UPDATE user_roles 
SET role_id = 'ROLE_ID_FROM_ABOVE'
WHERE user_id = 'USER_ID_FROM_AUTH_USERS';
```

Or use the Supabase dashboard:
1. Go to **Table Editor**
2. Open `user_roles` table
3. Find your user and update `role_id` to the super_admin role ID

## Role System

### Default Roles

| Role | Level | Description | Permissions |
|------|-------|-------------|-------------|
| **Super Admin** | 100 | Full system access | All permissions including user management |
| **Admin** | 50 | Administrative access | All except role management |
| **Editor** | 25 | Content creator | Create/edit runs and ideas |
| **Viewer** | 10 | Read-only access | View all content |

### Permission Resources

- `runs` - Pipeline runs
- `ideas` - Ideas and concepts
- `prompts` - System prompts
- `settings` - Application settings
- `users` - User management
- `roles` - Role management
- `learnings` - System learnings
- `all` - Super admin wildcard

### Permission Actions

- `create` - Create new items
- `read` - View items
- `update` - Edit items
- `delete` - Remove items
- `execute` - Run pipelines
- `manage` - Full control (create + read + update + delete)

## Admin Panel

Access the admin panel at `/admin` (requires super admin role):

Features:
- View all users
- Create new users
- Assign/change roles
- Delete users
- View roles and permissions

## API Endpoints

### Authentication

- `POST /api/auth/signup` - Register new user
- `POST /api/auth/signin` - Sign in with email/password
- `POST /api/auth/signout` - Sign out
- `GET /api/auth/callback` - OAuth callback

### User Management (Super Admin only)

- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `GET /api/users/[id]` - Get user details
- `PATCH /api/users/[id]` - Update user or assign role
- `DELETE /api/users/[id]` - Delete user

### Role Management (Admin+)

- `GET /api/roles` - List all roles with permissions
- `POST /api/roles` - Create new role (Super Admin only)

## Security Notes

1. **Service Role Key**: Never expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code
2. **RLS Policies**: Row Level Security is enabled on all tables
3. **Password Requirements**: Minimum 8 characters
4. **Session Management**: Sessions auto-refresh with Supabase
5. **HTTPS Required**: Always use HTTPS in production

## Troubleshooting

### "Unauthorized" errors

- Check your `.env.local` has correct Supabase credentials
- Verify user has appropriate role in `user_roles` table

### OAuth not working

- Verify redirect URLs match exactly (including http/https)
- Check provider credentials are correct
- Enable provider in Supabase dashboard

### Admin panel redirecting to home

- User is not super_admin
- Assign super_admin role using SQL instructions above

### Database migration errors

- Ensure you have proper permissions on Supabase
- Check for conflicting table names
- Contact Supabase support if issues persist

## Next Steps

1. Test sign up flow
2. Configure OAuth providers
3. Create additional roles if needed
4. Customize email templates
5. Set up production environment variables
6. Configure additional RLS policies if needed

## Support

For issues related to:
- **Supabase**: [Supabase Documentation](https://supabase.com/docs)
- **This Project**: Open an issue on GitHub

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  full_name?: string;
  created_at: string;
  last_sign_in_at?: string;
  roles: Array<{ id: string; name: string; slug: string; level: number }>;
}

interface Role {
  id: string;
  name: string;
  slug: string;
  description: string;
  level: number;
  is_system: boolean;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

  // New user form
  const [showNewUser, setShowNewUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('viewer');
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    // Check if user is super admin
    if (!loading && !user?.hasRole('super_admin')) {
      router.push('/');
      return;
    }

    if (user?.hasRole('super_admin')) {
      fetchUsers();
      fetchRoles();
    }
  }, [user, loading, router]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles');
      if (!res.ok) throw new Error('Failed to fetch roles');
      const data = await res.json();
      setRoles(data.roles || []);
    } catch (err: any) {
      console.error('Failed to fetch roles:', err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setError('');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          full_name: newUserName,
          role_slug: newUserRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create user');
      }

      setShowNewUser(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('viewer');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;

    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete user');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign_role', role_id: roleId }),
      });

      if (!res.ok) throw new Error('Failed to assign role');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-slate-400">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Yönetici Paneli</h1>
          <p className="text-slate-400">Kullanıcı ve rol yönetimi</p>
        </div>
        <button
          onClick={() => setShowNewUser(true)}
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white"
        >
          + Yeni Kullanıcı
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Kullanıcılar
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'roles'
              ? 'text-indigo-400 border-b-2 border-indigo-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Roller & İzinler
        </button>
      </div>

      {/* Users Table */}
      {activeTab === 'users' && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Kullanıcı
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Rol
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Son Giriş
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-400">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-900/30">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-white">
                        {u.full_name || '-'}
                      </div>
                      <div className="text-sm text-slate-400">{u.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.roles[0]?.slug || 'viewer'}
                      onChange={(e) => {
                        const role = roles.find(r => r.slug === e.target.value);
                        if (role) handleAssignRole(u.id, role.id);
                      }}
                      className="rounded-lg border border-slate-700 bg-slate-950/50 px-2 py-1 text-sm text-white"
                      disabled={u.id === user?.id}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.slug}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleDateString('tr-TR')
                      : 'Asla'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== user?.id && (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Sil
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Roles & Permissions */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          {roles.map((role) => (
            <div
              key={role.id}
              className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/30"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                <div>
                  <h3 className="font-semibold text-white">{role.name}</h3>
                  <p className="text-sm text-slate-400">{role.description}</p>
                </div>
                <span className="rounded-lg bg-slate-950/50 px-3 py-1 text-xs font-medium text-slate-400">
                  Level {role.level}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New User Modal */}
      {showNewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Yeni Kullanıcı</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Ad Soyam</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">E-posta</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Şifre</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-white"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Rol</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-white"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewUser(false)}
                  className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="flex-1 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {creatingUser ? 'Oluşturuluyor...' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

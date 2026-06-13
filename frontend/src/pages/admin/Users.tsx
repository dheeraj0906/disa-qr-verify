import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Modal from '../../components/Modal';
import { usersApi, workersApi } from '../../api';
import type { AuthUser, Worker } from '../../types';

const ROLES = ['super_admin', 'commissioner', 'verifier', 'field_worker'] as const;

const ROLE_PILL: Record<string, string> = {
  super_admin:  'bg-purple-100 text-purple-800',
  commissioner: 'bg-blue-100 text-blue-800',
  verifier:     'bg-teal-100 text-teal-800',
  field_worker: 'bg-gray-100 text-gray-700',
};

interface Form {
  name: string; email: string; password: string;
  role: string; zone: string; worker_id: string;
}

const BLANK: Form = { name: '', email: '', password: '', role: 'field_worker', zone: '', worker_id: '' };
function toForm(u: AuthUser): Form {
  return { name: u.name, email: u.email, password: '', role: u.role, zone: u.zone ?? '', worker_id: (u as AuthUser & { worker_id?: string }).worker_id ?? '' };
}

export default function AdminUsersPage() {
  const [items, setItems]     = useState<AuthUser[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState<Form>(BLANK);
  const [editId, setEditId]   = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  function load() {
    setLoading(true);
    Promise.all([usersApi.list(), workersApi.list()])
      .then(([u, w]) => { setItems(u.data); setWorkers(w.data); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openCreate() { setForm(BLANK); setEditId(null); setErr(''); setOpen(true); }
  function openEdit(u: AuthUser) { setForm(toForm(u)); setEditId(u.id); setErr(''); setOpen(true); }

  async function handleSave() {
    setSaving(true); setErr('');
    try {
      const payload: Record<string, unknown> = {
        name:      form.name,
        email:     form.email,
        role:      form.role,
        zone:      form.zone  || undefined,
        worker_id: form.worker_id || null,
      };
      if (form.password) payload.password = form.password;
      if (!editId && !form.password) { setErr('Password is required for new users.'); setSaving(false); return; }
      if (editId) await usersApi.update(editId, payload);
      else        await usersApi.create(payload);
      setOpen(false); load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '';
      setErr(msg.includes('unique') ? 'Email already in use.' : 'Save failed.');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await usersApi.remove(deleteId).catch(() => {});
    setDeleteId(null); load();
  }

  const f = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Users</h1>
            <p className="text-xs text-gray-400">{items.length} total · passwords stored hashed</p>
          </div>
          <button onClick={openCreate} className={btnPrimary}>+ Add User</button>
        </div>

        {loading ? <Spinner /> : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Zone</Th><Th>Worker Link</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <Td className="font-medium text-gray-900">{u.name}</Td>
                    <Td className="text-gray-500">{u.email}</Td>
                    <Td>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_PILL[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </Td>
                    <Td>{u.zone ?? <span className="text-gray-300">—</span>}</Td>
                    <Td>
                      {(u as AuthUser & { worker_id?: string }).worker_id
                        ? <span className="text-xs text-green-600">✓ Linked</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </Td>
                    <Td>
                      <div className="flex gap-3">
                        <button onClick={() => openEdit(u)} className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => setDeleteId(u.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <Empty text="No users yet." />}
          </div>
        )}
      </div>

      {open && (
        <Modal title={editId ? 'Edit User' : 'Add User'} onClose={() => setOpen(false)} size="md">
          <div className="space-y-4">
            <div className="flex gap-3">
              <Field label="Name *">
                <input value={form.name} onChange={f('name')} className={inp} placeholder="Full name" />
              </Field>
              <Field label="Email *">
                <input value={form.email} onChange={f('email')} type="email" className={inp} placeholder="user@disa.gov" />
              </Field>
            </div>
            <Field label={editId ? 'New Password (leave blank to keep)' : 'Password *'}>
              <input value={form.password} onChange={f('password')} type="password" className={inp} placeholder="Min. 6 characters" />
            </Field>
            <div className="flex gap-3">
              <Field label="Role *">
                <select value={form.role} onChange={f('role')} className={inp}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </Field>
              <Field label="Zone">
                <input value={form.zone} onChange={f('zone')} className={inp} placeholder="Zone A / North / …" />
              </Field>
            </div>
            <Field label="Link to Worker (for field workers)">
              <select value={form.worker_id} onChange={f('worker_id')} className={inp}>
                <option value="">— None —</option>
                {workers.map((w) => <option key={w.id} value={w.id}>{w.name}{w.stretch_name ? ` (${w.stretch_name})` : ''}</option>)}
              </select>
            </Field>
            {err && <p className="text-red-600 text-xs">{err}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setOpen(false)} className={btnSecondary}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.email} className={btnPrimary}>
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete User?" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-600 mb-5">This will permanently delete the user account.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteId(null)} className={btnSecondary}>Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Delete</button>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
const btnPrimary   = 'px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition';
const btnSecondary = 'px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition';
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm text-gray-700 ${className}`}>{children}</td>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex-1"><label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>{children}</div>;
}
function Spinner() {
  return <div className="flex justify-center py-16"><div className="h-7 w-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
}
function Empty({ text }: { text: string }) {
  return <div className="text-center text-gray-400 text-sm py-12">{text}</div>;
}

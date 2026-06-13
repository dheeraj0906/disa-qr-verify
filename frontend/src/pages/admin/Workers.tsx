import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Modal from '../../components/Modal';
import { workersApi, stretchesApi } from '../../api';
import type { Worker, Stretch } from '../../types';

const ROLES = ['field_worker', 'verifier', 'commissioner', 'super_admin'] as const;

interface Form {
  name: string; phone: string; assigned_stretch_id: string; role: string; status: string;
}

const BLANK: Form = { name: '', phone: '', assigned_stretch_id: '', role: 'field_worker', status: 'active' };
function toForm(w: Worker): Form {
  return { name: w.name, phone: w.phone ?? '', assigned_stretch_id: w.assigned_stretch_id ?? '', role: w.role, status: w.status };
}

const STATUS_PILL: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
};

export default function AdminWorkersPage() {
  const [items, setItems]     = useState<Worker[]>([]);
  const [stretches, setStretches] = useState<Stretch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState<Form>(BLANK);
  const [editId, setEditId]   = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  function load() {
    setLoading(true);
    Promise.all([workersApi.list(), stretchesApi.list()])
      .then(([w, s]) => { setItems(w.data); setStretches(s.data); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openCreate() { setForm(BLANK); setEditId(null); setErr(''); setOpen(true); }
  function openEdit(w: Worker) { setForm(toForm(w)); setEditId(w.id); setErr(''); setOpen(true); }

  async function handleSave() {
    setSaving(true); setErr('');
    try {
      const payload = {
        name:                form.name,
        phone:               form.phone || undefined,
        assigned_stretch_id: form.assigned_stretch_id || null,
        role:                form.role,
        status:              form.status,
      };
      if (editId) await workersApi.update(editId, payload);
      else        await workersApi.create(payload);
      setOpen(false); load();
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed.');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await workersApi.remove(deleteId).catch(() => {});
    setDeleteId(null); load();
  }

  const f = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Workers</h1>
            <p className="text-xs text-gray-400">{items.length} total · QR badges auto-generated on create</p>
          </div>
          <button onClick={openCreate} className={btnPrimary}>+ Add Worker</button>
        </div>

        {loading ? <Spinner /> : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <Th>Name</Th><Th>Phone</Th><Th>Stretch</Th><Th>Role</Th><Th>Status</Th><Th>QR</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50">
                    <Td className="font-medium text-gray-900">{w.name}</Td>
                    <Td>{w.phone ?? <span className="text-gray-300">—</span>}</Td>
                    <Td>{w.stretch_name ?? <span className="text-gray-300">Unassigned</span>}</Td>
                    <Td><span className="text-xs text-gray-500">{w.role.replace('_', ' ')}</span></Td>
                    <Td>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[w.status] ?? 'bg-gray-100'}`}>
                        {w.status}
                      </span>
                    </Td>
                    <Td>
                      {w.qr_badge_code
                        ? <a href={workersApi.qrUrl(w.id)} download target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">⬇ PNG</a>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </Td>
                    <Td>
                      <div className="flex gap-3">
                        <button onClick={() => openEdit(w)} className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => setDeleteId(w.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <Empty text="No workers yet." />}
          </div>
        )}
      </div>

      {open && (
        <Modal title={editId ? 'Edit Worker' : 'Add Worker'} onClose={() => setOpen(false)} size="md">
          <div className="space-y-4">
            <div className="flex gap-3">
              <Field label="Name *">
                <input value={form.name} onChange={f('name')} className={inp} placeholder="Worker name" />
              </Field>
              <Field label="Phone">
                <input value={form.phone} onChange={f('phone')} className={inp} placeholder="+91 XXXXX XXXXX" />
              </Field>
            </div>
            <Field label="Assigned Stretch">
              <select value={form.assigned_stretch_id} onChange={f('assigned_stretch_id')} className={inp}>
                <option value="">— Unassigned —</option>
                {stretches.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <div className="flex gap-3">
              <Field label="Role">
                <select value={form.role} onChange={f('role')} className={inp}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={f('status')} className={inp}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            </div>
            {err && <p className="text-red-600 text-xs">{err}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setOpen(false)} className={btnSecondary}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name} className={btnPrimary}>
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete Worker?" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-600 mb-5">This will also remove their task logs and attendance records.</p>
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

import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Modal from '../../components/Modal';
import { vehiclesApi, stretchesApi } from '../../api';
import type { Vehicle, Stretch } from '../../types';

interface Form {
  registration_number: string; driver_name: string;
  stretch_id: string; status: string;
}

const BLANK: Form = { registration_number: '', driver_name: '', stretch_id: '', status: 'active' };

function toForm(v: Vehicle): Form {
  return { registration_number: v.registration_number, driver_name: v.driver_name ?? '', stretch_id: v.stretch_id ?? '', status: v.status };
}

const STATUS_PILL: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
};

export default function AdminVehiclesPage() {
  const [items, setItems]     = useState<Vehicle[]>([]);
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
    Promise.all([vehiclesApi.list(), stretchesApi.list()])
      .then(([v, s]) => { setItems(v.data); setStretches(s.data); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openCreate() { setForm(BLANK); setEditId(null); setErr(''); setOpen(true); }
  function openEdit(v: Vehicle) { setForm(toForm(v)); setEditId(v.id); setErr(''); setOpen(true); }

  async function handleSave() {
    setSaving(true); setErr('');
    try {
      const payload = {
        registration_number: form.registration_number,
        driver_name:   form.driver_name || undefined,
        stretch_id:    form.stretch_id   || null,
        status:        form.status,
      };
      if (editId) await vehiclesApi.update(editId, payload);
      else        await vehiclesApi.create(payload);
      setOpen(false); load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '';
      setErr(msg.includes('unique') ? 'A vehicle is already assigned to that stretch.' : 'Save failed.');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await vehiclesApi.remove(deleteId).catch(() => {});
    setDeleteId(null); load();
  }

  const f = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Vehicles</h1>
            <p className="text-xs text-gray-400">{items.length} total · 1:1 stretch assignment</p>
          </div>
          <button onClick={openCreate} className={btnPrimary}>+ Add Vehicle</button>
        </div>

        {loading ? <Spinner /> : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <Th>Registration</Th><Th>Driver</Th><Th>Assigned Stretch</Th><Th>Status</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <Td className="font-mono font-semibold text-gray-900">{v.registration_number}</Td>
                    <Td>{v.driver_name ?? <span className="text-gray-300">—</span>}</Td>
                    <Td>{v.stretch_name ?? <span className="text-gray-300">Unassigned</span>}</Td>
                    <Td>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_PILL[v.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {v.status}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex gap-3">
                        <button onClick={() => openEdit(v)} className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => setDeleteId(v.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <Empty text="No vehicles yet." />}
          </div>
        )}
      </div>

      {open && (
        <Modal title={editId ? 'Edit Vehicle' : 'Add Vehicle'} onClose={() => setOpen(false)} size="md">
          <div className="space-y-4">
            <Field label="Registration Number *">
              <input value={form.registration_number} onChange={f('registration_number')} className={inp} placeholder="TS 24 BA 6647" />
            </Field>
            <Field label="Driver Name">
              <input value={form.driver_name} onChange={f('driver_name')} className={inp} placeholder="Driver name" />
            </Field>
            <Field label="Assigned Stretch">
              <select value={form.stretch_id} onChange={f('stretch_id')} className={inp}>
                <option value="">— Unassigned —</option>
                {stretches.map((s) => <option key={s.id} value={s.id}>{s.name}{s.road_name ? ` (${s.road_name})` : ''}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={f('status')} className={inp}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            {err && <p className="text-red-600 text-xs">{err}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setOpen(false)} className={btnSecondary}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.registration_number} className={btnPrimary}>
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete Vehicle?" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-600 mb-5">This cannot be undone.</p>
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
  return <div><label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>{children}</div>;
}
function Spinner() {
  return <div className="flex justify-center py-16"><div className="h-7 w-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
}
function Empty({ text }: { text: string }) {
  return <div className="text-center text-gray-400 text-sm py-12">{text}</div>;
}

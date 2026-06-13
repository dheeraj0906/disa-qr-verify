import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import { stretchesApi } from '../../api';
import type { Stretch, StretchStatus } from '../../types';

const COLORS = ['green', 'yellow', 'red', 'orange'] as const;

const COLOR_DOT: Record<string, string> = {
  green: 'bg-green-500', yellow: 'bg-yellow-400', red: 'bg-red-500', orange: 'bg-orange-500',
};

interface Form {
  name: string; color_code: string; road_name: string;
  start_lat: string; start_lng: string; end_lat: string; end_lng: string;
}

const BLANK: Form = { name: '', color_code: 'green', road_name: '', start_lat: '', start_lng: '', end_lat: '', end_lng: '' };

function parseCoords(raw: string | null): { lat: string; lng: string } {
  if (!raw) return { lat: '', lng: '' };
  try {
    const g = JSON.parse(raw) as { coordinates?: [number, number] };
    return g.coordinates ? { lat: String(g.coordinates[1]), lng: String(g.coordinates[0]) } : { lat: '', lng: '' };
  } catch { return { lat: '', lng: '' }; }
}

function toForm(s: Stretch): Form {
  const sp = parseCoords(s.start_point);
  const ep = parseCoords(s.end_point);
  return { name: s.name, color_code: s.color_code, road_name: s.road_name ?? '', start_lat: sp.lat, start_lng: sp.lng, end_lat: ep.lat, end_lng: ep.lng };
}

export default function AdminStretchesPage() {
  const [items, setItems]     = useState<Stretch[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState<Form>(BLANK);
  const [editId, setEditId]   = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState('');

  function load() {
    setLoading(true);
    stretchesApi.list().then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openCreate() { setForm(BLANK); setEditId(null); setErr(''); setOpen(true); }
  function openEdit(s: Stretch) { setForm(toForm(s)); setEditId(s.id); setErr(''); setOpen(true); }

  async function handleSave() {
    setSaving(true); setErr('');
    try {
      const payload = {
        name: form.name, color_code: form.color_code, road_name: form.road_name || undefined,
        start_lat: form.start_lat ? Number(form.start_lat) : undefined,
        start_lng: form.start_lng ? Number(form.start_lng) : undefined,
        end_lat:   form.end_lat   ? Number(form.end_lat)   : undefined,
        end_lng:   form.end_lng   ? Number(form.end_lng)   : undefined,
      };
      if (editId) await stretchesApi.update(editId, payload);
      else        await stretchesApi.create(payload);
      setOpen(false); load();
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed.');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await stretchesApi.remove(deleteId).catch(() => {});
    setDeleteId(null); load();
  }

  const f = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Stretches</h1>
            <p className="text-xs text-gray-400">{items.length} total</p>
          </div>
          <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
            + Add Stretch
          </button>
        </div>

        {loading ? <Spinner /> : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <Th>Name</Th><Th>Color</Th><Th>Road</Th><Th>GPS</Th><Th>Status</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <Td className="font-medium text-gray-900">{s.name}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-3 w-3 rounded-full ${COLOR_DOT[s.color_code] ?? 'bg-gray-400'}`} />
                        {s.color_code}
                      </div>
                    </Td>
                    <Td>{s.road_name ?? <span className="text-gray-300">—</span>}</Td>
                    <Td>{s.start_point ? <span className="text-green-600 text-xs font-medium">✓ Set</span> : <span className="text-gray-300 text-xs">—</span>}</Td>
                    <Td><StatusBadge status={s.status as StretchStatus} /></Td>
                    <Td>
                      <div className="flex gap-3">
                        <button onClick={() => openEdit(s)} className="text-xs text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => setDeleteId(s.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <Empty text="No stretches yet." />}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {open && (
        <Modal title={editId ? 'Edit Stretch' : 'Add Stretch'} onClose={() => setOpen(false)} size="md">
          <div className="space-y-4">
            <Row>
              <Field label="Name *">
                <input value={form.name} onChange={f('name')} className={inp} placeholder="Stretch 1" />
              </Field>
              <Field label="Color *">
                <select value={form.color_code} onChange={f('color_code')} className={inp}>
                  {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </Row>
            <Field label="Road Name">
              <input value={form.road_name} onChange={f('road_name')} className={inp} placeholder="Jammi Banda Road" />
            </Field>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Start Point GPS (optional)</p>
              <Row>
                <Field label="Latitude"><input value={form.start_lat} onChange={f('start_lat')} className={inp} placeholder="17.2478" type="number" step="any" /></Field>
                <Field label="Longitude"><input value={form.start_lng} onChange={f('start_lng')} className={inp} placeholder="80.1514" type="number" step="any" /></Field>
              </Row>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">End Point GPS (optional)</p>
              <Row>
                <Field label="Latitude"><input value={form.end_lat} onChange={f('end_lat')} className={inp} placeholder="17.2500" type="number" step="any" /></Field>
                <Field label="Longitude"><input value={form.end_lng} onChange={f('end_lng')} className={inp} placeholder="80.1550" type="number" step="any" /></Field>
              </Row>
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

      {/* Delete confirm */}
      {deleteId && (
        <Modal title="Delete Stretch?" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-600 mb-5">This will also delete all checkpoints and task logs for this stretch.</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeleteId(null)} className={btnSecondary}>Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Delete</button>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

// ── Shared micro-components ────────────────────────────────────────────────────
const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
const btnPrimary   = 'px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition';
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
function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3">{children}</div>;
}
function Spinner() {
  return <div className="flex justify-center py-16"><div className="h-7 w-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
}
function Empty({ text }: { text: string }) {
  return <div className="text-center text-gray-400 text-sm py-12">{text}</div>;
}

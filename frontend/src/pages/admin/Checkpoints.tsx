import { useState, useEffect } from 'react';
import AdminLayout from '../../components/AdminLayout';
import Modal from '../../components/Modal';
import { checkpointsApi, stretchesApi } from '../../api';
import type { Checkpoint, Stretch } from '../../types';

const TYPES = ['start', 'mid', 'end'] as const;

const TYPE_PILL: Record<string, string> = {
  start: 'bg-green-100 text-green-800',
  mid:   'bg-yellow-100 text-yellow-800',
  end:   'bg-red-100 text-red-800',
};

const SCAN_LABEL: Record<string, string> = { start: 'Check-In', mid: 'Progress', end: 'Completion' };

interface Form {
  stretch_id: string; type: string; lat: string; lng: string;
}

const BLANK: Form = { stretch_id: '', type: 'start', lat: '', lng: '' };
function toForm(c: Checkpoint): Form {
  return { stretch_id: c.stretch_id, type: c.type, lat: '', lng: '' };
}

export default function AdminCheckpointsPage() {
  const [items, setItems]     = useState<Checkpoint[]>([]);
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
    Promise.all([checkpointsApi.list(), stretchesApi.list()])
      .then(([c, s]) => { setItems(c.data); setStretches(s.data); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openCreate() { setForm(BLANK); setEditId(null); setErr(''); setOpen(true); }
  function openEdit(c: Checkpoint) { setForm(toForm(c)); setEditId(c.id); setErr(''); setOpen(true); }

  async function handleSave() {
    setSaving(true); setErr('');
    try {
      const payload = {
        stretch_id: form.stretch_id,
        type:       form.type as 'start' | 'mid' | 'end',
        lat:        form.lat ? Number(form.lat) : undefined,
        lng:        form.lng ? Number(form.lng) : undefined,
      };
      if (editId) await checkpointsApi.update(editId, payload);
      else        await checkpointsApi.create(payload);
      setOpen(false); load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '';
      setErr(msg.includes('unique') ? 'A checkpoint of this type already exists for this stretch.' : 'Save failed.');
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteId) return;
    await checkpointsApi.remove(deleteId).catch(() => {});
    setDeleteId(null); load();
  }

  const f = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  // Group by stretch
  const byStretch = items.reduce<Record<string, { stretchName: string; cps: Checkpoint[] }>>((acc, cp) => {
    if (!acc[cp.stretch_id]) acc[cp.stretch_id] = { stretchName: cp.stretch_name, cps: [] };
    acc[cp.stretch_id].cps.push(cp);
    return acc;
  }, {});

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Checkpoints</h1>
            <p className="text-xs text-gray-400">{items.length} total · one start/mid/end per stretch</p>
          </div>
          <button onClick={openCreate} className={btnPrimary}>+ Add Checkpoint</button>
        </div>

        {loading ? <Spinner /> : items.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl"><Empty text="No checkpoints yet. Use QR → Bulk Generate to create defaults." /></div>
        ) : (
          <div className="space-y-5">
            {Object.entries(byStretch).map(([, { stretchName, cps }]) => (
              <div key={stretchName} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
                  <p className="text-sm font-semibold text-gray-700">{stretchName}</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <Th>Type</Th><Th>Scan Label</Th><Th>QR Payload</Th><Th>GPS</Th><Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...cps].sort((a, b) => TYPES.indexOf(a.type as typeof TYPES[number]) - TYPES.indexOf(b.type as typeof TYPES[number])).map((cp) => (
                      <tr key={cp.id} className="hover:bg-gray-50">
                        <Td>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase ${TYPE_PILL[cp.type] ?? 'bg-gray-100 text-gray-600'}`}>
                            {cp.type}
                          </span>
                        </Td>
                        <Td className="text-gray-500">{SCAN_LABEL[cp.type]}</Td>
                        <Td>
                          {cp.qr_code ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-gray-500 truncate max-w-xs">{cp.qr_code}</span>
                              <a href={checkpointsApi.qrUrl(cp.id)} download target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline whitespace-nowrap">⬇ PNG</a>
                            </div>
                          ) : <span className="text-amber-500 text-xs">⚠ Not generated</span>}
                        </Td>
                        <Td>
                          {(cp as Checkpoint & { location_geojson?: string }).location_geojson
                            ? <span className="text-green-600 text-xs">✓</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </Td>
                        <Td>
                          <div className="flex gap-3">
                            <button onClick={() => openEdit(cp)} className="text-xs text-blue-600 hover:underline">Edit</button>
                            <button onClick={() => setDeleteId(cp.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <Modal title={editId ? 'Edit Checkpoint' : 'Add Checkpoint'} onClose={() => setOpen(false)} size="md">
          <div className="space-y-4">
            <Field label="Stretch *">
              <select value={form.stretch_id} onChange={f('stretch_id')} className={inp}>
                <option value="">— Select stretch —</option>
                {stretches.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Type *">
              <select value={form.type} onChange={f('type')} className={inp}>
                {TYPES.map((t) => <option key={t} value={t}>{t} ({SCAN_LABEL[t]})</option>)}
              </select>
            </Field>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Location GPS (optional)</p>
              <div className="flex gap-3">
                <Field label="Latitude"><input value={form.lat} onChange={f('lat')} className={inp} placeholder="17.2478" type="number" step="any" /></Field>
                <Field label="Longitude"><input value={form.lng} onChange={f('lng')} className={inp} placeholder="80.1514" type="number" step="any" /></Field>
              </div>
            </div>
            {err && <p className="text-red-600 text-xs">{err}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setOpen(false)} className={btnSecondary}>Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.stretch_id || !form.type} className={btnPrimary}>
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title="Delete Checkpoint?" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-gray-600 mb-5">All task logs for this checkpoint will also be deleted.</p>
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

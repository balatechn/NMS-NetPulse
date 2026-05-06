'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useWS } from '@/lib/ws';
import {
  Plus, Search, Server, Pencil, Trash2, RefreshCw,
  CheckCircle2, XCircle, Clock, ChevronUp, ChevronDown, X,
} from 'lucide-react';
import clsx from 'clsx';

interface Device {
  id: number;
  name: string;
  ip_address: string;
  type: string;
  location: string;
  snmp_community: string;
  snmp_version: string;
  snmp_port: number;
  enabled: boolean;
  status: string;
  latency_ms: number | null;
  checked_at: string | null;
  active_alerts: string;
}

const TYPES = ['router', 'switch', 'firewall', 'server', 'access-point', 'printer', 'other'];

function StatusDot({ status }: { status: string }) {
  return (
    <span className={clsx('inline-block w-2 h-2 rounded-full',
      status === 'up' ? 'bg-green-400' :
      status === 'down' ? 'bg-red-400 animate-pulse' :
      'bg-gray-500'
    )} />
  );
}

function DeviceModal({
  device, onSave, onClose,
}: { device: Partial<Device> | null; onSave: () => void; onClose: () => void }) {
  const isEdit = !!(device as any)?.id;
  const [form, setForm] = useState({
    name: device?.name || '',
    ip_address: device?.ip_address || '',
    type: device?.type || 'router',
    location: device?.location || '',
    snmp_community: device?.snmp_community || 'NATIONAL852',
    snmp_version: device?.snmp_version || '2c',
    snmp_port: device?.snmp_port || 161,
    enabled: device?.enabled !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(k: string, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (isEdit) await api.updateDevice((device as any).id, form);
      else await api.createDevice(form);
      onSave();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="glass rounded-2xl w-full max-w-lg p-6 fade-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">{isEdit ? 'Edit Device' : 'Add Device'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Device Name *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" required />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs text-gray-400 mb-1">IP Address *</label>
              <input value={form.ip_address} onChange={(e) => set('ip_address', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="192.168.1.1" required />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Type</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Location</label>
              <input value={form.location} onChange={(e) => set('location', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="e.g. DC-Main" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">SNMP Community</label>
              <input value={form.snmp_community} onChange={(e) => set('snmp_community', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">SNMP Version</label>
              <select value={form.snmp_version} onChange={(e) => set('snmp_version', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                <option value="1">v1</option>
                <option value="2c">v2c</option>
                <option value="3">v3</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">SNMP Port</label>
              <input type="number" value={form.snmp_port} onChange={(e) => set('snmp_port', parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="enabled" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} className="rounded" />
              <label htmlFor="enabled" className="text-sm text-gray-300">Enabled</label>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-medium transition text-sm">
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const { lastMessage } = useWS();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; device: Partial<Device> | null }>({ open: false, device: null });
  const [polling, setPolling] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const load = useCallback(async () => {
    try { setDevices(await api.getDevices()); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (lastMessage?.type === 'status_update') {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === lastMessage.data.device_id
            ? { ...d, status: lastMessage.data.status, latency_ms: lastMessage.data.latency }
            : d
        )
      );
    }
  }, [lastMessage]);

  async function handlePoll(id: number) {
    setPolling((s) => new Set(s).add(id));
    try { await api.pollDevice(id); await load(); }
    catch {} finally { setPolling((s) => { const n = new Set(s); n.delete(id); return n; }); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this device?')) return;
    setDeleting(id);
    try { await api.deleteDevice(id); setDevices((d) => d.filter((x) => x.id !== id)); }
    catch {} finally { setDeleting(null); }
  }

  function toggleSort(key: string) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  const filtered = devices
    .filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.ip_address.includes(search))
    .sort((a, b) => {
      const va = (a as any)[sortKey] ?? '';
      const vb = (b as any)[sortKey] ?? '';
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });

  const SortIcon = ({ k }: { k: string }) => (
    sortKey === k ? (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Devices</h1>
        <button
          onClick={() => setModal({ open: true, device: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> Add Device
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search devices..."
          className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><RefreshCw className="w-6 h-6 text-blue-500 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {[
                    { k: 'status', l: 'Status' },
                    { k: 'name', l: 'Name' },
                    { k: 'ip_address', l: 'IP' },
                    { k: 'type', l: 'Type' },
                    { k: 'location', l: 'Location' },
                    { k: 'latency_ms', l: 'Latency' },
                  ].map(({ k, l }) => (
                    <th
                      key={k}
                      onClick={() => toggleSort(k)}
                      className="text-left px-4 py-3 text-gray-400 font-medium cursor-pointer hover:text-white select-none"
                    >
                      <span className="inline-flex items-center gap-1">{l} <SortIcon k={k} /></span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-gray-400 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-800/40 transition">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot status={d.status || 'unknown'} />
                        <span className={clsx('capitalize text-xs',
                          d.status === 'up' ? 'text-green-400' :
                          d.status === 'down' ? 'text-red-400' :
                          'text-gray-400'
                        )}>{d.status || 'unknown'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{d.name}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{d.ip_address}</td>
                    <td className="px-4 py-3">
                      <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded-lg text-xs capitalize">{d.type}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{d.location || '—'}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                      {d.latency_ms != null ? `${d.latency_ms.toFixed(1)}ms` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handlePoll(d.id)}
                          disabled={polling.has(d.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-950 rounded-lg transition disabled:opacity-40"
                          title="Poll now"
                        >
                          <RefreshCw className={clsx('w-3.5 h-3.5', polling.has(d.id) && 'animate-spin')} />
                        </button>
                        <button
                          onClick={() => setModal({ open: true, device: d })}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(d.id)}
                          disabled={deleting === d.id}
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950 rounded-lg transition disabled:opacity-40"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      {search ? 'No devices match search' : 'No devices yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <DeviceModal
          device={modal.device}
          onSave={() => { setModal({ open: false, device: null }); load(); }}
          onClose={() => setModal({ open: false, device: null })}
        />
      )}
    </div>
  );
}

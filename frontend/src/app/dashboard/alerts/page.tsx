'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw, Bell } from 'lucide-react';
import clsx from 'clsx';

interface Alert {
  id: number;
  device_id: number;
  device_name: string;
  ip_address: string;
  severity: string;
  message: string;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [resolved, setResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setAlerts(await api.getAlerts(resolved)); }
    catch {} finally { setLoading(false); }
  }, [resolved]);

  useEffect(() => { load(); }, [load]);

  async function handleResolve(id: number) {
    setResolving(id);
    try { await api.resolveAlert(id); await load(); }
    catch {} finally { setResolving(null); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this alert?')) return;
    try { await api.deleteAlert(id); setAlerts((a) => a.filter((x) => x.id !== id)); }
    catch {}
  }

  const severityColor: Record<string, string> = {
    critical: 'text-red-400 bg-red-950 border-red-800',
    warning: 'text-amber-400 bg-amber-950 border-amber-800',
    info: 'text-blue-400 bg-blue-950 border-blue-800',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setResolved(false)}
            className={clsx('px-4 py-2 rounded-xl text-sm font-medium transition',
              !resolved ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}
          >
            Active
          </button>
          <button
            onClick={() => setResolved(true)}
            className={clsx('px-4 py-2 rounded-xl text-sm font-medium transition',
              resolved ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}
          >
            Resolved
          </button>
          <button onClick={load} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><RefreshCw className="w-6 h-6 text-blue-500 animate-spin" /></div>
        ) : alerts.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-500">
            <Bell className="w-10 h-10 opacity-30" />
            <p>{resolved ? 'No resolved alerts' : 'No active alerts — all clear!'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {alerts.map((a) => (
              <div key={a.id} className="px-5 py-4 hover:bg-gray-800/40 transition">
                <div className="flex items-start gap-4">
                  <AlertTriangle className={clsx('w-5 h-5 mt-0.5 flex-shrink-0',
                    a.severity === 'critical' ? 'text-red-400' :
                    a.severity === 'warning' ? 'text-amber-400' :
                    'text-blue-400')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium">{a.message}</p>
                      <span className={clsx('text-xs px-2 py-0.5 rounded-lg border capitalize', severityColor[a.severity] || 'text-gray-400 bg-gray-800 border-gray-700')}>
                        {a.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">
                      {a.device_name} · <span className="font-mono">{a.ip_address}</span>
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {new Date(a.created_at).toLocaleString()}
                      {a.resolved_at && ` · Resolved ${new Date(a.resolved_at).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!resolved && (
                      <button
                        onClick={() => handleResolve(a.id)}
                        disabled={resolving === a.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-950 hover:bg-green-900 text-green-400 rounded-lg text-xs font-medium transition disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Resolve
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-red-950 text-gray-400 hover:text-red-400 rounded-lg text-xs transition"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

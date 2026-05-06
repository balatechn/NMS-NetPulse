'use client';
import { useEffect, useState, useCallback } from 'react';
import { useWS } from '@/lib/ws';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  Server, CheckCircle2, XCircle, AlertTriangle,
  Clock, Activity, Bell, RefreshCw, ArrowUpRight,
} from 'lucide-react';
import clsx from 'clsx';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

interface Summary {
  total_devices: string;
  devices_up: string;
  devices_down: string;
  devices_unknown: string;
  avg_latency: string;
  active_alerts: string;
}

interface Device {
  id: number;
  name: string;
  ip_address: string;
  type: string;
  location: string;
  status: string;
  latency_ms: number;
  checked_at: string;
  active_alerts: string;
}

function StatCard({
  icon: Icon, label, value, sub, color,
}: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="glass rounded-2xl p-5 fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className={clsx('text-3xl font-bold mt-1', color)}>{value}</p>
          {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
        </div>
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', color.replace('text-', 'bg-').replace('400', '950').replace('500', '950'))}>
          <Icon className={clsx('w-5 h-5', color)} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; dot: string; label: string }> = {
    up: { cls: 'bg-green-950 text-green-400 border-green-800', dot: 'bg-green-400', label: 'Up' },
    down: { cls: 'bg-red-950 text-red-400 border-red-800', dot: 'bg-red-400 animate-pulse', label: 'Down' },
    unknown: { cls: 'bg-gray-800 text-gray-400 border-gray-700', dot: 'bg-gray-400', label: 'Unknown' },
  };
  const c = cfg[status] || cfg.unknown;
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border', c.cls)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}

export default function DashboardPage() {
  const { lastMessage } = useWS();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const [s, d, a] = await Promise.all([
        api.getSummary(),
        api.getDevices(),
        api.getAlerts(false),
      ]);
      setSummary(s);
      setDevices(d);
      setAlerts(a.slice(0, 5));
      setLastUpdated(new Date());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live updates from WebSocket
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

  const upPct = summary
    ? Math.round((parseInt(summary.devices_up) / Math.max(parseInt(summary.total_devices), 1)) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-gray-400">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Updated {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Server} label="Total Devices" value={summary?.total_devices || 0} color="text-blue-400" />
        <StatCard icon={CheckCircle2} label="Devices Up" value={summary?.devices_up || 0} sub={`${upPct}% online`} color="text-green-400" />
        <StatCard icon={XCircle} label="Devices Down" value={summary?.devices_down || 0} color="text-red-400" />
        <StatCard icon={Bell} label="Active Alerts" value={summary?.active_alerts || 0} color="text-amber-400" />
      </div>

      {/* Network health bar */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-300">Network Health</span>
          <span className="text-sm font-bold text-white">{upPct}%</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-700',
              upPct >= 90 ? 'bg-green-500' : upPct >= 70 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${upPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{summary?.devices_up || 0} up</span>
          <span>{summary?.devices_down || 0} down</span>
          <span>{summary?.devices_unknown || 0} unknown</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Device table */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">Devices</h2>
            <Link href="/dashboard/devices" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {devices.slice(0, 8).map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-800/50 transition">
                <StatusBadge status={d.status || 'unknown'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{d.name}</p>
                  <p className="text-xs text-gray-500">{d.ip_address}</p>
                </div>
                <div className="text-right">
                  {d.latency_ms != null && (
                    <span className="text-xs text-gray-400">{d.latency_ms.toFixed(1)}ms</span>
                  )}
                </div>
              </div>
            ))}
            {devices.length === 0 && (
              <div className="py-8 text-center text-gray-500 text-sm">No devices yet</div>
            )}
          </div>
        </div>

        {/* Alerts */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">Recent Alerts</h2>
            <Link href="/dashboard/alerts" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-gray-800">
            {alerts.map((a) => (
              <div key={a.id} className="px-5 py-3 hover:bg-gray-800/50 transition">
                <div className="flex items-start gap-3">
                  <AlertTriangle className={clsx('w-4 h-4 mt-0.5 flex-shrink-0',
                    a.severity === 'critical' ? 'text-red-400' : 'text-amber-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{a.message}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.device_name} · {a.ip_address}</p>
                  </div>
                  <span className={clsx('text-xs px-2 py-0.5 rounded-lg capitalize',
                    a.severity === 'critical' ? 'bg-red-950 text-red-400' : 'bg-amber-950 text-amber-400')}>
                    {a.severity}
                  </span>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="py-8 text-center text-green-400 text-sm flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 opacity-50" />
                No active alerts
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { BarChart2, RefreshCw, Activity } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from 'recharts';

interface Device {
  id: number;
  name: string;
  ip_address: string;
  status: string;
}

export default function MetricsPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<Record<string, any[]>>({});
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getDevices().then((d) => {
      setDevices(d);
      if (d.length > 0) setSelected(d[0].id);
    }).catch(() => {});
  }, []);

  const loadMetrics = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    try { setMetrics(await api.getMetrics(selected, hours)); }
    catch {} finally { setLoading(false); }
  }, [selected, hours]);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  const latencyData = (metrics['latency'] || []).map((m) => ({
    time: new Date(m.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    latency: m.value != null ? parseFloat(m.value.toFixed(2)) : null,
  }));

  const selectedDevice = devices.find((d) => d.id === selected);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Metrics</h1>
        <button onClick={loadMetrics} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400 transition">
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={selected || ''}
          onChange={(e) => setSelected(parseInt(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 min-w-[200px]"
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>{d.name} ({d.ip_address})</option>
          ))}
        </select>
        {[6, 12, 24, 48, 168].map((h) => (
          <button key={h} onClick={() => setHours(h)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              hours === h ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {h >= 168 ? '7d' : `${h}h`}
          </button>
        ))}
      </div>

      {selectedDevice && (
        <p className="text-gray-400 text-sm">
          Showing data for <span className="text-white font-medium">{selectedDevice.name}</span> ({selectedDevice.ip_address}) — last {hours >= 168 ? '7 days' : `${hours} hours`}
        </p>
      )}

      {/* Latency Chart */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-blue-400" />
          <h2 className="font-semibold text-white">Latency (ms)</h2>
          {loading && <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin ml-2" />}
        </div>
        {latencyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={latencyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} unit="ms" />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#60a5fa' }}
                formatter={(v: any) => [`${v}ms`, 'Latency']}
              />
              <Line
                type="monotone"
                dataKey="latency"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#3b82f6' }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center text-gray-500 gap-3">
            <BarChart2 className="w-10 h-10 opacity-30" />
            <p>No latency data yet for this period</p>
          </div>
        )}
      </div>
    </div>
  );
}

// clsx import needed in this file
import clsx from 'clsx';

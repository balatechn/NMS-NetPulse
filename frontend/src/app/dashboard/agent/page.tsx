'use client';
import { useEffect, useState, useCallback } from 'react';
import { useWS } from '@/lib/ws';
import { api } from '@/lib/api';
import { Radio, RefreshCw, Zap } from 'lucide-react';
import clsx from 'clsx';

interface AgentEvent {
  id: number;
  source_ip: string;
  device_id: number | null;
  device_name: string | null;
  event_type: string;
  payload: any;
  received_at: string;
}

export default function AgentEventsPage() {
  const { lastMessage } = useWS();
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AgentEvent | null>(null);

  const load = useCallback(async () => {
    try {
      const [evts, st] = await Promise.all([
        api.getAgentEvents(),
        api.getAgentStatus(),
      ]);
      setEvents(evts);
      setStatus(st);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Prepend new agent events from WebSocket
  useEffect(() => {
    if (lastMessage?.type === 'agent_event') {
      setEvents((prev) => [{
        id: Date.now(),
        source_ip: lastMessage.data.ip,
        device_id: lastMessage.data.device_id,
        device_name: null,
        event_type: lastMessage.data.eventType,
        payload: lastMessage.data.payload,
        received_at: lastMessage.time,
      }, ...prev.slice(0, 99)]);
    }
  }, [lastMessage]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Agent Events</h1>
        <button onClick={load} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-400 transition">
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Agent listener status */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Events (1h)', value: status?.total_events || '0' },
          { label: 'Unique Devices', value: status?.unique_devices || '0' },
          { label: 'Last Event', value: status?.last_event ? new Date(status.last_event).toLocaleTimeString() : 'Never' },
        ].map((s) => (
          <div key={s.label} className="glass rounded-2xl p-4">
            <p className="text-gray-400 text-xs">{s.label}</p>
            <p className="text-white font-bold text-xl mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-950 border border-blue-900 rounded-xl px-4 py-2.5">
        <Zap className="w-4 h-4 text-blue-400 flex-shrink-0" />
        <span>
          Tacitine NMS Agent listener on port <strong className="text-blue-300">2133</strong>.
          Configure NMS Agent on the router: <strong className="text-blue-300">Management → NMS Agent</strong> → Server IP: your host, Port: 2133, Secret: <code className="text-blue-300">ab01970c-0444ff4a-7a144966-b31ca1c4</code>
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Events list */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400" />
              Incoming Events
            </h2>
          </div>
          {loading ? (
            <div className="py-12 flex justify-center"><RefreshCw className="w-5 h-5 text-blue-500 animate-spin" /></div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              <Radio className="w-8 h-8 mx-auto mb-3 opacity-30" />
              Waiting for agent connections...
            </div>
          ) : (
            <div className="divide-y divide-gray-800 max-h-[500px] overflow-y-auto">
              {events.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelected(selected?.id === e.id ? null : e)}
                  className={clsx(
                    'w-full text-left px-4 py-3 hover:bg-gray-800/50 transition',
                    selected?.id === e.id && 'bg-blue-950/30'
                  )}
                >
                  <div className="flex items-center gap-2 justify-between">
                    <span className="text-xs bg-blue-950 text-blue-300 border border-blue-900 px-2 py-0.5 rounded-lg">
                      {e.event_type}
                    </span>
                    <span className="text-xs text-gray-500">{new Date(e.received_at).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-sm text-white mt-1">{e.device_name || e.source_ip}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payload detail */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800">
            <h2 className="font-semibold text-white">Payload</h2>
          </div>
          {selected ? (
            <pre className="p-4 text-xs text-green-300 overflow-auto max-h-[500px] font-mono">
              {JSON.stringify(selected.payload, null, 2)}
            </pre>
          ) : (
            <div className="py-12 text-center text-gray-600 text-sm">
              Click an event to inspect its payload
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

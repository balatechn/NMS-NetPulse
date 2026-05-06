'use client';
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';

interface WSMessage {
  type: string;
  data?: any;
  time?: string;
}

interface WSContextType {
  lastMessage: WSMessage | null;
  connected: boolean;
}

const WSContext = createContext<WSContextType>({ lastMessage: null, connected: false });

export function WSProvider({ children }: { children: React.ReactNode }) {
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const token = localStorage.getItem('nms_token');
    if (!token) return;

    const wsBase = process.env.NEXT_PUBLIC_WS_URL || window.location.origin;
    const wsUrl = wsBase.replace(/^http/, 'ws') + '/ws/live';

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      reconnectRef.current = setTimeout(connect, 5000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try { setLastMessage(JSON.parse(e.data)); } catch {}
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  return <WSContext.Provider value={{ lastMessage, connected }}>{children}</WSContext.Provider>;
}

export const useWS = () => useContext(WSContext);

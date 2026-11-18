'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiOrigin } from './api';
import { useAuth } from './auth-context';
import type { AppNotification, ServerToClientEvents } from './types';
import { useToast } from '@/components/Toast';

interface RealtimeContextValue {
  connected: boolean;
  socket: Socket<ServerToClientEvents> | null;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  socket: null,
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket<ServerToClientEvents> | null>(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const accessToken = session?.access_token ?? null;

  useEffect(() => {
    if (!accessToken) {
      setConnected(false);
      setSocket(null);
      return;
    }

    const s: Socket<ServerToClientEvents> = io(`${apiOrigin()}/realtime`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));

    s.on('notification:new', (n: AppNotification) => {
      toastRef.current({
        title: n.title,
        description: n.body,
        variant: n.type === 'emergency_new' || n.type === 'flood_alert' ? 'warning' : 'info',
        href: n.link ?? undefined,
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setConnected(false);
      setSocket(null);
    };
  }, [accessToken]);

  return (
    <RealtimeContext.Provider value={{ connected, socket }}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}

export function useRealtimeEvent<K extends keyof ServerToClientEvents>(
  event: K,
  handler: ServerToClientEvents[K],
) {
  const { socket } = useRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listener = (...args: any[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (handlerRef.current as any)(...args);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on(event, listener as any);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socket.off(event, listener as any);
    };
  }, [socket, event]);
}

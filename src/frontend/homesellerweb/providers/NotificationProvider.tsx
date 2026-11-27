'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as signalR from '@microsoft/signalr';
import { NotificationDto } from '@/dtos/notification/notification.dto';
import { tokenStorage } from '@/lib/http';
import { normalizeNotification, notificationKey } from '@/lib/notifications';

function readToken() {
  try { return tokenStorage.get(); } catch { return null; }
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

const NOTIFICATION_API_URL =
  process.env.NEXT_PUBLIC_NOTIFICATION_API_URL || 'http://localhost:5267';

interface NotificationContextValue {
  notifications: NotificationDto[];
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  unreadCount: number;
  markAllRead: () => void;
  connectNotifications: () => Promise<void>;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  isConnected: false,
  connectionStatus: 'disconnected',
  unreadCount: 0,
  markAllRead: () => {},
  connectNotifications: async () => {},
  clearNotifications: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set());
  const mounted = useRef(false);
  const lifecycle = useRef(0);
  const connectLock = useRef(false);

  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const startPromiseRef = useRef<Promise<void> | null>(null);
  const connectedTokenRef = useRef<string | null>(null);

  const stopConnectionSafely = useCallback(async () => {
    const conn = connectionRef.current;
    const pendingStart = startPromiseRef.current;

    connectionRef.current = null;
    startPromiseRef.current = null;
    connectedTokenRef.current = null;

    if (pendingStart) {
      await pendingStart.catch(() => {});
    }

    if (conn && conn.state !== signalR.HubConnectionState.Disconnected) {
      await conn.stop().catch(() => {});
    }
    if (mounted.current) { setIsConnected(false); setConnectionStatus('disconnected'); }
  }, []);

  const connectNotifications = useCallback(async () => {
    const token = readToken();
    if (!token || connectLock.current || !mounted.current) return;

    if (
      connectedTokenRef.current === token &&
      (connectionRef.current?.state === signalR.HubConnectionState.Connected ||
        connectionRef.current?.state === signalR.HubConnectionState.Connecting)
    ) {
      return;
    }

    connectLock.current = true;
    try {
      const epoch = lifecycle.current;
      await stopConnectionSafely();
      if (!mounted.current || epoch !== lifecycle.current || readToken() !== token) return;
      setConnectionStatus('connecting');
      connectedTokenRef.current = token;

      const hubUrl = `${NOTIFICATION_API_URL}/NotificationHub`;

      const connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => readToken() ?? '',
          withCredentials: true,
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      connection.keepAliveIntervalInMilliseconds = 5000;
      connection.serverTimeoutInMilliseconds = 15000;

      connection.on('ReceiveNotification', (value: unknown) => {
        if (connectionRef.current !== connection) return;
        const notification = normalizeNotification(value);
        if (!notification) return;
        setNotifications((prev) => prev.some((item) => notificationKey(item) === notificationKey(notification)) ? prev : [notification, ...prev].slice(0, 100));
      });

      connection.onreconnecting(() => {
        if (connectionRef.current === connection) { setIsConnected(false); setConnectionStatus('reconnecting'); }
      });
      connection.onreconnected(() => {
        if (connectionRef.current === connection) { setIsConnected(true); setConnectionStatus('connected'); }
      });
      connection.onclose(() => {
        if (connectionRef.current === connection) { setIsConnected(false); setConnectionStatus('disconnected'); }
      });

      connectionRef.current = connection;

      const startPromise = connection
        .start()
        .then(() => {
          if (connectionRef.current !== connection) {
            return connection.stop().catch(() => {});
          }
          setIsConnected(true);
          setConnectionStatus('connected');
        })
        .catch((err) => {
          if (connectionRef.current === connection) {
            if (err?.name !== 'AbortError') {
              console.error('Notification SignalR error:', err);
            }
            setIsConnected(false);
            setConnectionStatus('disconnected');
            connectionRef.current = null;
            connectedTokenRef.current = null;
          }
        })
        .finally(() => {
          if (startPromiseRef.current === startPromise) {
            startPromiseRef.current = null;
          }
        });

      startPromiseRef.current = startPromise;
      await startPromise;
    } finally {
      connectLock.current = false;
    }
  }, [stopConnectionSafely]);

  useEffect(() => {
    mounted.current = true;
    lifecycle.current += 1;
    const timer = setTimeout(() => {
      connectNotifications();
    }, 0);

    return () => {
      mounted.current = false;
      lifecycle.current += 1;
      clearTimeout(timer);
      stopConnectionSafely();
    };
  }, [connectNotifications, stopConnectionSafely]);

  const unreadCount = notifications.filter((item) => !readKeys.has(notificationKey(item))).length;
  const markAllRead = () => setReadKeys(new Set(notifications.map(notificationKey)));
  const clearNotifications = () => { setNotifications([]); setReadKeys(new Set()); };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        isConnected,
        connectionStatus,
        unreadCount,
        markAllRead,
        connectNotifications,
        clearNotifications,
      }}
    >
      {children}
      <p role="status" className="sr-only">{unreadCount > 0 && notifications[0] ? `${notifications[0].title || 'Уведомление'}. ${notifications[0].message || ''}` : ''}</p>
    </NotificationContext.Provider>
  );
}

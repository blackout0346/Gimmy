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

const NOTIFICATION_API_URL =
  process.env.NEXT_PUBLIC_NOTIFICATION_API_URL || 'http://localhost:5267';

interface NotificationContextValue {
  notifications: NotificationDto[];
  isConnected: boolean;
  connectNotifications: () => Promise<void>;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  isConnected: false,
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
    setIsConnected(false);
  }, []);

  const connectNotifications = useCallback(async () => {
    const token = tokenStorage.get();
    if (!token) return;

    if (
      connectedTokenRef.current === token &&
      (connectionRef.current?.state === signalR.HubConnectionState.Connected ||
        connectionRef.current?.state === signalR.HubConnectionState.Connecting)
    ) {
      return;
    }

    await stopConnectionSafely();
    connectedTokenRef.current = token;

    const hubUrl = `${NOTIFICATION_API_URL}/NotificationHub`;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => tokenStorage.get() ?? '',
        withCredentials: true,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.keepAliveIntervalInMilliseconds = 5000;
    connection.serverTimeoutInMilliseconds = 15000;

    connection.on('ReceiveNotification', (notification: NotificationDto) => {
      setNotifications((prev) => [notification, ...prev]);
    });

    connection.onreconnecting(() => {
      if (connectionRef.current === connection) setIsConnected(false);
    });
    connection.onreconnected(() => {
      if (connectionRef.current === connection) setIsConnected(true);
    });
    connection.onclose(() => {
      if (connectionRef.current === connection) setIsConnected(false);
    });

    connectionRef.current = connection;

    const startPromise = connection
      .start()
      .then(() => {
        if (connectionRef.current !== connection) {
          return connection.stop().catch(() => {});
        }
        setIsConnected(true);
      })
      .catch((err) => {
        if (connectionRef.current === connection) {
          if (err?.name !== 'AbortError') {
            console.error('Notification SignalR error:', err);
          }
          setIsConnected(false);
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
  }, [stopConnectionSafely]);

  useEffect(() => {
    const timer = setTimeout(() => {
      connectNotifications();
    }, 0);

    return () => {
      clearTimeout(timer);
      stopConnectionSafely();
    };
  }, [connectNotifications, stopConnectionSafely]);

  const clearNotifications = () => setNotifications([]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        isConnected,
        connectNotifications,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
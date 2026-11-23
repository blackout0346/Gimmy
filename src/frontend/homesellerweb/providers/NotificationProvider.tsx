'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { NotificationDto } from '@/dtos/notification/notification.dto';
import { tokenStorage } from '@/lib/http';

interface NotificationContextValue {
  notifications: NotificationDto[];
  isConnected: boolean;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  isConnected: false,
  clearNotifications: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) return;

    const hubUrl = `${process.env.NEXT_PUBLIC_NOTIFICATION_API_URL}/NotificationHub`;

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

    connection.onreconnecting(() => setIsConnected(false));
    connection.onreconnected(() => setIsConnected(true));
    connection.onclose(() => setIsConnected(false));

    connection
      .start()
      .then(() => {
        setIsConnected(true);
      })
      .catch((err) => {
        console.error('SignalR connection error:', err);
      });

    connectionRef.current = connection;

    return () => {
      connection.stop();
      setIsConnected(false);
    };
  }, []);

  const clearNotifications = () => setNotifications([]);

  return (
    <NotificationContext.Provider value={{ notifications, isConnected, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}
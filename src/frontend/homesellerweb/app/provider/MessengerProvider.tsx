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
import { tokenStorage } from '@/lib/http';
import {
  ChatResponse,
  DeleteMessageRequest,
  EditMessageRequest,
  GetOrCreateChatRequest,
  MessageResponse,
  SendMessageRequest,
} from '@/app/api/DTOs/messenger/route';
import { messengerService } from '@/app/api/Services/messenger.service';

const MESSENGER_API_URL =
  process.env.NEXT_PUBLIC_MESSENGER_API_URL || 'http://localhost:5214';

interface TypingState {
  [chatId: string]: string[];
}

interface MessengerContextValue {
  connectionState: signalR.HubConnectionState;
  chats: ChatResponse[];
  activeChatId: string | null;
  messages: Record<string, MessageResponse[]>;
  typingUsers: TypingState;
  isLoadingHistory: boolean;

  connect: () => Promise<void>;
  setActiveChat: (chatId: string | null) => Promise<void>;
  loadChats: () => Promise<void>;
  startOrGetChat: (request: GetOrCreateChatRequest) => Promise<ChatResponse>;
  loadMoreMessages: (
    chatId: string,
    page: number,
    pageSize?: number
  ) => Promise<boolean>;

  sendMessage: (request: SendMessageRequest) => Promise<void>;
  editMessage: (request: EditMessageRequest) => Promise<void>;
  deleteMessage: (request: DeleteMessageRequest) => Promise<void>;
  sendTypingStatus: (chatId: string, isTyping: boolean) => Promise<void>;
}

const MessengerContext = createContext<MessengerContextValue | undefined>(
  undefined
);

interface MessengerProviderProps {
  children: React.ReactNode;
  hubPath?: string;
  isAuthenticated?: boolean;
}

export const MessengerProvider: React.FC<MessengerProviderProps> = ({
  children,
  hubPath = '/hubs/messenger',
  isAuthenticated = true,
}) => {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const startPromiseRef = useRef<Promise<void> | null>(null);

  const [connectionState, setConnectionState] =
    useState<signalR.HubConnectionState>(
      signalR.HubConnectionState.Disconnected
    );
  const [chats, setChats] = useState<ChatResponse[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, MessageResponse[]>>(
    {}
  );
  const [typingUsers, setTypingUsers] = useState<TypingState>({});
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const loadChats = useCallback(async () => {
    if (!tokenStorage.get()) return;
    try {
      const userChats = await messengerService.getUserChats();
      setChats(userChats);
    } catch (error) {
      console.error('Ошибка при загрузке чатов:', error);
    }
  }, []);

  const stopConnectionSafely = useCallback(async () => {
    const conn = connectionRef.current;
    const pendingStart = startPromiseRef.current;

    connectionRef.current = null;
    startPromiseRef.current = null;

    if (pendingStart) {
      await pendingStart.catch(() => {});
    }

    if (conn && conn.state !== signalR.HubConnectionState.Disconnected) {
      await conn.stop().catch(() => {});
    }
  }, []);

  const connect = useCallback(async () => {
    const token = tokenStorage.get();
    if (!token) return;

    if (
      connectionRef.current?.state === signalR.HubConnectionState.Connected ||
      connectionRef.current?.state === signalR.HubConnectionState.Connecting
    ) {
      return;
    }

    await stopConnectionSafely();

    const hubUrl = `${MESSENGER_API_URL}${hubPath}`;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => tokenStorage.get() || '',
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('ReceiveMessage', (message: MessageResponse) => {
      setMessages((prev) => {
        const chatMessages = prev[message.chatId] || [];
        if (chatMessages.some((m) => m.id === message.id)) return prev;
        return {
          ...prev,
          [message.chatId]: [...chatMessages, message],
        };
      });
    });

    connection.on('MessageEdited', (updatedMessage: MessageResponse) => {
      setMessages((prev) => {
        const chatMessages = prev[updatedMessage.chatId];
        if (!chatMessages) return prev;
        return {
          ...prev,
          [updatedMessage.chatId]: chatMessages.map((msg) =>
            msg.id === updatedMessage.id ? updatedMessage : msg
          ),
        };
      });
    });

    connection.on('MessageDeleted', (chatId: string, messageId: string) => {
      setMessages((prev) => {
        const chatMessages = prev[chatId];
        if (!chatMessages) return prev;
        return {
          ...prev,
          [chatId]: chatMessages.filter((msg) => msg.id !== messageId),
        };
      });
    });

    connection.on(
      'UserTyping',
      (chatId: string, userId: string, isTyping: boolean) => {
        setTypingUsers((prev) => {
          const current = prev[chatId] || [];
          if (isTyping) {
            if (current.includes(userId)) return prev;
            return { ...prev, [chatId]: [...current, userId] };
          }
          return {
            ...prev,
            [chatId]: current.filter((id) => id !== userId),
          };
        });
      }
    );

    connection.onreconnecting(() => {
      if (connectionRef.current === connection) {
        setConnectionState(signalR.HubConnectionState.Reconnecting);
      }
    });
    connection.onreconnected(() => {
      if (connectionRef.current === connection) {
        setConnectionState(signalR.HubConnectionState.Connected);
        loadChats();
      }
    });
    connection.onclose(() => {
      if (connectionRef.current === connection) {
        setConnectionState(signalR.HubConnectionState.Disconnected);
      }
    });

    connectionRef.current = connection;
    setConnectionState(signalR.HubConnectionState.Connecting);

    const startPromise = connection
      .start()
      .then(async () => {
        // Если за время negotiation соединение уже успели отменить/пересоздать
        if (connectionRef.current !== connection) {
          await connection.stop().catch(() => {});
          return;
        }
        setConnectionState(signalR.HubConnectionState.Connected);
        await loadChats();
      })
      .catch((err) => {
        if (connectionRef.current === connection) {
          console.error('Ошибка подключения к SignalR Hub:', err);
          setConnectionState(signalR.HubConnectionState.Disconnected);
          connectionRef.current = null;
        }
      })
      .finally(() => {
        if (startPromiseRef.current === startPromise) {
          startPromiseRef.current = null;
        }
      });

    startPromiseRef.current = startPromise;
    await startPromise;
  }, [hubPath, loadChats, stopConnectionSafely]);

useEffect(() => {
  const token = tokenStorage.get();

  if (!isAuthenticated || !token) {
    stopConnectionSafely();
    setChats([]);
    setMessages({});
    setActiveChatId(null);
    return;
  }

  const timer = setTimeout(() => {
    connect();
  }, 0);

  return () => {
    clearTimeout(timer);
    stopConnectionSafely();
  };
}, [isAuthenticated, connect, stopConnectionSafely]);
  const setActiveChat = useCallback(
    async (chatId: string | null) => {
      setActiveChatId(chatId);
      if (!chatId || !tokenStorage.get()) return;

      if (
        connectionRef.current?.state === signalR.HubConnectionState.Connected
      ) {
        await connectionRef.current
          .invoke('JoinChat', chatId)
          .catch(console.error);
      }

      if (!messages[chatId]) {
        setIsLoadingHistory(true);
        try {
          const history = await messengerService.getChatHistory({
            chatId,
            page: 1,
            pageSize: 50,
          });
          setMessages((prev) => ({
            ...prev,
            [chatId]: history.messages,
          }));
        } catch (error) {
          console.error('Ошибка при загрузке истории чата:', error);
        } finally {
          setIsLoadingHistory(false);
        }
      }
    },
    [messages]
  );

  const loadMoreMessages = useCallback(
    async (
      chatId: string,
      page: number,
      pageSize: number = 50
    ): Promise<boolean> => {
      if (!tokenStorage.get()) return false;
      setIsLoadingHistory(true);
      try {
        const history = await messengerService.getChatHistory({
          chatId,
          page,
          pageSize,
        });
        if (history.messages.length === 0) return false;

        setMessages((prev) => {
          const existing = prev[chatId] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const uniqueOlder = history.messages.filter(
            (m) => !existingIds.has(m.id)
          );
          return {
            ...prev,
            [chatId]: [...uniqueOlder, ...existing],
          };
        });
        return history.messages.length === pageSize;
      } finally {
        setIsLoadingHistory(false);
      }
    },
    []
  );

  const startOrGetChat = useCallback(
    async (request: GetOrCreateChatRequest): Promise<ChatResponse> => {
      const chat = await messengerService.getOrCreateChat(request);

      setChats((prev) => {
        if (prev.some((c) => c.id === chat.id)) return prev;
        return [chat, ...prev];
      });

      if (
        connectionRef.current?.state === signalR.HubConnectionState.Connected
      ) {
        await connectionRef.current.invoke('JoinChat', chat.id);
      }

      return chat;
    },
    []
  );

  const sendMessage = useCallback(async (request: SendMessageRequest) => {
    if (connectionRef.current?.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Нет подключения к серверу сообщений');
    }
    await connectionRef.current.invoke('SendMessage', request);
  }, []);

  const editMessage = useCallback(async (request: EditMessageRequest) => {
    if (connectionRef.current?.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Нет подключения к серверу сообщений');
    }
    await connectionRef.current.invoke('EditMessage', request);
  }, []);

  const deleteMessage = useCallback(async (request: DeleteMessageRequest) => {
    if (connectionRef.current?.state !== signalR.HubConnectionState.Connected) {
      throw new Error('Нет подключения к серверу сообщений');
    }
    await connectionRef.current.invoke('DeleteMessage', request);
  }, []);

  const sendTypingStatus = useCallback(
    async (chatId: string, isTyping: boolean) => {
      if (
        connectionRef.current?.state === signalR.HubConnectionState.Connected
      ) {
        await connectionRef.current
          .invoke('SendTypingStatus', chatId, isTyping)
          .catch(() => {});
      }
    },
    []
  );

  return (
    <MessengerContext.Provider
      value={{
        connectionState,
        chats,
        activeChatId,
        messages,
        typingUsers,
        isLoadingHistory,
        connect,
        setActiveChat,
        loadChats,
        startOrGetChat,
        loadMoreMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        sendTypingStatus,
      }}
    >
      {children}
    </MessengerContext.Provider>
  );
};

export const useMessenger = (): MessengerContextValue => {
  const context = useContext(MessengerContext);
  if (!context) {
    throw new Error('useMessenger должен использоваться внутри MessengerProvider');
  }
  return context;
};
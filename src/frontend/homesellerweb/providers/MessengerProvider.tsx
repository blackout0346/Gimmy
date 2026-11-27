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
import { readSession } from '@/lib/session';

function readToken() {
  try { return tokenStorage.get(); } catch { return null; }
}
import {
  ChatResponse,
  DeleteMessageRequest,
  EditMessageRequest,
  GetOrCreateChatRequest,
  MessageResponse,
  SendMessageRequest,
} from '@/dtos/messenger/messenger.dto';
import { messengerService } from '@/services/messenger.service';

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
  unreadChatIds: string[];
  unreadCount: number;
  markChatRead: (chatId: string) => void;
  markChatUnread: (chatId: string, observedAt?: number) => void;
  ingestMessage: (message: MessageResponse, observedAt?: number) => void;

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
  const connectLock = useRef(false);
  const mounted = useRef(false);
  const lifecycle = useRef(0);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const startPromiseRef = useRef<Promise<void> | null>(null);
const connectedTokenRef = useRef<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<signalR.HubConnectionState>(
      signalR.HubConnectionState.Disconnected
    );
  const [unreadChatIds, setUnreadChatIds] = useState<string[]>([]);
  const activeChatRef = useRef<string | null>(null);
  const readAtRef = useRef(new Map<string, number>());
  const seenMessages = useRef(new Set<string>());
  const ownUserId = useRef<string | null>(null);
  const knownChats = useRef(new Set<string>());
  const refreshChats = useRef<() => Promise<void>>(async () => {});
  const refreshingChats = useRef(false);
  const [chats, setChats] = useState<ChatResponse[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, MessageResponse[]>>(
    {}
  );
  const [typingUsers, setTypingUsers] = useState<TypingState>({});
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const markChatRead = useCallback((chatId: string) => {
    const key = chatId.toLowerCase();
    readAtRef.current.set(key, Date.now());
    setUnreadChatIds((current) => current.filter((id) => id.toLowerCase() !== key));
  }, []);

  const markChatUnread = useCallback((chatId: string, observedAt = Date.now()) => {
    const key = chatId.toLowerCase();
    if ((readAtRef.current.get(key) ?? 0) >= observedAt) return;
    if (activeChatRef.current?.toLowerCase() === key && (typeof document === 'undefined' || document.visibilityState === 'visible')) return;
    setUnreadChatIds((current) => current.some((id) => id.toLowerCase() === key) ? current : [...current, chatId]);
  }, []);

  const ingestMessage = useCallback((message: MessageResponse, observedAt = Date.now()) => {
    if (!message?.id || !message.chatId || !message.userId || seenMessages.current.has(message.id)) return;
    seenMessages.current.add(message.id);
    const oldest = seenMessages.current.values().next().value;
    if (seenMessages.current.size > 5000 && oldest) seenMessages.current.delete(oldest);
    setMessages((prev) => {
      const existing = prev[message.chatId] ?? [];
      return existing.some((item) => item.id === message.id) ? prev : { ...prev, [message.chatId]: [...existing, message] };
    });
    const userId = ownUserId.current ?? readSession().userId;
    if (message.userId.toLowerCase() !== userId?.toLowerCase()) markChatUnread(message.chatId, observedAt);
    if (!knownChats.current.has(message.chatId.toLowerCase()) && !refreshingChats.current) {
      refreshingChats.current = true;
      void refreshChats.current().finally(() => { refreshingChats.current = false; });
    }
  }, [markChatUnread]);

  useEffect(() => {
    function visible() {
      if (document.visibilityState === 'visible' && activeChatRef.current) markChatRead(activeChatRef.current);
    }
    document.addEventListener('visibilitychange', visible);
    return () => document.removeEventListener('visibilitychange', visible);
  }, [markChatRead]);

  const loadChats = useCallback(async () => {
    if (!readToken()) return;
    try {
      const userChats = await messengerService.getUserChats();
      knownChats.current = new Set(userChats.map((chat) => chat.id.toLowerCase()));
      setChats(userChats);
      const connection = connectionRef.current;
      if (connection?.state === signalR.HubConnectionState.Connected) {
        for (let offset = 0; offset < userChats.length; offset += 6) {
          if (connectionRef.current !== connection || connection.state !== signalR.HubConnectionState.Connected) return;
          await Promise.all(userChats.slice(offset, offset + 6).map((chat) => connection.invoke('JoinChat', chat.id).catch(console.error)));
        }
      }
    } catch (error) {
      console.error('Ошибка при загрузке чатов:', error);
    }
  }, []);

  useEffect(() => { refreshChats.current = loadChats; }, [loadChats]);

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
}, []);

const connect = useCallback(async () => {
  const token = readToken();
  if (!token || connectLock.current || !mounted.current) return;

  // Пропускаем, только если уже подключены С ТЕМ ЖЕ токеном
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
    const changedSession = connectedTokenRef.current !== null && connectedTokenRef.current !== token;
    await stopConnectionSafely();
    if (!mounted.current || epoch !== lifecycle.current || readToken() !== token) return;
    if (changedSession) {
      setChats([]);
      setMessages({});
      setActiveChatId(null);
      activeChatRef.current = null;
      setUnreadChatIds([]);
      knownChats.current.clear();
      seenMessages.current.clear();
      readAtRef.current.clear();
      setTypingUsers({});
    }
    ownUserId.current = readSession().userId;
    connectedTokenRef.current = token;

    const hubUrl = `${MESSENGER_API_URL}${hubPath}`;
      const connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => readToken() || '',
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      connection.on('ReceiveMessage', (message: MessageResponse) => {
        if (connectionRef.current === connection) ingestMessage(message);
      });

      connection.on('MessageEdited', (updatedMessage: MessageResponse) => {
        if (connectionRef.current !== connection) return;
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
        if (connectionRef.current !== connection) return;
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
          if (connectionRef.current !== connection) return;
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
          if (activeChatRef.current) await connection.invoke('JoinChat', activeChatRef.current).catch(console.error);
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
  } finally {
    connectLock.current = false;
  }
  }, [hubPath, loadChats, stopConnectionSafely, ingestMessage]);

useEffect(() => {
  mounted.current = true;
  lifecycle.current += 1;
  const token = readToken();

  if (!isAuthenticated || !token) {
    stopConnectionSafely();
    setChats([]);
    setMessages({});
    setActiveChatId(null);
    activeChatRef.current = null;
    setUnreadChatIds([]);
    knownChats.current.clear();
    seenMessages.current.clear();
    readAtRef.current.clear();
    return () => { mounted.current = false; lifecycle.current += 1; };
  }

  const timer = setTimeout(() => {
    connect();
  }, 0);

  return () => {
    mounted.current = false;
    lifecycle.current += 1;
    clearTimeout(timer);
    stopConnectionSafely();
  };
}, [isAuthenticated, connect, stopConnectionSafely]);
  const setActiveChat = useCallback(
    async (chatId: string | null) => {
      activeChatRef.current = chatId;
      setActiveChatId(chatId);
      if (chatId) markChatRead(chatId);
      if (!chatId || !readToken()) return;

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
          history.messages.forEach((message) => seenMessages.current.add(message.id));
          setMessages((prev) => {
            const merged = new Map([...history.messages, ...(prev[chatId] ?? [])].map((message) => [message.id, message] as const));
            return { ...prev, [chatId]: [...merged.values()] };
          });
        } catch (error) {
          console.error('Ошибка при загрузке истории чата:', error);
        } finally {
          setIsLoadingHistory(false);
        }
      }
    },
    [messages, markChatRead]
  );

  const loadMoreMessages = useCallback(
    async (
      chatId: string,
      page: number,
      pageSize: number = 50
    ): Promise<boolean> => {
      if (!readToken()) return false;
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
      knownChats.current.add(chat.id.toLowerCase());

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
        unreadChatIds,
        unreadCount: unreadChatIds.length,
        markChatRead,
        markChatUnread,
        ingestMessage,
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

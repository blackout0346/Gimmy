'use client';

import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { authService } from './api/Services/auth.service';
import { productService } from './api/Services/product.service';
import { cartService } from './api/Services/cart.service';
import { messengerService } from './api/Services/messenger.service';
import { useNotifications } from './provider/NotificationProvider';
import { useMessenger } from './provider/MessengerProvider';
import { ProductsResponse } from './api/DTOs/product/route';
import { CartResponse } from './api/DTOs/cart/route';
import { tokenStorage } from '@/lib/http';

const MESSENGER_API_URL =
  process.env.NEXT_PUBLIC_MESSENGER_API_URL || 'http://localhost:5214';

// Вспомогательная функция для получения userId текущего пользователя из JWT
function getCurrentUserIdFromToken(): string | null {
  const token = tokenStorage.get();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return (
      payload[
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'
      ] ||
      payload.sub ||
      payload.nameid ||
      null
    );
  } catch {
    return null;
  }
}

export function DashboardExample() {
  const [products, setProducts] = useState<ProductsResponse[]>([]);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loginInput, setLoginInput] = useState('user1');
  const [passwordInput, setPasswordInput] = useState('password123');

  const { notifications, isConnected } = useNotifications();
  const {
    connectionState,
    chats,
    activeChatId,
    messages,
    typingUsers,
    isLoadingHistory,
    setActiveChat,
    loadChats,
    loadMoreMessages,
    startOrGetChat,
    sendMessage,
    editMessage,
    deleteMessage,
    sendTypingStatus,
  } = useMessenger();

  // Состояния формы чата
  const [messageText, setMessageText] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setCurrentUserId(getCurrentUserIdFromToken());
    productService.getProducts().then(setProducts).catch(console.error);
  }, []);

  const currentMessages = activeChatId ? messages[activeChatId] || [] : [];
  const currentTyping = activeChatId ? typingUsers[activeChatId] || [] : [];
  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  // Автоскролл вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, activeChatId]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authService.login({ login: loginInput, password: passwordInput });
      setCurrentUserId(getCurrentUserIdFromToken());
      const userCart = await cartService.getCart();
      setCart(userCart);
      await loadChats();
    } catch (error) {
      console.error('Ошибка входа:', error);
    }
  };

  const handleAddToCart = async (productId: string) => {
    await cartService.addToCart({ productId, quantity: 1 });
    const updatedCart = await cartService.getCart();
    setCart(updatedCart);
  };

  const handleSelectChat = async (chatId: string) => {
    setPage(1);
    setHasMore(true);
    setReplyToId(null);
    setEditingMessageId(null);
    setMessageText('');
    await setActiveChat(chatId);
  };

  const handleLoadOlder = async () => {
    if (!activeChatId || isLoadingHistory || !hasMore) return;
    const nextPage = page + 1;
    const moreAvailable = await loadMoreMessages(activeChatId, nextPage, 50);
    setPage(nextPage);
    setHasMore(moreAvailable);
  };

  const handleStartChatWithSeller = async (product: ProductsResponse) => {
    try {
      const targetUserId =
        (product as any).userId || '00000000-0000-0000-0000-000000000000';

      const chat = await startOrGetChat({
        productId: product.id,
        productName: product.nameProduct,
        targetUserId,
        initiatorName: loginInput,
      });

      await handleSelectChat(chat.id);
    } catch (error) {
      console.error('Не удалось создать/открыть чат:', error);
    }
  };

  const handleInputChange = (value: string) => {
    setMessageText(value);
    if (!activeChatId) return;

    sendTypingStatus(activeChatId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(activeChatId, false);
    }, 2000);
  };

  const handleSendOrEditMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChatId || (!messageText.trim() && selectedFiles.length === 0)) {
      return;
    }

    try {
      if (editingMessageId) {
        await editMessage({
          messageId: editingMessageId,
          newText: messageText.trim(),
        });
        setEditingMessageId(null);
        setMessageText('');
        return;
      }

      let uploadedAttachments = undefined;
      if (selectedFiles.length > 0) {
        setIsUploading(true);
        uploadedAttachments = await messengerService.uploadAttachments(
          selectedFiles
        );
      }

      await sendMessage({
        chatId: activeChatId,
        senderName: loginInput,
        text: messageText.trim(),
        replyId: replyToId,
        attachments: uploadedAttachments,
      });

      setMessageText('');
      setReplyToId(null);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      sendTypingStatus(activeChatId, false);
    } catch (error) {
      console.error('Ошибка при отправке/редактировании:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const replyMessageObj = replyToId
    ? currentMessages.find((m) => m.id === replyToId)
    : null;

  const isSignalRConnected =
    connectionState === signalR.HubConnectionState.Connected;

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-slate-800">
      {/* Верхняя панель статуса и авторизации */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-900">
            HomeSeller Test Panel
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              isConnected
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-rose-100 text-rose-700'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            Notifications: {isConnected ? 'Online' : 'Offline'}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              isSignalRConnected
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            Messenger: {connectionState}
          </span>
        </div>

        <form onSubmit={handleLogin} className="flex items-center gap-2">
          <input
            type="text"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            placeholder="Логин"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Пароль"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            Войти
          </button>
        </form>
      </header>

      {/* Основная сетка: Магазин слева / Мессенджер справа */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Левая колонка: Товары, Корзина, Уведомления (5 колонок) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Товары */}
          <section className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Каталог товаров</h2>
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                В корзине: {cart?.cartItems.length ?? 0}
              </span>
            </div>

            {products.length === 0 ? (
              <p className="text-sm text-slate-400">Товары не загружены</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {products.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {p.nameProduct}
                      </p>
                      <p className="text-sm text-slate-500">{p.price} ₽</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddToCart(p.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition"
                      >
                        В корзину
                      </button>
                      <button
                        onClick={() => handleStartChatWithSeller(p)}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition"
                      >
                        Написать продавцу
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Уведомления */}
          <section className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <h2 className="mb-3 text-lg font-semibold">
              Уведомления ({notifications.length})
            </h2>
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400">Новых уведомлений нет</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {notifications.map((n, idx) => (
                  <li
                    key={`${n.entityId}-${idx}`}
                    className="rounded-lg bg-slate-50 p-3 text-sm border border-slate-100"
                  >
                    <p className="font-semibold text-slate-800">{n.title}</p>
                    <p className="text-slate-600">{n.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Правая колонка: Полноценный интерфейс Мессенджера (7 колонок) */}
        <section className="flex h-[680px] overflow-hidden rounded-xl bg-white shadow-sm border border-slate-200 lg:col-span-7">
          {/* Сайдбар со списком чатов */}
          <aside className="flex w-1/3 flex-col border-r border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h2 className="font-semibold text-slate-800">
                Чаты ({chats.length})
              </h2>
              <button
                onClick={() => loadChats()}
                title="Обновить список"
                className="rounded p-1 text-xs text-slate-500 hover:bg-slate-200"
              >
                ↻
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {chats.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Нет активных диалогов
                </div>
              ) : (
                chats.map((chat) => {
                  const isActive = chat.id === activeChatId;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => handleSelectChat(chat.id)}
                      className={`w-full border-b border-slate-100 p-3.5 text-left transition ${
                        isActive
                          ? 'bg-blue-50 border-l-4 border-l-blue-600'
                          : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">
                          Чат #{chat.id.slice(0, 6)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(chat.createAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        Товар: {chat.productId.slice(0, 8)}...
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Окно диалога */}
          <div className="flex w-2/3 flex-col bg-white">
            {activeChat ? (
              <>
                {/* Шапка диалога */}
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Диалог #{activeChat.id.slice(0, 8)}
                    </h3>
                    <p className="text-xs text-slate-500">
                      ID товара: {activeChat.productId}
                    </p>
                  </div>
                  {hasMore && currentMessages.length >= 50 && (
                    <button
                      onClick={handleLoadOlder}
                      disabled={isLoadingHistory}
                      className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      {isLoadingHistory ? 'Загрузка...' : 'Загрузить ранние'}
                    </button>
                  )}
                </div>

                {/* Область сообщений */}
                <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 p-4">
                  {isLoadingHistory && currentMessages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      Загрузка сообщений...
                    </div>
                  ) : currentMessages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      Напишите первое сообщение
                    </div>
                  ) : (
                    currentMessages.map((msg) => {
                      const isMine =
                        currentUserId &&
                        msg.userId.toLowerCase() ===
                          currentUserId.toLowerCase();
                      const isEdited = msg.updateAt !== msg.createAt;

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            isMine ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div
                            className={`group relative max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                              isMine
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                            }`}
                          >
                            {/* Цитируемое сообщение (Reply) */}
                            {msg.reply && (
                              <div
                                className={`mb-1.5 rounded border-l-2 px-2 py-1 text-xs ${
                                  isMine
                                    ? 'border-blue-200 bg-blue-700/60 text-blue-100'
                                    : 'border-indigo-500 bg-slate-100 text-slate-600'
                                }`}
                              >
                                <p className="font-semibold">
                                  Пользователь {msg.reply.userId.slice(0, 6)}
                                </p>
                                <p className="truncate">{msg.reply.text}</p>
                              </div>
                            )}

                            {/* Текст сообщения */}
                            {msg.text && (
                              <p className="whitespace-pre-wrap break-words">
                                {msg.text}
                              </p>
                            )}

                            {/* Вложения */}
                            {msg.attachments?.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {msg.attachments.map((att) => {
                                  const fullUrl = att.fileUrl.startsWith('http')
                                    ? att.fileUrl
                                    : `${MESSENGER_API_URL}${att.fileUrl}`;
                                  const isImage =
                                    att.mimeType.startsWith('image/');

                                  return isImage ? (
                                    <a
                                      key={att.id}
                                      href={fullUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block overflow-hidden rounded-lg border border-black/10"
                                    >
                                      <img
                                        src={fullUrl}
                                        alt={att.fileName}
                                        className="max-h-48 w-auto object-cover"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      key={att.id}
                                      href={fullUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`flex items-center gap-2 rounded-lg p-2 text-xs underline ${
                                        isMine
                                          ? 'bg-blue-700 text-white'
                                          : 'bg-slate-100 text-blue-600'
                                      }`}
                                    >
                                      📎 {att.fileName} (
                                      {Math.round(att.size / 1024)} КБ)
                                    </a>
                                  );
                                })}
                              </div>
                            )}

                            {/* Время и пометка ред. */}
                            <div
                              className={`mt-1 flex items-center justify-end gap-1.5 text-[10px] ${
                                isMine ? 'text-blue-200' : 'text-slate-400'
                              }`}
                            >
                              {isEdited && <span>ред.</span>}
                              <span>
                                {new Date(msg.createAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          </div>

                          {/* Кнопки действий под сообщением */}
                          <div className="mt-1 flex gap-2 px-1 text-[11px] text-slate-400">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMessageId(null);
                                setReplyToId(msg.id);
                              }}
                              className="hover:text-slate-700"
                            >
                              Ответить
                            </button>
                            {isMine && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyToId(null);
                                    setEditingMessageId(msg.id);
                                    setMessageText(msg.text);
                                  }}
                                  className="hover:text-blue-600"
                                >
                                  Изменить
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteMessage({ messageId: msg.id })
                                  }
                                  className="hover:text-rose-600"
                                >
                                  Удалить
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Индикатор "печатает..." */}
                <div className="h-5 px-4 text-xs italic text-slate-400">
                  {currentTyping.length > 0 && 'Собеседник печатает...'}
                </div>

                {/* Плашка ответа или редактирования */}
                {(replyMessageObj || editingMessageId) && (
                  <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs">
                    <div className="truncate">
                      {replyMessageObj ? (
                        <>
                          <span className="font-semibold text-blue-600">
                            Ответ на:{' '}
                          </span>
                          <span className="text-slate-600">
                            {replyMessageObj.text || 'Вложение'}
                          </span>
                        </>
                      ) : (
                        <span className="font-semibold text-amber-600">
                          Редактирование сообщения
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyToId(null);
                        setEditingMessageId(null);
                        setMessageText('');
                      }}
                      className="ml-2 text-slate-400 hover:text-slate-700"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Предпросмотр выбранных файлов */}
                {selectedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2">
                    {selectedFiles.map((file, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
                      >
                        {file.name}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFiles((prev) =>
                              prev.filter((_, idx) => idx !== i)
                            )
                          }
                          className="ml-1 font-bold hover:text-blue-950"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Панель ввода сообщения */}
                <form
                  onSubmit={handleSendOrEditMessage}
                  className="flex items-center gap-2 border-t border-slate-200 p-3"
                >
                  {!editingMessageId && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) =>
                          setSelectedFiles(Array.from(e.target.files || []))
                        }
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Прикрепить файл"
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition"
                      >
                        📎
                      </button>
                    </>
                  )}

                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Напишите сообщение..."
                    className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={
                      !isSignalRConnected ||
                      isUploading ||
                      (!messageText.trim() && selectedFiles.length === 0)
                    }
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {isUploading
                      ? 'Загрузка...'
                      : editingMessageId
                      ? 'Сохранить'
                      : 'Отправить'}
                  </button>
                </form>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-400">
                <p className="text-sm font-medium">Чат не выбран</p>
                <p className="mt-1 text-xs">
                  Выберите диалог слева или нажмите «Написать продавцу» у любого
                  товара
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
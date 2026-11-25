'use client';

import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { authService } from '@/services/auth.service';
import { productService } from '@/services/product.service';
import { cartService } from '@/services/cart.service';
import { favoriteService } from '@/services/favorite.service';
import { messengerService } from '@/services/messenger.service';
import { useNotifications } from '@/providers/NotificationProvider';
import { useMessenger } from '@/providers/MessengerProvider';
import { ProductsResponse } from '@/dtos/product/product.dto';
import { CartResponse, FavoriteResponse } from '@/dtos/cart/cart.dto';
import { tokenStorage } from '@/lib/http';

const MESSENGER_API_URL =
  process.env.NEXT_PUBLIC_MESSENGER_API_URL || 'http://localhost:5214';
const PRODUCT_API_URL =
  process.env.NEXT_PUBLIC_PRODUCT_API_URL || 'http://localhost:5030';

const CONDITION_NEW = '11111111-1111-1111-1111-111111111111';
const CONDITION_USED = '22222222-2222-2222-2222-222222222222';

const MOCK_PRODUCTS = [
  {
    nameProduct: 'iPhone 15 Pro 256GB',
    price: 98500,
    description: 'Идеальное состояние, полный комплект, АКБ 96%.',
    position: 'Москва',
    conditionId: CONDITION_USED,
    imageURLs: ['https://picsum.photos/seed/iphone15/400/300'],
    tagIds: [] as string[],
  },
  {
    nameProduct: 'Механическая клавиатура Keychron K2',
    price: 8900,
    description: 'Свитчи Gateron Brown, горячая замена, RGB-подсветка.',
    position: 'Санкт-Петербург',
    conditionId: CONDITION_NEW,
    imageURLs: ['https://picsum.photos/seed/keychron/400/300'],
    tagIds: [] as string[],
  },
  {
    nameProduct: 'Наушники Sony WH-1000XM5',
    price: 27400,
    description: 'Отличное шумоподавление, кейс и кабель в комплекте.',
    position: 'Казань',
    conditionId: CONDITION_NEW,
    imageURLs: ['https://picsum.photos/seed/sonyxm5/400/300'],
    tagIds: [] as string[],
  },
  {
    nameProduct: 'Монитор LG UltraGear 27" 144Hz',
    price: 24900,
    description: 'IPS матрица, 2K разрешение, без битых пикселей.',
    position: 'Екатеринбург',
    conditionId: CONDITION_USED,
    imageURLs: ['https://picsum.photos/seed/lgmonitor/400/300'],
    tagIds: [] as string[],
  },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getProductImageUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${PRODUCT_API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

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
  // Данные магазина и пользователя
  const [products, setProducts] = useState<ProductsResponse[]>([]);
  const [selectedProduct, setSelectedProduct] =
    useState<ProductsResponse | null>(null);
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [favorites, setFavorites] = useState<FavoriteResponse | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Симуляция
  const [isSimulating, setIsSimulating] = useState(false);
  const [simLogs, setSimLogs] = useState<string[]>([]);

  // Форма авторизации
  const [loginInput, setLoginInput] = useState('user1');
  const [passwordInput, setPasswordInput] = useState('password123');

  // Форма добавления товара
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // Провайдеры
  const { notifications, isConnected } = useNotifications();
  const {
    connectionState,
    chats,
    activeChatId,
    messages,
    typingUsers,
    isLoadingHistory,
    connect,
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

  const addSimLog = (text: string) => {
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setSimLogs((prev) => [...prev, `[${time}] ${text}`]);
  };

  const showError = (err: unknown, fallback: string) => {
    const message = err instanceof Error ? err.message : fallback;
    setErrorMsg(message);
    console.error(fallback, err);
  };

  const fetchProducts = async () => {
    try {
      const data = await productService.getProducts();
      setProducts(data);
    } catch (error) {
      showError(error, 'Ошибка при загрузке товаров');
    }
  };

  useEffect(() => {
    setCurrentUserId(getCurrentUserIdFromToken());
    fetchProducts();
  }, []);

  const currentMessages = activeChatId ? messages[activeChatId] || [] : [];
  const currentTyping = activeChatId ? typingUsers[activeChatId] || [] : [];
  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, activeChatId]);

  // --- Хелперы имён для чатов и сообщений ---

  const getChatProduct = (productId: string) =>
    products.find((p) => p.id === productId);

  const getChatProductName = (chat: (typeof chats)[number]) => {
    const product = getChatProduct(chat.productId);
    return (
      (chat as any).productName ||
      product?.nameProduct ||
      'Неизвестный товар'
    );
  };

  const getInterlocutorName = (chat: (typeof chats)[number]) => {
    const product = getChatProduct(chat.productId);
    if ((chat as any).interlocutorName) return (chat as any).interlocutorName;
    if ((chat as any).targetUserName) return (chat as any).targetUserName;
    if (product?.sellerLogin) {
      if (
        currentUserId &&
        product.userId?.toLowerCase() === currentUserId.toLowerCase()
      ) {
        return 'Покупатель';
      }
      return product.sellerLogin;
    }
    return 'Собеседник';
  };

  const getReplyAuthorName = (
    reply: NonNullable<(typeof currentMessages)[number]['reply']>
  ) => {
    if (
      currentUserId &&
      reply.userId.toLowerCase() === currentUserId.toLowerCase()
    ) {
      return loginInput || 'Вы';
    }
    if ((reply as any).senderName) return (reply as any).senderName;
    if (activeChat) return getInterlocutorName(activeChat);
    return 'Собеседник';
  };

  // --- Авторизация ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await authService.login({ login: loginInput, password: passwordInput });
      setCurrentUserId(getCurrentUserIdFromToken());
      const userCart = await cartService.getCart();
      setCart(userCart);
      const userFavorites = await favoriteService.getFavorite();
      setFavorites(userFavorites);
      await connect();
    } catch (error) {
      showError(error, 'Ошибка входа');
    }
  };

  // --- Симуляция ---

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setErrorMsg(null);
    setSimLogs([]);

    try {
      addSimLog(`Авторизация под "${loginInput}"...`);
      try {
        await authService.login({ login: loginInput, password: passwordInput });
      } catch {
        if (typeof (authService as any).register === 'function') {
          addSimLog('Пользователь не найден, регистрируем нового...');
          await (authService as any).register({
            login: loginInput,
            password: passwordInput,
            email: `${loginInput}@test.local`,
          });
          await authService.login({
            login: loginInput,
            password: passwordInput,
          });
        } else {
          throw new Error(
            'Неверный логин/пароль (метод register не найден в authService)'
          );
        }
      }

      const uid =
        getCurrentUserIdFromToken() || '00000000-0000-0000-0000-000000000000';
      setCurrentUserId(uid);
      await connect();
      addSimLog('Успешный вход и подключение к SignalR.');
      await sleep(400);

      let dbConditions: { id: string; nameCondition: string }[] = [];
      if (typeof (productService as any).getConditions === 'function') {
        try {
          dbConditions = await (productService as any).getConditions();
          addSimLog(`Загружено состояний из БД: ${dbConditions.length}`);
        } catch {
          addSimLog(
            'Не удалось загрузить состояния из БД, используем ID по умолчанию.'
          );
        }
      }

      for (let i = 0; i < MOCK_PRODUCTS.length; i++) {
        const item = MOCK_PRODUCTS[i];
        const conditionId =
          dbConditions.length > 0
            ? dbConditions[i % dbConditions.length].id
            : item.conditionId;

        addSimLog(`Добавление товара: ${item.nameProduct}...`);
        await productService.createProduct({
          ...item,
          conditionId,
        });
        await sleep(350);
      }

      const updatedProducts = await productService.getProducts();
      setProducts(updatedProducts);
      addSimLog(`Каталог обновлён (всего товаров: ${updatedProducts.length}).`);
      await sleep(400);

      const itemsForCart = updatedProducts.slice(0, 2);
      for (const prod of itemsForCart) {
        addSimLog(`В корзину: ${prod.nameProduct}`);
        await cartService.addToCart({ productId: prod.id, quantity: 1 });
        await sleep(300);
      }
      const updatedCart = await cartService.getCart();
      setCart(updatedCart);
      addSimLog(`Корзина обновлена (позиций: ${updatedCart?.cartItems.length ?? 0}).`);
      await sleep(400);

      const itemsForFavorite = updatedProducts.slice(0, 2);
      for (const prod of itemsForFavorite) {
        addSimLog(`В избранное: ${prod.nameProduct}`);
        await favoriteService.addFavorite(prod.id);
        await sleep(300);
      }

      let updatedFavorites = await favoriteService.getFavorite();
      setFavorites(updatedFavorites);
      addSimLog(
        `Избранное загружено (товаров: ${updatedFavorites.productIds?.length ?? 0}).`
      );
      await sleep(300);

      if (itemsForFavorite.length > 1) {
        const toRemove = itemsForFavorite[1];
        addSimLog(`Удаление из избранного: ${toRemove.nameProduct}`);
        updatedFavorites = await favoriteService.removeFavorite(toRemove.id);
        setFavorites(updatedFavorites);
        addSimLog(
          `После удаления в избранном: ${updatedFavorites.productIds?.length ?? 0}.`
        );
        await sleep(300);
      }

      const firstProduct = updatedProducts[0];
      if (firstProduct) {
        addSimLog(`Открываем чат по товару "${firstProduct.nameProduct}"...`);
        const targetUserId = firstProduct.userId || uid;

        const chat = await startOrGetChat({
          productId: firstProduct.id,
          productName: firstProduct.nameProduct,
          targetUserId,
          initiatorName: loginInput,
        });

        await handleSelectChat(chat.id);
        await sleep(500);

        addSimLog('Симуляция печати и отправка сообщения #1...');
        sendTypingStatus(chat.id, true);
        await sleep(900);
        await sendMessage({
          chatId: chat.id,
          senderName: loginInput,
          text: `Здравствуйте! Подскажите, "${firstProduct.nameProduct}" ещё в наличии?`,
          replyId: null,
        });
        sendTypingStatus(chat.id, false);
        await sleep(700);

        addSimLog('Загрузка вложения и отправка сообщения #2...');
        const mockFile = new File(
          [`Заявка на осмотр: ${firstProduct.nameProduct}`],
          'details.txt',
          { type: 'text/plain' }
        );
        const uploaded = await messengerService.uploadAttachments([mockFile]);
        await sendMessage({
          chatId: chat.id,
          senderName: loginInput,
          text: 'Прикрепил файл с вопросами по доставке.',
          replyId: null,
          attachments: uploaded,
        });
      }

      addSimLog('✅ Симуляция успешно завершена!');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Ошибка симуляции';
      addSimLog(`❌ Ошибка: ${msg}`);
      showError(error, 'Симуляция прервана');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateIncoming = async () => {
    setIsSimulating(true);
    setErrorMsg(null);
    setSimLogs([]);

    let botConnection: signalR.HubConnection | null = null;
    const myToken = tokenStorage.get();

    try {
      if (!myToken) {
        throw new Error('Сначала войдите в свой аккаунт.');
      }

      const myUserId = getCurrentUserIdFromToken();
      if (!myUserId) {
        throw new Error('Не удалось прочитать ваш UserId из токена.');
      }

      if (!isSignalRConnected) {
        await connect();
      }

      const botLogin = 'bot_buyer';
      const botPassword = 'password123';
      addSimLog(`Авторизация собеседника "${botLogin}"...`);

      try {
        await authService.login({ login: botLogin, password: botPassword });
      } catch {
        if (typeof (authService as any).register === 'function') {
          addSimLog(`Регистрируем "${botLogin}"...`);
          await (authService as any).register({
            login: botLogin,
            password: botPassword,
            email: `${botLogin}@test.local`,
          });
          await authService.login({ login: botLogin, password: botPassword });
        } else {
          throw new Error(
            `Пользователь "${botLogin}" не найден, а метод register отсутствует.`
          );
        }
      }

      const botToken = tokenStorage.get();
      const botUserId = getCurrentUserIdFromToken();

      (tokenStorage as any).set(myToken);

      if (!botToken || !botUserId) {
        throw new Error('Не удалось получить токен собеседника.');
      }

      const targetProduct = products[0];
      const productId =
        targetProduct?.id || '00000000-0000-0000-0000-000000000001';
      const productName = targetProduct?.nameProduct || 'Тестовый товар';

      addSimLog(`Открываем чат с "${botLogin}"...`);
      const chat = await startOrGetChat({
        productId,
        productName,
        targetUserId: botUserId,
        initiatorName: loginInput,
      });
      await handleSelectChat(chat.id);

      addSimLog('Собеседник подключается к SignalR...');
      botConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${MESSENGER_API_URL}/hubs/messenger`, {
          accessTokenFactory: () => botToken,
        })
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      await botConnection.start();
      await botConnection.invoke('JoinChat', chat.id);

      const incomingMessages = [
        `Привет! Увидел объявление "${productName}", ещё актуально?`,
        'Состояние действительно хорошее? Можно сегодня вечером подъехать посмотреть?',
        'Если всё ок, заберу сразу наличными или переводом 👍',
      ];

      for (const text of incomingMessages) {
        addSimLog(`"${botLogin}" печатает...`);
        await botConnection.invoke('SendTypingStatus', chat.id, true);
        await sleep(1400);

        await botConnection.invoke('SendMessage', {
          chatId: chat.id,
          senderName: botLogin,
          text,
          replyId: null,
        });
        await botConnection.invoke('SendTypingStatus', chat.id, false);
        addSimLog(`Входящее сообщение получено.`);
        await sleep(900);
      }

      addSimLog('✅ Симуляция входящих сообщений завершена!');
    } catch (error) {
      if (myToken) (tokenStorage as any).set(myToken);
      const msg = error instanceof Error ? error.message : 'Ошибка симуляции';
      addSimLog(`❌ Ошибка: ${msg}`);
      showError(error, 'Не удалось симулировать входящие сообщения');
    } finally {
      if (botConnection) {
        await botConnection.stop().catch(() => {});
      }
      setIsSimulating(false);
    }
  };

  // --- Товары, Корзина и Избранное ---

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim() || !newProductPrice) return;

    setErrorMsg(null);
    setIsCreatingProduct(true);
    try {
      await productService.createProduct({
        nameProduct: newProductName.trim(),
        price: Number(newProductPrice),
        description: newProductDescription.trim(),
        position: 'Москва',
        conditionId: CONDITION_NEW,
        imageURLs: ['https://picsum.photos/seed/newproduct/400/300'],
        tagIds: [],
      });

      setNewProductName('');
      setNewProductPrice('');
      setNewProductDescription('');
      setIsAddProductOpen(false);
      await fetchProducts();
    } catch (error) {
      showError(error, 'Ошибка при добавлении товара');
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const handleAddToCart = async (productId: string) => {
    setErrorMsg(null);
    try {
      await cartService.addToCart({ productId, quantity: 1 });
      const updatedCart = await cartService.getCart();
      setCart(updatedCart);
    } catch (error) {
      showError(error, 'Ошибка при добавлении в корзину');
    }
  };

  const handleToggleFavorite = async (productId: string) => {
    setErrorMsg(null);
    try {
      const isFav = favorites?.productIds?.includes(productId);
      const updated = isFav
        ? await favoriteService.removeFavorite(productId)
        : await favoriteService.addFavorite(productId);
      setFavorites(updated);
    } catch (error) {
      showError(error, 'Ошибка при обновлении избранного');
    }
  };

  // --- Мессенджер ---

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
    setErrorMsg(null);
    try {
      const targetUserId =
        product.userId || '00000000-0000-0000-0000-000000000000';

      const chat = await startOrGetChat({
        productId: product.id,
        productName: product.nameProduct,
        targetUserId,
        initiatorName: loginInput,
      });

      setSelectedProduct(null);
      await handleSelectChat(chat.id);
    } catch (error) {
      showError(error, 'Не удалось создать/открыть чат');
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

    setErrorMsg(null);
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
      showError(error, 'Ошибка при отправке/редактировании');
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
      <header className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
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
          {currentUserId && (
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
              Пользователь: {loginInput}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleLogin} className="flex items-center gap-2">
            <input
              type="text"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              placeholder="Логин"
              className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Пароль"
              className="w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Войти
            </button>
          </form>

          <button
            type="button"
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            {isSimulating ? 'Симуляция...' : '▶ Запустить симуляцию'}
          </button>

          <button
            type="button"
            onClick={handleSimulateIncoming}
            disabled={isSimulating}
            className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
          >
            {isSimulating ? 'Пишет...' : '💬 Мне пишут'}
          </button>
        </div>
      </header>

      {/* Лог симуляции */}
      {simLogs.length > 0 && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/70 p-3 text-xs text-violet-950">
          <div className="mb-1.5 flex items-center justify-between font-semibold">
            <span>Лог симуляции</span>
            <button
              type="button"
              onClick={() => setSimLogs([])}
              className="text-violet-500 hover:text-violet-800"
            >
              Очистить
            </button>
          </div>
          <div className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
            {simLogs.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {/* Баннер ошибок API / валидации */}
      {errorMsg && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="ml-4 font-bold hover:text-rose-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* Основная сетка */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Левая колонка: Каталог, Добавление товара, Корзина, Уведомления */}
        <div className="space-y-6 lg:col-span-5">
          {/* Каталог и форма добавления */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                Каталог ({products.length})
              </h2>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600">
                  Избранное: {favorites?.productIds?.length ?? 0}
                </span>
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  Корзина: {cart?.cartItems.length ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen((prev) => !prev)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
                >
                  {isAddProductOpen ? 'Закрыть' : '+ Добавить товар'}
                </button>
              </div>
            </div>

            {/* Форма добавления нового товара */}
            {isAddProductOpen && (
              <form
                onSubmit={handleCreateProduct}
                className="mb-5 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4"
              >
                <h3 className="text-sm font-semibold text-emerald-900">
                  Новый товар
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="Название товара"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newProductPrice}
                    onChange={(e) => setNewProductPrice(e.target.value)}
                    placeholder="Цена (₽)"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <textarea
                  rows={2}
                  value={newProductDescription}
                  onChange={(e) => setNewProductDescription(e.target.value)}
                  placeholder="Описание товара (опционально)"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isCreatingProduct}
                    className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isCreatingProduct ? 'Сохранение...' : 'Создать товар'}
                  </button>
                </div>
              </form>
            )}

            {/* Список товаров */}
            {products.length === 0 ? (
              <p className="text-sm text-slate-400">Товары не найдены</p>
            ) : (
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto pr-1">
                {products.map((p) => {
                  const isFav = favorites?.productIds?.includes(p.id);
                  const thumbUrl = getProductImageUrl(p.imageURLs?.[0]);

                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedProduct(p)}
                        className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                      >
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={p.nameProduct}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                            Нет фото
                          </div>
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setSelectedProduct(p)}
                          className="block w-full truncate text-left font-medium text-slate-900 hover:text-blue-600 hover:underline"
                        >
                          {p.nameProduct}
                        </button>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">
                            {p.price} ₽
                          </span>
                          {p.sellerLogin && <span>• {p.sellerLogin}</span>}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleFavorite(p.id)}
                          title="В избранное"
                          className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                            isFav
                              ? 'border-rose-300 bg-rose-50 text-rose-600'
                              : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {isFav ? '♥' : '♡'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddToCart(p.id)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium transition hover:bg-slate-50"
                        >
                          В корзину
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartChatWithSeller(p)}
                          className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700"
                        >
                          Чат
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Уведомления */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">
              Уведомления ({notifications.length})
            </h2>
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-400">Новых уведомлений нет</p>
            ) : (
              <ul className="max-h-44 space-y-2 overflow-y-auto">
                {notifications.map((n, idx) => (
                  <li
                    key={`${n.entityId}-${idx}`}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                  >
                    <p className="font-semibold text-slate-800">{n.title}</p>
                    <p className="text-slate-600">{n.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Правая колонка: Интерфейс Мессенджера */}
        <section className="flex h-[680px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-7">
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
                  const productName = getChatProductName(chat);
                  const interlocutorName = getInterlocutorName(chat);

                  return (
                    <button
                      key={chat.id}
                      onClick={() => handleSelectChat(chat.id)}
                      className={`w-full border-b border-slate-100 p-3.5 text-left transition ${
                        isActive
                          ? 'border-l-4 border-l-blue-600 bg-blue-50'
                          : 'hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {interlocutorName}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {new Date(chat.createAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {productName}
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
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-900">
                      {getInterlocutorName(activeChat)}
                    </h3>
                    <p className="truncate text-xs text-slate-500">
                      Товар: {getChatProductName(activeChat)}
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

                {/* Сообщения */}
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
                            className={`relative max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                              isMine
                                ? 'rounded-br-none bg-blue-600 text-white'
                                : 'rounded-bl-none border border-slate-200 bg-white text-slate-800'
                            }`}
                          >
                            {msg.reply && (
                              <div
                                className={`mb-1.5 rounded border-l-2 px-2 py-1 text-xs ${
                                  isMine
                                    ? 'border-blue-200 bg-blue-700/60 text-blue-100'
                                    : 'border-indigo-500 bg-slate-100 text-slate-600'
                                }`}
                              >
                                <p className="font-semibold">
                                  {getReplyAuthorName(msg.reply)}
                                </p>
                                <p className="truncate">{msg.reply.text}</p>
                              </div>
                            )}

                            {msg.text && (
                              <p className="whitespace-pre-wrap break-words">
                                {msg.text}
                              </p>
                            )}

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

                {/* Индикатор печати */}
                <div className="h-5 px-4 text-xs italic text-slate-400">
                  {currentTyping.length > 0 &&
                    `${getInterlocutorName(activeChat)} печатает...`}
                </div>

                {/* Плашка ответа / редактирования */}
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

                {/* Предпросмотр файлов */}
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

                {/* Форма отправки */}
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
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
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
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
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
                  Выберите диалог слева или нажмите «Чат» у любого товара
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Модальное окно просмотра товара */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedProduct.nameProduct}
                </h3>
                <p className="text-xs text-slate-500">
                  Продавец: {selectedProduct.sellerLogin || 'Неизвестно'}
                  {selectedProduct.position ? ` • ${selectedProduct.position}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Фотографии товара */}
            {selectedProduct.imageURLs && selectedProduct.imageURLs.length > 0 && (
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {selectedProduct.imageURLs.map((rawUrl, idx) => {
                  const fullUrl = getProductImageUrl(rawUrl);
                  if (!fullUrl) return null;
                  return (
                    <img
                      key={idx}
                      src={fullUrl}
                      alt={`${selectedProduct.nameProduct} ${idx + 1}`}
                      className="h-44 w-full shrink-0 rounded-xl border border-slate-200 object-cover"
                    />
                  );
                })}
              </div>
            )}

            <div className="mb-4 text-2xl font-bold text-blue-600">
              {selectedProduct.price} ₽
            </div>

            <div className="mb-6 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              {selectedProduct.description || 'Описание товара отсутствует.'}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleToggleFavorite(selectedProduct.id)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  favorites?.productIds?.includes(selectedProduct.id)
                    ? 'border-rose-300 bg-rose-50 text-rose-600'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {favorites?.productIds?.includes(selectedProduct.id)
                  ? '♥ В избранном'
                  : '♡ В избранное'}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleAddToCart(selectedProduct.id);
                  setSelectedProduct(null);
                }}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium transition hover:bg-slate-50"
              >
                В корзину
              </button>
              <button
                type="button"
                onClick={() => handleStartChatWithSeller(selectedProduct)}
                className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                Написать продавцу
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
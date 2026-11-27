'use client';

import { useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { authService } from '@/services/auth.service';
import { productService } from '@/services/product.service';
import { profileService } from '@/services/profile.service';
import { cartService } from '@/services/cart.service';
import { favoriteService } from '@/services/favorite.service';
import { messengerService } from '@/services/messenger.service';
import { useNotifications } from '@/providers/NotificationProvider';
import { useMessenger } from '@/providers/MessengerProvider';
import {
  ConditionResponse,
  ProductFilterRequest,
  ProductsResponse,
  TagResponse,
} from '@/dtos/product/product.dto';
import {
  ProfileRequest,
  ProfileResponse,
} from '@/dtos/profile/profile.dto';
import { CartResponse, FavoriteResponse } from '@/dtos/cart/cart.dto';
import { tokenStorage } from '@/lib/http';

const MESSENGER_API_URL =
  process.env.NEXT_PUBLIC_MESSENGER_API_URL || 'http://localhost:5214';
const PRODUCT_API_URL =
  process.env.NEXT_PUBLIC_PRODUCT_API_URL || 'http://localhost:5030';
const PROFILE_API_URL =
  process.env.NEXT_PUBLIC_PROFILE_API_URL || 'http://localhost:5050';

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

const INITIAL_FILTER: ProductFilterRequest = {
  search: '',
  minPrice: undefined,
  maxPrice: undefined,
  conditionId: '',
  tagIds: [],
  position: '',
  minRating: undefined,
  sortBy: 'newest',
  page: 1,
  pageSize: 20,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function resolveAssetUrl(baseUrl: string, url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
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

async function createMockAvatarFile(filename = 'avatar.png'): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#4f46e5';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HS', 64, 64);
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  return new File([blob || new Uint8Array([137, 80, 78, 71])], filename, {
    type: 'image/png',
  });
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

  // Профиль пользователя
  const [myProfile, setMyProfile] = useState<ProfileResponse | null>(null);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileDescription, setProfileDescription] = useState('');
  const [profilePhoneNumber, setProfilePhoneNumber] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Фильтрация и справочники
  const [conditions, setConditions] = useState<ConditionResponse[]>([]);
  const [tags, setTags] = useState<TagResponse[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filter, setFilter] = useState<ProductFilterRequest>(INITIAL_FILTER);

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

  const syncProfileForm = (profile: ProfileResponse | null) => {
    if (!profile) {
      setProfileName('');
      setProfileDescription('');
      setProfilePhoneNumber('');
      return;
    }
    setProfileName(profile.name ?? '');
    setProfileDescription(profile.description ?? '');
    setProfilePhoneNumber(profile.phoneNumber ?? '');
  };

  const fetchMyProfile = async () => {
    if (!tokenStorage.get()) {
      setMyProfile(null);
      return null;
    }
    try {
      const profile = await profileService.getMyProfile();
      setMyProfile(profile);
      syncProfileForm(profile);
      return profile;
    } catch (error) {
      showError(error, 'Ошибка при загрузке профиля');
      return null;
    }
  };

  const fetchProducts = async (customFilter?: ProductFilterRequest) => {
    try {
      const activeFilter = customFilter ?? filter;
      const data = await productService.getProducts(activeFilter);
      setProducts(data);
    } catch (error) {
      showError(error, 'Ошибка при загрузке товаров');
    }
  };

  const fetchDictionaries = async () => {
    try {
      const [condList, tagList] = await Promise.all([
        productService.getConditions(),
        productService.getTags(),
      ]);
      setConditions(condList);
      setTags(tagList);
    } catch {
      // Справочники опциональны
    }
  };

  useEffect(() => {
    const uid = getCurrentUserIdFromToken();
    setCurrentUserId(uid);
    fetchProducts(INITIAL_FILTER);
    fetchDictionaries();
    if (uid) {
      fetchMyProfile();
    }
  }, []);

  // --- Обработчики фильтров ---

  const handleApplyFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextFilter = { ...filter, page: 1 };
    setFilter(nextFilter);
    await fetchProducts(nextFilter);
  };

  const handleResetFilter = async () => {
    setFilter(INITIAL_FILTER);
    await fetchProducts(INITIAL_FILTER);
  };

  const handleToggleFilterTag = (tagId: string) => {
    setFilter((prev) => {
      const current = prev.tagIds ?? [];
      const exists = current.includes(tagId);
      return {
        ...prev,
        tagIds: exists
          ? current.filter((id) => id !== tagId)
          : [...current, tagId],
      };
    });
  };

  // --- Обработчики профиля ---

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSavingProfile(true);
    try {
      const payload: ProfileRequest = {
        name: profileName.trim() || loginInput,
        description: profileDescription.trim() || null,
        phoneNumber: profilePhoneNumber.trim() || null,
      };

      const saved = myProfile
        ? await profileService.updateMyProfile(payload)
        : await profileService.createProfile(payload);

      setMyProfile(saved);
      syncProfileForm(saved);
      setIsProfileEditOpen(false);
    } catch (error) {
      showError(error, 'Ошибка при сохранении профиля');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUploadProfileAvatar = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setIsUploadingAvatar(true);
    try {
      await profileService.addImageToMyProfile(file);
      await fetchMyProfile();
    } catch (error) {
      showError(error, 'Ошибка при загрузке фото профиля');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleDeleteProfileImage = async (imageId: string) => {
    setErrorMsg(null);
    try {
      await profileService.deleteMyProfileImage(imageId);
      await fetchMyProfile();
    } catch (error) {
      showError(error, 'Ошибка при удалении фото профиля');
    }
  };

  const handleDeleteMyProfile = async () => {
    setErrorMsg(null);
    try {
      await profileService.deleteMyProfile();
      setMyProfile(null);
      syncProfileForm(null);
      setIsProfileEditOpen(false);
    } catch (error) {
      showError(error, 'Ошибка при удалении профиля');
    }
  };

  const handleAttachProductToProfile = async (productId: string) => {
    setErrorMsg(null);
    try {
      await profileService.addProductToMyProfile(productId);
      await fetchMyProfile();
    } catch (error) {
      showError(error, 'Ошибка при привязке товара к профилю');
    }
  };

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
      await fetchMyProfile();
      const userCart = await cartService.getCart();
      setCart(userCart);
      const userFavorites = await favoriteService.getFavorite();
      setFavorites(userFavorites);
      await connect();
    } catch (error) {
      showError(error, 'Ошибка входа');
    }
  };

  // --- Полная симуляция (Авторизация -> Профиль -> Товары -> Корзина -> Избранное -> Чат) ---

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
      await sleep(350);

      // 1. Симуляция профиля
      addSimLog('Проверка профиля пользователя...');
      let currentProfile = await profileService.getMyProfile();
      const profilePayload: ProfileRequest = {
        name: `Продавец ${loginInput}`,
        description: 'Надёжный продавец на HomeSeller. Быстрая отправка.',
        phoneNumber: '+7 (999) 123-45-67',
      };

      if (!currentProfile) {
        addSimLog('Профиль не найден — создаём новый профиль...');
        currentProfile = await profileService.createProfile(profilePayload);
      } else {
        addSimLog('Профиль найден — обновляем данные профиля...');
        currentProfile = await profileService.updateMyProfile(profilePayload);
      }
      setMyProfile(currentProfile);
      syncProfileForm(currentProfile);
      await sleep(300);

      addSimLog('Загрузка аватара в профиль...');
      try {
        const avatarFile = await createMockAvatarFile('sim-avatar.png');
        await profileService.addImageToMyProfile(avatarFile);
        const refreshedProfile = await profileService.getMyProfile();
        setMyProfile(refreshedProfile);
        addSimLog('Фото профиля успешно загружено.');
      } catch (imgErr) {
        addSimLog(
          `⚠️ Не удалось загрузить фото профиля: ${
            imgErr instanceof Error ? imgErr.message : 'ошибка'
          }`
        );
      }
      await sleep(350);

      // 2. Загрузка справочников и создание товаров с привязкой к профилю
      let dbConditions: ConditionResponse[] = [];
      try {
        dbConditions = await productService.getConditions();
        setConditions(dbConditions);
        addSimLog(`Загружено состояний из БД: ${dbConditions.length}`);
      } catch {
        addSimLog(
          'Не удалось загрузить состояния из БД, используем ID по умолчанию.'
        );
      }

      for (let i = 0; i < MOCK_PRODUCTS.length; i++) {
        const item = MOCK_PRODUCTS[i];
        const conditionId =
          dbConditions.length > 0
            ? dbConditions[i % dbConditions.length].id
            : item.conditionId;

        addSimLog(`Создание товара: ${item.nameProduct}...`);
        const createdProd = await productService.createProduct({
          ...item,
          conditionId,
        });

        if (createdProd?.id) {
          addSimLog(`Привязка товара "${item.nameProduct}" к профилю...`);
          await profileService
            .addProductToMyProfile(createdProd.id)
            .catch(() => {});
        }
        await sleep(300);
      }

      const finalProfile = await profileService.getMyProfile();
      setMyProfile(finalProfile);

      const updatedProducts = await productService.getProducts(filter);
      setProducts(updatedProducts);
      addSimLog(`Каталог обновлён (всего товаров: ${updatedProducts.length}).`);
      await sleep(350);

      // 3. Корзина
      const itemsForCart = updatedProducts.slice(0, 2);
      for (const prod of itemsForCart) {
        addSimLog(`В корзину: ${prod.nameProduct}`);
        await cartService.addToCart({ productId: prod.id, quantity: 1 });
        await sleep(250);
      }
      const updatedCart = await cartService.getCart();
      setCart(updatedCart);
      addSimLog(
        `Корзина обновлена (позиций: ${updatedCart?.cartItems.length ?? 0}).`
      );
      await sleep(350);

      // 4. Избранное
      const itemsForFavorite = updatedProducts.slice(0, 2);
      for (const prod of itemsForFavorite) {
        addSimLog(`В избранное: ${prod.nameProduct}`);
        await favoriteService.addFavorite(prod.id);
        await sleep(250);
      }

      let updatedFavorites = await favoriteService.getFavorite();
      setFavorites(updatedFavorites);
      addSimLog(
        `Избранное загружено (товаров: ${updatedFavorites.productIds?.length ?? 0}).`
      );
      await sleep(250);

      if (itemsForFavorite.length > 1) {
        const toRemove = itemsForFavorite[1];
        addSimLog(`Удаление из избранного: ${toRemove.nameProduct}`);
        updatedFavorites = await favoriteService.removeFavorite(toRemove.id);
        setFavorites(updatedFavorites);
        addSimLog(
          `После удаления в избранном: ${updatedFavorites.productIds?.length ?? 0}.`
        );
        await sleep(250);
      }

      // 5. Мессенджер
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
        await sleep(400);

        addSimLog('Симуляция печати и отправка сообщения #1...');
        sendTypingStatus(chat.id, true);
        await sleep(800);
        await sendMessage({
          chatId: chat.id,
          senderName: loginInput,
          text: `Здравствуйте! Подскажите, "${firstProduct.nameProduct}" ещё в наличии?`,
          replyId: null,
        });
        sendTypingStatus(chat.id, false);
        await sleep(600);

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

      addSimLog('✅ Полная симуляция (включая профиль) успешно завершена!');
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
      const created = await productService.createProduct({
        nameProduct: newProductName.trim(),
        price: Number(newProductPrice),
        description: newProductDescription.trim(),
        position: 'Москва',
        conditionId: CONDITION_NEW,
        imageURLs: ['https://picsum.photos/seed/newproduct/400/300'],
        tagIds: [],
      });

      if (myProfile && created?.id) {
        await profileService
          .addProductToMyProfile(created.id)
          .catch(() => {});
        await fetchMyProfile();
      }

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

  // Извлечение полей строго по интерфейсу ProfileResponse
  const profileImages = myProfile?.imageURLs ?? [];
  const profileAvatarUrl = resolveAssetUrl(
    PROFILE_API_URL,
    profileImages[0]?.imageURL ?? null
  );
  const profileProductIds =
    myProfile?.productUsers?.map((pu) => pu.productId) ?? [];

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
        {/* Левая колонка: Профиль, Каталог с фильтрацией, Уведомления */}
        <div className="space-y-6 lg:col-span-5">
          {/* Карточка профиля пользователя */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Мой профиль</h2>
              {currentUserId && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsProfileEditOpen((prev) => !prev)}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {isProfileEditOpen
                      ? 'Отмена'
                      : myProfile
                      ? 'Редактировать'
                      : '+ Создать профиль'}
                  </button>
                  {myProfile && (
                    <button
                      type="button"
                      onClick={handleDeleteMyProfile}
                      title="Удалить профиль"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
                    >
                      Удалить
                    </button>
                  )}
                </div>
              )}
            </div>

            {!currentUserId ? (
              <p className="text-sm text-slate-400">
                Войдите в аккаунт, чтобы управлять профилем.
              </p>
            ) : myProfile ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-indigo-50">
                    {profileAvatarUrl ? (
                      <img
                        src={profileAvatarUrl}
                        alt={myProfile.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-indigo-600">
                        {(myProfile.name || loginInput)
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">
                      {myProfile.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {myProfile.phoneNumber || 'Телефон не указан'}
                    </p>
                    <p className="mt-0.5 text-xs text-indigo-600">
                      Товаров в профиле: {profileProductIds.length}
                    </p>
                  </div>

                  <div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadProfileAvatar}
                    />
                    <button
                      type="button"
                      disabled={isUploadingAvatar}
                      onClick={() => avatarInputRef.current?.click()}
                      className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                    >
                      {isUploadingAvatar ? 'Загрузка...' : '📷 Фото'}
                    </button>
                  </div>
                </div>

                {myProfile.description && (
                  <p className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
                    {myProfile.description}
                  </p>
                )}

                {/* Галерея фото профиля с возможностью удаления */}
                {profileImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {profileImages.map((img, idx) => {
                      const imgUrl = resolveAssetUrl(
                        PROFILE_API_URL,
                        img.imageURL
                      );
                      if (!imgUrl) return null;
                      return (
                        <div
                          key={img.id}
                          className="group relative h-12 w-12 overflow-hidden rounded-lg border border-slate-200"
                        >
                          <img
                            src={imgUrl}
                            alt={`Фото профиля ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteProfileImage(img.id)}
                            title="Удалить фото"
                            className="absolute inset-0 hidden items-center justify-center bg-black/50 text-xs font-bold text-white group-hover:flex"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Профиль ещё не создан. Нажмите «+ Создать профиль» или запустите
                симуляцию.
              </p>
            )}

            {/* Форма создания / редактирования профиля */}
            {isProfileEditOpen && currentUserId && (
              <form
                onSubmit={handleSaveProfile}
                className="mt-4 space-y-2.5 rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 text-xs"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Имя / название магазина"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={profilePhoneNumber}
                    onChange={(e) => setProfilePhoneNumber(e.target.value)}
                    placeholder="Телефон (+7...)"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <textarea
                  rows={2}
                  value={profileDescription}
                  onChange={(e) => setProfileDescription(e.target.value)}
                  placeholder="О себе / описание продавца"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="rounded-lg bg-indigo-600 px-3.5 py-1.5 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSavingProfile ? 'Сохранение...' : 'Сохранить профиль'}
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Каталог, фильтрация и добавление товара */}
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

            {/* Поиск и фильтры */}
            <form onSubmit={handleApplyFilter} className="mb-4 space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={filter.search ?? ''}
                  onChange={(e) =>
                    setFilter((prev) => ({ ...prev, search: e.target.value }))
                  }
                  placeholder="Поиск по названию или описанию..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsFilterOpen((prev) => !prev)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    isFilterOpen
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Фильтры
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
                >
                  Найти
                </button>
              </div>

              {isFilterOpen && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      value={filter.minPrice ?? ''}
                      onChange={(e) =>
                        setFilter((prev) => ({
                          ...prev,
                          minPrice: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        }))
                      }
                      placeholder="Цена от (₽)"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      min="0"
                      value={filter.maxPrice ?? ''}
                      onChange={(e) =>
                        setFilter((prev) => ({
                          ...prev,
                          maxPrice: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        }))
                      }
                      placeholder="Цена до (₽)"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={filter.position ?? ''}
                      onChange={(e) =>
                        setFilter((prev) => ({
                          ...prev,
                          position: e.target.value,
                        }))
                      }
                      placeholder="Город / локация"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      min="1"
                      max="5"
                      step="0.5"
                      value={filter.minRating ?? ''}
                      onChange={(e) =>
                        setFilter((prev) => ({
                          ...prev,
                          minRating: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        }))
                      }
                      placeholder="Мин. рейтинг (1-5)"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={filter.conditionId ?? ''}
                      onChange={(e) =>
                        setFilter((prev) => ({
                          ...prev,
                          conditionId: e.target.value || undefined,
                        }))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Любое состояние</option>
                      {conditions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={filter.sortBy ?? 'newest'}
                      onChange={(e) =>
                        setFilter((prev) => ({
                          ...prev,
                          sortBy: e.target
                            .value as ProductFilterRequest['sortBy'],
                        }))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="newest">Сначала новые</option>
                      <option value="price_asc">Дешевле</option>
                      <option value="price_desc">Дороже</option>
                      <option value="rating_desc">По рейтингу</option>
                    </select>
                  </div>

                  {tags.length > 0 && (
                    <div>
                      <p className="mb-1.5 font-medium text-slate-600">Теги:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag) => {
                          const selected = filter.tagIds?.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => handleToggleFilterTag(tag.id)}
                              className={`rounded-full border px-2.5 py-0.5 transition ${
                                selected
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleResetFilter}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-slate-600 hover:bg-slate-100"
                    >
                      Сбросить
                    </button>
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
                    >
                      Применить
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* Список товаров */}
            {products.length === 0 ? (
              <p className="text-sm text-slate-400">Товары не найдены</p>
            ) : (
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto pr-1">
                {products.map((p) => {
                  const isFav = favorites?.productIds?.includes(p.id);
                  const isInMyProfile = profileProductIds.includes(p.id);
                  const thumbUrl = resolveAssetUrl(
                    PRODUCT_API_URL,
                    p.imageURLs?.[0]
                  );

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
                          {isInMyProfile && (
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
                              В профиле
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-1.5">
                        {myProfile && !isInMyProfile && (
                          <button
                            type="button"
                            onClick={() => handleAttachProductToProfile(p.id)}
                            title="Привязать к моему профилю"
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100"
                          >
                            +Проф
                          </button>
                        )}
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
        <section className="flex h-[780px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-7">
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
                  {selectedProduct.position
                    ? ` • ${selectedProduct.position}`
                    : ''}
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
            {selectedProduct.imageURLs &&
              selectedProduct.imageURLs.length > 0 && (
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                  {selectedProduct.imageURLs.map((rawUrl, idx) => {
                    const fullUrl = resolveAssetUrl(PRODUCT_API_URL, rawUrl);
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
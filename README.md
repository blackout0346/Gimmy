# Gimmy

Микросервисный маркетплейс и платформа для онлайн-торговли со встроенным мессенджером в реальном времени и системой уведомлений.

---

## Архитектура и микросервисы

Проект построен на микросервисной архитектуре на базе **.NET 10 / ASP.NET Core** с асинхронным взаимодействием через **RabbitMQ (MassTransit)** и Real-Time коммуникацией через **SignalR**.

| Сервис | Описание | Основные технологии |
| :--- | :--- | :--- |
| **AuthService** | Регистрация, аутентификация, хэширование паролей и генерация JWT-токенов | ASP.NET Core, EF Core, PostgreSQL, JWT, Redis, MassTransit |
| **UserService** | Управление профилями пользователей, загрузка аватаров (`/ProfileAttachment`), обработка RPC-запросов имени пользователя | ASP.NET Core, EF Core, PostgreSQL, MassTransit (`GetUserNameConsumer`), Redis |
| **ProductService** | Каталог товаров, теги и подкатегории, рейтинги и отзывы, начальное заполнение БД из `initData.json`, хранение изображений (`/imageStore`) | ASP.NET Core, EF Core, PostgreSQL, Redis, MassTransit (`UserDeleteConsumer`) |
| **CartService** | Управление корзиной покупателя | ASP.NET Core, EF Core, PostgreSQL, Redis |
| **MessengerService** | Личные чаты в реальном времени, отправка и скачивание вложений (`/AttachmentMessage`) | ASP.NET Core, SignalR (`/hubs/messenger`), EF Core, PostgreSQL, Redis, MassTransit |
| **NotificationService** | Мгновенная доставка уведомлений клиентам по WebSockets | ASP.NET Core, SignalR (`/NotificationHub`), MassTransit (`NotificationConsumer`), Redis |

---

## Технологический стек

* **Backend:** C#, .NET 10, ASP.NET Core Web API
* **Базы данных и ORM:** PostgreSQL 18, Entity Framework Core (автоматические Code-First миграции при запуске)
* **Кэширование:** Redis 7 (`StackExchange.Redis`), `IMemoryCache`
* **Брокер сообщений:** RabbitMQ 4 + MassTransit (Event-Driven взаимодействие, Request/Response, Retry-политики)
* **Real-Time:** ASP.NET Core SignalR (аутентификация через query-параметр `access_token`)
* **Безопасность и стабильность:** JWT Bearer Authentication (`ClockSkew = Zero`), Rate Limiting (`SlidingWindowLimiter`: 100 req/sec), CORS (`http://localhost:3000`)
* **Документация API:** Swagger / OpenAPI с поддержкой Bearer-авторизации
* **Инфраструктура:** Docker, Docker Compose, `DotNetEnv` (`.env`)

---

## Ключевые особенности

* **Автоматическое переключение БД (Failover):** При старте каждый сервис проверяет доступность удаленной базы (`NpgsqlConnectionVPS`). Если VPS недоступен, происходит автоматическое переключение на локальный инстанс PostgreSQL (`NpgsqlConnectionLocal`).
* **Автоматические миграции и сидинг:** При запуске сервисов применяются актуальные миграции EF Core (`Database.MigrateAsync()`). В `ProductService` реализована начальная инициализация каталога, тегов, изображений и отзывов из `initData.json`.
* **Работа с медиафайлами и вложениями:**
  * Изображения товаров и отзывов раздаются через `/imageStore`.
  * Аватары пользователей хранятся и отдаются через `/ProfileAttachment`.
  * Вложения мессенджера (`/AttachmentMessage`) поддерживают любые типы файлов: изображения отображаются напрямую, а остальные файлы отдаются с заголовком `Content-Disposition: attachment`.

---

## Быстрый старт

### 1. Предварительные требования

* [.NET 10 SDK](https://dotnet.microsoft.com/download)
* [Docker](https://www.docker.com/) и Docker Compose

### 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта и укажите параметры подключения к инфраструктуре и настройки JWT:

```env
# PostgreSQL
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=HomeSellerDB
DB_PORT=5432

ConnectionStrings__NpgsqlConnectionVPS=Host=your_vps_ip;Port=5432;Database=HomeSellerDB;Username=postgres;Password=your_postgres_password
ConnectionStrings__NpgsqlConnectionLocal=Host=localhost;Port=5432;Database=HomeSellerDB;Username=postgres;Password=your_postgres_password

# Redis
Redis__Host=localhost
Redis__Port=6379
Redis__Password=your_redis_password

# RabbitMQ
RabbitMQ__HostName=localhost
RabbitMQ__Username=guest
RabbitMQ__Password=guest

# JWT
Jwt__Issuer=HomeSeller
Jwt__Audience=HomeSellerClient
Jwt__Key=your_super_secret_jwt_key_at_least_32_characters

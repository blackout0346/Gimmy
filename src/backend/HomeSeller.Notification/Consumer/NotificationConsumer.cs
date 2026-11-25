
using HomeSeller.Notification.Models;
using HomeSeller.Notification.Services;
using HomeSeller.Shared.EventMessenger;
using HomeSeller.Shared.EventProduct;
using HomeSeller.Shared.EventProfle;
using HomeSeller.Shared.EventUser;
using MassTransit;
using Microsoft.AspNetCore.SignalR;
namespace HomeSeller.Notification.Consumer;

public class NotificationConsumer : 
    IConsumer<ProductCreatedEvent>,
    IConsumer<ProductUpdatedEvent>,
    IConsumer<ProductDeletedEvent>,
    IConsumer<UserRegisteredEvent>,
    IConsumer<UserLoginEvent>,
    IConsumer<UserChangePasswordEvent>,
    IConsumer<UserDeletedEvent>,
    IConsumer<MessageSentEvent>,
    IConsumer<ChatCreatedEvent>,
    IConsumer<ProfileUpdateEvent>
{
    private readonly IHubContext<NotificationHub, INotificationClient> _hubContext;
    private readonly ILogger<NotificationConsumer> _logger;

    public NotificationConsumer(IHubContext<NotificationHub, INotificationClient> hubContext,
        ILogger<NotificationConsumer> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }
    
  public async Task Consume(ConsumeContext<ProductCreatedEvent> context)
    {
        var msg = context.Message;
        var name = string.IsNullOrWhiteSpace(msg.productName) ? "Без названия" : msg.productName;

        await SendToUserAsync(msg.UserId, new NotificationDto(
            Type: nameof(ProductCreatedEvent),
            Title: "Товар опубликован",
            Message: $"Ваш товар «{name}» успешно создан ({msg.CreateAt:dd.MM.yyyy в HH:mm} UTC) и уже отображается в общем каталоге для покупателей.",
            EntityId: msg.ProductId,
            CreatedAt: msg.CreateAt
        ));
    }

    public async Task Consume(ConsumeContext<ProductUpdatedEvent> context)
    {
        var msg = context.Message;
        var name = string.IsNullOrWhiteSpace(msg.productName) ? "Без названия" : msg.productName;

        await SendToUserAsync(msg.UserId, new NotificationDto(
            Type: nameof(ProductUpdatedEvent),
            Title: "Товар обновлён",
            Message: $"Информация о товаре «{name}» была успешно обновлена ({msg.UpdateAt:dd.MM.yyyy в HH:mm} UTC). Актуальные данные уже доступны в карточке.",
            EntityId: msg.ProductId,
            CreatedAt: msg.UpdateAt
        ));
    }

    public async Task Consume(ConsumeContext<ProductDeletedEvent> context)
    {
        var msg = context.Message;
        var name = string.IsNullOrWhiteSpace(msg.productName) ? "Без названия" : msg.productName;

        await SendToUserAsync(msg.UserId, new NotificationDto(
            Type: nameof(ProductDeletedEvent),
            Title: "Товар удалён",
            Message: $"Товар «{name}» был снят с публикации и полностью удалён из вашего каталога ({msg.DeleteAt:dd.MM.yyyy в HH:mm} UTC).",
            EntityId: msg.ProductId,
            CreatedAt: msg.DeleteAt
        ));
    }

    public async Task Consume(ConsumeContext<UserRegisteredEvent> context)
    {
        var msg = context.Message;

        await SendToUserAsync(msg.UserId, new NotificationDto(
            Type: nameof(UserRegisteredEvent),
            Title: "Добро пожаловать в Gimmy!",
            Message: $"Аккаунт «{msg.Login}» успешно зарегистрирован. Теперь вы можете добавлять свои товары, управлять каталогом и отслеживать активность.",
            EntityId: msg.UserId,
            CreatedAt: DateTime.UtcNow
        ));
    }

    public async Task Consume(ConsumeContext<UserLoginEvent> context)
    {
        var msg = context.Message;
        var loginTime = DateTime.UtcNow;

        await SendToUserAsync(msg.UserId, new NotificationDto(
            Type: nameof(UserLoginEvent),
            Title: "Выполнен вход в аккаунт",
            Message: $"В ваш профиль «{msg.Login}» выполнен вход ({loginTime:dd.MM.yyyy в HH:mm} UTC). Если это были не вы, немедленно смените пароль в настройках безопасности.",
            EntityId: msg.UserId,
            CreatedAt: loginTime
        ));
    }

    public async Task Consume(ConsumeContext<UserChangePasswordEvent> context)
    {
        var msg = context.Message;
        var changeTime = DateTime.UtcNow;

        await SendToUserAsync(msg.UserId, new NotificationDto(
            Type: nameof(UserChangePasswordEvent),
            Title: "Пароль успешно изменён",
            Message: $"Пароль для учётной записи «{msg.Login}» был обновлён ({changeTime:dd.MM.yyyy в HH:mm} UTC). Для входа теперь используйте новые данные.",
            EntityId: msg.UserId,
            CreatedAt: changeTime
        ));
    }

    public async Task Consume(ConsumeContext<UserDeletedEvent> context)
    {
        var msg = context.Message;

        await SendToUserAsync(msg.UserId, new NotificationDto(
            Type: nameof(UserDeletedEvent),
            Title: "Аккаунт удалён",
            Message: $"Учётная запись «{msg.Login}» и все связанные с ней данные были безвозвратно удалены ({msg.DeleteAt:dd.MM.yyyy в HH:mm} UTC).",
            EntityId: msg.UserId,
            CreatedAt: msg.DeleteAt
        ));
    }
    public async Task Consume(ConsumeContext<MessageSentEvent> context)
    {
        var msg = context.Message;
        var sender = string.IsNullOrWhiteSpace(msg.SenderName) ? "Пользователь" : msg.SenderName;
        
      
        var preview = string.IsNullOrWhiteSpace(msg.Text)
            ? "Отправлено вложение"
            : msg.Text.Length > 80 
                ? $"{msg.Text[..80]}..." 
                : msg.Text;

        await SendToUserAsync(msg.ReceiverId, new NotificationDto(
            Type: nameof(MessageSentEvent),
            Title: $"Сообщение от {sender}",
            Message: $"«{preview}» ({msg.SentAt:dd.MM.yyyy в HH:mm} UTC)",
            EntityId: msg.ChatId,
            CreatedAt: msg.SentAt
        ));
    }

    public async Task Consume(ConsumeContext<ChatCreatedEvent> context)
    {
        var msg = context.Message;
        var initiator = string.IsNullOrWhiteSpace(msg.InitiatorName) ? "Пользователь" : msg.InitiatorName;

        var text = string.IsNullOrWhiteSpace(msg.ProductName)
            ? $"«{initiator}» начал с вами новый диалог ({msg.CreatedAt:dd.MM.yyyy в HH:mm} UTC)."
            : $"«{initiator}» начал с вами диалог по товару «{msg.ProductName}» ({msg.CreatedAt:dd.MM.yyyy в HH:mm} UTC).";

        await SendToUserAsync(msg.ReceiverId, new NotificationDto(
            Type: nameof(ChatCreatedEvent),
            Title: "Новый диалог",
            Message: text,
            EntityId: msg.ChatId,
            CreatedAt: msg.CreatedAt
        ));
    }
    public async Task Consume(ConsumeContext<ProfileUpdateEvent> context)
    {
        var msg = context.Message;
        var initiator = string.IsNullOrWhiteSpace(msg.name) ? "Пользователь" : msg.name;

        await SendToUserAsync(msg.UserId, new NotificationDto(
            Type: nameof(ProfileUpdateEvent),
            Title: "Профиль обновлён",
            Message: $"{initiator}, данные вашего профиля успешно обновлены.",
            EntityId: msg.UserId,
            CreatedAt: msg.updatedAt
        ));
    }
    private async Task SendToUserAsync(Guid userId, NotificationDto notification)
    {
        _logger.LogInformation($"Отправка уведомления {notification.Type} пользователю: {userId}",notification.Type, userId);
        await _hubContext.Clients.User(userId.ToString()).ReceiveNotification(notification);
    }


  
}
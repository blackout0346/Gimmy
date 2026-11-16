namespace HomeSeller.Notification.Models;

public record NotificationDto(
    string Type,
    string Title,
    string Message,
    Guid EntityId,
    DateTime CreatedAt);
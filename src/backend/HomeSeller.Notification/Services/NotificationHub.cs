using HomeSeller.Notification.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace HomeSeller.Notification.Services;

public interface INotificationClient
{
    Task ReceiveNotification(NotificationDto notification);
}
[Authorize]
public class NotificationHub : Hub<INotificationClient>
{
    private readonly ILogger<NotificationHub> _logger;

    public NotificationHub(ILogger<NotificationHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Клиент подключился: ConnectionId={ConnectionId}, UserIdentifier={UserId}",
            Context.ConnectionId, Context.UserIdentifier ?? "NULL");
        await base.OnConnectedAsync();
    }
}
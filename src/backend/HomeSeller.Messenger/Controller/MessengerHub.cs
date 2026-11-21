
using System.Security.Claims;
using HomeSeller.Messenger.DTO.Messanger;
using HomeSeller.Messenger.Interface;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace HomeSeller.Messenger.Controller;

[Authorize]
public class MessengerHub : Hub<IMessengerClient>
{
    private readonly IMessangerService _messangerService;
    private readonly ILogger<MessengerHub> _logger;

    public MessengerHub(IMessangerService messangerService, ILogger<MessengerHub> logger)
    {
        _messangerService = messangerService;
        _logger = logger;
    }
    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();
        
      
        await Groups.AddToGroupAsync(Context.ConnectionId, GetUserGroup(userId));

      
        var userChats = await _messangerService.GetUserChatsAsync(userId);
        foreach (var chat in userChats)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, GetChatGroup(chat.Id));
        }

        _logger.LogInformation("Пользователь {UserId} подключился к SignalR (ConnectionId: {ConnectionId})", userId, Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();
        _logger.LogInformation("Пользователь {UserId} отключился от SignalR", userId);
        await base.OnDisconnectedAsync(exception);
    }


    public async Task JoinChat(Guid chatId)
    {
        var userId = GetUserId();
  
        await _messangerService.GetChatHistoryAsync(userId, new GetChatHistoryRequest { ChatId = chatId, Page = 1, PageSize = 1 });
        await Groups.AddToGroupAsync(Context.ConnectionId, GetChatGroup(chatId));
    }


    public async Task SendMessage(SendMessageRequest request)
    {
        var userId = GetUserId();
        var response = await _messangerService.SendMessageAsync(userId, request);
        

        await Clients.Group(GetChatGroup(request.ChatId)).ReceiveMessage(response);
    }

    public async Task EditMessage(EditMessageRequest request)
    {
        var userId = GetUserId();
        var response = await _messangerService.EditMessageAsync(userId, request);
        
        await Clients.Group(GetChatGroup(response.ChatId)).MessageEdited(response);
    }


    public async Task DeleteMessage(DeleteMessageRequest request)
    {
        var userId = GetUserId();
        var message = await _messangerService.GetMessageByIdAsync(request.MessageId);
        if (message is null) return;

        await _messangerService.DeleteMessageAsync(userId, request);
        
        await Clients.Group(GetChatGroup(message.ChatId)).MessageDeleted(message.ChatId, request.MessageId);
    }


    public async Task SendTypingStatus(Guid chatId, bool isTyping)
    {
        var userId = GetUserId();
        await Clients.OthersInGroup(GetChatGroup(chatId)).UserTyping(chatId, userId, isTyping);
    }

    private Guid GetUserId()
    {
        var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                    ?? Context.User?.FindFirst("sub")?.Value;

        if (!Guid.TryParse(claim, out var userId))
            throw new HubException("Не удалось определить идентификатор пользователя.");

        return userId;
    }

    public static string GetChatGroup(Guid chatId) => $"chat:{chatId}";
    public static string GetUserGroup(Guid userId) => $"user:{userId}";
}
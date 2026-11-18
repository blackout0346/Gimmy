using HomeSeller.Messenger.DTO.Messanger;
using HomeSeller.Messenger.Interface;
using HomeSeller.Messenger.Models;
using HomeSeller.Shared.CacheHelper;
using HomeSeller.Shared.EventMessenger;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

namespace HomeSeller.Messenger.Services;

public class MessangerService : IMessangerService
{
    private readonly ILogger<MessangerService> _logger;
    private readonly IDatabase _redis;
    private readonly IMessangerStore _store;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly TimeSpan? _cacheExpiry = TimeSpan.FromMinutes(5);

    public MessangerService(
        IMessangerStore store,
        IPublishEndpoint publishEndpoint,
        IConnectionMultiplexer muxer,
        ILogger<MessangerService> logger)
    {
        _store = store;
        _redis = muxer.GetDatabase();
        _publishEndpoint = publishEndpoint;
        _logger = logger;
    }

    public async Task<MessageResponse?> GetMessageByIdAsync(Guid messageId)
    {
        var cacheKey = $"messenger:msg:{messageId}";
        var cached = await CacheHelper.GetCacheAsync<MessageResponse>(_redis, _logger, cacheKey);
        if (cached is not null)
            return cached;

        var message = await _store.GetMessageAsync(messageId);
        if (message is null)
            return null;

        var response = MapToMessageResponse(message);
        await CacheHelper.SetCacheAsync(_redis, _logger, response, cacheKey, _cacheExpiry);
        return response;
    }

    public async Task<ChatHistoryResponse> GetChatHistoryAsync(Guid userId, GetChatHistoryRequest request)
    {
        var chat = await _store.GetChatAsync(request.ChatId)
            ?? throw new KeyNotFoundException($"Чат {request.ChatId} не найден.");

        if (chat.UserId1 != userId && chat.UserId2 != userId)
            throw new UnauthorizedAccessException("Нет доступа к этому чату.");

        int page = request.Page < 1 ? 1 : request.Page;
        int pageSize = request.PageSize < 1 ? 50 : request.PageSize;

        var cacheKey = $"messenger:chat:{request.ChatId}:history:p{page}:s{pageSize}";
        if (page == 1)
        {
            var cached = await CacheHelper.GetCacheAsync<ChatHistoryResponse>(_redis, _logger, cacheKey);
            if (cached is not null)
                return cached;
        }

        int skip = (page - 1) * pageSize;
        var messages = await _store.GetChatMessagesAsync(request.ChatId, skip, pageSize);
        messages.Reverse();

        var response = new ChatHistoryResponse
        {
            ChatId = request.ChatId,
            Page = page,
            PageSize = pageSize,
            Messages = messages.Select(MapToMessageResponse).ToList()
        };

        if (page == 1)
        {
            await CacheHelper.SetCacheAsync(_redis, _logger, response, cacheKey, _cacheExpiry);
        }

        return response;
    }

    public async Task<MessageResponse> SendMessageAsync(Guid userId, SendMessageRequest request)
    {
        var chat = await _store.GetChatAsync(request.ChatId)
            ?? throw new KeyNotFoundException($"Чат {request.ChatId} не найден.");

        if (chat.UserId1 != userId && chat.UserId2 != userId)
            throw new UnauthorizedAccessException("Пользователь не является участником чата.");

        Message? replyMessage = null;
        if (request.ReplyId.HasValue)
        {
            replyMessage = await _store.GetMessageAsync(request.ReplyId.Value);
            if (replyMessage is null || replyMessage.ChatId != request.ChatId)
                throw new InvalidOperationException("Сообщение для ответа не найдено в данном чате.");
        }

        var messageAttachments = new List<Attachment>();
        if (request.Attachments is { Count: > 0 })
        {
            var urls = request.Attachments.Select(a => a.FileUrl).ToList();
            var existingAttachments = await _store.GetUnattachedAttachmentsByUrlsAsync(urls);
            var existingByUrl = existingAttachments.ToDictionary(a => a.FileUrl);

            foreach (var item in request.Attachments)
            {
                if (existingByUrl.TryGetValue(item.FileUrl, out var existing))
                {
                    messageAttachments.Add(existing);
                }
                else
                {
                    messageAttachments.Add(new Attachment
                    {
                        Id = Guid.NewGuid(),
                        FileName = item.FileName,
                        FileUrl = item.FileUrl,
                        MimeType = item.MimeType,
                        Size = item.Size
                    });
                }
            }
        }

        var now = DateTime.UtcNow;
        var message = new Message
        {
            Id = Guid.NewGuid(),
            ChatId = request.ChatId,
            UserId = userId,
            message = request.Text,
            ReplyId = request.ReplyId,
            Reply = replyMessage,
            CreateAt = now,
            UpdateAt = now,
            IsDeleted = false,
            Attachments = messageAttachments
        };

        var created = await _store.CreateMessageAsync(message);
        var response = MapToMessageResponse(created);

        await CacheHelper.SetCacheAsync(_redis, _logger, response, $"messenger:msg:{created.Id}", _cacheExpiry);
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"messenger:chat:{request.ChatId}:history:p1:s50");

        var receiverId = chat.UserId1 == userId ? chat.UserId2 : chat.UserId1;
        await _publishEndpoint.Publish(new MessageSentEvent
        {
            MessageId = created.Id,
            ChatId = created.ChatId,
            SenderId = userId,
            SenderName = request.SenderName,
            ReceiverId = receiverId,
            Text = created.message,
            SentAt = created.CreateAt
        });

        return response;
    }

    public async Task<MessageResponse> EditMessageAsync(Guid userId, EditMessageRequest request)
    {
        var message = await _store.GetMessageAsync(request.MessageId)
            ?? throw new KeyNotFoundException($"Сообщение {request.MessageId} не найдено.");

        if (message.UserId != userId)
            throw new UnauthorizedAccessException("Нельзя редактировать чужое сообщение.");

        message.message = request.NewText;
        message.UpdateAt = DateTime.UtcNow;

        var updated = await _store.UpdateMessageAsync(message);
        var response = MapToMessageResponse(updated);

        await CacheHelper.SetCacheAsync(_redis, _logger, response, $"messenger:msg:{updated.Id}", _cacheExpiry);
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"messenger:chat:{updated.ChatId}:history:p1:s50");

        return response;
    }

    public async Task DeleteMessageAsync(Guid userId, DeleteMessageRequest request)
    {
        var message = await _store.GetMessageAsync(request.MessageId)
            ?? throw new KeyNotFoundException($"Сообщение {request.MessageId} не найдено.");

        if (message.UserId != userId)
            throw new UnauthorizedAccessException("Нельзя удалить чужое сообщение.");

        await _store.SoftDeleteMessageAsync(request.MessageId);

        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"messenger:msg:{request.MessageId}");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"messenger:chat:{message.ChatId}:history:p1:s50");
    }

    public async Task<ChatResponse> GetOrCreateChatAsync(Guid userId, GetOrCreateChatRequest request)
    {
        if (userId == request.TargetUserId)
            throw new InvalidOperationException("Нельзя создать чат с самим собой.");

        var (firstUserId, secondUserId) = userId.CompareTo(request.TargetUserId) < 0
            ? (userId, request.TargetUserId)
            : (request.TargetUserId, userId);

        var existingChat = await _store.GetChatByProductAndUserAsync(
            request.ProductId, firstUserId, secondUserId);

        if (existingChat is not null)
            return MapToChatResponse(existingChat);

        var now = DateTime.UtcNow;
        var chat = new Chat
        {
            Id = Guid.NewGuid(),
            ProductId = request.ProductId,
            UserId1 = firstUserId,
            UserId2 = secondUserId,
            CreateAt = now
        };

        Chat created;
        try
        {
            created = await _store.CreateChatAsync(chat);
        }
        catch (DbUpdateException)
        {
            var concurrentChat = await _store.GetChatByProductAndUserAsync(
                request.ProductId, firstUserId, secondUserId);

            if (concurrentChat is not null)
                return MapToChatResponse(concurrentChat);

            throw;
        }

        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"messenger:user:{userId}:chats");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"messenger:user:{request.TargetUserId}:chats");

        await _publishEndpoint.Publish(new ChatCreatedEvent
        {
            ChatId = created.Id,
            InitiatorId = userId,
            InitiatorName = request.InitiatorName,
            ReceiverId = request.TargetUserId,
            ProductName = request.ProductName,
            CreatedAt = created.CreateAt
        });

        return MapToChatResponse(created);
    }

    public async Task<List<ChatResponse>> GetUserChatsAsync(Guid userId)
    {
        var cacheKey = $"messenger:user:{userId}:chats";
        var cached = await CacheHelper.GetCacheAsync<List<ChatResponse>>(_redis, _logger, cacheKey);
        if (cached is not null)
            return cached;

        var chats = await _store.GetUserChatsAsync(userId);
        var response = chats.Select(MapToChatResponse).ToList();

        await CacheHelper.SetCacheAsync(_redis, _logger, response, cacheKey, _cacheExpiry);
        return response;
    }

    public async Task<List<AttachmentResponse>> SaveAttachmentsAsync(IEnumerable<AttachmentRequest> attachments)
    {
        var entities = attachments.Select(a => new Attachment
        {
            Id = Guid.NewGuid(),
            FileName = a.FileName,
            FileUrl = a.FileUrl,
            MimeType = a.MimeType,
            Size = a.Size
        }).ToList();

        var saved = await _store.AddAttachmentsAsync(entities);

        return saved.Select(a => new AttachmentResponse
        {
            Id = a.Id,
            FileName = a.FileName,
            FileUrl = a.FileUrl,
            MimeType = a.MimeType,
            Size = a.Size
        }).ToList();
    }

    private static MessageResponse MapToMessageResponse(Message m)
    {
        return new MessageResponse
        {
            Id = m.Id,
            ChatId = m.ChatId,
            UserId = m.UserId,
            Text = m.message,
            ReplyId = m.ReplyId,
            Reply = m.Reply is null
                ? null
                : new ReplyPreviewResponse
                {
                    Id = m.Reply.Id,
                    UserId = m.Reply.UserId,
                    Text = m.Reply.message
                },
            CreateAt = m.CreateAt,
            UpdateAt = m.UpdateAt,
            Attachments = m.Attachments.Select(a => new AttachmentResponse
            {
                Id = a.Id,
                FileName = a.FileName,
                FileUrl = a.FileUrl,
                MimeType = a.MimeType,
                Size = a.Size
            }).ToList()
        };
    }

    private static ChatResponse MapToChatResponse(Chat c)
    {
        return new ChatResponse
        {
            Id = c.Id,
            ProductId = c.ProductId,
            UserId1 = c.UserId1,
            UserId2 = c.UserId2,
            CreateAt = c.CreateAt
        };
    }
}
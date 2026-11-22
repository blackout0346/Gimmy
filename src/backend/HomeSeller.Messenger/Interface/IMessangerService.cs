using HomeSeller.Messenger.DTO.Messanger;
using MassTransit.Clients;

namespace HomeSeller.Messenger.Interface;

public interface IMessangerService
{
    Task<MessageResponse?> GetMessageByIdAsync(Guid messageId);
    Task<ChatHistoryResponse> GetChatHistoryAsync(Guid userId, GetChatHistoryRequest request);
    Task<MessageResponse> SendMessageAsync(Guid userId, SendMessageRequest request);
    Task<MessageResponse> EditMessageAsync(Guid userId, EditMessageRequest request);
    Task DeleteMessageAsync(Guid userId, DeleteMessageRequest request);
    Task<ChatResponse> GetOrCreateChatAsync(Guid userId, GetOrCreateChatRequest request);
    Task<List<ChatResponse>> GetUserChatsAsync(Guid userId);
    Task<List<AttachmentResponse>> SaveAttachmentsAsync(IEnumerable<AttachmentRequest> attachments);
}
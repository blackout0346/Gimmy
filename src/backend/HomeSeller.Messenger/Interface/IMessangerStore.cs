using HomeSeller.Messenger.Models;

namespace HomeSeller.Messenger.Interface;

public interface IMessangerStore
{
   Task<Message?> GetMessageAsync(Guid id);
   Task<List<Message>> GetChatMessagesAsync(Guid chatId, int skip = 0, int take = 50);
   Task<Message> CreateMessageAsync(Message message);
   Task<Message> UpdateMessageAsync(Message message);
   Task SoftDeleteMessageAsync(Guid id);

   Task<Chat?> GetChatAsync(Guid id);
   Task<Chat?> GetChatByProductAndUserAsync(Guid productId, Guid userId1, Guid userId2);
   Task<List<Chat>> GetUserChatsAsync(Guid userId);
   Task<Chat> CreateChatAsync(Chat chat);

   Task<List<Attachment>> GetAttachmentsByIdsAsync(IEnumerable<Guid> ids);
   Task<List<Attachment>> GetUnattachedAttachmentsByUrlsAsync(IEnumerable<string> urls);
   Task UpdateAttachmentsAsync(IEnumerable<Attachment> attachments);
   Task<List<Attachment>> AddAttachmentsAsync(IEnumerable<Attachment> attachments);
}
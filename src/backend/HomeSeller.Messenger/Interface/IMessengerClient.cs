using HomeSeller.Messenger.DTO.Messanger;

namespace HomeSeller.Messenger.Interface;

public interface IMessengerClient
{
    Task ReceiveMessage(MessageResponse message);
    Task MessageEdited(MessageResponse message);
    Task MessageDeleted(Guid chatId, Guid messageId);
    Task ChatCreated(ChatResponse chat);
    Task UserTyping(Guid chatId, Guid userId, bool isTyping);
}
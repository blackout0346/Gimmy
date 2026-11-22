using MassTransit.Clients;

namespace HomeSeller.Messenger.DTO.Messanger;

public class ChatHistoryResponse
{
    public Guid ChatId { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public List<MessageResponse> Messages { get; set; } = new();
}
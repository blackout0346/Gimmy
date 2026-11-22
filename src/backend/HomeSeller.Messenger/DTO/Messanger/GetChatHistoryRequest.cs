namespace HomeSeller.Messenger.DTO.Messanger;

public class GetChatHistoryRequest
{
    public Guid ChatId { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}
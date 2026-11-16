namespace HomeSeller.Shared.EventMessenger;

public class ChatCreatedEvent
{
    public Guid ChatId { get; set; }
    public Guid InitiatorId { get; set; }
    public string InitiatorName { get; set; } = string.Empty;
    public Guid ReceiverId { get; set; }
    public string? ProductName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
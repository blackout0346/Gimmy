namespace HomeSeller.Messenger.DTO.Messanger;

public class GetOrCreateChatRequest
{
    public Guid ProductId { get; set; }
    public string? ProductName { get; set; }
    public Guid TargetUserId { get; set; }
    
    public string InitiatorName { get; set; } = string.Empty;
    public string TargetUserName { get; set; } = string.Empty;
}
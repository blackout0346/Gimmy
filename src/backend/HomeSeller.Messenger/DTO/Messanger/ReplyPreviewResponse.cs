namespace HomeSeller.Messenger.DTO.Messanger;

public class ReplyPreviewResponse
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
}
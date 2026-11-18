namespace HomeSeller.Messenger.DTO.Messanger;

public class SendMessageRequest
{
    public Guid ChatId { get; set; }
    public string SenderName { get; set; } = string.Empty; 
    public string Text { get; set; } = string.Empty;
    public Guid? ReplyId { get; set; }
    public List<AttachmentRequest>? Attachments { get; set; }
}
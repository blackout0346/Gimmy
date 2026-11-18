namespace HomeSeller.Messenger.DTO.Messanger;

public class MessageResponse
{
    public Guid Id { get; set; }
    public Guid ChatId { get; set; }
    public Guid UserId { get; set; }
    public string Text { get; set; } = string.Empty;
    public Guid? ReplyId { get; set; }
    public ReplyPreviewResponse? Reply { get; set; }
    public DateTime CreateAt { get; set; }
    public DateTime UpdateAt { get; set; }
    public List<AttachmentResponse> Attachments { get; set; } = new();
}
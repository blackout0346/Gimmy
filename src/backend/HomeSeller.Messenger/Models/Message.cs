namespace HomeSeller.Messenger.Models;

public class Message
{
    public Guid Id { get; set; }

    public string message { get; set; } = string.Empty;

    public Guid ChatId { get; set; }
    public Chat Chat { get; set; } = null!;

    public Guid UserId { get; set; }

    public Guid? ReplyId { get; set; }
    public Message? Reply { get; set; }

    public ICollection<Attachment> Attachments { get; set; }
        = new List<Attachment>();

    public DateTime CreateAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdateAt { get; set; } = DateTime.UtcNow;

    public bool IsDeleted { get; set; }
}
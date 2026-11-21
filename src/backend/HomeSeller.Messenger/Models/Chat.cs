namespace HomeSeller.Messenger.Models;

public class Chat
{
    public Guid Id { get; set; }
    public Guid UserId1 { get; set; }
    public Guid UserId2 { get; set; }
    public Guid ProductId { get; set; }
    public DateTime CreateAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<Message> Messages { get; set; }
        = new List<Message>();
}
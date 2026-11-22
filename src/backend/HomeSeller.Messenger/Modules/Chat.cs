namespace HomeSeller.Messenger.Models;

public class Chat
{
    public Guid Id { get; set; }
    public Guid UserId1 { get; set; }
    
    public Guid UserId2 { get; set; }
    public Guid ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string UserName1 { get; set; } = string.Empty;
    public string UserName2 { get; set; } = string.Empty;
    public DateTime CreateAt { get; set; } = DateTime.UtcNow;
    
    public ICollection<Message> Messages { get; set; }
        = new List<Message>();
}
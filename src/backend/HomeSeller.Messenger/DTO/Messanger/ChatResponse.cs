namespace HomeSeller.Messenger.DTO.Messanger;

public class ChatResponse
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Guid UserId1 { get; set; }
    public string UserName1 { get; set; } = string.Empty;
    public Guid UserId2 { get; set; }
    public string UserName2 { get; set; } = string.Empty;
    public DateTime CreateAt { get; set; }
    public string ProductName { get; set; } = string.Empty;
}
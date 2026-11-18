namespace HomeSeller.Messenger.DTO.Messanger;

public class ChatResponse
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Guid UserId1 { get; set; }
    public Guid UserId2 { get; set; }
    public DateTime CreateAt { get; set; }
}
namespace HomeSeller.Messenger.DTO.Messanger;

public class EditMessageRequest
{
    public Guid MessageId { get; set; }
    public string NewText { get; set; } = string.Empty;
}
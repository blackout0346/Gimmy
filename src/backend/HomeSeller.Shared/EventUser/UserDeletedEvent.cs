namespace HomeSeller.Shared.EventUser;

public class UserDeletedEvent
{
    public Guid UserId { get; set; }
    public string Login{ get; set; }
    public DateTime DeleteAt { get; set; }
}
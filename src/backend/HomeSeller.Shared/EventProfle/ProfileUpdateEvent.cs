namespace HomeSeller.Shared.EventProfle;

public class ProfileUpdateEvent
{
    public Guid UserId { get; set; }
    public string name { get; set; }
    public string phone { get; set; }
    public string description { get; set; }
    public DateTime updatedAt { get; set; }
    
}
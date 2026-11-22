namespace HomeSellerServer.Module;

public class Users
{
    public Guid  Id { get; set; }
    public string Login { get; set; }
    public string HashPassword { get; set; }

    public DateTime CreateAt { get; set; } = DateTime.UtcNow;

    public bool isDeleted { get; set; } = false;
}
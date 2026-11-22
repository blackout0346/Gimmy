namespace HomeSeller.UserService.Modules;

public class ProductUser
{
    public Guid Id { get; set; }
    public Guid UserProfilesId { get; set; }
    public UsersProfiles UsersProfiles { get; set; } = null!;

    public Guid ProductId { get; set; }
}
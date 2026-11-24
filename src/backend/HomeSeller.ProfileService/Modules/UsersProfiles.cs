using System.ComponentModel.DataAnnotations.Schema;

namespace HomeSeller.UserService.Modules;

public class UsersProfiles
{
    public Guid Id { get; set; }
    

    public  Guid UserId { get; set; }
    public ICollection<ProfileImage> ImageURLs { get; set; }  = new List<ProfileImage>();
    public string Name { get; set; }
    public string Description { get; set; }= string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public ICollection<ProductUser>  ProductUsers { get; set; }   = new List<ProductUser>();
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
}
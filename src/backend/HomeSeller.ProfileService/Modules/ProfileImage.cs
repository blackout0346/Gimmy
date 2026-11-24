using System.ComponentModel.DataAnnotations.Schema;

namespace HomeSeller.UserService.Modules;

public class ProfileImage
{
        public Guid Id { get; set; }
        public string ImageURL { get; set; } = string.Empty;
        public Guid UserProfilesId { get; set; }
        public UsersProfiles UsersProfiles { get; set; } = null!;
        public bool IsDeleted { get; set; } = false;
}
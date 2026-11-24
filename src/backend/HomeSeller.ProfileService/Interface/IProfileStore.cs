using HomeSeller.UserService.Modules;

namespace HomeSeller.UserService.Interface;

public interface IProfileStore
{
    public Task<List<UsersProfiles>> GetProfilesAsync();
    public Task<UsersProfiles?> GetProfileByUserIdAsync(Guid userId);
    public Task AddProductToUserAsync(Guid userId, Guid productId);
    public Task<UsersProfiles?> GetProfileByIdAsync(Guid id);
    public Task<UsersProfiles> AddProfileAsync(UsersProfiles profile);
    public Task AddImageToProfileAsync(Guid userId, string imageUrl);
    public Task DeleteProfileImageAsync(Guid userId, Guid imageId);
    public Task UpdateProfileAsync(UsersProfiles profile);

    public Task DeleteProfileAsync(Guid userId);

}
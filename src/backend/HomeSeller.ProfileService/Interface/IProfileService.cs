using HomeSeller.UserService.DTO.Profile;
using HomeSeller.UserService.Modules;

namespace HomeSeller.UserService.Interface;

public interface IProfileService
{
   public Task<List<ProfileResponse>> GetProfilesAsync();
   public Task<ProfileResponse?> GetProfileByUserIdAsync(Guid userId);
   public Task<ProfileResponse?> GetProfileByIdAsync(Guid id);
   public Task<ProfileResponse> AddProfileAsync(Guid userId, ProfileRequest request);
   public Task<ProfileResponse?> UpdateProfileAsync(Guid userId, ProfileRequest request);
   public  Task<string> AddImageToProfileAsync(Guid userId, IFormFile file);
   public  Task DeleteProfileImageAsync(Guid userId, Guid imageId);
   public Task AddProductToUserAsync(Guid userId, Guid productId);
   public Task DeleteProfileAsync(Guid userId);
}
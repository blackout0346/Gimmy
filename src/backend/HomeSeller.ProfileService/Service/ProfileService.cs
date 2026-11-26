using HomeSeller.Shared.CacheHelper;
using HomeSeller.UserService.DTO.Profile;
using HomeSeller.UserService.Interface;
using HomeSeller.UserService.Modules;
using HomeSeller.UserService.Store;
using MassTransit;
using ProductService.ImagesServices;
using StackExchange.Redis;

namespace HomeSeller.UserService.Service;

public class ProfileService : IProfileService
{
    private readonly ILogger<ProfileService> _logger;
    private readonly ImagesSystem _imagesSystem;
    private readonly IProfileStore _profileStore;
    private readonly IPublishEndpoint _publishEndpoint;

    private readonly IDatabase _redis;
    private readonly TimeSpan? _cacheExpiry = TimeSpan.FromHours(1);

    public ProfileService(IConnectionMultiplexer muxer,
        ImagesSystem imagesSystem,
        ILogger<ProfileService> logger,
        IProfileStore profileStore,
        IPublishEndpoint publishEndpoint)
    {
        _redis = muxer.GetDatabase();
        _logger = logger;
        _imagesSystem = imagesSystem;
        _profileStore = profileStore;
        _publishEndpoint = publishEndpoint;
    }

    public async Task<List<ProfileResponse>> GetProfilesAsync()
    {
        var cacheKey = "Profiles:all";
        var cachequery = await CacheHelper.GetCacheAsync<List<ProfileResponse>>(_redis, _logger, cacheKey);
        if (cachequery != null)
        {
            return cachequery;
        }

        var profiles = await _profileStore.GetProfilesAsync();
        var response = profiles.Select(MapToResponse).ToList();
        await CacheHelper.SetCacheAsync(_redis, _logger, response, cacheKey, _cacheExpiry);
        return response;
    }

    public async Task<ProfileResponse?> GetProfileByUserIdAsync(Guid userId)
    {
        var cacheKey = $"Profiles:user:{userId}";
        var cachequery = await CacheHelper.GetCacheAsync<ProfileResponse?>(_redis, _logger, cacheKey);
        if (cachequery != null)
        {
            return cachequery;
        }

        var profile = await _profileStore.GetProfileByUserIdAsync(userId);
        if (profile is null)
        {
            return null;
        }

        var response = MapToResponse(profile);
        await CacheHelper.SetCacheAsync(_redis, _logger, response, cacheKey, _cacheExpiry);
        return response;
    }

    public async Task<ProfileResponse?> GetProfileByIdAsync(Guid id)
    {
        var cacheKey = $"Profiles:Id:{id}";
        var cachequery = await CacheHelper.GetCacheAsync<ProfileResponse?>(_redis, _logger, cacheKey);
        if (cachequery != null)
        {
            return cachequery;
        }

        var profile = await _profileStore.GetProfileByIdAsync(id);
        if (profile is null)
        {
            return null;
        }

        var response = MapToResponse(profile); 
        await CacheHelper.SetCacheAsync(_redis, _logger, response, cacheKey, _cacheExpiry);
        return response;
    }

    public async Task<ProfileResponse> AddProfileAsync(Guid userId, ProfileRequest request)
    {
        var existingProfile = await _profileStore.GetProfileByUserIdAsync(userId);
        if (existingProfile is not null)
        {
            throw new InvalidOperationException($"Profile for user {userId} already exists");
        }

        var profile = new UsersProfiles
        {
            UserId = userId,

            Name = request.Name,
            Description = request.Description,
            PhoneNumber = request.PhoneNumber,
            CreatedAt = DateTime.UtcNow,
        };
        var created = await _profileStore.AddProfileAsync(profile);
        var response = MapToResponse(created);
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, "Profiles:all");
        await CacheHelper.SetCacheAsync(_redis, _logger, response, $"Profiles:user:{userId}", _cacheExpiry);
        await CacheHelper.SetCacheAsync(_redis, _logger, response, $"Profiles:Id:{created.Id}", _cacheExpiry);
        return response;
    }

    public async Task<ProfileResponse?> UpdateProfileAsync(Guid userId, ProfileRequest request)
    {
        var existingProfile = await _profileStore.GetProfileByUserIdAsync(userId);
        if (existingProfile == null)
        {
            throw new InvalidOperationException($"Profile with id {userId} does not exist");
        }

        existingProfile.Name = request.Name;
        existingProfile.Description = request.Description;
        existingProfile.PhoneNumber = request.PhoneNumber;
        await _profileStore.UpdateProfileAsync(existingProfile);
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, "Profiles:all");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"Profiles:user:{userId}");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"Profiles:Id:{existingProfile.Id}");
        var updated = await _profileStore.GetProfileByUserIdAsync(userId);
        return updated is null ? null : MapToResponse(updated);
    }

    public async Task AddProductToUserAsync(Guid userId, Guid productId)
    {
        var existing = await _profileStore.GetProfileByUserIdAsync(userId);
        if (existing == null)
        {
            throw new InvalidOperationException($"Profile with id {userId} does not exist");
        }

        await _profileStore.AddProductToUserAsync(userId, productId);
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, "Profiles:all");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"Profiles:user:{userId}");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"Profiles:Id:{existing.Id}");
    }

    public async Task DeleteProfileAsync(Guid userId)
    {
        var existing = await _profileStore.GetProfileByUserIdAsync(userId);
        if (existing is null)
        {
            throw new InvalidOperationException($"Profile for user {userId} does not exist");
        }

        var imageUrls = existing.ImageURLs?.Select(img => img.ImageURL).ToList() ?? new List<string>();

        await _profileStore.DeleteProfileAsync(userId);
        if (imageUrls.Count > 0)
        {
            _imagesSystem.DeleteImages(imageUrls);
        }
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, "Profiles:all");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"Profiles:user:{userId}");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"Profiles:Id:{existing.Id}");
    }

    public async Task<string> AddImageToProfileAsync(Guid userId, IFormFile file)
    {
        var existing = await _profileStore.GetProfileByUserIdAsync(userId);
        if (existing is null)
        {
            throw new InvalidOperationException($"Profile for user {userId} does not exist");
        }

        var imageUrl = await _imagesSystem.SaveImageAsync(file);

        try
        {
            await _profileStore.AddImageToProfileAsync(userId, imageUrl);
            await CacheHelper.InvalidateCacheAsync(_redis, _logger, "Profiles:all");
            await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"Profiles:user:{userId}");
            await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"Profiles:Id:{existing.Id}");
            return imageUrl;
        }
        catch
        {
           
            _imagesSystem.DeleteImage(imageUrl);
            throw;
        }

      
    }

    public async Task DeleteProfileImageAsync(Guid userId, Guid imageId)
    {
        var existing = await _profileStore.GetProfileByUserIdAsync(userId);
        if (existing is null)
        {
            throw new InvalidOperationException($"Profile for user {userId} does not exist");
        }

        var image = existing.ImageURLs?.FirstOrDefault(img => img.Id == imageId);
        if (image is null)
        {
            throw new InvalidOperationException($"Image {imageId} not found in profile");
        }

        await _profileStore.DeleteProfileImageAsync(userId, imageId);
        _imagesSystem.DeleteImage(image.ImageURL);
       
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, "Profiles:all");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"Profiles:user:{userId}");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"Profiles:Id:{existing.Id}");
    }

    private static ProfileResponse MapToResponse(UsersProfiles profile)
    {
        return new ProfileResponse
        {
            Id = profile.Id,
            UserId = profile.UserId,
            Name = profile.Name,
            Description = profile.Description,
            PhoneNumber = profile.PhoneNumber,
            CreatedAt = profile.CreatedAt,
            UpdatedAt = profile.UpdatedAt,
            ImageURLs = profile.ImageURLs?
                .Select(img => new ProfileImageItem
                {
                    Id = img.Id,
                    ImageURL = img.ImageURL
                })
                .ToList() ?? new List<ProfileImageItem>(),
            ProductUsers = profile.ProductUsers?
                .Select(pu => new ProductUsersItem
                {
                    Id = pu.Id,
                    ProductId = pu.ProductId
                })
                .ToList() ?? new List<ProductUsersItem>()
        };
    }
}
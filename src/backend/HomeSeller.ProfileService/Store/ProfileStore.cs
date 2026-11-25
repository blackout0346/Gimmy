using HomeSeller.UserService.Interface;
using HomeSeller.UserService.Modules;
using Microsoft.EntityFrameworkCore;

namespace HomeSeller.UserService.Store;

public class ProfileStore : IProfileStore
{
    private readonly AppDbContext _dbContext;

    public ProfileStore(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<UsersProfiles>> GetProfilesAsync()
    {
        return await _dbContext.UsersProfiles
            .AsNoTracking()
            .Include(i => i.ImageURLs)
            .ToListAsync();
    }

    public async Task<UsersProfiles?> GetProfileByUserIdAsync(Guid userId)
    {
        return await _dbContext.UsersProfiles
            .AsNoTracking()
            .Include(i => i.ProductUsers)
            .Include(i => i.ImageURLs)
            .FirstOrDefaultAsync(u => u.UserId == userId);
    }

    public async Task<UsersProfiles?> GetProfileByIdAsync(Guid id)
    {
        return await _dbContext.UsersProfiles
            .AsNoTracking()
            .Include(i => i.ProductUsers)
            .Include(i => i.ImageURLs)
            .FirstOrDefaultAsync(u => u.Id == id);
    }

    public async Task<UsersProfiles> AddProfileAsync(UsersProfiles profile)
    {
        var userProfile = new UsersProfiles
        {
            UserId = profile.UserId,
            Name = profile.Name,
            Description = profile.Description,
            PhoneNumber = profile.PhoneNumber,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _dbContext.UsersProfiles.AddAsync(userProfile);
        await _dbContext.SaveChangesAsync();
        return userProfile;
    }

    public async Task AddProductToUserAsync(Guid userId, Guid productId)
    {
        var profileId = await _dbContext.UsersProfiles
            .Where(u => u.UserId == userId)
            .Select(u => u.Id)
            .FirstOrDefaultAsync();

        if (profileId == Guid.Empty)
        {
            return;
        }

        var exists = await _dbContext.ProductUser
            .AnyAsync(p => p.UserProfilesId == profileId && p.ProductId == productId);

        if (!exists)
        {
            await _dbContext.ProductUser.AddAsync(new ProductUser
            {
                UserProfilesId = profileId,
                ProductId = productId
            });
            await _dbContext.SaveChangesAsync();
        }
    }

    public async Task AddImageToProfileAsync(Guid userId, string imageUrl)
    {
        var profileId = await _dbContext.UsersProfiles
            .Where(u => u.UserId == userId)
            .Select(u => u.Id)
            .FirstOrDefaultAsync();

        if (profileId == Guid.Empty)
        {
            return;
        }

        await _dbContext.ProfileImage.AddAsync(new ProfileImage
        {
            UserProfilesId = profileId,
            ImageURL = imageUrl
        });

        await _dbContext.SaveChangesAsync();
    }

    public async Task DeleteProfileImageAsync(Guid userId, Guid imageId)
    {
        await _dbContext.ProfileImage
            .Where(img => img.Id == imageId && img.UsersProfiles.UserId == userId)
            .ExecuteUpdateAsync(setter => setter
                .SetProperty(img => img.IsDeleted, true));
    }

    public async Task UpdateProfileAsync(UsersProfiles profile)
    {
        var existing = await _dbContext.UsersProfiles
            .FirstOrDefaultAsync(u => u.UserId == profile.UserId);

        if (existing == null)
        {
            return;
        }

        existing.Name = profile.Name;
        existing.Description = profile.Description;
        existing.PhoneNumber = profile.PhoneNumber;
        existing.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();
    }

    public async Task DeleteProfileAsync(Guid userId)
    {
        var item = await _dbContext.UsersProfiles
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (item != null)
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync();

            var now = DateTime.UtcNow;

            await _dbContext.UsersProfiles.Where(u => u.Id == item.Id)
                .ExecuteUpdateAsync(setter => setter
                    .SetProperty(u => u.IsDeleted, true)
                    .SetProperty(u => u.DeletedAt, now)
                    .SetProperty(u => u.UpdatedAt, now));

            await _dbContext.ProductUser.Where(p => p.UserProfilesId == item.Id)
                .ExecuteUpdateAsync(setter => setter
                    .SetProperty(p => p.isDeleted, true));

            await _dbContext.ProfileImage.Where(img => img.UserProfilesId == item.Id)
                .ExecuteUpdateAsync(setter => setter
                    .SetProperty(img => img.IsDeleted, true));

            await transaction.CommitAsync();
        }
    }
}
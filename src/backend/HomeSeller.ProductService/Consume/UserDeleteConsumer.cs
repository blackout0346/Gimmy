using ConsoleApp1;
using HomeSeller.Shared;
using HomeSeller.Shared.EventUser;
using HomeSellerServer.Module;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using ProductService.Module;


namespace ProductService.Services;

public class UserDeleteConsumer : IConsumer<UserDeletedEvent>
{
    private readonly ProductDbContext _dbContext;
    private readonly ILogger<UserDeleteConsumer> _logger;
    private readonly ImagesSystem _imagesSystem;
    public UserDeleteConsumer(ImagesSystem imagesSystem,ProductDbContext dbContext, ILogger<UserDeleteConsumer> logger)
    {
        _imagesSystem = imagesSystem;
        _dbContext = dbContext;
        _logger = logger;
        
    }
    public async Task Consume(ConsumeContext<UserDeletedEvent> context)
    {
        var userId = context.Message.UserId;
        _logger.LogInformation($"Обработка удаления пользователя{userId}", userId);
        var imageUrls = await _dbContext.Products
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .SelectMany(p => p.ImageURLs.Select(img => img.ImageURL))
            .ToListAsync(context.CancellationToken);
        
        await _dbContext.Products.Where(p => p.UserId == userId).ExecuteUpdateAsync(setters=>setters.SetProperty(p=>p.isDeleted,true), context.CancellationToken);
        if (imageUrls.Count > 0)
        {
            _imagesSystem.DeleteImages(imageUrls);
        }

        
    
    }
}
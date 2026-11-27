
using HomeSeller.ProductService.Modules;
using HomeSellerServer.Module;
using Microsoft.EntityFrameworkCore;
using ProductService.DTO.Products;
using ProductService.ImagesServices;
using ProductService.Interface;
using ProductService.Module;

namespace HomeSeller.ProductService.StoreService;

public class ProductStore : IProductStore
{
    private readonly ProductDbContext _dbcontext;
    private readonly ImagesSystem _imagesSystem;

    public ProductStore(ProductDbContext context, ImagesSystem imagesSystem)
    {
        _imagesSystem = imagesSystem;
        this._dbcontext = context;
    }

    public async Task<IEnumerable<Products>> GetProducts(ProductFilterRequest filter)
{
    var query = _dbcontext.Products
        .AsNoTracking()
        .Include(p => p.Condition)
        .Include(p => p.ImageURLs)
        .Include(p => p.ProductTags)
            .ThenInclude(pt => pt.Tag)
        .Where(p => !p.isDeleted)
        .AsQueryable();

    if (!string.IsNullOrWhiteSpace(filter.Search))
    {
        var search = filter.Search.Trim().ToLower();
        query = query.Where(p =>
            p.NameProduct.ToLower().Contains(search) ||
            p.Description.ToLower().Contains(search));
    }

    if (filter.MinPrice.HasValue)
    {
        query = query.Where(p => p.Price >= filter.MinPrice.Value);
    }
    if (filter.MaxPrice.HasValue)
    {
        query = query.Where(p => p.Price <= filter.MaxPrice.Value);
    }

    if (filter.ConditionId.HasValue)
    {
        query = query.Where(p => p.ConditionId == filter.ConditionId.Value);
    }

    if (filter.TagIds != null && filter.TagIds.Count > 0)
    {
        var expandedTagIds = await _dbcontext.Tags
            .Where(t => filter.TagIds.Contains(t.Id) || (t.ParentTagId.HasValue && filter.TagIds.Contains(t.ParentTagId.Value)))
            .Select(t => t.Id)
            .ToListAsync();

        query = query.Where(p => p.ProductTags.Any(pt => expandedTagIds.Contains(pt.TagId)));
    }

    if (!string.IsNullOrWhiteSpace(filter.Position))
    {
        var pos = filter.Position.Trim().ToLower();
        query = query.Where(p => p.Position.ToLower().Contains(pos));
    }

    if (filter.MinRating.HasValue)
    {
        query = query.Where(p =>
            p.RateProductItems.Any(r => !r.IsDeleted) &&
            p.RateProductItems.Where(r => !r.IsDeleted).Average(r => r.Rate) >= filter.MinRating.Value);
    }

    query = filter.SortBy?.ToLowerInvariant() switch
    {
        "price_asc" => query.OrderBy(p => p.Price),
        "price_desc" => query.OrderByDescending(p => p.Price),
        "rating_desc" => query.OrderByDescending(p =>
            p.RateProductItems.Where(r => !r.IsDeleted).Select(r => (double?)r.Rate).Average() ?? 0),
        _ => query.OrderByDescending(p => p.CreateAt)
    };

    return await query
        .Skip((filter.Page - 1) * filter.PageSize)
        .Take(filter.PageSize)
        .ToListAsync();
}

    public async Task<Products?> GetProductsIdAsync(Guid id)
    {
        var product = await _dbcontext.Products
            .AsNoTracking()
            .Include(p => p.Condition)
            .Include(p => p.ImageURLs)
            .Include(p => p.ProductTags)
            .ThenInclude(pt => pt.Tag)
            .FirstOrDefaultAsync(p => p.Id == id);


        return product;
    }

    public async Task<bool> DeleteProductAsync(Guid productId)
    {
        var imageUrls = await _dbcontext.Products
            .AsNoTracking()
            .Where(p => p.Id == productId && !p.isDeleted)
            .SelectMany(p => p.ImageURLs.Select(img => img.ImageURL))
            .ToListAsync();


        var updatedRows = await _dbcontext.Products
            .Where(p => p.Id == productId && !p.isDeleted)
            .ExecuteUpdateAsync(setters => setters.SetProperty(p => p.isDeleted, true));


        if (updatedRows == 0)
        {
            return false;
        }


        if (imageUrls.Count > 0)
        {
            _imagesSystem.DeleteImages(imageUrls);
        }

        return true;
    }

    public async Task ProductsAddAsync(Products products)
    {
        products.CreateAt = DateTime.UtcNow;
        products.isDeleted = false;
        await _dbcontext.Products.AddAsync(products);
        await _dbcontext.SaveChangesAsync();
    }

    public async Task<IEnumerable<Products>> GetProductsByIdsAsync(IEnumerable<Guid> ids)
    {
        var products = await _dbcontext.Products
            .AsNoTracking()
            .OrderBy(p => p.Id)
          
            .Include(p => p.Condition)
            .Include(p => p.ImageURLs)
            .Include(p => p.ProductTags)
            .ThenInclude(pt => pt.Tag)
            .Where(p => ids.Contains(p.Id)).ToListAsync();

        return products;
    }

    public async Task ProductsUpdateAsync(Guid UserId, Products products)
    {
        var existingProduct = await _dbcontext.Products
            .Include(p => p.ProductTags)
            .Include(p => p.ImageURLs)
            .FirstOrDefaultAsync(p => p.Id == products.Id && p.UserId == UserId);

        if (existingProduct == null)
            return;


        existingProduct.NameProduct = products.NameProduct;
        existingProduct.Description = products.Description;
        existingProduct.Price = products.Price;
        existingProduct.ConditionId = products.ConditionId;
        existingProduct.Position = products.Position;

        if (products.ImageURLs != null)
        {
            var incomingImages = products.ImageURLs
                .Where(img => !string.IsNullOrWhiteSpace(img.ImageURL))
                .ToList();

            var unusedImages = existingProduct.ImageURLs.ToList();

            for (var index = 0; index < incomingImages.Count; index++)
            {
                var incoming = incomingImages[index];

                var existingImage = unusedImages.FirstOrDefault(
                    img => img.ImageURL == incoming.ImageURL);

                if (existingImage != null)
                {
                    existingImage.SortOrder = index;
                    unusedImages.Remove(existingImage);
                }
                else
                {
                    incoming.ProductId = existingProduct.Id;
                    incoming.SortOrder = index;

                    _dbcontext.Set<ProductImage>().Add(incoming);
                }
            }

            _dbcontext.Set<ProductImage>().RemoveRange(unusedImages);
        }

        if (products.ProductTags != null)
        {
            var newTagIds = products.ProductTags.Select(pt => pt.TagId).ToHashSet();
            var currentTagIds = existingProduct.ProductTags.Select(pt => pt.TagId).ToHashSet();


            var tagsToRemove = existingProduct.ProductTags
                .Where(pt => !newTagIds.Contains(pt.TagId))
                .ToList();
            _dbcontext.ProductTags.RemoveRange(tagsToRemove);


            var tagsToAdd = products.ProductTags
                .Where(pt => !currentTagIds.Contains(pt.TagId))
                .ToList();

            foreach (var tag in tagsToAdd)
            {
                tag.ProductId = existingProduct.Id;
                _dbcontext.Set<ProductTag>().Add(tag);
            }
        }

        await _dbcontext.SaveChangesAsync();
    }

    public async Task<bool> RateDeleteAsync(Guid id, Guid userId)
    {
        try
        {
            var item= await _dbcontext.RateProductItem
                .Where(i => i.UserId == userId && i.Id == id)
                .ExecuteUpdateAsync(setter => setter
                    .SetProperty(i => i.IsDeleted, true)
                    .SetProperty(i => i.DeletedAt, DateTime.UtcNow));
            return item > 0;
        }
        catch (Exception e)
        {
            Console.Error.WriteLine(e.Message);
            throw;
        }
    
    }

    public async Task<IEnumerable<RateProductItem>> GetRateProductItems(Guid productid)
    {
        return await _dbcontext.RateProductItem.AsNoTracking()
            .Include(p => p.RateProductImages)
            .Where(p => p.ProductId == productid)
            .ToListAsync();
    }

    public async Task RateAddAsync(RateProductItem rate)
    {
        rate.CreatedAt = DateTime.UtcNow;
        rate.UpdatedAt = DateTime.UtcNow;
        await _dbcontext.RateProductItem.AddAsync(rate);
        await _dbcontext.SaveChangesAsync();
    }

    public async Task RateUpdateAsync(RateProductItem rate, Guid userId)
    {         using var transit = _dbcontext.Database.BeginTransaction();
        try
        {
            var updaterate = await _dbcontext.RateProductItem
                .Where(p => p.UserId == userId && p.Id == rate.Id && !p.IsDeleted)
                .ExecuteUpdateAsync(setter => setter
                    .SetProperty(p => p.Rate, rate.Rate)
                    .SetProperty(p => p.DescriptionRate, rate.DescriptionRate)
                    .SetProperty(p => p.UpdatedAt, DateTime.UtcNow));

            if (updaterate == 0)
            {
                return;
            }

            if (rate.RateProductImages != null)
            {
                await _dbcontext.RateProductImage
                    .Where(img => img.RateProductItemId == rate.Id)
                    .ExecuteDeleteAsync();
                var newImage = rate.RateProductImages
                    .Select(i => new RateProductImage
                {
                    Id = i.Id == Guid.Empty ? Guid.NewGuid() : i.Id,
                    ImageURL = i.ImageURL,
                    RateProductItemId = rate.Id,
                });
                await _dbcontext.RateProductImage.AddRangeAsync(newImage);
                await _dbcontext.SaveChangesAsync();
            }

            await transit.CommitAsync();

        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(ex.Message);
            await transit.RollbackAsync();
            throw;
        }
    }

    public async Task<IEnumerable<Condition>> GetConditionAsync()
    {
        return await _dbcontext.Condition.AsNoTracking().ToListAsync();
    }

    public async Task<IEnumerable<Tags>> GetTagsAsync()
    {
        return await _dbcontext.Tags.AsNoTracking().ToListAsync();
    }

    public async Task<RateProductItem?> GetRateByIdAsync(Guid rateId)
    {
        return await _dbcontext.RateProductItem
            .AsNoTracking()
            .Include(r => r.RateProductImages)
            .FirstOrDefaultAsync(r => r.Id == rateId);
    }

    public async Task<(double avarageRating, int RatingCount)> GetProductRatingStateAsync(Guid productId)
    {
        var state = await _dbcontext.RateProductItem
            .AsNoTracking()
            .Where(p => p.ProductId == productId)
            .GroupBy(r=>r.ProductId)
            .Select(g=> new
            {
                Avarage = g.Average(r=>r.Rate),
                Count = g.Count()
            }).FirstOrDefaultAsync();
        if (state == null)
        {
            return (0.0, 0);
        }
        return (Math.Round(state.Avarage,1), state.Count);
            
    }
    public async Task<Dictionary<Guid, (double avarageRating, int RatingCount)>> GetProductsRatingStateAsync(IEnumerable<Guid> productIds)
    {
        var ids = productIds.ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<Guid, (double, int)>();
        }

        var states = await _dbcontext.RateProductItem
            .AsNoTracking()
            .Where(p => ids.Contains(p.ProductId))
            .GroupBy(r => r.ProductId)
            .Select(g => new
            {
                ProductId = g.Key,
                Avarage = g.Average(r => r.Rate),
                Count = g.Count()
            })
            .ToListAsync();

        return states.ToDictionary(
            x => x.ProductId,
            x => (Math.Round(x.Avarage, 1), x.Count));
    }
}
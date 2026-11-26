
using HomeSeller.ProductService.Modules;
using HomeSellerServer.Module;
using Microsoft.EntityFrameworkCore;
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

    public async Task<IEnumerable<Products>> GetProducts(
        string? search = null, 
        int page = 1, 
        int pageSize = 20)
    {
     
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _dbcontext.Products
            .AsNoTracking()
            .Include(p => p.Condition)
            .Include(p => p.ImageURLs)
            .Include(p => p.ProductTags)
            .ThenInclude(pt => pt.Tag)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchTerm = $"%{search.Trim()}%"; 
            query = query.Where(p => EF.Functions.ILike(p.NameProduct, searchTerm));
        }

        return await query
            .OrderBy(p => p.Id)
            .Skip((page - 1) * pageSize) 
            .Take(pageSize)             
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
            var newurl = products.ImageURLs.Select(img => img.ImageURL).ToHashSet();
            var currenturl = existingProduct.ImageURLs.Select(img => img.ImageURL).ToHashSet();
            var imagestoremove = existingProduct.ImageURLs.Where(img => !newurl.Contains(img.ImageURL)).ToList();
            _dbcontext.Set<ProductImage>().RemoveRange(imagestoremove);
            var imagestoadd = products.ImageURLs.Where(img => !currenturl.Contains(img.ImageURL)).ToList();
            foreach (var img in imagestoadd)
            {
                img.ProductId = products.Id;
                existingProduct.ImageURLs.Add(img);
            }
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
                existingProduct.ProductTags.Add(tag);
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
                .Where(p => p.UserId == userId)
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
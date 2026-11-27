using System.Diagnostics;
using HomeSeller.ProductService.DTO.Conditions;
using HomeSeller.ProductService.DTO.Rates;
using HomeSeller.ProductService.Modules;
using HomeSeller.Shared.CacheHelper;
using HomeSeller.Shared.EventProduct;
using HomeSeller.Shared.EventProfile;
using HomeSeller.Shared.EventRates;
using HomeSellerServer.Interface;
using MassTransit;
using ProductService.DTO.Products;
using ProductService.ImagesServices;
using ProductService.Interface;
using ProductService.Module;
using StackExchange.Redis;

namespace HomeSeller.ProductService.Services;

public class ProductService : IProductService
{
    private readonly IRequestClient<GetUserNameRequest> _userNameClient;
    private readonly IProductStore _productStore;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<ProductService> _logger;
    private readonly IDatabase _redis;
    private readonly TimeSpan? _cacheExpiry = TimeSpan.FromHours(1);
    private readonly ImagesSystem _imagesSystem;

    private const string ProductsVersionKey = "products:list:version";

    public ProductService(
        ImagesSystem imagesSystem,
        IRequestClient<GetUserNameRequest> userNameClient,
        IProductStore productStore,
        IPublishEndpoint publishEndpoint,
        ILogger<ProductService> logger,
        IConnectionMultiplexer muxer)
    {
        _userNameClient = userNameClient;
        _imagesSystem = imagesSystem;
        _redis = muxer.GetDatabase();
        _logger = logger;
        _publishEndpoint = publishEndpoint;
        _productStore = productStore;
    }

    public async Task<IEnumerable<ProductsResponse>> GetProductsAsync(ProductFilterRequest filter)
{
    if (filter.Page < 1) filter.Page = 1;
    if (filter.PageSize < 1 || filter.PageSize > 100) filter.PageSize = 20;

    var version = await CacheHelper.GetVersionAsync(_redis, _logger, ProductsVersionKey);
    var cacheKey = BuildFilterCacheKey(version, filter);

    var cachedProducts = await CacheHelper.GetCacheAsync<IEnumerable<ProductsResponse>>(_redis, _logger, cacheKey);
    if (cachedProducts != null)
    {
        _logger.LogInformation("get cache: {CacheKey}", cacheKey);
        return cachedProducts;
    }

    var products = (await _productStore.GetProducts(filter)).ToList();

    if (products.Count == 0)
    {
        return Enumerable.Empty<ProductsResponse>();
    }

    var ratingsMap = await _productStore.GetProductsRatingStateAsync(products.Select(p => p.Id));
    var productsResponse = products
        .Select(p => MapToResponse(p, ratingsMap.GetValueOrDefault(p.Id)))
        .ToList();

    // Если применены любые фильтры/поиск — кэшируем на 5 минут, иначе на стандартный _cacheExpiry (1 час)
    var hasFilters = IsFiltered(filter);
    await CacheHelper.SetCacheAsync(
        _redis,
        _logger,
        productsResponse,
        cacheKey,
        hasFilters ? TimeSpan.FromMinutes(5) : _cacheExpiry);

    _logger.LogInformation("get no cache: {CacheKey}", cacheKey);

    return productsResponse;
}


    public async Task<ProductsResponse?> GetProductByIdAsync(Guid id)
    {
        var cacheKey = $"products:id{id}";
        var cachedProduct = await CacheHelper.GetCacheAsync<ProductsResponse?>(_redis, _logger, cacheKey);
        if (cachedProduct != null)
        {
            return cachedProduct;
        }

        var product = await _productStore.GetProductsIdAsync(id);
        if (product == null)
        {
            return null;
        }

        var rating = await _productStore.GetProductRatingStateAsync(id);
        var productResponse = MapToResponse(product, rating);
        await CacheHelper.SetCacheAsync(_redis, _logger, productResponse, cacheKey, _cacheExpiry);

        return productResponse;
    }

    public async Task<ProductsResponse> CreateProductAsync(Guid userId, ProductsRequest request)
    {
        var newProductId = Guid.NewGuid();
        var userNameResponse = await _userNameClient.GetResponse<GetUserNameResponse>(
            new GetUserNameRequest { UserId = userId });

        var username = string.IsNullOrWhiteSpace(userNameResponse.Message.UserName)
            ? "Пользователь"
            : userNameResponse.Message.UserName;

        var product = new Products
        {
            Id = newProductId,
            NameProduct = request.NameProduct,
            Description = request.Description,
            Price = request.Price,
            ConditionId = request.ConditionId,
            UserId = userId,
            SellerLogin = username,
            CreateAt = DateTime.UtcNow,
            Position = request.Position,
            ImageURLs = request.ImageURLs?.Where(img => !string.IsNullOrWhiteSpace(img)).Select(img => new ProductImage
            {
                Id = Guid.NewGuid(),
                ProductId = newProductId,
                ImageURL = img.Trim()
            }).ToList() ?? new List<ProductImage>(),

            ProductTags = request.TagIds?.Select(tagId => new ProductTag
            {
                Id = Guid.NewGuid(),
                ProductId = newProductId,
                TagId = tagId
            }).ToList() ?? new List<ProductTag>()
        };

        await _productStore.ProductsAddAsync(product);
        await CacheHelper.IncrementVersionAsync(_redis, _logger, ProductsVersionKey);

        await _publishEndpoint.Publish(new ProductCreatedEvent()
        {
            ProductId = newProductId,
            productName = request.NameProduct,
            CreateAt = DateTime.UtcNow,
        });

        var createdProduct = await _productStore.GetProductsIdAsync(product.Id);
        return MapToResponse(createdProduct ?? product);
    }

    public async Task<ProductsResponse?> UpdateProductsAsync(Guid userId, Guid productid, ProductsRequest request)
    {
        var existing = await _productStore.GetProductsIdAsync(productid);
        if (existing == null || existing.UserId != userId)
        {
            return null;
        }

        var productToUpdate = new Products
        {
            Id = productid,
            NameProduct = request.NameProduct,
            Description = request.Description,
            Price = request.Price,
            SellerLogin = existing.SellerLogin,
            ConditionId = request.ConditionId,
            UserId = existing.UserId,
            Position = request.Position,
            ImageURLs = request.ImageURLs?
                .Where(img => !string.IsNullOrWhiteSpace(img))
                .Select(img => new ProductImage
                {
                    Id = Guid.NewGuid(),
                    ProductId = productid,
                    ImageURL = img.Trim()
                }).ToList() ?? new List<ProductImage>(),

            ProductTags = request.TagIds?.Select(tagId => new ProductTag
            {
                Id = Guid.NewGuid(),
                ProductId = productid,
                TagId = tagId
            }).ToList() ?? new List<ProductTag>()
        };

        var newUrls = productToUpdate.ImageURLs
            .Select(i => i.ImageURL)
            .ToHashSet();

        var removedUrls = existing.ImageURLs?
            .Where(old => !newUrls.Contains(old.ImageURL))
            .Select(old => old.ImageURL)
            .ToList() ?? new List<string>();

        await _productStore.ProductsUpdateAsync(userId, productToUpdate);
        if (removedUrls.Count > 0)
        {
            _imagesSystem.DeleteImages(removedUrls);
        }

        await _publishEndpoint.Publish(new ProductUpdatedEvent
        {
            ProductId = productid,
            productName = request.NameProduct,
            UpdateAt = DateTime.UtcNow,
        });

        await CacheHelper.IncrementVersionAsync(_redis, _logger, ProductsVersionKey);
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"products:id{productid}");

        var updatedProduct = await _productStore.GetProductsIdAsync(productid);
        if (updatedProduct == null)
        {
            return null;
        }
        var rating = await _productStore.GetProductRatingStateAsync(productid);
        return MapToResponse(updatedProduct, rating);
    }

    public async Task<bool> DeleteProductsAsync(Guid userId, Guid productid)
    {
        var existing = await _productStore.GetProductsIdAsync(productid);
        if (existing == null || existing.UserId != userId)
        {
            return false;
        }
        var deleted = await _productStore.DeleteProductAsync(productid);
        if (!deleted)
        {
            return false;
        }
        await _publishEndpoint.Publish(new ProductDeletedEvent()
        {
            ProductId = productid,
            productName = existing.NameProduct,
            UserId = userId,
            DeleteAt = DateTime.UtcNow,
        });

        await CacheHelper.IncrementVersionAsync(_redis, _logger, ProductsVersionKey);
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"products:id{productid}");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"rates:product:{productid}");
        return true;
    }

    //Rate
    public async Task<bool> DeleteRateAsync(Guid userId, Guid rateId)
    {
        var existing = await _productStore.GetRateByIdAsync(rateId);
        if (existing == null || existing.UserId != userId)
        {
            return false;
        }

        var deleted = await _productStore.RateDeleteAsync(rateId, userId);
        if (!deleted)
        {
            return false;
        }

        var imageUrls = existing.RateProductImages
            .Select(img => img.ImageURL)
            .Where(url => !string.IsNullOrWhiteSpace(url))
            .ToList();

        if (imageUrls.Count > 0)
        {
            _imagesSystem.DeleteImages(imageUrls);
        }

        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"rates:product:{existing.ProductId}");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"products:id{existing.ProductId}");
        await CacheHelper.IncrementVersionAsync(_redis, _logger, ProductsVersionKey);

        return true;
    }

    public async Task<RateResponse> AddRateAsync(Guid userId, RateRequest request)
    {
        var product = await _productStore.GetProductsIdAsync(request.ProductId);
        if (product == null)
        {
            throw new KeyNotFoundException("Товар не найден");
        }

        var existing = await _productStore.GetRateProductItems(request.ProductId);
        if (existing.Any(i => i.UserId == userId))
        {
            throw new InvalidOperationException("Вы уже оставляли отзыв на этот товар");
        }
        var userNameResponse = await _userNameClient.GetResponse<GetUserNameResponse>(
            new GetUserNameRequest { UserId = userId });

        var username = string.IsNullOrWhiteSpace(userNameResponse.Message.UserName)
            ? "Пользователь"
            : userNameResponse.Message.UserName;

        var rateId = Guid.NewGuid();
        var item = new RateProductItem
        {
            Id = rateId,
            Username = username,
            ProductId = request.ProductId,
            UserId = userId,
            Rate = request.Rate,
            DescriptionRate = request.DescriptionRate?.Trim() ?? string.Empty,
            IsDeleted = false,
            RateProductImages = request.ImageURLs?
                .Where(img => !string.IsNullOrWhiteSpace(img))
                .Select(img => new RateProductImage
                {
                    Id = Guid.NewGuid(),
                    RateProductItemId = rateId,
                    ImageURL = img.Trim()
                }).ToList() ?? new List<RateProductImage>()
        };

        await _productStore.RateAddAsync(item);
        await _publishEndpoint.Publish(new RatesUploadEvent
        {
            ProductId = product.Id,
            ProductOwnerId = product.UserId,
            UserName = username,
            ProductName = product.NameProduct,
            descRate = item.DescriptionRate ?? string.Empty,
            Rate = item.Rate,
            CreateAt = DateTime.UtcNow,
        });
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"rates:product:{request.ProductId}");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"products:id{request.ProductId}");
        await CacheHelper.IncrementVersionAsync(_redis, _logger, ProductsVersionKey);

        return MapToRateResponse(item);
    }

    public async Task<RateResponse?> UpdateRateAsync(Guid userId, Guid rateId, RateRequest request)
    {
        var currentRate = await _productStore.GetRateByIdAsync(rateId);
        if (currentRate == null || currentRate.UserId != userId)
        {
            return null;
        }

        var updateImages = request.ImageURLs?
            .Where(img => !string.IsNullOrWhiteSpace(img))
            .Select(img => new RateProductImage
            {
                Id = Guid.NewGuid(),
                RateProductItemId = rateId,
                ImageURL = img.Trim()
            }).ToList() ?? new List<RateProductImage>();

        var newUrls = updateImages.Select(i => i.ImageURL).ToHashSet();
        var removedUrls = currentRate.RateProductImages
            .Where(old => !newUrls.Contains(old.ImageURL))
            .Select(old => old.ImageURL)
            .ToList();

        var itemUpdate = new RateProductItem
        {
            Id = rateId,
            UserId = userId,
            Rate = request.Rate,
            Username = currentRate.Username,
            ProductId = currentRate.ProductId,
            DescriptionRate = request.DescriptionRate?.Trim() ?? string.Empty,
            RateProductImages = updateImages
        };

        await _productStore.RateUpdateAsync(itemUpdate, userId);
        if (removedUrls.Count > 0)
        {
            _imagesSystem.DeleteImages(removedUrls);
        }
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"rates:product:{currentRate.ProductId}");
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"products:id{currentRate.ProductId}");
        await CacheHelper.IncrementVersionAsync(_redis, _logger, ProductsVersionKey);

        itemUpdate.CreatedAt = currentRate.CreatedAt;
        itemUpdate.UpdatedAt = DateTime.UtcNow;

        return MapToRateResponse(itemUpdate);
    }

    public async Task<IEnumerable<RateResponse>> GetRateByProductIdAsync(Guid productId)
    {
        var cacheKey = $"rates:product:{productId}";

        var cachedRates = await CacheHelper.GetCacheAsync<IEnumerable<RateResponse>>(_redis, _logger, cacheKey);
        if (cachedRates != null)
        {
            return cachedRates;
        }

        var rates = await _productStore.GetRateProductItems(productId);
        var response = rates.Select(MapToRateResponse).ToList();

        await CacheHelper.SetCacheAsync(_redis, _logger, response, cacheKey, _cacheExpiry);

        return response;
    }

    public async Task<IEnumerable<ConditionResponse>> GetConditionAsync()
    {
        var conditions = await _productStore.GetConditionAsync();
        return conditions.Select(c => new ConditionResponse
        {
            Id = c.Id,
            Name = c.NameCondition
        }).ToList();
    }

    public async Task<IEnumerable<TagResponse>> GetTagsAsync()
    {
        var tags = await _productStore.GetTagsAsync();
        return tags.Select(t => new TagResponse
        {
            Id = t.Id,
            Name = t.NameTag,
        }).ToList();
    }

    private static ProductsResponse MapToResponse(
        Products products,
        (double averageRating, int ratingCount) rating = default) => new()
    {
        Id = products.Id,
        UserId = products.UserId,
        CreateAt = products.CreateAt,
        SellerLogin = products.SellerLogin,
        Description = products.Description,
        Price = products.Price,
        ImageURLs = products.ImageURLs?.Select(img => img.ImageURL).ToList(),
        NameProduct = products.NameProduct,
        ConditionId = products.ConditionId,
        NameCondition = products.Condition?.NameCondition ?? string.Empty,
        Position = products.Position ?? string.Empty,
        AverageRating = rating.averageRating,
        RatingsCount = rating.ratingCount,
        Tags = products.ProductTags?
            .Where(pt => pt.Tag != null)
            .Select(pt => pt.Tag.NameTag)
            .ToList() ?? new List<string>()
    };

    private static RateResponse MapToRateResponse(RateProductItem item)
    {
        return new RateResponse
        {
            Id = item.Id,
            ProductId = item.ProductId,
            UserId = item.UserId,
            UserName = item.Username,
            DescriptionRate = item.DescriptionRate,
            Rate = item.Rate,
            CreateAt = item.CreatedAt,
            UpdateAt = item.UpdatedAt,
            ImageURLs = item.RateProductImages?
                .Select(img => img.ImageURL)
                .ToList() ?? new List<string>()
        };
    }
    
    private static bool IsFiltered(ProductFilterRequest f) =>
        !string.IsNullOrWhiteSpace(f.Search) ||
        f.MinPrice.HasValue ||
        f.MaxPrice.HasValue ||
        f.ConditionId.HasValue ||
        (f.TagIds != null && f.TagIds.Count > 0) ||
        !string.IsNullOrWhiteSpace(f.Position) ||
        f.MinRating.HasValue ||
        (!string.IsNullOrWhiteSpace(f.SortBy) && f.SortBy != "newest");

    private static string BuildFilterCacheKey(long version, ProductFilterRequest f)
    {
        var searchPart = string.IsNullOrWhiteSpace(f.Search) ? "none" : f.Search.Trim().ToLowerInvariant();
        var tagsPart = (f.TagIds != null && f.TagIds.Count > 0)
            ? string.Join(",", f.TagIds.OrderBy(id => id))
            : "none";
        var posPart = string.IsNullOrWhiteSpace(f.Position) ? "none" : f.Position.Trim().ToLowerInvariant();

        return $"products:v{version}" +
               $":q:{searchPart}" +
               $":minP:{f.MinPrice?.ToString() ?? "none"}" +
               $":maxP:{f.MaxPrice?.ToString() ?? "none"}" +
               $":cond:{f.ConditionId?.ToString() ?? "none"}" +
               $":tags:{tagsPart}" +
               $":pos:{posPart}" +
               $":rate:{f.MinRating?.ToString() ?? "none"}" +
               $":sort:{f.SortBy ?? "newest"}" +
               $":p{f.Page}:s{f.PageSize}";
    }
}
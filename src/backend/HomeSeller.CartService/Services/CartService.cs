using System.Security.Claims;
using HomeSeller.CartService.DTOs.Cart;
using HomeSeller.CartService.DTOs.Favorite;
using HomeSeller.CartService.Interfaces;
using HomeSeller.CartService.Module;
using HomeSeller.Shared.CacheHelper;
using StackExchange.Redis;


namespace HomeSeller.CartService.Services;

public class CartService : ICartService
{
    private readonly ICartStore _cartstore;
    private readonly IDatabase _redis;
    private readonly TimeSpan? _cacheExpiry = TimeSpan.FromHours(1);
    private readonly ILogger<CartService> _logger;

    public CartService(ILogger<CartService>logger, ICartStore cartstore, IConnectionMultiplexer muxer)
    {
        _redis = muxer.GetDatabase();
        _cartstore = cartstore;
        _logger = logger;
    }


    public async Task<FavoriteResponse> GetFavorite(Guid userId)
    {
        var cachekey = $"favorites:id:{userId}";
        var cachequery = await CacheHelper.GetCacheAsync<FavoriteResponse>(_redis, _logger, cachekey);
        if (cachequery != null)
        {
            return cachequery;
        }
    
        var item = await _cartstore.GetFavorites(userId);
        var response = new FavoriteResponse
        {
            UserId = userId,
            ProductIds = item.Select(e => e.ProductId).ToList()
        };
        await CacheHelper.SetCacheAsync(_redis, _logger, response, cachekey, _cacheExpiry);
        return response;

    }

    public async Task<FavoriteResponse> AddFavorite(Guid userId, Guid productId)
    {
        
        await _cartstore.AddFavoriteItemAsync(userId, productId);
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"favorites:id:{userId}");
        return await GetFavorite(userId);
    }

    public async Task<FavoriteResponse> RemoveFavorite(Guid userId, Guid productId)
    {
        await _cartstore.RemoveFavoriteItemAsync(userId, productId);
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"favorites:id:{userId}");
        return await GetFavorite(userId);
    }

    public async Task<CartResponse> GetCartByUserIdAsync(Guid userId)
    {
        var cachekey = $"cart:id:{userId}";
        var cachequery = await CacheHelper.GetCacheAsync<CartResponse>(_redis, _logger, cachekey);
        if (cachequery != null)
        {
            return cachequery;
        }

        var cartByUser = await _cartstore.GetCartByUserIdAsync(userId);
        var cartResponse = MapToResponse(cartByUser, userId);
        await CacheHelper.SetCacheAsync(_redis, _logger, cartResponse, cachekey, _cacheExpiry);
        return cartResponse;
    }

    public async Task<CartResponse> AddItemAsync(Guid userId, CartRequest request)
    {
        var cartitem = new CartItem
        {
            ProductId = request.ProductId,
            Quantity = request.Quantity
        };
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"cart:id:{userId}");
        await _cartstore.AddItemAsync(cartitem, userId);
      
        var updatedCart = await _cartstore.GetCartByUserIdAsync(userId);
        return MapToResponse(updatedCart, userId);
    }

    public async Task<CartResponse> RemoveItemAsync(Guid userId, Guid productId)
    {
        await _cartstore.RemoveItemAsync(productId, userId);

        var updatedCart = await _cartstore.GetCartByUserIdAsync(userId);
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"cart:id{userId}");
        return MapToResponse(updatedCart, userId);
    }

    public async Task ClearCartAsync(Guid userId)
    {
        await CacheHelper.InvalidateCacheAsync(_redis, _logger, $"cart:id{userId}");
        await _cartstore.ClearCartAsync(userId);
    }

    private static CartResponse MapToResponse(Cart? cart, Guid userId)
    {
        if (cart == null)
        {
            return new CartResponse
            {
                Id = Guid.Empty,
                UserId = userId,
                CartItems = new List<CartItemResponse>()
            };
        }

        return new CartResponse
        {
            Id = cart.Id,
            UserId = cart.UserId,
            CartItems = cart.CartItems.Select(i => new CartItemResponse
            {
                Id = i.Id,
                ProductId = i.ProductId,
                Quantity = i.Quantity
            }).ToList()
        };
    }
}
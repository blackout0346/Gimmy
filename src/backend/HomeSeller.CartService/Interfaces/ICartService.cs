using HomeSeller.CartService.DTOs.Cart;
using HomeSeller.CartService.DTOs.Favorite;

namespace HomeSeller.CartService.Interfaces;

public interface ICartService
{
    public Task<FavoriteResponse>  GetFavorite(Guid userId);
    public Task<FavoriteResponse> AddFavorite(Guid userId, Guid productId);
    public Task<FavoriteResponse> RemoveFavorite(Guid userId, Guid productId);
    public Task<CartResponse> GetCartByUserIdAsync(Guid userId);
    public Task<CartResponse> AddItemAsync(Guid userId, CartRequest request);
    public Task<CartResponse> RemoveItemAsync(Guid userId, Guid productId);
    public Task ClearCartAsync(Guid userId);
}
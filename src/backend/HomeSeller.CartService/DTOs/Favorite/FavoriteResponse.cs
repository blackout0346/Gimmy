namespace HomeSeller.CartService.DTOs.Favorite;

public class FavoriteResponse
{
    public Guid UserId { get; set; }
    public List<Guid> ProductIds { get; set; }
}
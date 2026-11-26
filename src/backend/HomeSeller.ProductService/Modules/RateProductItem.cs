using ProductService.Module;

namespace HomeSeller.ProductService.Modules;

public class RateProductItem
{
    public Guid Id { get; set; }
    public Guid ProductId { get; set; }
    public Products Product { get; set; } = null!;
    public Guid UserId { get; set; }
    public string? DescriptionRate { get; set; }
    public int Rate
    {
        get;
        set => field = Math.Clamp(value, 1, 5);
    } = 1;
    public bool IsDeleted { get; set; } = false;
    public DateTime CreatedAt { get; set; } 
    public DateTime UpdatedAt { get; set; } 
    public DateTime DeletedAt { get; set; }
    public ICollection<RateProductImage>  RateProductImages { get; set; } = new List<RateProductImage>();
}
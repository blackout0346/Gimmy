using System.ComponentModel.DataAnnotations.Schema;

namespace HomeSeller.ProductService.Modules;

public class RateProductImage
{
    public Guid Id { get; set; }
    public string ImageURL { get; set; } = null!;
    public Guid RateProductItemId { get; set; }
    
    [ForeignKey(nameof(RateProductItemId))]
    public RateProductItem RateProductItem { get; set; } = null!;
}
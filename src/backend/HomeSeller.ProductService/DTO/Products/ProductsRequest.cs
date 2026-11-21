namespace ProductService.DTO.Products;

public class ProductsRequest
{
    public string NameProduct { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public List<string> ImageURLs { get; set; } = null!;
    public List<IFormFile>? ImageFiles { get; set; } 
    public Guid ConditionId { get; set; }
    public Guid UserId { get; set; }
    public string Position { get; set; }

    public List<Guid> TagIds { get; set; } = new();
}
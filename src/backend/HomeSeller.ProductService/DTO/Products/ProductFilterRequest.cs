namespace ProductService.DTO.Products;

public class ProductFilterRequest
{
    public string? Search { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public Guid? ConditionId { get; set; }
    public List<Guid>? TagIds { get; set; }

    public string? Position { get; set; }
    public double? MinRating { get; set; }
    
  
    public string? SortBy { get; set; } = "newest";
    
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
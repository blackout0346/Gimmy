namespace HomeSeller.ProductService.DTO.Rates;

public class RateResponse
{
    public Guid Id { get; set; }
    public string DescriptionRate { get; set; } = string.Empty;
    public int Rate { get; set; }
    public Guid ProductId { get; set; }
    public DateTime CreateAt { get; set; }
    public DateTime UpdateAt { get; set; }
    public List<string> ImageURLs { get; set; }
    public Guid UserId { get; set; }
}
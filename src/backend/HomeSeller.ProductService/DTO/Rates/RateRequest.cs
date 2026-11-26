namespace HomeSeller.ProductService.DTO.Rates;

public class RateRequest
{
    public Guid Id { get; set; }
    public string DescriptionRate { get; set; } = string.Empty;
    public int Rate { get; set; }
    public List<string> ImageURLs { get; set; }
    public Guid ProductId { get; set; }
}
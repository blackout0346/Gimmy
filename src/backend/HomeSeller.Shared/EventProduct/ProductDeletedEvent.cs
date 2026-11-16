namespace HomeSeller.Shared.EventProduct;

public class ProductDeletedEvent
{
    public Guid ProductId { get; set; }
    public string productName { get; set; }
    public Guid UserId { get; set; }

    public DateTime DeleteAt { get; set; } = DateTime.UtcNow;
}
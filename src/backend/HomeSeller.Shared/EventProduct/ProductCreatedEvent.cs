namespace HomeSeller.Shared.EventProduct;

public class ProductCreatedEvent
{
    public Guid ProductId { get; set; }
    public string productName { get; set; }

    public Guid UserId { get; set; }

    public DateTime CreateAt { get; set; } = DateTime.UtcNow;
}
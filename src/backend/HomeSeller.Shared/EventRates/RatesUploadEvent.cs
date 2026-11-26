namespace HomeSeller.Shared.EventRates;

public class RatesUploadEvent
{
    public Guid ProductId { get; set; }
    public Guid ProductOwnerId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string descRate { get; set; } = string.Empty;
    public int Rate { get; set; }
    public DateTime CreateAt { get; set; }
}
using HomeSeller.ProductService.Modules;
using ProductService.Module;

namespace ProductService.Interface;

public interface IProductStore
{
    public Task<IEnumerable<Products>>  GetProducts(string? search=null);
    public Task<Products?> GetProductsIdAsync(Guid id);
    public Task<bool> DeleteProductAsync(Guid productId);
    public Task ProductsAddAsync(Products products);
    public Task<IEnumerable<Products>> GetProductsByIdsAsync(IEnumerable<Guid> ids);
    public Task ProductsUpdateAsync(Guid userId,Products products);
    
    public Task<bool> RateDeleteAsync(Guid id  ,Guid userId);
    public Task<IEnumerable<RateProductItem>>  GetRateProductItems(Guid productid);
  
    public Task RateAddAsync(RateProductItem rate);
    public Task RateUpdateAsync(RateProductItem rate, Guid userId);
    public Task<IEnumerable<Condition>> GetConditionAsync();
    public Task<IEnumerable<Tags>> GetTagsAsync();
    public  Task<RateProductItem?> GetRateByIdAsync(Guid rateId);
    public Task<(double avarageRating, int RatingCount)> GetProductRatingStateAsync(Guid productId);
    public Task<Dictionary<Guid, (double avarageRating, int RatingCount)>> GetProductsRatingStateAsync(IEnumerable<Guid> productIds);
}
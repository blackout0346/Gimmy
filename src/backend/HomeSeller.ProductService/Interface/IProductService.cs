using HomeSeller.ProductService.DTO.Conditions;
using HomeSeller.ProductService.DTO.Rates;
using ProductService.DTO.Products;

namespace HomeSellerServer.Interface;

public interface IProductService
{
    Task<IEnumerable<ProductsResponse>> GetProductsAsync(string? search = null);
    Task<ProductsResponse?> GetProductByIdAsync(Guid productid);
    Task<ProductsResponse> CreateProductAsync(Guid userId, ProductsRequest request);
    Task<ProductsResponse?> UpdateProductsAsync(Guid userId, Guid productid, ProductsRequest request);
    Task<bool> DeleteProductsAsync(Guid userId, Guid productid);
    Task<bool> DeleteRateAsync(Guid userId, Guid rateId);
    Task<RateResponse> AddRateAsync(Guid userId, RateRequest request);
    Task<RateResponse?> UpdateRateAsync(Guid userId, Guid rateId, RateRequest request);
    
    Task<IEnumerable<RateResponse>> GetRateByProductIdAsync(Guid productId);
    
    
    Task<IEnumerable<ConditionResponse>> GetConditionAsync();
    Task<IEnumerable<TagResponse>> GetTagsAsync();
    
}
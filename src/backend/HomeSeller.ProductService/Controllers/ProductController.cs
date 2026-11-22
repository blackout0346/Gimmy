using System.Security.Claims;
using HomeSellerServer.Interface;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ProductService.DTO.Products;
using ProductService.ImagesServices;
using Superpower.Model;

namespace ProductService.Controllers;

[Route("api/Product")]
[ApiController]
[Authorize]
[EnableRateLimiting("sliding_window")]
public class ProductController : ControllerBase
{
    
    private readonly IProductService _productService;
    private readonly ImagesSystem _imagesSystem;

    public ProductController(IProductService productService, ImagesSystem imagesSystem)
    {
        _imagesSystem = imagesSystem;
        _productService = productService;
    }

    [HttpGet("GetProduct/{productId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ProductsResponse), 200)]
    public async Task<IActionResult> GetByIdProduct([FromRoute] Guid productId)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var result = await _productService.GetProductByIdAsync(productId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("upload")]
    [ProducesResponseType(typeof(List<string>), 200)]
    public async Task<IActionResult> Upload([FromForm] List<IFormFile> files)
    {
        if (files == null || files.Count == 0)
        {
            return BadRequest(ModelState);
        }
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }
        try
        {
            

            var uploadedurls = new List<string>();
            foreach (var file in files)
            {
                
                var url= await _imagesSystem.SaveImageAsync(file);
                uploadedurls.Add(url);
            }
            return Ok(uploadedurls);
        }catch(Exception ex)
        {
            return BadRequest(ex.Message);
        }
        
        
    }
    [HttpGet("GetProducts")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ProductsResponse), 200)]
    public async Task<IActionResult> GetAllProducts([FromQuery] string? search = null)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var result = await _productService.GetProductsAsync(search);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }


    [HttpPost("AddProduct")]
    [ProducesResponseType(typeof(ProductsResponse), 200)]
    public async Task<IActionResult> AddProduct([FromBody] ProductsRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var userId = GetUserId();
            var result = await _productService.CreateProductAsync(userId, request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.InnerException?.Message ?? ex.Message);
        }
    }

    [HttpPut("UpdateProduct/{productId:guid}")]
    [ProducesResponseType(typeof(ProductsResponse), 200)]
    public async Task<IActionResult> UpdateProduct([FromRoute] Guid productId, [FromBody] ProductsRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var userId = GetUserId();
            var result = await _productService.UpdateProductsAsync(userId, productId, request);
            return result == null ? NotFound() : Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("DeleteProduct/{productId:guid}")]
    [ProducesResponseType(typeof(ProductsResponse), 200)]
    public async Task<IActionResult> DeleteProduct([FromRoute] Guid productId)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var userId = GetUserId();
            var result = await _productService.DeleteProductsAsync(userId, productId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private Guid GetUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                      ?? User.FindFirst("sub")?.Value
                      ?? User.FindFirst("id")?.Value;

        if (string.IsNullOrEmpty(idClaim) || !Guid.TryParse(idClaim, out var userId))
        {
            throw new UnauthorizedAccessException("Идентификатор пользователя не найден в токене.");
        }

        return userId;
    }
}
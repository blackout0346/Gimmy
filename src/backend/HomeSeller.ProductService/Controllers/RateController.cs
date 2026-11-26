using System.Security.Claims;
using HomeSeller.ProductService.DTO.Rates;
using HomeSellerServer.Interface;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ProductService.ImagesServices;

namespace ProductService.Controllers;

[Route("api/Rate")]
[ApiController]
[Authorize]
[EnableRateLimiting("sliding_window")]
public class RateController : ControllerBase
{
    private readonly IProductService _productService;
    private readonly ImagesSystem _imagesSystem;

    public RateController(IProductService productService, ImagesSystem imagesSystem)
    {
        _productService = productService;
        _imagesSystem = imagesSystem;
    }

    [HttpGet("GetProductRates/{productId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IEnumerable<RateResponse>), 200)]
    public async Task<IActionResult> GetProductRates([FromRoute] Guid productId)
    {
        try
        {
            var result = await _productService.GetRateByProductIdAsync(productId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(List<string>), 200)]
    public async Task<IActionResult> Upload([FromForm] List<IFormFile> files)
    {
        if (files == null || files.Count == 0)
        {
            return BadRequest("Файлы не переданы.");
        }

        var uploadedUrls = new List<string>();
        try
        {
            foreach (var file in files)
            {
                var url = await _imagesSystem.SaveImageAsync(file, "rates");
                uploadedUrls.Add(url);
            }

            return Ok(uploadedUrls);
        }
        catch (Exception ex)
        {
            if (uploadedUrls.Count > 0)
            {
                _imagesSystem.DeleteImages(uploadedUrls);
            }

            return BadRequest(ex.Message);
        }
    }

    [HttpPost("AddRate")]
    [ProducesResponseType(typeof(RateResponse), 200)]
    public async Task<IActionResult> AddRate([FromBody] RateRequest request)
    {
        try
        {
            var userId = GetUserId();
            var result = await _productService.AddRateAsync(userId, request);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ex.Message);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ex.Message);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.InnerException?.Message ?? ex.Message);
        }
    }

    [HttpPut("UpdateRate/{rateId:guid}")]
    [ProducesResponseType(typeof(RateResponse), 200)]
    public async Task<IActionResult> UpdateRate([FromRoute] Guid rateId, [FromBody] RateRequest request)
    {
        try
        {
            var userId = GetUserId();
            var result = await _productService.UpdateRateAsync(userId, rateId, request);
            return result == null ? NotFound() : Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ex.Message);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("DeleteRate/{rateId:guid}")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> DeleteRate([FromRoute] Guid rateId)
    {
        try
        {
            var userId = GetUserId();
            var deleted = await _productService.DeleteRateAsync(userId, rateId);
            return deleted ? NoContent() : NotFound();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(ex.Message);
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
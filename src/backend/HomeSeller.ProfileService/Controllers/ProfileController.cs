using System.Security.Claims;
using HomeSeller.UserService.DTO.Profile;
using HomeSeller.UserService.Interface;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HomeSeller.UserService.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("sliding_window")]
public class ProfileController : ControllerBase
{
    private readonly IProfileService _profileService;
    private readonly ILogger<ProfileController> _logger;

    public ProfileController(IProfileService profileService, ILogger<ProfileController> logger)
    {
        _profileService = profileService;
        _logger = logger;
    }


    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
                          ?? User.FindFirstValue("sub");

        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            throw new UnauthorizedAccessException("Не удалось извлечь корректный UserId из токена.");
        }

        return userId;
    }

  
    [HttpGet]
    public async Task<ActionResult<List<ProfileResponse>>> GetProfiles()
    {
        var profiles = await _profileService.GetProfilesAsync();
        return Ok(profiles);
    }


    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProfileResponse>> GetProfileById(Guid id)
    {
        var profile = await _profileService.GetProfileByIdAsync(id);
        if (profile is null)
        {
            return NotFound(new { message = $"Профиль с Id '{id}' не найден." });
        }

        return Ok(profile);
    }


    [HttpGet("user/{userId:guid}")]
    public async Task<ActionResult<ProfileResponse>> GetProfileByUserId(Guid userId)
    {
        var profile = await _profileService.GetProfileByUserIdAsync(userId);
        if (profile is null)
        {
            return NotFound(new { message = $"Профиль для пользователя '{userId}' не найден." });
        }

        return Ok(profile);
    }

 
    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<ProfileResponse>> GetMyProfile()
    {
        var userId = GetCurrentUserId();
        var profile = await _profileService.GetProfileByUserIdAsync(userId);

        if (profile is null)
        {
            return NotFound(new { message = "Профиль текущего пользователя ещё не создан." });
        }

        return Ok(profile);
    }

 
    [Authorize]
    [HttpPost]
    public async Task<ActionResult<ProfileResponse>> CreateProfile([FromBody] ProfileRequest request)
    {
        var userId = GetCurrentUserId();

        try
        {
            var created = await _profileService.AddProfileAsync(userId, request);
            return CreatedAtAction(nameof(GetProfileById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }


    [Authorize]
    [HttpPut("me")]
    public async Task<ActionResult<ProfileResponse>> UpdateMyProfile([FromBody] ProfileRequest request)
    {
        var userId = GetCurrentUserId();

        try
        {
            var updated = await _profileService.UpdateProfileAsync(userId, request);
            if (updated is null)
            {
                return NotFound(new { message = "Профиль не найден." });
            }

            return Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }


    [Authorize]
    [HttpDelete("me")]
    public async Task<IActionResult> DeleteMyProfile()
    {
        var userId = GetCurrentUserId();

        try
        {
            await _profileService.DeleteProfileAsync(userId);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }


    [Authorize]
    [HttpPost("me/products/{productId:guid}")]
    public async Task<IActionResult> AddProductToMyProfile(Guid productId)
    {
        var userId = GetCurrentUserId();

        try
        {
            await _profileService.AddProductToUserAsync(userId, productId);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }


    [Authorize]
    [HttpPost("me/images")]

    public async Task<IActionResult> AddImageToMyProfile(IFormFile file)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "Файл не передан или пуст." });
        }

        var userId = GetCurrentUserId();

        try
        {
            var imageUrl = await _profileService.AddImageToProfileAsync(userId, file);
            return Ok(new { imageUrl });
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

  
    [Authorize]
    [HttpDelete("me/images/{imageId:guid}")]
    public async Task<IActionResult> DeleteMyProfileImage(Guid imageId)
    {
        var userId = GetCurrentUserId();

        try
        {
            await _profileService.DeleteProfileImageAsync(userId, imageId);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
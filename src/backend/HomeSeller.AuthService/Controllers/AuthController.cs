using System.Security.Authentication;
using HomeSellerServer.DTO;
using HomeSellerServer.Exceptions;
using HomeSellerServer.Module;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HomeSellerServer.Controllers;

[Route("api/auth")]
[ApiController]

[EnableRateLimiting("sliding_window")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    [ProducesResponseType( 200)]
    [ProducesResponseType( 400)]
    [ProducesResponseType(409)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var result = await _authService.RegisterAsync(request);
            return Ok(result);
        }
        catch (UserAlreadyExistsException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (AuthenticationException ex)
        {
            return BadRequest(new {message = ex.Message});
        }
    }

    [HttpPost("login")]
    [ProducesResponseType( 200)]
    [ProducesResponseType( 400)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var result = await _authService.LoginAsync(request);
            return Ok(result);
        }
        catch (AuthenticationException)
        {
            return Unauthorized(new { message = "Invalid login or password." });
        }
    }

    [HttpPut("ChangePassword")]
    [ProducesResponseType(typeof(LoginResponse), 200)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        try
        {
            await _authService.ChangePasswordAsync(request);
            return Ok(new { message = "Password updated successfully." });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("DeleteUser/{userId}")]
    [ProducesResponseType( 200)]
    [ProducesResponseType( 400)]
    public async Task<IActionResult> DeleteUser([FromRoute] Guid userId)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            await _authService.DeleteUserAsync(userId);
            return Ok(new { message = "User deleted successfully." });
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            return StatusCode(500, "Internal server error");
        }
    }
}
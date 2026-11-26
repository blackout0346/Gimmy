using System.Security.Claims;
using HomeSeller.Messenger.DTO.Messanger;
using HomeSeller.Messenger.ImagesServices;
using HomeSeller.Messenger.Interface;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace HomeSeller.Messenger.Controller;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("sliding_window")]
public class MessengerController : ControllerBase
{
    private readonly IMessangerService _messangerService;
    private readonly ImagesSystem _imagesSystem;

    public MessengerController(
        IMessangerService messangerService,
        ImagesSystem imagesSystem)
    {
        _messangerService = messangerService;
        _imagesSystem = imagesSystem;
    }


    [HttpGet("chats")]
    [ProducesResponseType(typeof(List<ChatResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUserChats()
    {
        var userId = GetUserId();
        var chats = await _messangerService.GetUserChatsAsync(userId);
        return Ok(chats);
    }


    [HttpPost("chats")]
    [ProducesResponseType(typeof(ChatResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetOrCreateChat([FromBody] GetOrCreateChatRequest request)
    {
        try
        {
            var userId = GetUserId();
            var chat = await _messangerService.GetOrCreateChatAsync(userId, request);
            return Ok(chat);
        }catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
   
    }

    [HttpGet("chats/{chatId:guid}/messages")]
    [ProducesResponseType(typeof(ChatHistoryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetChatHistory(
        [FromRoute] Guid chatId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var userId = GetUserId();
        var request = new GetChatHistoryRequest
        {
            ChatId = chatId,
            Page = page,
            PageSize = pageSize
        };

        var history = await _messangerService.GetChatHistoryAsync(userId, request);
        return Ok(history);
    }


    [HttpGet("messages/{messageId:guid}")]
    [ProducesResponseType(typeof(MessageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetMessageById([FromRoute] Guid messageId)
    {
        var message = await _messangerService.GetMessageByIdAsync(messageId);
        if (message is null)
            return NotFound(new { message = $"Сообщение {messageId} не найдено." });

        return Ok(message);
    }


    [HttpPost("attachments")]
    [RequestSizeLimit(20 * 1024 * 1024)]
    [ProducesResponseType(typeof(List<AttachmentResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UploadAttachments([FromForm] List<IFormFile> files)
    {
        if (files is null || files.Count == 0)
            return BadRequest(new { message = "Файлы не переданы." });
    
        var response = new List<AttachmentResponse>();
    
        foreach (var file in files)
        {
            try
            {
                var relativeUrl = await _imagesSystem.SaveImageAsync(file);
                response.Add(new AttachmentResponse
                {
                    Id = Guid.NewGuid(),
                    FileName = file.FileName,
                    FileUrl = relativeUrl,
                    MimeType = file.ContentType,
                    Size = file.Length
                });
            }
            catch (Exception ex)
            {
                _imagesSystem.DeleteImages(response.Select(x => x.FileUrl));
                return BadRequest(new { message = ex.Message });
            }
        }
    
        return Ok(response);
    }


    [HttpDelete("attachments")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public IActionResult DeleteAttachment([FromQuery] string fileUrl)
    {
        if (string.IsNullOrWhiteSpace(fileUrl))
            return BadRequest(new { message = "Не указан путь к файлу." });

        _imagesSystem.DeleteImage(fileUrl);
        return NoContent();
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value;

        if (!Guid.TryParse(claim, out var userId))
            throw new UnauthorizedAccessException("Не удалось определить идентификатор пользователя.");

        return userId;
    }
}
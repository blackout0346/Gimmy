using HomeSeller.Messenger.Interface;
using HomeSeller.Messenger.Models;
using Microsoft.EntityFrameworkCore;

namespace HomeSeller.Messenger.StoreService;

public class MessangerStore : IMessangerStore
{
    private readonly AppDbContext _dbContext;

    public MessangerStore(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Message?> GetMessageAsync(Guid id)
    {
        return await _dbContext.Messages
            .Include(m => m.Attachments)
            .Include(m => m.Reply)
            .FirstOrDefaultAsync(m => m.Id == id);
    }

    public async Task<List<Message>> GetChatMessagesAsync(Guid chatId, int skip = 0, int take = 50)
    {
        return await _dbContext.Messages
            .Where(m => m.ChatId == chatId)
            .Include(m => m.Attachments)
            .Include(m => m.Reply)
            .OrderByDescending(m => m.CreateAt)
            .Skip(skip)
            .Take(take)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<Message> CreateMessageAsync(Message message)
    {
        _dbContext.Messages.Add(message);
        await _dbContext.SaveChangesAsync();
        return message;
    }

    public async Task<Message> UpdateMessageAsync(Message message)
    {
        if (_dbContext.Entry(message).State == EntityState.Detached)
        {
            _dbContext.Messages.Attach(message);
            _dbContext.Entry(message).State = EntityState.Modified;
        }

        await _dbContext.SaveChangesAsync();
        return message;
    }

    public async Task SoftDeleteMessageAsync(Guid id)
    {
        var message = await _dbContext.Messages.FirstOrDefaultAsync(m => m.Id == id);
        if (message != null)
        {
            message.IsDeleted = true;
            message.UpdateAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();
        }
    }

    public async Task<Chat?> GetChatAsync(Guid id)
    {
        return await _dbContext.Chats
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task<Chat?> GetChatByProductAndUserAsync(Guid productId, Guid userId1, Guid userId2)
    {
        return await _dbContext.Chats.FirstOrDefaultAsync(c =>
            c.ProductId == productId &&
            ((c.UserId1 == userId1 && c.UserId2 == userId2) ||
             (c.UserId1 == userId2 && c.UserId2 == userId1)));
    }

    public async Task<List<Chat>> GetUserChatsAsync(Guid userId)
    {
        return await _dbContext.Chats
            .Where(c => c.UserId1 == userId || c.UserId2 == userId)
            .OrderByDescending(c => c.CreateAt)
            .AsNoTracking()
            .ToListAsync();
    }

    public async Task<Chat> CreateChatAsync(Chat chat)
    {
        _dbContext.Chats.Add(chat);
        await _dbContext.SaveChangesAsync();
        return chat;
    }

    public async Task<List<Attachment>> GetAttachmentsByIdsAsync(IEnumerable<Guid> ids)
    {
        return await _dbContext.Attachments
            .Where(a => ids.Contains(a.Id))
            .ToListAsync();
    }

    public async Task<List<Attachment>> GetUnattachedAttachmentsByUrlsAsync(IEnumerable<string> urls)
    {
        var urlList = urls
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Distinct()
            .ToList();

        if (urlList.Count == 0)
            return new List<Attachment>();

        return await _dbContext.Attachments
            .Where(a => urlList.Contains(a.FileUrl) && a.MessageId == null)
            .ToListAsync();
    }

    public async Task UpdateAttachmentsAsync(IEnumerable<Attachment> attachments)
    {
        _dbContext.Attachments.UpdateRange(attachments);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<List<Attachment>> AddAttachmentsAsync(IEnumerable<Attachment> attachments)
    {
        var list = attachments.ToList();
        await _dbContext.Attachments.AddRangeAsync(list);
        await _dbContext.SaveChangesAsync();
        return list;
    }
}
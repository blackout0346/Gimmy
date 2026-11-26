using HomeSeller.Shared.EventProfile;
using HomeSeller.UserService.Modules;
using MassTransit;
using Microsoft.EntityFrameworkCore;

namespace HomeSeller.UserService.Consumer;

public class GetUserNameConsumer:IConsumer<GetUserNameRequest>
{
    private readonly AppDbContext _db;

    public GetUserNameConsumer(AppDbContext db)
    {
        _db = db;
    }

    public async Task Consume(ConsumeContext<GetUserNameRequest> context)
    {
        var name = await _db.UsersProfiles
            .AsNoTracking()
            .Where(u => u.UserId == context.Message.UserId && !u.IsDeleted)
            .Select(u => u.Name)
            .FirstOrDefaultAsync();

        await context.RespondAsync(new GetUserNameResponse
        {
            UserName = string.IsNullOrWhiteSpace(name) ? "Пользователь" : name
        });
    }
}
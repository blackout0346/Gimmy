using Microsoft.EntityFrameworkCore;

namespace HomeSeller.Messenger.Models;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Attachment> Attachments { get; set; }
    public DbSet<Chat> Chats { get; set; }
    public DbSet<Message> Messages { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasDefaultSchema("SellShop.Messenger");
        modelBuilder.Entity<Chat>()
            .HasIndex(c => new { c.UserId1, c.CreateAt });

        modelBuilder.Entity<Chat>()
            .HasIndex(c => new { c.UserId2, c.CreateAt });
        modelBuilder.Entity<Chat>().HasIndex(c => new { c.ProductId, c.UserId1, c.UserId2 }).IsUnique();

        modelBuilder.Entity<Chat>()
            .HasMany(c => c.Messages)
            .WithOne(m => m.Chat)
            .HasForeignKey(m => m.ChatId)
            .OnDelete(DeleteBehavior.Cascade);


        modelBuilder.Entity<Message>()
            .HasMany(m => m.Attachments)
            .WithOne(a => a.Message)
            .HasForeignKey(a => a.MessageId)
            .OnDelete(DeleteBehavior.Cascade);


        modelBuilder.Entity<Message>()
            .HasOne(m => m.Reply)
            .WithMany()
            .HasForeignKey(m => m.ReplyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Message>()
            .HasIndex(m => m.UserId);

        modelBuilder.Entity<Message>()
            .HasIndex(m => m.ReplyId);
        modelBuilder.Entity<Message>()
            .HasIndex(m => new { m.ChatId, m.CreateAt })
            .HasFilter("\"IsDeleted\" = false");
        modelBuilder.Entity<Attachment>()
            .HasIndex(a => a.MessageId);
        
        modelBuilder.Entity<Message>()
            .HasQueryFilter(m => !m.IsDeleted);

        modelBuilder.Entity<Attachment>()
            .HasQueryFilter(a => !a.Message.IsDeleted);
    }
}
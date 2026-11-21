using Microsoft.EntityFrameworkCore;

namespace HomeSellerServer.Module;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Users> Users { get; set; }

    public static readonly Guid BuyerRoleId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    public static readonly Guid SellerRoleId = Guid.Parse("22222222-2222-2222-2222-222222222222");


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("SellShop.Auth");
        modelBuilder.Entity<Users>(entity =>
        {
            entity.HasIndex(e=>e.Login).IsUnique();
        });

        
        modelBuilder.Entity<Users>(entity =>
        {
            entity.HasQueryFilter(u => !u.isDeleted);

         
        });


        
    }
}
using Microsoft.EntityFrameworkCore;

namespace HomeSeller.UserService.Modules;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions options) : base(options)
    {
    }


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("SellShop.UserProfiles");
        modelBuilder.Entity<UsersProfiles>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.Property(e => e.Name)
                .IsRequired()
                .HasMaxLength(100);

            entity.Property(e => e.PhoneNumber)
                .HasMaxLength(20);

            entity.HasIndex(e => e.Name);
            entity.HasQueryFilter(e=>!e.IsDeleted);
        });
        modelBuilder.Entity<ProductUser>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasQueryFilter(e => !e.UsersProfiles.IsDeleted);
            entity.HasIndex(e => new { e.UserProfilesId, e.ProductId })
                .IsUnique();

     

            entity.HasOne(e => e.UsersProfiles)
                .WithMany(e => e.ProductUsers)
                .HasForeignKey(e => e.UserProfilesId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        
    }
    
}
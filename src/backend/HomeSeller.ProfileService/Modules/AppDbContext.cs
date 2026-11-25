using Microsoft.EntityFrameworkCore;

namespace HomeSeller.UserService.Modules;

public class AppDbContext : DbContext
{
    public DbSet<UsersProfiles>  UsersProfiles { get; set; }
    public DbSet<ProductUser>   ProductUser { get; set; }
    public DbSet<ProfileImage> ProfileImage { get; set; }
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
        
    }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("SellShop.UserProfiles");
        modelBuilder.Entity<UsersProfiles>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserId)
                .IsRequired();
            entity.Property(e => e.Name)
                .IsRequired()
                .HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);

            entity.Property(e => e.PhoneNumber)
                .HasMaxLength(20);

            entity.HasIndex(e => e.Name);
            entity.HasQueryFilter(e=>!e.IsDeleted);
        });
        modelBuilder.Entity<ProductUser>(entity =>
        {
            entity.HasKey(e => e.Id);

            entity.HasQueryFilter(e => !e.isDeleted && !e.UsersProfiles.IsDeleted);
            entity.HasIndex(e => new { e.UserProfilesId, e.ProductId })
                .IsUnique();


            
            entity.HasOne(e => e.UsersProfiles)
                .WithMany(e => e.ProductUsers)
                .HasForeignKey(e => e.UserProfilesId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<ProfileImage>(entity =>
        {
            entity.HasKey(e => e.Id);



            entity.HasQueryFilter(e => !e.IsDeleted && !e.UsersProfiles.IsDeleted);

            entity.HasOne(e => e.UsersProfiles)
                .WithMany(e => e.ImageURLs)
                .HasForeignKey(e => e.UserProfilesId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        
    }
    
}
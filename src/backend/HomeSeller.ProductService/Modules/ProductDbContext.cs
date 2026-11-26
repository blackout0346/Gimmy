using HomeSeller.ProductService.Modules;
using Microsoft.EntityFrameworkCore;
using ProductService.Module;

namespace HomeSellerServer.Module;

public class ProductDbContext : DbContext
{
    public ProductDbContext(DbContextOptions<ProductDbContext> options) : base(options) { }


    public DbSet<Products> Products { get; set; }
    public DbSet<Condition> Condition { get; set; } 
    public DbSet<Tags> Tags { get; set; }
    public DbSet<ProductTag> ProductTags { get; set; }
    public DbSet<ProductImage>  ProductImage { get; set; }
    public DbSet<RateProductItem> RateProductItem { get; set; }
    public DbSet<RateProductImage>  RateProductImage { get; set; }
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("SellShop.Product");
        modelBuilder.Entity<Condition>().HasData(
            new Condition { Id = Guid.Parse("11111111-1111-1111-1111-111111111111"), NameCondition = "Новое" },
            new Condition { Id = Guid.Parse("22222222-2222-2222-2222-222222222222"), NameCondition = "Б/У" }
        );

        modelBuilder.Entity<RateProductItem>(entity =>
        {
            entity.HasQueryFilter(p=>!p.Product.isDeleted && !p.IsDeleted);
            entity.HasOne(pi => pi.Product)
                .WithMany(p => p.RateProductItems)
                .HasForeignKey(pi => pi.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
   
        });
        modelBuilder.Entity<RateProductImage>(entity =>
        {
        entity.HasOne(p=>p.RateProductItem)
            .WithMany(p=>p.RateProductImages)
            .HasForeignKey(pi => pi.RateProductItemId)
            .OnDelete(DeleteBehavior.Cascade);
        
        });
        modelBuilder.Entity<ProductImage>(entity =>
        {
            entity.HasQueryFilter(pi => !pi.Products.isDeleted);

            entity.HasOne(pi => pi.Products)
                .WithMany(p => p.ImageURLs)
                .HasForeignKey(pi => pi.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<Tags>(entity =>
        {
            entity.HasOne(t => t.ParentTag)
                .WithMany(t => t.SubTags)
                .HasForeignKey(t => t.ParentTagId)
                .OnDelete(DeleteBehavior.Restrict); 
        });

        modelBuilder.Entity<Products>(entity =>
        {
            entity.HasIndex(e => e.NameProduct);
        });
        modelBuilder.Entity<Products>(entity =>
        {
            entity.HasQueryFilter(p => !p.isDeleted);

            entity.Property(p => p.Price)
                .HasColumnType("numeric(18,2)");

            entity.HasOne(p => p.Condition)
                .WithMany(c => c.Products)
                .HasForeignKey(p => p.ConditionId)
                .OnDelete(DeleteBehavior.Restrict); 
        });

  
        modelBuilder.Entity<ProductTag>(entity =>
        {
         
            entity.HasQueryFilter(pt => !pt.Product.isDeleted );

            entity.HasOne(pt => pt.Product)
                .WithMany(p => p.ProductTags)
                .HasForeignKey(pt => pt.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(pt => pt.Tag)
                .WithMany(t => t.ProductTags)
                .HasForeignKey(pt => pt.TagId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(pt => new { pt.ProductId, pt.TagId })
                .IsUnique();
        });
    }
}
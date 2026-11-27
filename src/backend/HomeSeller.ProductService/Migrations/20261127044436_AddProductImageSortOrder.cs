using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HomeSeller.ProductService.Migrations
{
    /// <inheritdoc />
    public partial class AddProductImageSortOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                schema: "SellShop.Product",
                table: "ProductImage",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SortOrder",
                schema: "SellShop.Product",
                table: "ProductImage");
        }
    }
}

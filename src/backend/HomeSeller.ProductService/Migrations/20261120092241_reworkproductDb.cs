using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HomeSeller.ProductService.Migrations
{
    /// <inheritdoc />
    public partial class reworkproductDb : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Position",
                schema: "SellShop.Product",
                table: "Products",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Position",
                schema: "SellShop.Product",
                table: "Products");
        }
    }
}

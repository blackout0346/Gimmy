using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace HomeSeller.ProductService.Migrations
{
    /// <inheritdoc />
    public partial class initCondition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: "SellShop.Product",
                table: "Condition",
                columns: new[] { "Id", "NameCondition" },
                values: new object[,]
                {
                    { new Guid("11111111-1111-1111-1111-111111111111"), "Новое" },
                    { new Guid("22222222-2222-2222-2222-222222222222"), "Б/У" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: "SellShop.Product",
                table: "Condition",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"));

            migrationBuilder.DeleteData(
                schema: "SellShop.Product",
                table: "Condition",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"));
        }
    }
}

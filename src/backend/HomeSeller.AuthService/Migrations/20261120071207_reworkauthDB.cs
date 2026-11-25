using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace HomeSellerServer.Migrations
{
    /// <inheritdoc />
    public partial class reworkauthDB : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Users_Roles_RoleId",
                schema: "SellShop.Auth",
                table: "Users");

            migrationBuilder.DropTable(
                name: "Roles",
                schema: "SellShop.Auth");

            migrationBuilder.DropIndex(
                name: "IX_Users_RoleId",
                schema: "SellShop.Auth",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RoleId",
                schema: "SellShop.Auth",
                table: "Users");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Login",
                schema: "SellShop.Auth",
                table: "Users",
                column: "Login",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_Login",
                schema: "SellShop.Auth",
                table: "Users");

            migrationBuilder.AddColumn<Guid>(
                name: "RoleId",
                schema: "SellShop.Auth",
                table: "Users",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "Roles",
                schema: "SellShop.Auth",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleName = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.InsertData(
                schema: "SellShop.Auth",
                table: "Roles",
                columns: new[] { "Id", "RoleName" },
                values: new object[,]
                {
                    { new Guid("22222222-2222-2222-2222-222222222222"), "Seller" },
                    { new Guid("33333333-3333-3333-3333-333333333333"), "Buyer" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_RoleId",
                schema: "SellShop.Auth",
                table: "Users",
                column: "RoleId");

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Roles_RoleId",
                schema: "SellShop.Auth",
                table: "Users",
                column: "RoleId",
                principalSchema: "SellShop.Auth",
                principalTable: "Roles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HomeSeller.Messenger.Migrations
{
    /// <inheritdoc />
    public partial class messengerinit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ProductName",
                schema: "SellShop.Messenger",
                table: "Chats",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "UserName1",
                schema: "SellShop.Messenger",
                table: "Chats",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "UserName2",
                schema: "SellShop.Messenger",
                table: "Chats",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ProductName",
                schema: "SellShop.Messenger",
                table: "Chats");

            migrationBuilder.DropColumn(
                name: "UserName1",
                schema: "SellShop.Messenger",
                table: "Chats");

            migrationBuilder.DropColumn(
                name: "UserName2",
                schema: "SellShop.Messenger",
                table: "Chats");
        }
    }
}

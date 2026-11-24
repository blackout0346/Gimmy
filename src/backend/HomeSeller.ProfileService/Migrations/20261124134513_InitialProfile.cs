using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HomeSeller.UserService.Migrations
{
    /// <inheritdoc />
    public partial class InitialProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "SellShop.UserProfiles");

            migrationBuilder.CreateTable(
                name: "UsersProfiles",
                schema: "SellShop.UserProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    PhoneNumber = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsersProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProductUser",
                schema: "SellShop.UserProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserProfilesId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    isDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductUser", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductUser_UsersProfiles_UserProfilesId",
                        column: x => x.UserProfilesId,
                        principalSchema: "SellShop.UserProfiles",
                        principalTable: "UsersProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProfileImage",
                schema: "SellShop.UserProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ImageURL = table.Column<string>(type: "text", nullable: false),
                    UserProfilesId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfileImage", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProfileImage_UsersProfiles_UserProfilesId",
                        column: x => x.UserProfilesId,
                        principalSchema: "SellShop.UserProfiles",
                        principalTable: "UsersProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductUser_UserProfilesId_ProductId",
                schema: "SellShop.UserProfiles",
                table: "ProductUser",
                columns: new[] { "UserProfilesId", "ProductId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProfileImage_UserProfilesId",
                schema: "SellShop.UserProfiles",
                table: "ProfileImage",
                column: "UserProfilesId");

            migrationBuilder.CreateIndex(
                name: "IX_UsersProfiles_Name",
                schema: "SellShop.UserProfiles",
                table: "UsersProfiles",
                column: "Name");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductUser",
                schema: "SellShop.UserProfiles");

            migrationBuilder.DropTable(
                name: "ProfileImage",
                schema: "SellShop.UserProfiles");

            migrationBuilder.DropTable(
                name: "UsersProfiles",
                schema: "SellShop.UserProfiles");
        }
    }
}

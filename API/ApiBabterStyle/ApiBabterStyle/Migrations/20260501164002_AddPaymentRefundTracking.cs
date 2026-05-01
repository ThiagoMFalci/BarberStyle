using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ApiBabterStyle.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentRefundTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MercadoPagoPaymentId",
                table: "Appointments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MercadoPagoRefundId",
                table: "Appointments",
                type: "text",
                nullable: true);

            migrationBuilder.InsertData(
                table: "Barbers",
                columns: new[] { "Id", "Active", "Name", "Specialty" },
                values: new object[,]
                {
                    { new Guid("4c6f1905-a984-49f1-9129-c7b7c5c5eaf2"), true, "Michael Trindade", "Corte, barba e degradê" },
                    { new Guid("75624c38-17fd-4720-8670-42a7a59f32db"), true, "Valdir Bispo", "Barba, navalha e finalização" },
                    { new Guid("7ba716f3-2170-46d2-bb4e-bf6c983cfead"), true, "Ton Barber", "Corte masculino premium" }
                });

            migrationBuilder.InsertData(
                table: "Services",
                columns: new[] { "Id", "Active", "Description", "DurationMinutes", "Name", "Price" },
                values: new object[,]
                {
                    { new Guid("714f2a9f-f890-4592-bf37-56b3f5b913ef"), true, "Design discreto e natural", 20, "Sobrancelha", 25m },
                    { new Guid("f054bf3c-27c3-4374-b8c7-79acc4403590"), true, "Hidratacao e detox capilar", 50, "Tratamento capilar", 85m },
                    { new Guid("fe8385e9-0377-4907-9a8f-707e6d4a79f6"), true, "Experiencia reservada com cabelo, barba e acabamento", 120, "Dia do noivo / experiencia premium", 240m }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Barbers",
                keyColumn: "Id",
                keyValue: new Guid("4c6f1905-a984-49f1-9129-c7b7c5c5eaf2"));

            migrationBuilder.DeleteData(
                table: "Barbers",
                keyColumn: "Id",
                keyValue: new Guid("75624c38-17fd-4720-8670-42a7a59f32db"));

            migrationBuilder.DeleteData(
                table: "Barbers",
                keyColumn: "Id",
                keyValue: new Guid("7ba716f3-2170-46d2-bb4e-bf6c983cfead"));

            migrationBuilder.DeleteData(
                table: "Services",
                keyColumn: "Id",
                keyValue: new Guid("714f2a9f-f890-4592-bf37-56b3f5b913ef"));

            migrationBuilder.DeleteData(
                table: "Services",
                keyColumn: "Id",
                keyValue: new Guid("f054bf3c-27c3-4374-b8c7-79acc4403590"));

            migrationBuilder.DeleteData(
                table: "Services",
                keyColumn: "Id",
                keyValue: new Guid("fe8385e9-0377-4907-9a8f-707e6d4a79f6"));

            migrationBuilder.DropColumn(
                name: "MercadoPagoPaymentId",
                table: "Appointments");

            migrationBuilder.DropColumn(
                name: "MercadoPagoRefundId",
                table: "Appointments");
        }
    }
}

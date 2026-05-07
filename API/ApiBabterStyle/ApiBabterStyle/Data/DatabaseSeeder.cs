using ApiBabterStyle.Model;
using Microsoft.EntityFrameworkCore;

namespace ApiBabterStyle.Data;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BarberShopDbContext>();

        if (db.Database.IsRelational() && db.Database.ProviderName != "Microsoft.EntityFrameworkCore.Sqlite")
        {
            await db.Database.MigrateAsync();
            await SeedDefaultServicesAsync(db);
            await SeedAdminUserAsync(scope.ServiceProvider, db);
            return;
        }

        await db.Database.EnsureCreatedAsync();
        await EnsureSqliteAppointmentColumnsAsync(db);
        await EnsureSqliteUserColumnsAsync(db);

        if (!await db.Barbers.AnyAsync())
        {
            db.Barbers.AddRange(
                new Barber { Name = "Carlos Silva", Specialty = "Corte masculino e degradê" },
                new Barber { Name = "Rafael Santos", Specialty = "Barba, navalha e sobrancelha" });
        }

        await SeedDefaultServicesAsync(db);

        await db.SaveChangesAsync();
        await SeedAdminUserAsync(scope.ServiceProvider, db);
    }

    private static async Task SeedDefaultServicesAsync(BarberShopDbContext db)
    {
        var defaultServices = new[]
        {
            new BarberService { Name = "Corte", Description = "Corte masculino completo", Price = 45m, DurationMinutes = 45 },
            new BarberService { Name = "Barba", Description = "Barba com toalha quente e acabamento na navalha", Price = 35m, DurationMinutes = 30 },
            new BarberService { Name = "Corte + Barba", Description = "Pacote completo de corte e barba", Price = 75m, DurationMinutes = 75 },
            new BarberService { Name = "Plano Essencial", Description = "Assinatura mensal com 2 cortes e beneficios do clube", Price = 89.90m, DurationMinutes = 45 },
            new BarberService { Name = "Plano Premium", Description = "Assinatura mensal com cortes e barba do clube premium", Price = 149.90m, DurationMinutes = 75 },
            new BarberService { Name = "Plano Executivo", Description = "Assinatura mensal VIP com corte, barba e beneficios executivos", Price = 229.90m, DurationMinutes = 90 }
        };

        foreach (var service in defaultServices)
        {
            var exists = await db.Services.AnyAsync(item => item.Name.ToLower() == service.Name.ToLower());
            if (!exists)
            {
                db.Services.Add(service);
            }
        }

        await db.SaveChangesAsync();
    }

    private static async Task EnsureSqliteAppointmentColumnsAsync(BarberShopDbContext db)
    {
        if (db.Database.ProviderName != "Microsoft.EntityFrameworkCore.Sqlite")
        {
            return;
        }

        var columns = await db.Database
            .SqlQueryRaw<string>("SELECT name AS Value FROM pragma_table_info('Appointments')")
            .ToListAsync();

        if (!columns.Contains("MercadoPagoPaymentId"))
        {
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE Appointments ADD COLUMN MercadoPagoPaymentId TEXT NULL");
        }

        if (!columns.Contains("MercadoPagoRefundId"))
        {
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE Appointments ADD COLUMN MercadoPagoRefundId TEXT NULL");
        }
    }

    private static async Task EnsureSqliteUserColumnsAsync(BarberShopDbContext db)
    {
        if (db.Database.ProviderName != "Microsoft.EntityFrameworkCore.Sqlite")
        {
            return;
        }

        var columns = await db.Database
            .SqlQueryRaw<string>("SELECT name AS Value FROM pragma_table_info('Users')")
            .ToListAsync();

        if (!columns.Contains("PasswordResetTokenHash"))
        {
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE Users ADD COLUMN PasswordResetTokenHash TEXT NULL");
        }

        if (!columns.Contains("PasswordResetTokenExpiresAt"))
        {
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE Users ADD COLUMN PasswordResetTokenExpiresAt TEXT NULL");
        }

        if (!columns.Contains("PasswordResetRequestedAt"))
        {
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE Users ADD COLUMN PasswordResetRequestedAt TEXT NULL");
        }
    }

    private static async Task SeedAdminUserAsync(IServiceProvider services, BarberShopDbContext db)
    {
        var configuration = services.GetRequiredService<IConfiguration>();
        var email = configuration["AdminUser:Email"];
        var password = configuration["AdminUser:Password"];

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            return;
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        var admin = await db.Users.FirstOrDefaultAsync(user => user.Email == normalizedEmail);

        if (admin is not null)
        {
            admin.Name = configuration["AdminUser:Name"] ?? admin.Name;
            admin.Phone = configuration["AdminUser:Phone"] ?? admin.Phone;
            admin.Role = "Admin";
            admin.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
            await db.SaveChangesAsync();

            return;
        }

        db.Users.Add(new User
        {
            Name = configuration["AdminUser:Name"] ?? "Administrador",
            Email = normalizedEmail,
            Phone = configuration["AdminUser:Phone"] ?? string.Empty,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = "Admin"
        });

        await db.SaveChangesAsync();
    }
}

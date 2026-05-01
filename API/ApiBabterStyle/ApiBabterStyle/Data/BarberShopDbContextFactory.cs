using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ApiBabterStyle.Data;

public class BarberShopDbContextFactory : IDesignTimeDbContextFactory<BarberShopDbContext>
{
    public BarberShopDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? string.Empty;

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            connectionString = "Data Source=barberstyle-dev.db";
        }

        var builder = new DbContextOptionsBuilder<BarberShopDbContext>();
        if (connectionString.Contains("Data Source=", StringComparison.OrdinalIgnoreCase) ||
            connectionString.EndsWith(".db", StringComparison.OrdinalIgnoreCase))
        {
            builder.UseSqlite(connectionString);
        }
        else
        {
            builder.UseNpgsql(connectionString);
        }

        var options = builder.Options;

        return new BarberShopDbContext(options);
    }
}

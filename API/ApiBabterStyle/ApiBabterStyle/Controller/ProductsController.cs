using ApiBabterStyle.Data;
using ApiBabterStyle.DTOs;
using ApiBabterStyle.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ApiBabterStyle.Controller;

[ApiController]
[Route("api/produtos")]
public class ProductsController(BarberShopDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ProductResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var products = await db.Products
            .AsNoTracking()
            .Where(product => product.Active)
            .OrderBy(product => product.Name)
            .Select(product => new ProductResponse(
                product.Id,
                product.Name,
                product.Description,
                product.Category,
                product.Price,
                product.StockQuantity,
                product.ImageUrl,
                product.Active))
            .ToListAsync(cancellationToken);

        return Ok(products);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id && item.Active, cancellationToken);

        if (product is null)
        {
            return NotFound(new { message = "Produto nao encontrado." });
        }

        return Ok(ToResponse(product));
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("admin")]
    public async Task<ActionResult<IReadOnlyList<ProductResponse>>> GetAllForAdmin(CancellationToken cancellationToken)
    {
        var products = await db.Products
            .AsNoTracking()
            .OrderBy(product => product.Name)
            .Select(product => new ProductResponse(
                product.Id,
                product.Name,
                product.Description,
                product.Category,
                product.Price,
                product.StockQuantity,
                product.ImageUrl,
                product.Active))
            .ToListAsync(cancellationToken);

        return Ok(products);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("admin")]
    public async Task<ActionResult<ProductResponse>> Create(CreateProductRequest request, CancellationToken cancellationToken)
    {
        var validation = ValidateProduct(request.Name, request.Price, request.StockQuantity);
        if (validation is not null)
        {
            return BadRequest(new { message = validation });
        }

        var product = new Product
        {
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
            Category = request.Category.Trim(),
            Price = request.Price,
            StockQuantity = request.StockQuantity,
            ImageUrl = request.ImageUrl?.Trim() ?? string.Empty
        };

        db.Products.Add(product);
        await db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = product.Id }, ToResponse(product));
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("admin/{id:guid}")]
    public async Task<ActionResult<ProductResponse>> Update(Guid id, UpdateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await db.Products.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (product is null)
        {
            return NotFound(new { message = "Produto nao encontrado." });
        }

        var validation = ValidateProduct(request.Name, request.Price, request.StockQuantity);
        if (validation is not null)
        {
            return BadRequest(new { message = validation });
        }

        product.Name = request.Name.Trim();
        product.Description = request.Description.Trim();
        product.Category = request.Category.Trim();
        product.Price = request.Price;
        product.StockQuantity = request.StockQuantity;
        product.ImageUrl = request.ImageUrl?.Trim() ?? string.Empty;
        product.Active = request.Active;
        product.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToResponse(product));
    }

    [Authorize(Roles = "Admin")]
    [HttpPatch("admin/{id:guid}/status")]
    public async Task<ActionResult<ProductResponse>> ChangeStatus(Guid id, [FromQuery] bool active, CancellationToken cancellationToken)
    {
        var product = await db.Products.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (product is null)
        {
            return NotFound(new { message = "Produto nao encontrado." });
        }

        product.Active = active;
        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return Ok(ToResponse(product));
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("admin/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (product is null)
        {
            return NotFound(new { message = "Produto nao encontrado." });
        }

        product.Active = false;
        product.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private static string? ValidateProduct(string name, decimal price, int stockQuantity)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return "Nome do produto e obrigatorio.";
        }

        if (price <= 0)
        {
            return "Preco do produto precisa ser maior que zero.";
        }

        if (stockQuantity < 0)
        {
            return "Estoque nao pode ser negativo.";
        }

        return null;
    }

    private static ProductResponse ToResponse(Product product)
    {
        return new ProductResponse(
            product.Id,
            product.Name,
            product.Description,
            product.Category,
            product.Price,
            product.StockQuantity,
            product.ImageUrl,
            product.Active);
    }
}

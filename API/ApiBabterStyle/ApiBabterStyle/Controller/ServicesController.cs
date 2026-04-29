using ApiBabterStyle.Data;
using ApiBabterStyle.DTOs;
using ApiBabterStyle.Model;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ApiBabterStyle.Controller;

[ApiController]
[Route("api/servicos")]
public class ServicesController(BarberShopDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ServiceResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var services = await db.Services
            .Where(service => service.Active)
            .OrderBy(service => service.Price)
            .Select(service => new ServiceResponse(service.Id, service.Name, service.Description, service.Price, service.DurationMinutes))
            .ToListAsync(cancellationToken);

        return Ok(services);
    }

    [HttpGet("admin")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<IReadOnlyList<AdminServiceResponse>>> GetAllForAdmin(CancellationToken cancellationToken)
    {
        var services = await db.Services
            .OrderBy(service => service.Name)
            .Select(service => new AdminServiceResponse(
                service.Id,
                service.Name,
                service.Description,
                service.Price,
                service.DurationMinutes,
                service.Active))
            .ToListAsync(cancellationToken);

        return Ok(services);
    }

    [HttpPost("admin")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ServiceResponse>> Create(CreateServiceRequest request, CancellationToken cancellationToken)
    {
        var service = new BarberService
        {
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
            Price = request.Price,
            DurationMinutes = request.DurationMinutes
        };

        db.Services.Add(service);
        await db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetAll), new ServiceResponse(service.Id, service.Name, service.Description, service.Price, service.DurationMinutes));
    }

    [HttpPut("admin/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> Update(Guid id, UpdateServiceRequest request, CancellationToken cancellationToken)
    {
        var service = await db.Services.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (service is null)
        {
            return NotFound(new { message = "Servico nao encontrado." });
        }

        service.Name = request.Name.Trim();
        service.Description = request.Description.Trim();
        service.Price = request.Price;
        service.DurationMinutes = request.DurationMinutes;
        service.Active = request.Active;

        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("admin/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var service = await db.Services.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (service is null)
        {
            return NotFound(new { message = "Servico nao encontrado." });
        }

        service.Active = false;
        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }
}

using ApiBabterStyle.Data;
using ApiBabterStyle.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ApiBabterStyle.Controller;

[ApiController]
[Route("api/barbeiros")]
public class BarbersController(BarberShopDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BarberResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var barbers = await db.Barbers
            .Where(barber => barber.Active)
            .OrderBy(barber => barber.Name)
            .Select(barber => new BarberResponse(barber.Id, barber.Name, barber.Specialty))
            .ToListAsync(cancellationToken);

        return Ok(barbers);
    }
}

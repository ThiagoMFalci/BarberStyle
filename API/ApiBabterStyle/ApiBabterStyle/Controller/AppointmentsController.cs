using ApiBabterStyle.Data;
using ApiBabterStyle.DTOs;
using ApiBabterStyle.Model;
using ApiBabterStyle.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ApiBabterStyle.Controller;

[ApiController]
[Authorize]
[Route("api/agendamentos")]
public class AppointmentsController(BarberShopDbContext db, MercadoPagoService mercadoPagoService) : ControllerBase
{
    [HttpPost("publico")]
    [AllowAnonymous]
    public async Task<ActionResult<PublicAppointmentResponse>> CreatePublic(PublicAppointmentRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerName) || string.IsNullOrWhiteSpace(request.CustomerPhone))
        {
            return BadRequest(new { message = "Nome e telefone sao obrigatorios." });
        }

        var scheduledAt = NormalizeScheduledAt(request.ScheduledAt);
        if (scheduledAt <= DateTime.UtcNow)
        {
            return BadRequest(new { message = "Escolha uma data e horario no futuro." });
        }

        var requestedService = request.ServiceName.Trim().ToLowerInvariant();
        var service = await db.Services.FirstOrDefaultAsync(item =>
            item.Active &&
            (item.Name.ToLower() == requestedService ||
             item.Name.ToLower().Contains(requestedService) ||
             requestedService.Contains(item.Name.ToLower())),
            cancellationToken);
        if (service is null)
        {
            return NotFound(new { message = "Servico nao encontrado." });
        }

        var requestedBarber = request.BarberName.Trim().ToLowerInvariant();
        var barber = await db.Barbers.FirstOrDefaultAsync(item =>
            item.Active && item.Name.ToLower() == requestedBarber,
            cancellationToken);
        if (barber is null)
        {
            return NotFound(new { message = "Barbeiro nao encontrado." });
        }

        var isBusy = await db.Appointments.AnyAsync(appointment =>
            appointment.BarberId == barber.Id &&
            appointment.ScheduledAt == scheduledAt &&
            appointment.Status != AppointmentStatus.Cancelled,
            cancellationToken);

        if (isBusy)
        {
            return Conflict(new { message = "Este barbeiro ja possui um agendamento nesse horario." });
        }

        var email = string.IsNullOrWhiteSpace(request.CustomerEmail)
            ? $"cliente-{Guid.NewGuid():N}@barberstyle.local"
            : request.CustomerEmail.Trim().ToLowerInvariant();

        var user = await db.Users.FirstOrDefaultAsync(item => item.Email == email, cancellationToken);
        if (user is null)
        {
            user = new User
            {
                Name = request.CustomerName.Trim(),
                Email = email,
                Phone = request.CustomerPhone.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"))
            };
            db.Users.Add(user);
        }
        else
        {
            user.Name = request.CustomerName.Trim();
            user.Phone = request.CustomerPhone.Trim();
        }

        var appointment = new Appointment
        {
            User = user,
            UserId = user.Id,
            Barber = barber,
            BarberId = barber.Id,
            Service = service,
            ServiceId = service.Id,
            ScheduledAt = scheduledAt,
            Notes = BuildPublicNotes(request),
            PaymentStatus = request.PayOnline ? PaymentStatus.WaitingMercadoPago : PaymentStatus.Pending
        };

        db.Appointments.Add(appointment);
        await db.SaveChangesAsync(cancellationToken);

        if (request.PayOnline)
        {
            try
            {
                var preference = await mercadoPagoService.CreatePreferenceAsync(appointment, cancellationToken);
                appointment.MercadoPagoPreferenceId = preference.PreferenceId;
                appointment.MercadoPagoInitPoint = preference.CheckoutUrl;
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message, appointmentId = appointment.Id });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Nao foi possivel gerar o checkout do Mercado Pago: {ex.Message}", appointmentId = appointment.Id });
            }
        }

        var message = request.PayOnline
            ? "Horario reservado. Continue para o Mercado Pago para finalizar o pagamento."
            : "Horario agendado com sucesso. Pagamento presencial pendente.";

        return CreatedAtAction(nameof(GetPublicStatus), new { id = appointment.Id }, ToPublicResponse(appointment, request.PayOnline ? "Online" : "Presencial", message));
    }

    [HttpGet("publico/{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<PublicAppointmentStatusResponse>> GetPublicStatus(Guid id, CancellationToken cancellationToken)
    {
        var appointment = await db.Appointments
            .AsNoTracking()
            .Include(item => item.User)
            .Include(item => item.Barber)
            .Include(item => item.Service)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (appointment is null)
        {
            return NotFound(new { message = "Agendamento nao encontrado." });
        }

        return Ok(new PublicAppointmentStatusResponse(
            appointment.Id,
            appointment.User?.Name ?? string.Empty,
            appointment.Barber?.Name ?? string.Empty,
            appointment.Service?.Name ?? string.Empty,
            appointment.ScheduledAt,
            appointment.Status.ToString(),
            appointment.PaymentStatus.ToString(),
            appointment.Notes));
    }

    [HttpGet("admin")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<IReadOnlyList<AdminAppointmentResponse>>> GetAllForAdmin(CancellationToken cancellationToken)
    {
        var appointments = await db.Appointments
            .AsNoTracking()
            .Include(appointment => appointment.User)
            .Include(appointment => appointment.Barber)
            .Include(appointment => appointment.Service)
            .OrderBy(appointment => appointment.ScheduledAt)
            .Select(appointment => ToAdminResponse(appointment))
            .ToListAsync(cancellationToken);

        return Ok(appointments);
    }

    [HttpGet("meus")]
    public async Task<ActionResult<IReadOnlyList<AppointmentResponse>>> GetMine(CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var appointments = await db.Appointments
            .AsNoTracking()
            .Include(appointment => appointment.Barber)
            .Include(appointment => appointment.Service)
            .Where(appointment => appointment.UserId == userId)
            .OrderByDescending(appointment => appointment.ScheduledAt)
            .Select(appointment => ToResponse(appointment))
            .ToListAsync(cancellationToken);

        return Ok(appointments);
    }

    [HttpPost]
    public async Task<ActionResult<AppointmentResponse>> Create(CreateAppointmentRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var scheduledAt = NormalizeScheduledAt(request.ScheduledAt);

        if (scheduledAt <= DateTime.UtcNow)
        {
            return BadRequest(new { message = "Escolha uma data e horario no futuro." });
        }

        var barber = await db.Barbers.FirstOrDefaultAsync(item => item.Id == request.BarberId && item.Active, cancellationToken);
        if (barber is null)
        {
            return NotFound(new { message = "Barbeiro nao encontrado." });
        }

        var service = await db.Services.FirstOrDefaultAsync(item => item.Id == request.ServiceId && item.Active, cancellationToken);
        if (service is null)
        {
            return NotFound(new { message = "Servico nao encontrado." });
        }

        var isBusy = await db.Appointments.AnyAsync(appointment =>
            appointment.BarberId == request.BarberId &&
            appointment.ScheduledAt == scheduledAt &&
            appointment.Status != AppointmentStatus.Cancelled,
            cancellationToken);

        if (isBusy)
        {
            return Conflict(new { message = "Este barbeiro ja possui um agendamento nesse horario." });
        }

        var appointment = new Appointment
        {
            UserId = userId,
            BarberId = barber.Id,
            ServiceId = service.Id,
            ScheduledAt = scheduledAt,
            Notes = request.Notes?.Trim() ?? string.Empty,
            Barber = barber,
            Service = service,
            User = await db.Users.FindAsync([userId], cancellationToken)
        };

        db.Appointments.Add(appointment);
        await db.SaveChangesAsync(cancellationToken);

        if (request.CreatePayment)
        {
            try
            {
                var preference = await mercadoPagoService.CreatePreferenceAsync(appointment, cancellationToken);
                appointment.MercadoPagoPreferenceId = preference.PreferenceId;
                appointment.MercadoPagoInitPoint = preference.CheckoutUrl;
                appointment.PaymentStatus = PaymentStatus.WaitingMercadoPago;
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message, appointmentId = appointment.Id });
            }
        }

        return CreatedAtAction(nameof(GetMine), ToResponse(appointment));
    }

    [HttpPatch("{id:guid}/cancelar")]
    public async Task<ActionResult<AppointmentResponse>> Cancel(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var appointment = await db.Appointments
            .Include(item => item.Barber)
            .Include(item => item.Service)
            .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);

        if (appointment is null)
        {
            return NotFound(new { message = "Agendamento nao encontrado." });
        }

        appointment.Status = AppointmentStatus.Cancelled;
        appointment.PaymentStatus = appointment.PaymentStatus == PaymentStatus.Paid
            ? appointment.PaymentStatus
            : PaymentStatus.Cancelled;
        await db.SaveChangesAsync(cancellationToken);

        return Ok(ToResponse(appointment));
    }

    [HttpPatch("admin/{id:guid}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AdminAppointmentResponse>> UpdateStatus(Guid id, AppointmentStatus status, CancellationToken cancellationToken)
    {
        var appointment = await db.Appointments
            .Include(item => item.User)
            .Include(item => item.Barber)
            .Include(item => item.Service)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (appointment is null)
        {
            return NotFound(new { message = "Agendamento nao encontrado." });
        }

        appointment.Status = status;
        if (status == AppointmentStatus.Cancelled && appointment.PaymentStatus != PaymentStatus.Paid)
        {
            appointment.PaymentStatus = PaymentStatus.Cancelled;
        }

        await db.SaveChangesAsync(cancellationToken);

        return Ok(ToAdminResponse(appointment));
    }

    [HttpDelete("admin/{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> DeleteForAdmin(Guid id, CancellationToken cancellationToken)
    {
        var appointment = await db.Appointments.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (appointment is null)
        {
            return NotFound(new { message = "Agendamento nao encontrado." });
        }

        db.Appointments.Remove(appointment);
        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private static AppointmentResponse ToResponse(Appointment appointment)
    {
        return new AppointmentResponse(
            appointment.Id,
            appointment.BarberId,
            appointment.Barber?.Name ?? string.Empty,
            appointment.ServiceId,
            appointment.Service?.Name ?? string.Empty,
            appointment.Service?.Price ?? 0,
            appointment.ScheduledAt,
            appointment.Status.ToString(),
            appointment.PaymentStatus.ToString(),
            appointment.MercadoPagoInitPoint,
            appointment.Notes);
    }

    private static DateTime NormalizeScheduledAt(DateTime scheduledAt)
    {
        return scheduledAt.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(scheduledAt, DateTimeKind.Local).ToUniversalTime()
            : scheduledAt.ToUniversalTime();
    }

    private static string BuildPublicNotes(PublicAppointmentRequest request)
    {
        var notes = request.Notes?.Trim() ?? string.Empty;
        var unit = string.IsNullOrWhiteSpace(request.Unit) ? string.Empty : $"Unidade: {request.Unit.Trim()}.";

        return string.Join(" ", new[] { unit, notes }.Where(item => !string.IsNullOrWhiteSpace(item)));
    }

    private static PublicAppointmentResponse ToPublicResponse(Appointment appointment, string paymentMethod, string message)
    {
        return new PublicAppointmentResponse(
            appointment.Id,
            appointment.User?.Name ?? string.Empty,
            appointment.Barber?.Name ?? string.Empty,
            appointment.Service?.Name ?? string.Empty,
            appointment.Service?.Price ?? 0,
            appointment.ScheduledAt,
            appointment.Status.ToString(),
            appointment.PaymentStatus.ToString(),
            paymentMethod,
            appointment.MercadoPagoInitPoint,
            message);
    }

    private static AdminAppointmentResponse ToAdminResponse(Appointment appointment)
    {
        return new AdminAppointmentResponse(
            appointment.Id,
            appointment.UserId,
            appointment.User?.Name ?? string.Empty,
            appointment.User?.Email ?? string.Empty,
            appointment.User?.Phone ?? string.Empty,
            appointment.BarberId,
            appointment.Barber?.Name ?? string.Empty,
            appointment.ServiceId,
            appointment.Service?.Name ?? string.Empty,
            appointment.Service?.Price ?? 0,
            appointment.ScheduledAt,
            appointment.Status.ToString(),
            appointment.PaymentStatus.ToString(),
            appointment.MercadoPagoInitPoint,
            appointment.Notes,
            appointment.CreatedAt);
    }
}

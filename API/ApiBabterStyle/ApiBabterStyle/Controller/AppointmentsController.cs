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

        var userId = User.GetUserId();
        var user = await db.Users.FirstOrDefaultAsync(item => item.Id == userId, cancellationToken);
        if (user is null)
        {
            return Unauthorized(new { message = "Faca login para criar um agendamento." });
        }

        user.Name = request.CustomerName.Trim();
        user.Phone = request.CustomerPhone.Trim();

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
            Status = request.PayOnline ? AppointmentStatus.WaitingPayment : AppointmentStatus.Scheduled,
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
                db.Appointments.Remove(appointment);
                await db.SaveChangesAsync(cancellationToken);
                return BadRequest(new { message = ex.Message, appointmentId = appointment.Id });
            }
            catch (Exception ex)
            {
                db.Appointments.Remove(appointment);
                await db.SaveChangesAsync(cancellationToken);
                return BadRequest(new { message = BuildMercadoPagoErrorMessage(ex), appointmentId = appointment.Id });
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
            Status = request.CreatePayment ? AppointmentStatus.WaitingPayment : AppointmentStatus.Scheduled,
            PaymentStatus = request.CreatePayment ? PaymentStatus.WaitingMercadoPago : PaymentStatus.Pending,
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
                db.Appointments.Remove(appointment);
                await db.SaveChangesAsync(cancellationToken);
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

        var validation = await CancelWithRefundAsync(appointment, cancellationToken);
        if (validation is not null)
        {
            return validation;
        }

        await db.SaveChangesAsync(cancellationToken);

        return Ok(ToResponse(appointment));
    }

    [HttpPatch("{id:guid}/remarcar")]
    public async Task<ActionResult<AppointmentResponse>> Reschedule(Guid id, RescheduleAppointmentRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var scheduledAt = NormalizeScheduledAt(request.ScheduledAt);

        if (scheduledAt <= DateTime.UtcNow)
        {
            return BadRequest(new { message = "Escolha uma data e horario no futuro." });
        }

        var appointment = await db.Appointments
            .Include(item => item.Barber)
            .Include(item => item.Service)
            .FirstOrDefaultAsync(item => item.Id == id && item.UserId == userId, cancellationToken);

        if (appointment is null)
        {
            return NotFound(new { message = "Agendamento nao encontrado." });
        }

        if (appointment.Status == AppointmentStatus.Cancelled)
        {
            return BadRequest(new { message = "Nao e possivel remarcar um agendamento cancelado." });
        }

        var isBusy = await db.Appointments.AnyAsync(item =>
            item.Id != id &&
            item.BarberId == appointment.BarberId &&
            item.ScheduledAt == scheduledAt &&
            item.Status != AppointmentStatus.Cancelled,
            cancellationToken);

        if (isBusy)
        {
            return Conflict(new { message = "Este barbeiro ja possui um agendamento nesse horario." });
        }

        appointment.ScheduledAt = scheduledAt;
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
        if (status == AppointmentStatus.Cancelled)
        {
            var validation = await CancelWithRefundAsync(appointment, cancellationToken);
            if (validation is not null)
            {
                return validation;
            }
        }
        else
        {
            appointment.Status = status;
        }

        await db.SaveChangesAsync(cancellationToken);

        return Ok(ToAdminResponse(appointment));
    }

    [HttpPatch("admin/{id:guid}/pagamento")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AdminAppointmentResponse>> UpdatePaymentStatus(Guid id, PaymentStatus paymentStatus, CancellationToken cancellationToken)
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

        appointment.PaymentStatus = paymentStatus;

        if (paymentStatus == PaymentStatus.Paid && appointment.Status == AppointmentStatus.WaitingPayment)
        {
            appointment.Status = AppointmentStatus.Scheduled;
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

        if (appointment.PaymentStatus == PaymentStatus.Paid)
        {
            return BadRequest(new { message = "Agendamento pago nao pode ser excluido diretamente. Cancele primeiro para aplicar a regra de estorno." });
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

    private async Task<ActionResult?> CancelWithRefundAsync(Appointment appointment, CancellationToken cancellationToken)
    {
        if (appointment.Status == AppointmentStatus.Cancelled)
        {
            return BadRequest(new { message = "Este agendamento ja esta cancelado." });
        }

        if (appointment.PaymentStatus == PaymentStatus.Paid)
        {
            var now = DateTime.UtcNow;
            var refundLimit = appointment.ScheduledAt.AddHours(-2);

            if (now > refundLimit)
            {
                return BadRequest(new { message = "Estorno indisponivel. O cancelamento com estorno so pode ser feito ate 2 horas antes do horario agendado." });
            }

            if (now >= appointment.ScheduledAt)
            {
                return BadRequest(new { message = "Estorno indisponivel depois do horario agendado." });
            }

            if (!long.TryParse(appointment.MercadoPagoPaymentId, out var paymentId))
            {
                return BadRequest(new { message = "Nao foi possivel estornar automaticamente porque o pagamento do Mercado Pago nao esta vinculado ao agendamento." });
            }

            try
            {
                appointment.MercadoPagoRefundId = await mercadoPagoService.RefundPaymentAsync(paymentId, cancellationToken);
                appointment.PaymentStatus = PaymentStatus.Refunded;
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Nao foi possivel realizar o estorno no Mercado Pago: {ex.Message}" });
            }
        }
        else
        {
            appointment.PaymentStatus = PaymentStatus.Cancelled;
        }

        appointment.Status = AppointmentStatus.Cancelled;
        return null;
    }

    private static string BuildMercadoPagoErrorMessage(Exception exception)
    {
        return exception.Message.Contains("invalid access token", StringComparison.OrdinalIgnoreCase) ||
               exception.Message.Contains("401", StringComparison.OrdinalIgnoreCase)
            ? "Token de acesso do Mercado Pago invalido. Configure um Access Token valido em MercadoPago:AccessToken e reinicie a API."
            : $"Nao foi possivel gerar o checkout do Mercado Pago: {exception.Message}";
    }
}

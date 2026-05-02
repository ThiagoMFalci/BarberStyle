using ApiBabterStyle.Data;
using ApiBabterStyle.DTOs;
using ApiBabterStyle.Model;
using ApiBabterStyle.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace ApiBabterStyle.Controller;

[ApiController]
[Route("api/pagamentos/mercado-pago")]
public class PaymentsController(
    BarberShopDbContext db,
    MercadoPagoService mercadoPagoService,
    SmtpEmailService emailService,
    ILogger<PaymentsController> logger) : ControllerBase
{
    [Authorize]
    [HttpPost("preferencia")]
    [EnableRateLimiting("write")]
    public async Task<ActionResult<MercadoPagoPreferenceResponse>> CreatePreference(
        MercadoPagoPreferenceRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var appointment = await db.Appointments
            .Include(item => item.User)
            .Include(item => item.Barber)
            .Include(item => item.Service)
            .FirstOrDefaultAsync(item => item.Id == request.AppointmentId && item.UserId == userId, cancellationToken);

        if (appointment is null)
        {
            return NotFound(new { message = "Agendamento nao encontrado." });
        }

        if (appointment.Status == AppointmentStatus.Cancelled)
        {
            return BadRequest(new { message = "Nao e possivel pagar um agendamento cancelado." });
        }

        (string? PreferenceId, string CheckoutUrl) preference;
        try
        {
            preference = await mercadoPagoService.CreatePreferenceAsync(appointment, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = BuildMercadoPagoErrorMessage(ex) });
        }

        appointment.MercadoPagoPreferenceId = preference.PreferenceId;
        appointment.MercadoPagoInitPoint = preference.CheckoutUrl;
        appointment.PaymentStatus = PaymentStatus.WaitingMercadoPago;
        await db.SaveChangesAsync(cancellationToken);

        return Ok(new MercadoPagoPreferenceResponse(
            appointment.Id,
            appointment.MercadoPagoPreferenceId,
            appointment.MercadoPagoInitPoint,
            appointment.PaymentStatus));
    }

    [Authorize]
    [HttpPost("retorno")]
    [EnableRateLimiting("write")]
    public async Task<ActionResult<MercadoPagoReturnResponse>> ProcessReturn(
        MercadoPagoReturnRequest request,
        CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var appointment = await db.Appointments
            .Include(item => item.User)
            .Include(item => item.Barber)
            .Include(item => item.Service)
            .FirstOrDefaultAsync(item => item.Id == request.AppointmentId && item.UserId == userId, cancellationToken);

        if (appointment is null)
        {
            return NotFound(new { message = "Agendamento nao encontrado." });
        }

        var verifiedStatus = await TryVerifyPaymentStatusAsync(request.PaymentId, request.AppointmentId, cancellationToken);
        if (verifiedStatus is null)
        {
            return BadRequest(new { message = "Nao foi possivel confirmar o pagamento no Mercado Pago." });
        }

        var shouldSendPaymentEmail = false;

        if (verifiedStatus == "approved")
        {
            shouldSendPaymentEmail = appointment.PaymentStatus != PaymentStatus.Paid;
            appointment.Status = AppointmentStatus.Scheduled;
            appointment.PaymentStatus = PaymentStatus.Paid;
            appointment.MercadoPagoPaymentId = request.PaymentId ?? appointment.MercadoPagoPaymentId;
        }
        else if (verifiedStatus is "pending" or "in_process")
        {
            appointment.PaymentStatus = PaymentStatus.WaitingMercadoPago;
        }
        else if (verifiedStatus is "rejected" or "cancelled" or "failure" or "failed")
        {
            appointment.PaymentStatus = PaymentStatus.Failed;
        }

        await db.SaveChangesAsync(cancellationToken);

        if (shouldSendPaymentEmail)
        {
            await TrySendPaymentConfirmationAsync(appointment, cancellationToken);
        }

        var message = appointment.PaymentStatus == PaymentStatus.Paid
            ? "Pagamento confirmado. Seu agendamento esta marcado como pago."
            : "Retorno do Mercado Pago recebido. Atualizando o status do seu agendamento.";

        return Ok(new MercadoPagoReturnResponse(
            appointment.Id,
            appointment.Status.ToString(),
            appointment.PaymentStatus.ToString(),
            message));
    }

    [HttpPost("webhook")]
    [EnableRateLimiting("write")]
    public async Task<IActionResult> Webhook(CancellationToken cancellationToken)
    {
        var paymentId = await TryGetPaymentIdFromRequestAsync(cancellationToken);

        if (!paymentId.HasValue)
        {
            return Ok();
        }

        var payment = await mercadoPagoService.GetPaymentStatusAsync(paymentId.Value, cancellationToken);
        if (payment.AppointmentId is null || string.IsNullOrWhiteSpace(payment.Status))
        {
            return Ok();
        }

        var appointment = await db.Appointments
            .Include(item => item.User)
            .Include(item => item.Barber)
            .Include(item => item.Service)
            .FirstOrDefaultAsync(item => item.Id == payment.AppointmentId.Value, cancellationToken);
        if (appointment is null)
        {
            return Ok();
        }

        var shouldSendPaymentEmail = false;

        switch (payment.Status.ToLowerInvariant())
        {
            case "approved":
                shouldSendPaymentEmail = appointment.PaymentStatus != PaymentStatus.Paid;
                appointment.Status = AppointmentStatus.Scheduled;
                appointment.PaymentStatus = PaymentStatus.Paid;
                appointment.MercadoPagoPaymentId = paymentId.Value.ToString();
                break;
            case "refunded":
                appointment.PaymentStatus = PaymentStatus.Refunded;
                break;
            case "cancelled":
            case "rejected":
                appointment.PaymentStatus = PaymentStatus.Failed;
                break;
            default:
                appointment.Status = AppointmentStatus.WaitingPayment;
                appointment.PaymentStatus = PaymentStatus.WaitingMercadoPago;
                break;
        }

        await db.SaveChangesAsync(cancellationToken);

        if (shouldSendPaymentEmail)
        {
            await TrySendPaymentConfirmationAsync(appointment, cancellationToken);
        }

        return Ok();
    }

    private async Task<long?> TryGetPaymentIdFromRequestAsync(CancellationToken cancellationToken)
    {
        var queryId = Request.Query["data.id"].FirstOrDefault()
            ?? Request.Query["id"].FirstOrDefault();

        if (long.TryParse(queryId, out var parsedQueryId))
        {
            return parsedQueryId;
        }

        if (Request.ContentLength is null or 0)
        {
            return null;
        }

        using var document = await JsonDocument.ParseAsync(Request.Body, cancellationToken: cancellationToken);
        if (document.RootElement.TryGetProperty("data", out var data) &&
            data.TryGetProperty("id", out var idProperty) &&
            long.TryParse(idProperty.GetString(), out var parsedBodyId))
        {
            return parsedBodyId;
        }

        return null;
    }

    private async Task<string?> TryVerifyPaymentStatusAsync(string? paymentId, Guid appointmentId, CancellationToken cancellationToken)
    {
        if (!long.TryParse(paymentId, out var parsedPaymentId))
        {
            return null;
        }

        try
        {
            var payment = await mercadoPagoService.GetPaymentStatusAsync(parsedPaymentId, cancellationToken);
            return payment.AppointmentId == appointmentId
                ? payment.Status?.ToLowerInvariant()
                : null;
        }
        catch
        {
            return null;
        }
    }

    private async Task TrySendPaymentConfirmationAsync(Appointment appointment, CancellationToken cancellationToken)
    {
        try
        {
            await emailService.SendPaymentConfirmationAsync(appointment, cancellationToken);
        }
        catch (Exception error)
        {
            logger.LogError(error, "Falha ao enviar confirmacao de pagamento do agendamento {AppointmentId}", appointment.Id);
        }
    }

    private static string BuildMercadoPagoErrorMessage(Exception exception)
    {
        return exception.Message.Contains("invalid access token", StringComparison.OrdinalIgnoreCase) ||
               exception.Message.Contains("401", StringComparison.OrdinalIgnoreCase)
            ? "Token de acesso do Mercado Pago invalido. Configure um Access Token valido em MercadoPago:AccessToken e reinicie a API."
            : "Nao foi possivel gerar o checkout do Mercado Pago. Tente novamente em instantes.";
    }
}

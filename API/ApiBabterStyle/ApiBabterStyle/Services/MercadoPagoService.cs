using ApiBabterStyle.Model;
using MercadoPago.Client.Payment;
using MercadoPago.Client.Preference;
using MercadoPago.Config;

namespace ApiBabterStyle.Services;

public class MercadoPagoService(IConfiguration configuration, IWebHostEnvironment environment)
{
    public async Task<(string? PreferenceId, string CheckoutUrl)> CreatePreferenceAsync(Appointment appointment, CancellationToken cancellationToken)
    {
        var accessToken = configuration["MercadoPago:AccessToken"];
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            throw new InvalidOperationException("Configure MercadoPago:AccessToken para gerar pagamentos.");
        }

        if (appointment.Service is null || appointment.Barber is null || appointment.User is null)
        {
            throw new InvalidOperationException("O agendamento precisa estar carregado com cliente, barbeiro e servico.");
        }

        MercadoPagoConfig.AccessToken = accessToken;

        var publicBaseUrl = configuration["MercadoPago:PublicBaseUrl"]?.TrimEnd('/');
        var frontendBaseUrl = configuration["MercadoPago:FrontendBaseUrl"]?.TrimEnd('/');
        var canAutoReturn = !string.IsNullOrWhiteSpace(frontendBaseUrl) &&
            frontendBaseUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase);

        var request = new PreferenceRequest
        {
            ExternalReference = appointment.Id.ToString(),
            NotificationUrl = string.IsNullOrWhiteSpace(publicBaseUrl)
                ? null
                : $"{publicBaseUrl}/api/pagamentos/mercado-pago/webhook",
            BackUrls = string.IsNullOrWhiteSpace(frontendBaseUrl)
                ? null
                : new PreferenceBackUrlsRequest
                {
                    Success = $"{frontendBaseUrl}/status.html?id={appointment.Id}&pagamento=sucesso",
                    Pending = $"{frontendBaseUrl}/status.html?id={appointment.Id}&pagamento=pendente",
                    Failure = $"{frontendBaseUrl}/status.html?id={appointment.Id}&pagamento=falha"
                },
            AutoReturn = canAutoReturn ? "approved" : null,
            Items =
            [
                new PreferenceItemRequest
                {
                    Id = appointment.Service.Id.ToString(),
                    Title = $"{appointment.Service.Name} - {appointment.Barber.Name}",
                    Description = appointment.Service.Description,
                    Quantity = 1,
                    CurrencyId = configuration["MercadoPago:CurrencyId"] ?? "BRL",
                    UnitPrice = appointment.Service.Price
                }
            ]
        };

        var client = new PreferenceClient();
        var preference = await client.CreateAsync(request, cancellationToken: cancellationToken);
        var useSandbox = configuration.GetValue("MercadoPago:UseSandbox", environment.IsDevelopment());
        var checkoutUrl = useSandbox && !string.IsNullOrWhiteSpace(preference.SandboxInitPoint)
            ? preference.SandboxInitPoint
            : preference.InitPoint;

        if (string.IsNullOrWhiteSpace(checkoutUrl))
        {
            throw new InvalidOperationException("O Mercado Pago nao retornou uma URL de checkout.");
        }

        return (preference.Id, checkoutUrl);
    }

    public async Task<(Guid? AppointmentId, string? Status)> GetPaymentStatusAsync(long paymentId, CancellationToken cancellationToken)
    {
        var accessToken = configuration["MercadoPago:AccessToken"];
        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return (null, null);
        }

        MercadoPagoConfig.AccessToken = accessToken;

        var client = new PaymentClient();
        var payment = await client.GetAsync(paymentId, cancellationToken: cancellationToken);
        var appointmentId = Guid.TryParse(payment.ExternalReference, out var parsedId)
            ? parsedId
            : (Guid?)null;

        return (appointmentId, payment.Status);
    }
}

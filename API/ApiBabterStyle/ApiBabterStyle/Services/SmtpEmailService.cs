using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using ApiBabterStyle.Model;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ApiBabterStyle.Services;

public class SmtpEmailService(IConfiguration configuration, ILogger<SmtpEmailService> logger)
{
    public bool IsConfigured =>
        IsEmailProxyConfigured ||
        (!string.IsNullOrWhiteSpace(GetSetting("Host", "SmtpHost")) &&
        !string.IsNullOrWhiteSpace(GetSetting("FromEmail", "SmtpFrom")) &&
        (string.IsNullOrWhiteSpace(GetSetting("Username", "SmtpUser")) ||
            !string.IsNullOrWhiteSpace(GetSetting("Password", "SmtpPassword"))));

    private bool IsEmailProxyConfigured =>
        !string.IsNullOrWhiteSpace(configuration["EmailProxy:Url"] ?? configuration["EmailProxyUrl"]) &&
        !string.IsNullOrWhiteSpace(configuration["EmailProxy:Secret"] ?? configuration["EmailProxySecret"]);

    public async Task SendPasswordResetAsync(string toEmail, string customerName, string resetUrl, CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException("SMTP nao configurado.");
        }

        if (IsEmailProxyConfigured)
        {
            await SendPasswordResetByProxyAsync(toEmail, customerName, resetUrl, cancellationToken);
            return;
        }

        var host = GetSetting("Host", "SmtpHost")!;
        var port = int.TryParse(GetSetting("Port", "SmtpPort"), out var configuredPort) ? configuredPort : 587;
        var username = GetSetting("Username", "SmtpUser");
        var password = GetSetting("Password", "SmtpPassword");
        var fromEmail = GetSetting("FromEmail", "SmtpFrom")!;
        var fromName = GetSetting("FromName", "SmtpDisplayName") ?? "BarberStyle";
        var enableSsl = !bool.TryParse(GetSetting("EnableSsl", "SmtpEnableSsl"), out var configuredSsl) || configuredSsl;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Recuperacao de senha BarberStyle";
        message.Body = new BodyBuilder
        {
            HtmlBody = BuildPasswordResetBody(customerName, resetUrl)
        }.ToMessageBody();

        using var client = new SmtpClient
        {
            Timeout = 15000
        };

        var socketOptions = GetSocketOptions(port, enableSsl);
        using var socket = await ConnectIpv4SocketAsync(host, port, cancellationToken);
        using var stream = new NetworkStream(socket, ownsSocket: false);
        await client.ConnectAsync(stream, host, port, socketOptions, cancellationToken);

        if (!string.IsNullOrWhiteSpace(username) && !string.IsNullOrWhiteSpace(password))
        {
            await client.AuthenticateAsync(username, password, cancellationToken);
        }

        logger.LogInformation("Enviando email de recuperacao de senha para {Email}", toEmail);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }

    public async Task SendPaymentConfirmationAsync(Appointment appointment, CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException("SMTP nao configurado.");
        }

        if (appointment.User is null || string.IsNullOrWhiteSpace(appointment.User.Email))
        {
            return;
        }

        if (IsEmailProxyConfigured)
        {
            await SendPaymentConfirmationByProxyAsync(appointment, cancellationToken);
            return;
        }

        var host = GetSetting("Host", "SmtpHost")!;
        var port = int.TryParse(GetSetting("Port", "SmtpPort"), out var configuredPort) ? configuredPort : 587;
        var username = GetSetting("Username", "SmtpUser");
        var password = GetSetting("Password", "SmtpPassword");
        var fromEmail = GetSetting("FromEmail", "SmtpFrom")!;
        var fromName = GetSetting("FromName", "SmtpDisplayName") ?? "BarberStyle";
        var enableSsl = !bool.TryParse(GetSetting("EnableSsl", "SmtpEnableSsl"), out var configuredSsl) || configuredSsl;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromEmail));
        message.To.Add(MailboxAddress.Parse(appointment.User.Email));
        message.Subject = "Pagamento confirmado | BarberStyle";
        message.Body = new BodyBuilder
        {
            HtmlBody = BuildPaymentConfirmationBody(appointment)
        }.ToMessageBody();

        using var client = new SmtpClient
        {
            Timeout = 15000
        };

        var socketOptions = GetSocketOptions(port, enableSsl);
        using var socket = await ConnectIpv4SocketAsync(host, port, cancellationToken);
        using var stream = new NetworkStream(socket, ownsSocket: false);
        await client.ConnectAsync(stream, host, port, socketOptions, cancellationToken);

        if (!string.IsNullOrWhiteSpace(username) && !string.IsNullOrWhiteSpace(password))
        {
            await client.AuthenticateAsync(username, password, cancellationToken);
        }

        logger.LogInformation("Enviando confirmacao de pagamento para {Email}", appointment.User.Email);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }

    private async Task SendPasswordResetByProxyAsync(string toEmail, string customerName, string resetUrl, CancellationToken cancellationToken)
    {
        var proxyUrl = configuration["EmailProxy:Url"] ?? configuration["EmailProxyUrl"]!;
        var proxySecret = configuration["EmailProxy:Secret"] ?? configuration["EmailProxySecret"]!;

        using var httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(30)
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, proxyUrl)
        {
            Content = JsonContent.Create(new
            {
                toEmail,
                customerName,
                resetUrl
            })
        };

        request.Headers.Add("x-email-proxy-secret", proxySecret);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var message = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Proxy de email retornou {(int)response.StatusCode}: {message}");
        }

        logger.LogInformation("Email de recuperacao enviado via proxy para {Email}", toEmail);
    }

    private async Task SendPaymentConfirmationByProxyAsync(Appointment appointment, CancellationToken cancellationToken)
    {
        var proxyUrl = configuration["EmailProxy:Url"] ?? configuration["EmailProxyUrl"]!;
        var proxySecret = configuration["EmailProxy:Secret"] ?? configuration["EmailProxySecret"]!;
        var frontendBaseUrl = configuration["MercadoPago:FrontendBaseUrl"] ?? configuration["Frontend:BaseUrl"] ?? "http://127.0.0.1:5173";

        using var httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(30)
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, proxyUrl)
        {
            Content = JsonContent.Create(new
            {
                type = "payment-confirmation",
                toEmail = appointment.User!.Email,
                customerName = appointment.User.Name,
                serviceName = appointment.Service?.Name,
                barberName = appointment.Barber?.Name,
                scheduledAt = appointment.ScheduledAt,
                amount = appointment.Service?.Price ?? 0,
                appointmentId = appointment.Id,
                customerAreaUrl = $"{frontendBaseUrl.TrimEnd('/')}/cliente.html"
            })
        };

        request.Headers.Add("x-email-proxy-secret", proxySecret);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var message = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException($"Proxy de email retornou {(int)response.StatusCode}: {message}");
        }

        logger.LogInformation("Confirmacao de pagamento enviada via proxy para {Email}", appointment.User!.Email);
    }

    private string? GetSetting(string sectionKey, string flatKey)
    {
        var flatValue = configuration[flatKey];
        if (!string.IsNullOrWhiteSpace(flatValue))
        {
            return flatValue;
        }

        var sectionValue = configuration[$"Smtp:{sectionKey}"];
        return string.IsNullOrWhiteSpace(sectionValue) ? null : sectionValue;
    }

    private static SecureSocketOptions GetSocketOptions(int port, bool enableSsl)
    {
        if (!enableSsl)
        {
            return SecureSocketOptions.None;
        }

        return port == 465
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTls;
    }

    private static async Task<Socket> ConnectIpv4SocketAsync(string host, int port, CancellationToken cancellationToken)
    {
        var addresses = await Dns.GetHostAddressesAsync(host, AddressFamily.InterNetwork, cancellationToken);
        var lastError = default(Exception);

        foreach (var address in addresses)
        {
            var socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp)
            {
                NoDelay = true
            };

            try
            {
                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(12));
                using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);
                await socket.ConnectAsync(address, port, linked.Token);
                return socket;
            }
            catch (Exception error)
            {
                lastError = error;
                socket.Dispose();
            }
        }

        throw new TimeoutException($"Nao foi possivel conectar ao SMTP {host}:{port} via IPv4.", lastError);
    }

    private static string BuildPasswordResetBody(string customerName, string resetUrl)
    {
        var safeName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(customerName) ? "cliente" : customerName);
        var safeUrl = WebUtility.HtmlEncode(resetUrl);

        return $"""
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111216">
              <h2 style="margin:0 0 12px">Recuperacao de senha</h2>
              <p>Ola, {safeName}.</p>
              <p>Recebemos uma solicitacao para redefinir sua senha da BarberStyle.</p>
              <p>
                <a href="{safeUrl}" style="display:inline-block;background:#c9a45f;color:#15100a;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
                  Criar nova senha
                </a>
              </p>
              <p>Este link expira em 1 hora. Se voce nao solicitou a recuperacao, ignore este email.</p>
              <p style="font-size:12px;color:#736b5f">Se o botao nao abrir, copie e cole este link no navegador:<br>{safeUrl}</p>
            </div>
            """;
    }

    private static string BuildPaymentConfirmationBody(Appointment appointment)
    {
        var safeName = WebUtility.HtmlEncode(appointment.User?.Name ?? "cliente");
        var safeService = WebUtility.HtmlEncode(appointment.Service?.Name ?? "Servico agendado");
        var safeBarber = WebUtility.HtmlEncode(appointment.Barber?.Name ?? "Profissional da barbearia");
        var safeDate = WebUtility.HtmlEncode(appointment.ScheduledAt.ToString("dd/MM/yyyy HH:mm"));
        var safeAmount = WebUtility.HtmlEncode((appointment.Service?.Price ?? 0).ToString("C"));
        var safeId = WebUtility.HtmlEncode(appointment.Id.ToString());

        return $"""
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111216">
              <h2 style="margin:0 0 12px">Pagamento confirmado</h2>
              <p>Ola, {safeName}.</p>
              <p>Seu pagamento online foi confirmado e seu horario esta garantido.</p>
              <ul>
                <li><strong>Servico:</strong> {safeService}</li>
                <li><strong>Profissional:</strong> {safeBarber}</li>
                <li><strong>Data e horario:</strong> {safeDate}</li>
                <li><strong>Valor pago:</strong> {safeAmount}</li>
                <li><strong>Codigo:</strong> {safeId}</li>
              </ul>
              <p style="font-size:12px;color:#736b5f">Este email e uma confirmacao de pagamento e agendamento, nao substitui nota fiscal.</p>
            </div>
            """;
    }
}

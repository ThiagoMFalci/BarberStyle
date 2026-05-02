using System.Net;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ApiBabterStyle.Services;

public class SmtpEmailService(IConfiguration configuration, ILogger<SmtpEmailService> logger)
{
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(GetSetting("Host", "SmtpHost")) &&
        !string.IsNullOrWhiteSpace(GetSetting("FromEmail", "SmtpFrom")) &&
        (string.IsNullOrWhiteSpace(GetSetting("Username", "SmtpUser")) ||
            !string.IsNullOrWhiteSpace(GetSetting("Password", "SmtpPassword")));

    public async Task SendPasswordResetAsync(string toEmail, string customerName, string resetUrl, CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException("SMTP nao configurado.");
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
        await client.ConnectAsync(host, port, socketOptions, cancellationToken);

        if (!string.IsNullOrWhiteSpace(username) && !string.IsNullOrWhiteSpace(password))
        {
            await client.AuthenticateAsync(username, password, cancellationToken);
        }

        logger.LogInformation("Enviando email de recuperacao de senha para {Email}", toEmail);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }

    private string? GetSetting(string sectionKey, string flatKey)
    {
        var sectionValue = configuration[$"Smtp:{sectionKey}"];
        if (!string.IsNullOrWhiteSpace(sectionValue))
        {
            return sectionValue;
        }

        var flatValue = configuration[flatKey];
        return string.IsNullOrWhiteSpace(flatValue) ? null : flatValue;
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
}

import nodemailer from "nodemailer";

const json = (response, statusCode, payload) => {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
};

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));

const buildPasswordResetBody = ({ customerName, resetUrl }) => {
  const safeName = escapeHtml(customerName || "cliente");
  const safeUrl = escapeHtml(resetUrl);
  const year = new Date().getFullYear();

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Recuperacao de senha BarberStyle</title>
      </head>
      <body style="margin:0;padding:0;background:#f4efe5;font-family:Arial,Helvetica,sans-serif;color:#111216;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f4efe5;padding:32px 14px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:0 0 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align:middle;">
                          <div style="display:inline-block;width:46px;height:46px;border:1px solid rgba(201,164,95,.55);border-radius:8px;background:#111216;color:#e1c47e;text-align:center;line-height:46px;font-family:Georgia,serif;font-weight:800;font-size:18px;">BS</div>
                          <span style="display:inline-block;margin-left:12px;vertical-align:middle;">
                            <strong style="display:block;color:#111216;font-size:18px;line-height:1.2;">BarberStyle</strong>
                            <span style="display:block;color:#736b5f;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;">Barbearia Premium</span>
                          </span>
                        </td>
                        <td align="right" style="vertical-align:middle;color:#8a7650;font-size:12px;font-weight:800;text-transform:uppercase;">Conta segura</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="border-radius:12px;overflow:hidden;background:#111216;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:34px 34px 28px;background:#111216;color:#ffffff;">
                          <div style="margin:0 0 12px;color:#e1c47e;font-size:12px;font-weight:900;text-transform:uppercase;">Recuperacao de senha</div>
                          <h1 style="margin:0;font-family:Georgia,serif;font-size:36px;line-height:1.05;color:#ffffff;">Vamos recuperar seu acesso.</h1>
                          <p style="margin:18px 0 0;color:#d8d0c2;font-size:16px;line-height:1.65;">Ola, ${safeName}. Recebemos uma solicitacao para criar uma nova senha para sua conta BarberStyle.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:30px 34px;background:#ffffff;">
                          <p style="margin:0 0 22px;color:#4c463e;font-size:15px;line-height:1.7;">Clique no botao abaixo para escolher uma nova senha. Por seguranca, este link expira em <strong>1 hora</strong>.</p>
                          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                            <tr>
                              <td style="border-radius:8px;background:#c9a45f;">
                                <a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border-radius:8px;background:#c9a45f;color:#15100a;font-size:15px;font-weight:900;text-decoration:none;">Criar nova senha</a>
                              </td>
                            </tr>
                          </table>
                          <div style="border-left:4px solid #c9a45f;padding:12px 14px;background:#fbf7ee;border-radius:8px;color:#5f533f;font-size:13px;line-height:1.55;">
                            Se voce nao solicitou essa recuperacao, pode ignorar este email. Sua senha atual continuara a mesma.
                          </div>
                          <p style="margin:22px 0 0;color:#736b5f;font-size:12px;line-height:1.6;">Se o botao nao abrir, copie e cole este link no navegador:</p>
                          <p style="margin:6px 0 0;word-break:break-all;color:#8a7650;font-size:12px;line-height:1.5;">${safeUrl}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:18px 34px;background:#faf7ef;color:#736b5f;font-size:12px;line-height:1.6;">
                          <strong style="color:#111216;">BarberStyle</strong><br />
                          Atendimento premium, agenda online e cuidado em cada detalhe.<br />
                          © ${year} BarberStyle. Todos os direitos reservados.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value || "");
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
};

const buildPaymentConfirmationBody = ({
  customerName,
  serviceName,
  barberName,
  scheduledAt,
  amount,
  appointmentId,
  customerAreaUrl,
}) => {
  const safeName = escapeHtml(customerName || "cliente");
  const safeService = escapeHtml(serviceName || "Servico agendado");
  const safeBarber = escapeHtml(barberName || "Profissional da barbearia");
  const safeDate = escapeHtml(formatDateTime(scheduledAt));
  const safeAmount = escapeHtml(formatCurrency(amount));
  const safeAppointmentId = escapeHtml(appointmentId || "");
  const safeCustomerAreaUrl = escapeHtml(customerAreaUrl || "#");
  const year = new Date().getFullYear();

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Pagamento confirmado BarberStyle</title>
      </head>
      <body style="margin:0;padding:0;background:#f4efe5;font-family:Arial,Helvetica,sans-serif;color:#111216;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f4efe5;padding:32px 14px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:0 0 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align:middle;">
                          <div style="display:inline-block;width:46px;height:46px;border:1px solid rgba(201,164,95,.55);border-radius:8px;background:#111216;color:#e1c47e;text-align:center;line-height:46px;font-family:Georgia,serif;font-weight:800;font-size:18px;">BS</div>
                          <span style="display:inline-block;margin-left:12px;vertical-align:middle;">
                            <strong style="display:block;color:#111216;font-size:18px;line-height:1.2;">BarberStyle</strong>
                            <span style="display:block;color:#736b5f;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;">Barbearia Premium</span>
                          </span>
                        </td>
                        <td align="right" style="vertical-align:middle;color:#8a7650;font-size:12px;font-weight:800;text-transform:uppercase;">Pagamento confirmado</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="border-radius:12px;overflow:hidden;background:#111216;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:34px 34px 28px;background:#111216;color:#ffffff;">
                          <div style="margin:0 0 12px;color:#e1c47e;font-size:12px;font-weight:900;text-transform:uppercase;">Seu horario esta garantido</div>
                          <h1 style="margin:0;font-family:Georgia,serif;font-size:36px;line-height:1.05;color:#ffffff;">Pagamento confirmado.</h1>
                          <p style="margin:18px 0 0;color:#d8d0c2;font-size:16px;line-height:1.65;">Ola, ${safeName}. Recebemos a confirmacao do pagamento online e seu agendamento ja esta marcado como pago.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:30px 34px;background:#ffffff;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                            ${[
                              ["Servico", safeService],
                              ["Profissional", safeBarber],
                              ["Data e horario", safeDate],
                              ["Valor pago", safeAmount],
                              ["Codigo do agendamento", safeAppointmentId],
                              ["Forma de pagamento", "Online"],
                              ["Status", "Confirmado e pago"],
                            ].map(([label, value]) => `
                              <tr>
                                <td style="padding:12px 0;border-bottom:1px solid #eee5d5;color:#736b5f;font-size:13px;font-weight:800;text-transform:uppercase;">${label}</td>
                                <td align="right" style="padding:12px 0;border-bottom:1px solid #eee5d5;color:#111216;font-size:14px;font-weight:800;">${value}</td>
                              </tr>
                            `).join("")}
                          </table>

                          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 20px;">
                            <tr>
                              <td style="border-radius:8px;background:#c9a45f;">
                                <a href="${safeCustomerAreaUrl}" style="display:inline-block;padding:14px 22px;border-radius:8px;background:#c9a45f;color:#15100a;font-size:15px;font-weight:900;text-decoration:none;">Ver meus agendamentos</a>
                              </td>
                            </tr>
                          </table>

                          <div style="border-left:4px solid #c9a45f;padding:12px 14px;background:#fbf7ee;border-radius:8px;color:#5f533f;font-size:13px;line-height:1.55;">
                            Este email e uma confirmacao de pagamento e agendamento, nao substitui nota fiscal. Para cancelamentos e estornos, consulte a politica informada pela barbearia.
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:18px 34px;background:#faf7ef;color:#736b5f;font-size:12px;line-height:1.6;">
                          <strong style="color:#111216;">BarberStyle</strong><br />
                          Atendimento premium, agenda online e cuidado em cada detalhe.<br />
                          © ${year} BarberStyle. Todos os direitos reservados.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    json(response, 405, { message: "Metodo nao permitido." });
    return;
  }

  const expectedSecret = process.env.EMAIL_PROXY_SECRET;
  const receivedSecret = request.headers["x-email-proxy-secret"];

  if (!expectedSecret || receivedSecret !== expectedSecret) {
    json(response, 401, { message: "Nao autorizado." });
    return;
  }

  const { type = "password-reset", toEmail, customerName, resetUrl } = request.body || {};

  if (!toEmail) {
    json(response, 400, { message: "Email do destinatario e obrigatorio." });
    return;
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const secure = port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  const isPaymentConfirmation = type === "payment-confirmation";
  if (!isPaymentConfirmation && !resetUrl) {
    json(response, 400, { message: "Link de recuperacao e obrigatorio." });
    return;
  }

  const subject = isPaymentConfirmation
    ? "Pagamento confirmado | BarberStyle"
    : "Recupere sua senha | BarberStyle";
  const html = isPaymentConfirmation
    ? buildPaymentConfirmationBody(request.body)
    : buildPasswordResetBody({ customerName, resetUrl });

  await transporter.sendMail({
    from: `"${process.env.SMTP_DISPLAY_NAME || "BarberStyle"}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: toEmail,
    subject,
    html,
  });

  json(response, 200, { message: "Email enviado." });
}

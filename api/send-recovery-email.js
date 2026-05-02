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

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111216">
      <h2 style="margin:0 0 12px">Recuperacao de senha</h2>
      <p>Ola, ${safeName}.</p>
      <p>Recebemos uma solicitacao para redefinir sua senha da BarberStyle.</p>
      <p>
        <a href="${safeUrl}" style="display:inline-block;background:#c9a45f;color:#15100a;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
          Criar nova senha
        </a>
      </p>
      <p>Este link expira em 1 hora. Se voce nao solicitou a recuperacao, ignore este email.</p>
      <p style="font-size:12px;color:#736b5f">Se o botao nao abrir, copie e cole este link no navegador:<br>${safeUrl}</p>
    </div>
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

  const { toEmail, customerName, resetUrl } = request.body || {};

  if (!toEmail || !resetUrl) {
    json(response, 400, { message: "Email e link de recuperacao sao obrigatorios." });
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

  await transporter.sendMail({
    from: `"${process.env.SMTP_DISPLAY_NAME || "BarberStyle"}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Recuperacao de senha BarberStyle",
    html: buildPasswordResetBody({ customerName, resetUrl }),
  });

  json(response, 200, { message: "Email enviado." });
}

const apiUrl = "";
const bookingStorageKey = "barberstyle_bookings";
const params = new URLSearchParams(window.location.search);
const id = params.get("id") || params.get("appointmentId");
const paymentReturn = params.get("pagamento");

const fields = {
  title: document.querySelector("[data-title]"),
  message: document.querySelector("[data-message]"),
  list: document.querySelector("[data-status-list]"),
  customer: document.querySelector("[data-customer]"),
  service: document.querySelector("[data-service]"),
  barber: document.querySelector("[data-barber]"),
  date: document.querySelector("[data-date]"),
  status: document.querySelector("[data-status]"),
  payment: document.querySelector("[data-payment]"),
};

init();

async function init() {
  if (!id) {
    fields.title.textContent = "Codigo de agendamento nao informado";
    fields.message.textContent = "Volte ao site e faca um novo agendamento para acompanhar o status.";
    return;
  }

  const appointment = await fetchFromApi(id) || fetchFromStorage(id);

  if (!appointment) {
    fields.title.textContent = "Agendamento nao encontrado";
    fields.message.textContent = "Nao encontramos este codigo. Confira o link ou fale com a barbearia.";
    return;
  }

  renderStatus(appointment);
}

async function fetchFromApi(appointmentId) {
  try {
    const response = await fetch(`${apiUrl}/api/agendamentos/publico/${appointmentId}`);
    const payload = await response.json();

    if (!response.ok) {
      return null;
    }

    return {
      id: payload.id,
      name: payload.customerName,
      service: payload.serviceName,
      barber: payload.barberName,
      date: payload.scheduledAt,
      status: normalizeStatus(payload.status),
      paymentStatus: normalizePaymentStatus(payload.paymentStatus),
    };
  } catch {
    return null;
  }
}

function fetchFromStorage(appointmentId) {
  const bookings = JSON.parse(localStorage.getItem(bookingStorageKey) || "[]");
  return bookings.find((booking) => booking.id === appointmentId);
}

function renderStatus(appointment) {
  const isPaid = appointment.paymentStatus === "Pago";
  const isOnlineReturnSuccess = paymentReturn === "sucesso";

  fields.title.textContent = isPaid || isOnlineReturnSuccess
    ? "Horario confirmado e pagamento recebido"
    : "Horario agendado";
  fields.message.textContent = getMessage(appointment);
  fields.customer.textContent = appointment.name;
  fields.service.textContent = appointment.service;
  fields.barber.textContent = appointment.barber;
  fields.date.textContent = formatDateTime(appointment);
  fields.status.textContent = appointment.status;
  fields.payment.textContent = appointment.paymentStatus || "Pagamento pendente";
  fields.list.hidden = false;
}

function getMessage(appointment) {
  if (paymentReturn === "falha") {
    return "O Mercado Pago informou falha no pagamento. Seu horario ainda precisa de regularizacao.";
  }

  if (paymentReturn === "pendente") {
    return "O pagamento esta pendente no Mercado Pago. Acompanhe esta pagina para atualizacoes.";
  }

  if (paymentReturn === "sucesso") {
    return "Recebemos o retorno do Mercado Pago. A barbearia acompanhara a confirmacao do pagamento.";
  }

  if (appointment.paymentStatus === "Pagamento presencial pendente") {
    return "Seu horario esta confirmado e o pagamento sera feito presencialmente na barbearia.";
  }

  return "Seu horario foi registrado. Acompanhe aqui o status do pagamento e do atendimento.";
}

function normalizeStatus(status) {
  const map = {
    Scheduled: "Confirmado",
    Cancelled: "Cancelado",
    Completed: "Concluido",
  };

  return map[status] || status || "Pendente";
}

function normalizePaymentStatus(status) {
  const map = {
    Paid: "Pago",
    Pending: "Pagamento presencial pendente",
    WaitingMercadoPago: "Aguardando pagamento online",
    Cancelled: "Pagamento cancelado",
    Failed: "Pagamento recusado",
  };

  return map[status] || status || "Pagamento pendente";
}

function formatDateTime(appointment) {
  if (appointment.date && appointment.time) {
    return `${appointment.date} as ${appointment.time}`;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(appointment.date));
}

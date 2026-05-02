import { applyBrandConfig, applyThemeConfig, siteConfig } from "./site-config.js";

const bookingStorageKey = "barberstyle_bookings";
const servicesStorageKey = "barberstyle_services";
const scheduleStorageKey = "barberstyle_schedule";
const sessionStorageKey = "barberstyle_customer_session";
const defaultApiUrl = siteConfig.api.url;
const dashboardRefreshInterval = 15000;

const defaultServices = [
  { id: "corte", name: "Corte masculino", description: "Corte completo", price: 65, duration: 45, active: true },
  { id: "barba", name: "Barba completa", description: "Toalha quente e navalha", price: 45, duration: 30, active: true },
  { id: "combo", name: "Corte + barba", description: "Pacote completo", price: 95, duration: 75, active: true },
  { id: "sobrancelha", name: "Sobrancelha", description: "Acabamento natural", price: 25, duration: 20, active: true },
  { id: "tratamento", name: "Tratamento capilar", description: "Hidratacao e detox", price: 85, duration: 50, active: true },
  { id: "noivo", name: "Dia do noivo / experiencia premium", description: "Experiencia reservada", price: 240, duration: 120, active: true },
  { id: "plano-essencial", name: "Plano Essencial", description: "Clube mensal", price: 89.9, duration: 45, active: true },
  { id: "plano-premium", name: "Plano Premium", description: "Clube mensal", price: 149.9, duration: 75, active: true },
  { id: "plano-executivo", name: "Plano Executivo", description: "Clube mensal", price: 229.9, duration: 90, active: true },
];
const defaultSchedule = siteConfig.defaultSchedule;

const table = document.querySelector("[data-booking-table]");
const logTable = document.querySelector("[data-log-table]");
const emptyState = document.querySelector("[data-empty-state]");
const searchInput = document.querySelector("[data-search]");
const dateFilter = document.querySelector("[data-filter-date]");
const statusFilter = document.querySelector("[data-filter-status]");
const logDateInput = document.querySelector("[data-log-date]");
const clearFiltersButton = document.querySelector("[data-clear-filters]");
const clearDayButton = document.querySelector("[data-clear-day]");
const exportButton = document.querySelector("[data-export]");
const boardDateLabel = document.querySelector("[data-board-date-label]");
const dayBoard = document.querySelector("[data-day-board]");
const dayBoardEmpty = document.querySelector("[data-day-board-empty]");
const nextAppointmentEl = document.querySelector("[data-next-appointment]");
const dateHint = document.querySelector("[data-date-hint]");
const showAllBookingsButton = document.querySelector("[data-show-all-bookings]");
const quickDateButtons = document.querySelectorAll("[data-quick-date]");
const serviceForm = document.querySelector("[data-service-form]");
const serviceList = document.querySelector("[data-service-list]");
const scheduleForm = document.querySelector("[data-schedule-form]");
const scheduleList = document.querySelector("[data-schedule-list]");
const apiLoginForm = document.querySelector("[data-api-login]");
const apiMessage = document.querySelector("[data-api-message]");
const serviceMessage = document.querySelector("[data-service-message]");
const apiUrlInput = apiLoginForm?.elements.apiUrl;

let bookings = load(bookingStorageKey, []);
let services = load(servicesStorageKey, defaultServices);
let schedule = load(scheduleStorageKey, defaultSchedule);
let adminApiUrl = "";
let adminToken = "";
let dashboardRefreshTimer = null;
let isRefreshingDashboard = false;
let highlightedBookingId = "";

applyThemeConfig();
applyBrandConfig();

const today = getTodayDate();
dateFilter.value = today;
logDateInput.value = today;
document.querySelector("[data-current-date]").textContent = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
}).format(new Date());

if (apiUrlInput && defaultApiUrl) {
  apiUrlInput.value = defaultApiUrl;
}

initAdminSession();

function load(key, fallback) {
  return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
}

function persist() {
  localStorage.setItem(bookingStorageKey, JSON.stringify(bookings));
  localStorage.setItem(servicesStorageKey, JSON.stringify(services));
  localStorage.setItem(scheduleStorageKey, JSON.stringify(schedule));
}

function normalizeStatus(status) {
  const map = {
    Scheduled: "Confirmado",
    Cancelled: "Cancelado",
    Completed: "Concluido",
    Pending: "Pendente",
    WaitingPayment: "Aguardando pagamento",
  };

  return map[status] || status || "Pendente";
}

function normalizePaymentStatus(status) {
  const map = {
    Paid: "Pago",
    Pending: "Pagamento pendente",
    WaitingMercadoPago: "Aguardando Mercado Pago",
    Cancelled: "Pagamento cancelado",
    Failed: "Pagamento recusado",
    Refunded: "Estornado",
  };

  return map[status] || status || "Pagamento presencial pendente";
}

function normalizeApiAppointment(appointment) {
  const date = new Date(appointment.scheduledAt);

  return {
    id: appointment.id,
    name: appointment.customerName || "Cliente",
    phone: appointment.customerPhone || appointment.customerEmail || "-",
    service: appointment.serviceName,
    barber: appointment.barberName,
    unit: "Unidade principal",
    date: toInputDate(date),
    time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    price: Number(appointment.price || 0),
    paymentMethod: appointment.paymentStatus === "WaitingMercadoPago" ? "Online" : "Presencial",
    paymentStatus: normalizePaymentStatus(appointment.paymentStatus),
    notes: appointment.notes || "",
    status: normalizeStatus(appointment.status),
    createdAt: appointment.createdAt,
  };
}

function normalizeApiService(service) {
  return {
    id: service.id,
    name: service.name,
    description: service.description || "",
    price: Number(service.price || 0),
    duration: Number(service.durationMinutes || service.duration || 0),
    active: service.active !== false,
  };
}

async function initAdminSession() {
  const session = JSON.parse(localStorage.getItem(sessionStorageKey) || "null");
  if (session?.role !== "Admin" || !session.token) {
    return;
  }

  adminApiUrl = defaultApiUrl;
  adminToken = session.token;
  apiMessage.textContent = "Conectando com a sessao do proprietario...";
  try {
    await loadApiDashboardData();
    startDashboardAutoRefresh();
  } catch (error) {
    apiMessage.textContent = `${error.message} Entre novamente como proprietario ou use o formulario de API abaixo.`;
  }
}

async function loadApiDashboardData(options = {}) {
  const { silent = false } = options;

  if (!adminApiUrl || !adminToken || isRefreshingDashboard) {
    return;
  }

  isRefreshingDashboard = true;

  try {
    const appointmentResponse = await fetch(`${adminApiUrl}/api/agendamentos/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const payload = await appointmentResponse.json().catch(() => null);

    if (!appointmentResponse.ok) {
      throw new Error(payload?.message || "Nao foi possivel carregar os agendamentos.");
    }

    bookings = payload.map(normalizeApiAppointment);

    const servicesResponse = await fetch(`${adminApiUrl}/api/servicos/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const servicesPayload = await servicesResponse.json().catch(() => null);

    if (servicesResponse.ok && Array.isArray(servicesPayload)) {
      services = servicesPayload.map(normalizeApiService);
    }

    persist();
    render();
    if (!silent) {
      apiMessage.textContent = "Agenda e servicos carregados da API com sucesso.";
    }
  } finally {
    isRefreshingDashboard = false;
  }
}

async function refreshApiDashboard(options = {}) {
  if (!adminApiUrl || !adminToken) {
    return;
  }

  try {
    await loadApiDashboardData(options);
  } catch (error) {
    if (!options.silent) {
      apiMessage.textContent = error.message;
    }
  }
}

function startDashboardAutoRefresh() {
  if (dashboardRefreshTimer) {
    window.clearInterval(dashboardRefreshTimer);
  }

  dashboardRefreshTimer = window.setInterval(() => {
    refreshApiDashboard({ silent: true });
  }, dashboardRefreshInterval);
}

function getFilteredBookings() {
  const term = searchInput.value.trim().toLowerCase();
  const date = dateFilter.value;
  const status = statusFilter.value;

  return bookings.filter((booking) => {
    const matchesTerm =
      !term ||
      booking.name.toLowerCase().includes(term) ||
      booking.phone.toLowerCase().includes(term) ||
      booking.service.toLowerCase().includes(term) ||
      booking.barber.toLowerCase().includes(term);

    const matchesDate = !date || booking.date === date;
    const matchesStatus = !status || booking.status === status;

    return matchesTerm && matchesDate && matchesStatus;
  });
}

function render() {
  const filtered = getFilteredBookings();
  table.innerHTML = "";

  filtered.forEach((booking) => {
    const row = document.createElement("tr");
    row.dataset.bookingRow = booking.id;
    row.classList.toggle("is-highlighted", booking.id === highlightedBookingId);
    row.innerHTML = `
      <td>
        <strong>${formatDate(booking.date)}</strong>
        <span>${booking.time}</span>
      </td>
      <td>
        <strong>${escapeHtml(booking.name)}</strong>
        <span>${escapeHtml(booking.phone)}</span>
      </td>
      <td>
        <strong>${escapeHtml(booking.service)}</strong>
        <span>${formatMoney(booking.price)} • ${escapeHtml(booking.notes || "Sem observacoes")}</span>
      </td>
      <td>${escapeHtml(booking.barber)}</td>
      <td>${escapeHtml(booking.unit)}</td>
      <td>
        <span class="payment ${paymentClass(booking.paymentStatus)}">${escapeHtml(booking.paymentStatus || "Pagamento pendente")}</span>
        <span>${escapeHtml(booking.paymentMethod || "Presencial")}</span>
      </td>
      <td><span class="status ${slug(booking.status)}">${escapeHtml(booking.status)}</span></td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="Confirmado" data-id="${booking.id}">Confirmar</button>
          <button type="button" data-action="Concluido" data-id="${booking.id}">Concluir</button>
          <button type="button" data-payment="Pago" data-id="${booking.id}">Pago</button>
          <button type="button" data-action="Cancelado" data-id="${booking.id}">Cancelar</button>
          <button class="danger" type="button" data-delete data-id="${booking.id}">Excluir</button>
        </div>
      </td>
    `;
    table.appendChild(row);
  });

  emptyState.hidden = filtered.length > 0;
  renderDayBoard();
  renderLogs();
  renderServices();
  renderSchedule();
  updateMetrics();
}

function renderDayBoard() {
  if (!dayBoard || !dayBoardEmpty || !nextAppointmentEl || !boardDateLabel || !dateHint) {
    return;
  }

  const selectedDate = dateFilter.value || today;
  const sortedBookings = [...bookings].sort(compareBookingsByTime);
  const activeSortedBookings = sortedBookings.filter((booking) => booking.status !== "Cancelado");
  const dayBookings = bookings
    .filter((booking) => booking.date === selectedDate)
    .sort(compareBookingsByTime);
  const activeBookings = dayBookings.filter((booking) => booking.status !== "Cancelado");
  const nextBooking = activeSortedBookings.find((booking) => new Date(`${booking.date}T${booking.time}:00`).getTime() >= Date.now())
    || activeSortedBookings[0];
  const nextBookingIsOnSelectedDate = nextBooking?.date === selectedDate;

  boardDateLabel.textContent = `Mostrando ${formatDate(selectedDate)} - ${dayBookings.length} horario(s)`;
  dayBoard.innerHTML = "";
  dayBoardEmpty.hidden = dayBookings.length > 0;

  if (nextBooking) {
    nextAppointmentEl.innerHTML = `
      <span>${nextBookingIsOnSelectedDate ? "Proximo horario da data" : "Proximo horario geral"}</span>
      <strong>${formatDate(nextBooking.date)} ${escapeHtml(nextBooking.time)} - ${escapeHtml(nextBooking.name)}</strong>
      <p>${escapeHtml(nextBooking.service)} com ${escapeHtml(nextBooking.barber)} · ${escapeHtml(nextBooking.status)} · ${escapeHtml(nextBooking.paymentStatus)}</p>
      <button type="button" data-focus-booking="${nextBooking.id}">Ver na agenda</button>
    `;
    nextAppointmentEl.hidden = false;
  } else {
    nextAppointmentEl.hidden = true;
  }

  if (!dayBookings.length && bookings.length) {
    dateHint.innerHTML = `
      Existe ${bookings.length} horario(s) registrado(s), mas nenhum em ${formatDate(selectedDate)}.
      <button type="button" data-jump-next-booking>Ir para o proximo horario</button>
      <button type="button" data-clear-date-filter>Mostrar todos na tabela</button>
    `;
    dateHint.hidden = false;
  } else {
    dateHint.hidden = true;
    dateHint.innerHTML = "";
  }

  const barberNames = [...new Set(dayBookings.map((booking) => booking.barber || "Sem barbeiro"))].sort((a, b) => a.localeCompare(b));

  barberNames.forEach((barberName) => {
    const barberBookings = dayBookings.filter((booking) => (booking.barber || "Sem barbeiro") === barberName);
    const column = document.createElement("article");
    column.className = "barber-column";
    column.innerHTML = `
      <header>
        <strong>${escapeHtml(barberName)}</strong>
        <span>${barberBookings.length} horario(s)</span>
      </header>
      <div class="barber-slots"></div>
    `;

    const slots = column.querySelector(".barber-slots");
    barberBookings.forEach((booking) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `slot-card ${slug(booking.status)}`;
      card.dataset.focusBooking = booking.id;
      card.innerHTML = `
        <span>${escapeHtml(booking.time)}</span>
        <strong>${escapeHtml(booking.name)}</strong>
        <small>${escapeHtml(booking.service)} · ${formatMoney(booking.price)}</small>
        <em>${escapeHtml(booking.status)} · ${escapeHtml(booking.paymentStatus)}</em>
      `;
      slots.appendChild(card);
    });

    dayBoard.appendChild(column);
  });
}

function compareBookingsByTime(a, b) {
  return new Date(`${a.date}T${a.time}:00`) - new Date(`${b.date}T${b.time}:00`);
}

function focusBooking(id) {
  const booking = bookings.find((item) => item.id === id);
  if (!booking) {
    return;
  }

  highlightedBookingId = id;
  dateFilter.value = booking.date;
  searchInput.value = "";
  statusFilter.value = "";
  render();

  const row = table.querySelector(`[data-booking-row="${CSS.escape(id)}"]`);
  row?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function updateMetrics() {
  const todayBookings = bookings.filter((item) => item.date === today);
  const todayCompleted = todayBookings.filter((item) => item.status === "Concluido");

  document.querySelector("[data-total-bookings]").textContent = bookings.length;
  document.querySelector("[data-today-bookings]").textContent = todayBookings.length;
  document.querySelector("[data-pending-bookings]").textContent = bookings.filter((item) => item.status === "Pendente").length;
  document.querySelector("[data-today-revenue]").textContent = formatMoney(sum(todayCompleted));
}

function renderLogs() {
  const selectedDate = logDateInput.value || today;
  const dayBookings = bookings.filter((booking) => booking.date === selectedDate);
  const completed = dayBookings.filter((booking) => booking.status === "Concluido");
  const cancelled = dayBookings.filter((booking) => booking.status === "Cancelado");
  const paidOnline = dayBookings.filter((booking) => booking.paymentMethod === "Online" && booking.paymentStatus === "Pago");

  document.querySelector("[data-log-completed]").textContent = completed.length;
  document.querySelector("[data-log-cancelled]").textContent = cancelled.length;
  document.querySelector("[data-log-revenue]").textContent = formatMoney(sum(completed));
  document.querySelector("[data-log-paid]").textContent = formatMoney(sum(paidOnline));

  logTable.innerHTML = "";
  dayBookings.forEach((booking) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(booking.service)}</td>
      <td>${escapeHtml(booking.name)}</td>
      <td>${formatMoney(booking.price)}</td>
      <td><span class="status ${slug(booking.status)}">${escapeHtml(booking.status)}</span></td>
      <td><span class="payment ${paymentClass(booking.paymentStatus)}">${escapeHtml(booking.paymentStatus || "Pagamento pendente")}</span></td>
    `;
    logTable.appendChild(row);
  });
}

function renderServices() {
  serviceList.innerHTML = "";
  services.forEach((service) => {
    const item = document.createElement("article");
    item.className = "service-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(service.name)}</strong>
        <span>${formatMoney(service.price)} • ${service.duration} min • ${service.active ? "ativo" : "inativo"}</span>
      </div>
      <div class="service-actions">
        <button type="button" data-edit-service="${service.id}">Editar</button>
        <button type="button" data-remove-service="${service.id}">Excluir</button>
      </div>
    `;
    serviceList.appendChild(item);
  });
}

function renderSchedule() {
  scheduleList.innerHTML = "";
  schedule.forEach((time) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${time} <button type="button" data-remove-time="${time}" aria-label="Remover ${time}">x</button>`;
    scheduleList.appendChild(chip);
  });
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.price || 0), 0);
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDate() {
  return toInputDate(new Date());
}

function addDaysToInputDate(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return toInputDate(nextDate);
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function slug(value) {
  return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function paymentClass(value) {
  return String(value).toLowerCase().includes("pago") ? "pago" : "pendente";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[char];
  });
}

function exportCsv() {
  const rows = [
    ["Data", "Horario", "Cliente", "Telefone", "Servico", "Valor", "Barbeiro", "Unidade", "Pagamento", "Status", "Observacoes"],
    ...getFilteredBookings().map((booking) => [
      booking.date,
      booking.time,
      booking.name,
      booking.phone,
      booking.service,
      booking.price || 0,
      booking.barber,
      booking.unit,
      `${booking.paymentMethod || ""} - ${booking.paymentStatus || ""}`,
      booking.status,
      booking.notes || "",
    ]),
  ];

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "agendamentos-barberstyle.csv";
  link.click();
  URL.revokeObjectURL(url);
}

table.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("button[data-action]");
  const paymentButton = event.target.closest("button[data-payment]");
  const deleteButton = event.target.closest("button[data-delete]");

  if (actionButton) {
    if (adminToken) {
      await updateApiAppointmentStatus(actionButton.dataset.id, actionButton.dataset.action);
      return;
    }

    bookings = bookings.map((booking) => (
      booking.id === actionButton.dataset.id ? { ...booking, status: actionButton.dataset.action } : booking
    ));
  }

  if (paymentButton) {
    if (adminToken) {
      await updateApiPaymentStatus(paymentButton.dataset.id, paymentButton.dataset.payment);
      return;
    }

    bookings = bookings.map((booking) => (
      booking.id === paymentButton.dataset.id ? { ...booking, paymentStatus: paymentButton.dataset.payment } : booking
    ));
  }

  if (deleteButton) {
    if (adminToken) {
      await deleteApiAppointment(deleteButton.dataset.id);
      return;
    }

    const ok = window.confirm("Excluir este agendamento do dashboard? Esta acao remove o registro local.");
    if (!ok) {
      return;
    }

    bookings = bookings.filter((booking) => booking.id !== deleteButton.dataset.id);
  }

  persist();
  render();
});

dayBoard?.addEventListener("click", (event) => {
  const slotCard = event.target.closest("[data-focus-booking]");
  if (!slotCard) {
    return;
  }

  focusBooking(slotCard.dataset.focusBooking);
});

nextAppointmentEl?.addEventListener("click", (event) => {
  const focusButton = event.target.closest("[data-focus-booking]");
  if (!focusButton) {
    return;
  }

  focusBooking(focusButton.dataset.focusBooking);
});

dateHint?.addEventListener("click", (event) => {
  if (event.target.closest("[data-jump-next-booking]")) {
    const nextBooking = [...bookings]
      .filter((booking) => booking.status !== "Cancelado")
      .sort(compareBookingsByTime)
      .find((booking) => new Date(`${booking.date}T${booking.time}:00`).getTime() >= Date.now())
      || [...bookings].sort(compareBookingsByTime)[0];

    if (nextBooking) {
      focusBooking(nextBooking.id);
    }
  }

  if (event.target.closest("[data-clear-date-filter]")) {
    dateFilter.value = "";
    render();
    document.querySelector("#lista-agenda")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

showAllBookingsButton?.addEventListener("click", () => {
  searchInput.value = "";
  dateFilter.value = "";
  statusFilter.value = "";
  render();
  document.querySelector("#lista-agenda")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

async function updateApiAppointmentStatus(id, status) {
  const apiStatus = {
    Confirmado: "Scheduled",
    Concluido: "Completed",
    Cancelado: "Cancelled",
  }[status] || status;

  try {
    const response = await fetch(`${adminApiUrl}/api/agendamentos/admin/${id}/status?status=${apiStatus}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.message || "Nao foi possivel atualizar o agendamento.");
    }

    bookings = bookings.map((booking) => (
      booking.id === id ? normalizeApiAppointment(payload) : booking
    ));
    persist();
    render();
    apiMessage.textContent = "Agendamento atualizado com sucesso.";
    await refreshApiDashboard({ silent: true });
  } catch (error) {
    apiMessage.textContent = error.message;
  }
}

async function deleteApiAppointment(id) {
  try {
    const response = await fetch(`${adminApiUrl}/api/agendamentos/admin/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.message || "Nao foi possivel excluir o agendamento.");
    }

    bookings = bookings.filter((booking) => booking.id !== id);
    persist();
    render();
    apiMessage.textContent = "Agendamento excluido com sucesso.";
    await refreshApiDashboard({ silent: true });
  } catch (error) {
    apiMessage.textContent = error.message;
  }
}

async function updateApiPaymentStatus(id, paymentStatus) {
  const apiPaymentStatus = {
    Pago: "Paid",
    "Pagamento pendente": "Pending",
    "Aguardando Mercado Pago": "WaitingMercadoPago",
    "Pagamento cancelado": "Cancelled",
    "Pagamento recusado": "Failed",
    Estornado: "Refunded",
  }[paymentStatus] || paymentStatus;

  try {
    const response = await fetch(`${adminApiUrl}/api/agendamentos/admin/${id}/pagamento?paymentStatus=${apiPaymentStatus}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.message || "Nao foi possivel atualizar o pagamento.");
    }

    bookings = bookings.map((booking) => (
      booking.id === id ? normalizeApiAppointment(payload) : booking
    ));
    persist();
    render();
    apiMessage.textContent = "Pagamento atualizado com sucesso.";
    await refreshApiDashboard({ silent: true });
  } catch (error) {
    apiMessage.textContent = error.message;
  }
}

[searchInput, dateFilter, statusFilter, logDateInput].forEach((input) => {
  input.addEventListener("input", render);
});

quickDateButtons.forEach((button) => {
  button.addEventListener("click", () => {
    dateFilter.value = button.dataset.quickDate === "tomorrow"
      ? addDaysToInputDate(new Date(), 1)
      : today;
    render();
  });
});

clearFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  dateFilter.value = "";
  statusFilter.value = "";
  render();
});

clearDayButton.addEventListener("click", async () => {
  const day = dateFilter.value || today;
  const ok = window.confirm(`Excluir todos os agendamentos de ${formatDate(day)} do dashboard?`);
  if (!ok) {
    return;
  }

  if (adminToken) {
    const dayBookings = bookings.filter((booking) => booking.date === day);
    apiMessage.textContent = "Limpando agendamentos do dia...";

    for (const booking of dayBookings) {
      try {
        await deleteApiAppointment(booking.id);
      } catch {
        // deleteApiAppointment ja mostra a mensagem quando a API recusa a exclusao.
      }
    }

    await refreshApiDashboard({ silent: true });
    apiMessage.textContent = "Limpeza do dia finalizada.";
    return;
  }

  bookings = bookings.filter((booking) => booking.date !== day);
  persist();
  render();
});

exportButton.addEventListener("click", exportCsv);

serviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(serviceForm);
  const id = data.get("id") || `service-${Date.now()}`;
  const payload = {
    id,
    name: data.get("name").trim(),
    description: data.get("description").trim(),
    price: Number(data.get("price")),
    duration: Number(data.get("duration")),
    active: data.get("active") === "on",
  };

  if (adminToken) {
    await saveApiService(id, payload);
    return;
  }

  apiMessage.textContent = "Entre como proprietario para salvar servicos no banco de dados.";
  serviceMessage.textContent = "Entre como proprietario para salvar servicos no banco de dados.";
});

async function saveApiService(id, payload) {
  const isExisting = services.some((service) => service.id === id);
  const url = isExisting
    ? `${adminApiUrl}/api/servicos/admin/${id}`
    : `${adminApiUrl}/api/servicos/admin`;
  const requestBody = isExisting
    ? {
        name: payload.name,
        description: payload.description,
        price: payload.price,
        durationMinutes: payload.duration,
        active: payload.active,
      }
    : {
        name: payload.name,
        description: payload.description,
        price: payload.price,
        durationMinutes: payload.duration,
      };

  try {
    const response = await fetch(url, {
      method: isExisting ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(requestBody),
    });
    const result = response.status === 204 ? null : await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message || "Nao foi possivel salvar o servico na API.");
    }

    if (isExisting) {
      services = services.map((service) => (service.id === id ? payload : service));
    } else {
      services = [...services, normalizeApiService(result)];
    }

    serviceForm.reset();
    serviceForm.elements.active.checked = true;
    persist();
    render();
    apiMessage.textContent = "Servico salvo na API e disponivel para agendamento.";
    serviceMessage.textContent = "Servico salvo na API e disponivel para agendamento.";
    await refreshApiDashboard({ silent: true });
  } catch (error) {
    apiMessage.textContent = error.message;
    serviceMessage.textContent = error.message;
  }
}

serviceList.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-service]");
  const removeButton = event.target.closest("[data-remove-service]");

  if (editButton) {
    const service = services.find((item) => item.id === editButton.dataset.editService);
    serviceForm.elements.id.value = service.id;
    serviceForm.elements.name.value = service.name;
    serviceForm.elements.description.value = service.description || "";
    serviceForm.elements.price.value = service.price;
    serviceForm.elements.duration.value = service.duration;
    serviceForm.elements.active.checked = service.active !== false;
  }

  if (removeButton) {
    const ok = window.confirm("Excluir este servico da lista publica?");
    if (!ok) {
      return;
    }

    if (adminToken) {
      removeApiService(removeButton.dataset.removeService);
      return;
    }

    apiMessage.textContent = "Entre como proprietario para excluir servicos do banco de dados.";
    serviceMessage.textContent = "Entre como proprietario para excluir servicos do banco de dados.";
  }
});

async function removeApiService(id) {
  try {
    const response = await fetch(`${adminApiUrl}/api/servicos/admin/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.message || "Nao foi possivel excluir o servico na API.");
    }

    services = services.map((service) => (
      service.id === id ? { ...service, active: false } : service
    ));
    persist();
    render();
    apiMessage.textContent = "Servico removido da lista publica.";
    serviceMessage.textContent = "Servico removido da lista publica.";
    await refreshApiDashboard({ silent: true });
  } catch (error) {
    apiMessage.textContent = error.message;
    serviceMessage.textContent = error.message;
  }
}

scheduleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const time = new FormData(scheduleForm).get("time");

  if (!schedule.includes(time)) {
    schedule = [...schedule, time].sort();
    persist();
    render();
  }

  scheduleForm.reset();
});

scheduleList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-time]");
  if (!button) {
    return;
  }

  schedule = schedule.filter((time) => time !== button.dataset.removeTime);
  persist();
  render();
});

apiLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(apiLoginForm);
  const apiUrl = String(data.get("apiUrl")).replace(/\/$/, "");

  apiMessage.textContent = "Conectando com a API...";

  try {
    const loginResponse = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: data.get("email"),
        password: data.get("password"),
      }),
    });
    const auth = await loginResponse.json();

    if (!loginResponse.ok || auth.role !== "Admin") {
      throw new Error(auth.message || "Login administrativo invalido.");
    }

    adminApiUrl = apiUrl;
    adminToken = auth.token;

    await loadApiDashboardData();
    startDashboardAutoRefresh();
  } catch (error) {
    apiMessage.textContent = error.message;
  }
});

persist();
render();

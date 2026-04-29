const bookingStorageKey = "barberstyle_bookings";
const servicesStorageKey = "barberstyle_services";
const scheduleStorageKey = "barberstyle_schedule";

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
const defaultSchedule = ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00", "19:00"];

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
const serviceForm = document.querySelector("[data-service-form]");
const serviceList = document.querySelector("[data-service-list]");
const scheduleForm = document.querySelector("[data-schedule-form]");
const scheduleList = document.querySelector("[data-schedule-list]");
const apiLoginForm = document.querySelector("[data-api-login]");
const apiMessage = document.querySelector("[data-api-message]");

let bookings = load(bookingStorageKey, []);
let services = load(servicesStorageKey, defaultServices);
let schedule = load(scheduleStorageKey, defaultSchedule);

const today = getTodayDate();
dateFilter.value = today;
logDateInput.value = today;
document.querySelector("[data-current-date]").textContent = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
}).format(new Date());

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
  renderLogs();
  renderServices();
  renderSchedule();
  updateMetrics();
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

table.addEventListener("click", (event) => {
  const actionButton = event.target.closest("button[data-action]");
  const paymentButton = event.target.closest("button[data-payment]");
  const deleteButton = event.target.closest("button[data-delete]");

  if (actionButton) {
    bookings = bookings.map((booking) => (
      booking.id === actionButton.dataset.id ? { ...booking, status: actionButton.dataset.action } : booking
    ));
  }

  if (paymentButton) {
    bookings = bookings.map((booking) => (
      booking.id === paymentButton.dataset.id ? { ...booking, paymentStatus: paymentButton.dataset.payment } : booking
    ));
  }

  if (deleteButton) {
    const ok = window.confirm("Excluir este agendamento do dashboard? Esta acao remove o registro local.");
    if (!ok) {
      return;
    }

    bookings = bookings.filter((booking) => booking.id !== deleteButton.dataset.id);
  }

  persist();
  render();
});

[searchInput, dateFilter, statusFilter, logDateInput].forEach((input) => {
  input.addEventListener("input", render);
});

clearFiltersButton.addEventListener("click", () => {
  searchInput.value = "";
  dateFilter.value = "";
  statusFilter.value = "";
  render();
});

clearDayButton.addEventListener("click", () => {
  const day = dateFilter.value || today;
  const ok = window.confirm(`Excluir todos os agendamentos de ${formatDate(day)} do dashboard?`);
  if (!ok) {
    return;
  }

  bookings = bookings.filter((booking) => booking.date !== day);
  persist();
  render();
});

exportButton.addEventListener("click", exportCsv);

serviceForm.addEventListener("submit", (event) => {
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

  services = services.some((service) => service.id === id)
    ? services.map((service) => (service.id === id ? payload : service))
    : [...services, payload];

  serviceForm.reset();
  serviceForm.elements.active.checked = true;
  persist();
  render();
});

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

    services = services.filter((service) => service.id !== removeButton.dataset.removeService);
    persist();
    render();
  }
});

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

    const appointmentResponse = await fetch(`${apiUrl}/api/agendamentos/admin`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    const payload = await appointmentResponse.json();

    if (!appointmentResponse.ok) {
      throw new Error(payload.message || "Nao foi possivel carregar os agendamentos.");
    }

    bookings = payload.map(normalizeApiAppointment);
    persist();
    render();
    apiMessage.textContent = "Agenda carregada da API com sucesso.";
  } catch (error) {
    apiMessage.textContent = error.message;
  }
});

persist();
render();

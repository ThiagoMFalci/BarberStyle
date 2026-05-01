const apiUrl = "";
const sessionKey = "barberstyle_customer_session";
const usersKey = "barberstyle_customer_users";
const bookingKey = "barberstyle_bookings";
const scheduleKey = "barberstyle_schedule";
const defaultSchedule = ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00", "19:00"];

const authPanel = document.querySelector("[data-auth-panel]");
const dashboard = document.querySelector("[data-customer-dashboard]");
const tabs = document.querySelectorAll("[data-auth-tab]");
const loginForm = document.querySelector("[data-login-form]");
const registerForm = document.querySelector("[data-register-form]");
const authMessage = document.querySelector("[data-auth-message]");
const appointmentsEl = document.querySelector("[data-appointments]");
const emptyEl = document.querySelector("[data-empty]");
const welcomeEl = document.querySelector("[data-welcome]");
const dialog = document.querySelector("[data-reschedule-dialog]");
const rescheduleForm = document.querySelector("[data-reschedule-form]");
const timeSelect = document.querySelector("[data-time-select]");
const profileForm = document.querySelector("[data-profile-form]");
const profileMessage = document.querySelector("[data-profile-message]");
const paymentReturnMessage = document.querySelector("[data-payment-return-message]");

let session = JSON.parse(localStorage.getItem(sessionKey) || "null");
let appointments = [];

init();

function init() {
  populateTimes();
  bindEvents();
  applyInitialAuthTab();
  renderSession();
}

function bindEvents() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setTab(tab.dataset.authTab));
  });

  registerForm.addEventListener("submit", handleRegister);
  loginForm.addEventListener("submit", handleLogin);
  document.querySelector("[data-logout]").addEventListener("click", logout);
  document.querySelector("[data-refresh]").addEventListener("click", loadAppointments);
  document.querySelector("[data-close-dialog]").addEventListener("click", () => dialog.close());
  rescheduleForm.addEventListener("submit", handleReschedule);
  profileForm.addEventListener("submit", handleProfileUpdate);

  appointmentsEl.addEventListener("click", (event) => {
    const cancelButton = event.target.closest("[data-cancel]");
    const rescheduleButton = event.target.closest("[data-reschedule]");

    if (cancelButton) {
      cancelAppointment(cancelButton.dataset.cancel);
    }

    if (rescheduleButton) {
      openReschedule(rescheduleButton.dataset.reschedule);
    }
  });
}

function setTab(target) {
  tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.authTab === target));
  loginForm.classList.toggle("is-active", target === "login");
  registerForm.classList.toggle("is-active", target === "register");
  authMessage.textContent = "";
}

function applyInitialAuthTab() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");

  if (tab === "register" || tab === "login") {
    setTab(tab);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const data = new FormData(registerForm);
  const payload = {
    name: data.get("name").trim(),
    email: data.get("email").trim().toLowerCase(),
    phone: data.get("phone").trim(),
    password: data.get("password"),
  };

  try {
    const response = await fetch(`${apiUrl}/api/auth/cadastro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const auth = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(auth?.message || "Nao foi possivel criar sua conta.");
    }

    registerForm.reset();
    setTab("login");
    authMessage.textContent = "Cadastro realizado com sucesso. Entre com seu email e senha.";
    window.history.replaceState({}, document.title, "cliente.html?tab=login");
  } catch (error) {
    authMessage.textContent = `${error.message} Verifique se a API esta rodando para salvar o cadastro no banco.`;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const data = new FormData(loginForm);
  const payload = {
    email: data.get("email").trim().toLowerCase(),
    password: data.get("password"),
  };

  try {
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const auth = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(auth?.message || "Email ou senha invalidos.");
    }

    saveSession(auth);
    window.location.href = "index.html";
  } catch (error) {
    authMessage.textContent = `${error.message} Verifique se a API esta rodando.`;
  }
}

function registerLocal(payload) {
  const users = JSON.parse(localStorage.getItem(usersKey) || "[]");
  if (users.some((user) => user.email === payload.email)) {
    authMessage.textContent = "Ja existe uma conta com este email.";
    return null;
  }

  const user = {
    userId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    password: payload.password,
    role: "Cliente",
    token: "",
  };

  users.push(user);
  localStorage.setItem(usersKey, JSON.stringify(users));
  return user;
}

function loginLocal(payload) {
  const users = JSON.parse(localStorage.getItem(usersKey) || "[]");
  return users.find((user) => user.email === payload.email && user.password === payload.password) || null;
}

function saveSession(auth) {
  session = {
    userId: auth.userId,
    name: auth.name,
    email: auth.email,
    phone: auth.phone || "",
    role: auth.role || "Cliente",
    token: auth.token || "",
  };
  localStorage.setItem(sessionKey, JSON.stringify(session));
  renderSession();
}

function logout() {
  session = null;
  localStorage.removeItem(sessionKey);
  appointments = [];
  renderSession();
}

function renderSession() {
  const isLogged = Boolean(session);
  authPanel.hidden = isLogged;
  dashboard.hidden = !isLogged;

  if (!isLogged) {
    return;
  }

  welcomeEl.textContent = `${session.name}, aqui estao seus horarios registrados.`;
  populateProfileForm();
  loadProfile();
  handlePaymentReturn().then(loadAppointments);
}

async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("retorno") !== "mercado-pago") {
    return;
  }

  if (!session?.token) {
    showPaymentReturnMessage("Entre na sua conta para confirmar o retorno do pagamento.");
    return;
  }

  const appointmentId = params.get("agendamento") || params.get("external_reference");
  if (!appointmentId) {
    showPaymentReturnMessage("Nao foi possivel identificar o agendamento retornado pelo Mercado Pago.");
    return;
  }

  const paymentStatus = normalizeMercadoPagoReturnStatus(params.get("status") || params.get("pagamento"));

  try {
    const response = await fetch(`${apiUrl}/api/pagamentos/mercado-pago/retorno`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        appointmentId,
        paymentId: params.get("payment_id") || params.get("collection_id"),
        status: paymentStatus,
      }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.message || "Nao foi possivel confirmar o pagamento.");
    }

    showPaymentReturnMessage(payload.message || "Pagamento atualizado. Confira seu agendamento abaixo.");
    window.history.replaceState({}, document.title, "cliente.html");
  } catch (error) {
    showPaymentReturnMessage(`${error.message} Clique em Atualizar em alguns instantes.`);
  }
}

function normalizeMercadoPagoReturnStatus(value) {
  const status = String(value || "").toLowerCase();
  const map = {
    sucesso: "approved",
    approved: "approved",
    pendente: "pending",
    pending: "pending",
    falha: "failed",
    failure: "failed",
    failed: "failed",
    rejected: "rejected",
    cancelled: "cancelled",
  };

  return map[status] || status;
}

function showPaymentReturnMessage(message) {
  if (!paymentReturnMessage) {
    return;
  }

  paymentReturnMessage.hidden = false;
  paymentReturnMessage.textContent = message;
}

async function loadProfile() {
  if (!session?.token) {
    return;
  }

  try {
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    const profile = await response.json().catch(() => null);

    if (response.ok && profile) {
      updateSessionProfile(profile);
      populateProfileForm();
    }
  } catch {
    // Mantem a sessao local caso a API esteja indisponivel.
  }
}

function populateProfileForm() {
  if (!profileForm || !session) {
    return;
  }

  profileForm.elements.name.value = session.name || "";
  profileForm.elements.email.value = session.email || "";
  profileForm.elements.phone.value = session.phone || "";
  profileForm.elements.password.value = "";
}

async function handleProfileUpdate(event) {
  event.preventDefault();

  if (!session?.token) {
    profileMessage.textContent = "Entre novamente para alterar seus dados.";
    return;
  }

  const data = new FormData(profileForm);
  const payload = {
    name: data.get("name").trim(),
    phone: data.get("phone").trim(),
    password: data.get("password") || null,
  };

  try {
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify(payload),
    });
    const profile = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(profile?.message || "Nao foi possivel salvar seus dados.");
    }

    updateSessionProfile(profile);
    populateProfileForm();
    welcomeEl.textContent = `${session.name}, aqui estao seus horarios registrados.`;
    profileMessage.textContent = "Dados atualizados com sucesso.";
  } catch (error) {
    profileMessage.textContent = `${error.message} Verifique se a API esta rodando.`;
  }
}

function updateSessionProfile(profile) {
  session = {
    ...session,
    userId: profile.userId || session.userId,
    name: profile.name || session.name,
    email: profile.email || session.email,
    phone: profile.phone || "",
    role: profile.role || session.role,
  };
  localStorage.setItem(sessionKey, JSON.stringify(session));
}

async function loadAppointments() {
  appointments = loadLocalAppointments();

  if (session?.token) {
    try {
      const response = await fetch(`${apiUrl}/api/agendamentos/meus`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      const payload = await response.json().catch(() => null);

      if (response.ok) {
        appointments = payload.map(normalizeApiAppointment);
      }
    } catch {
      // Mantem os dados locais para a demonstracao.
    }
  }

  renderAppointments();
}

function loadLocalAppointments() {
  const all = JSON.parse(localStorage.getItem(bookingKey) || "[]");
  return all.filter((item) => item.email?.toLowerCase() === session.email.toLowerCase());
}

function normalizeApiAppointment(item) {
  const date = new Date(item.scheduledAt);
  return {
    id: item.id,
    service: item.serviceName,
    barber: item.barberName,
    date: toInputDate(date),
    time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    price: item.price,
    status: normalizeStatus(item.status),
    paymentStatus: normalizePaymentStatus(item.paymentStatus),
    paymentUrl: item.paymentUrl,
  };
}

function renderAppointments() {
  appointmentsEl.innerHTML = "";
  const active = appointments.filter((item) => item.status !== "Cancelado");
  const cancelled = appointments.filter((item) => item.status === "Cancelado");
  const next = active
    .filter((item) => new Date(`${item.date}T${item.time}:00`).getTime() >= Date.now())
    .sort((a, b) => new Date(`${a.date}T${a.time}:00`) - new Date(`${b.date}T${b.time}:00`))[0];

  document.querySelector("[data-next]").textContent = next ? `${formatDate(next.date)} ${next.time}` : "--";
  document.querySelector("[data-total]").textContent = appointments.length;
  document.querySelector("[data-active]").textContent = active.length;
  document.querySelector("[data-cancelled]").textContent = cancelled.length;
  emptyEl.hidden = appointments.length > 0;

  appointments.forEach((appointment) => {
    const card = document.createElement("article");
    const canEdit = appointment.status !== "Cancelado" && appointment.status !== "Concluido";
    card.className = "appointment-card";
    card.innerHTML = `
      <div>
        <span>Servico</span>
        <h3>${escapeHtml(appointment.service)}</h3>
        <p>${escapeHtml(appointment.barber || "Profissional a definir")}</p>
      </div>
      <div>
        <span>Data e status</span>
        <p><strong>${formatDate(appointment.date)} as ${appointment.time}</strong></p>
        <p>
          <span class="badge ${slug(appointment.status)}">${escapeHtml(appointment.status)}</span>
          <span class="badge">${escapeHtml(appointment.paymentStatus || "Pagamento pendente")}</span>
        </p>
      </div>
      <div class="appointment-actions">
        ${appointment.paymentUrl ? `<a class="btn btn-gold" href="${appointment.paymentUrl}" target="_blank" rel="noreferrer">Pagar</a>` : ""}
        ${canEdit ? `<button class="btn btn-ghost" type="button" data-reschedule="${appointment.id}">Remarcar</button>` : ""}
        ${canEdit ? `<button class="btn btn-danger" type="button" data-cancel="${appointment.id}">Cancelar</button>` : ""}
      </div>
    `;
    appointmentsEl.appendChild(card);
  });
}

async function cancelAppointment(id) {
  if (session?.token) {
    try {
      const response = await fetch(`${apiUrl}/api/agendamentos/${id}/cancelar`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session.token}` },
      });

      if (response.ok) {
        await loadAppointments();
        return;
      }

      const payload = await response.json().catch(() => null);
      showPaymentReturnMessage(payload?.message || "Nao foi possivel cancelar este agendamento.");
      return;
    } catch {
      // Continua com fallback local.
    }
  }

  updateLocalBooking(id, { status: "Cancelado", paymentStatus: "Pagamento cancelado" });
  await loadAppointments();
}

function openReschedule(id) {
  const appointment = appointments.find((item) => item.id === id);
  if (!appointment) {
    return;
  }

  rescheduleForm.elements.id.value = id;
  rescheduleForm.elements.date.value = appointment.date;
  rescheduleForm.elements.date.min = getTodayDate();
  rescheduleForm.elements.time.value = appointment.time;
  dialog.showModal();
}

async function handleReschedule(event) {
  event.preventDefault();
  const data = new FormData(rescheduleForm);
  const id = data.get("id");
  const date = data.get("date");
  const time = data.get("time");

  if (new Date(`${date}T${time}:00`).getTime() <= Date.now()) {
    return;
  }

  if (session?.token) {
    try {
      const response = await fetch(`${apiUrl}/api/agendamentos/${id}/remarcar`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ scheduledAt: `${date}T${time}:00` }),
      });

      if (response.ok) {
        dialog.close();
        await loadAppointments();
        return;
      }
    } catch {
      // Continua com fallback local.
    }
  }

  updateLocalBooking(id, { date, time });
  dialog.close();
  await loadAppointments();
}

function updateLocalBooking(id, changes) {
  const all = JSON.parse(localStorage.getItem(bookingKey) || "[]");
  const updated = all.map((item) => (item.id === id ? { ...item, ...changes } : item));
  localStorage.setItem(bookingKey, JSON.stringify(updated));
}

function populateTimes() {
  const schedule = JSON.parse(localStorage.getItem(scheduleKey) || JSON.stringify(defaultSchedule));
  timeSelect.innerHTML = '<option value="">Escolha o horario</option>';
  schedule.forEach((time) => {
    const option = document.createElement("option");
    option.value = time;
    option.textContent = time;
    timeSelect.appendChild(option);
  });
}

function normalizeStatus(status) {
  const map = {
    Scheduled: "Confirmado",
    Cancelled: "Cancelado",
    Completed: "Concluido",
    WaitingPayment: "Aguardando pagamento",
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
    Refunded: "Estornado",
  };
  return map[status] || status || "Pagamento pendente";
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

function slug(value) {
  return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => {
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

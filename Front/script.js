const siteConfig = {
  brandName: "BarberStyle",
  apiUrl: "",
  whatsappNumber: "5511999999999",
  whatsappText: "Olá! Quero falar com a BarberStyle.",
  whatsappDisplay: "(11) 99999-9999",
  instagramUrl: "https://instagram.com/barberstyle",
  address: "Rua Exemplo, 123 - Centro, São Paulo/SP",
};

const bookingStorageKey = "barberstyle_bookings";
const customerSessionKey = "barberstyle_customer_session";
const servicesStorageKey = "barberstyle_services";
const scheduleStorageKey = "barberstyle_schedule";
const availableBarbers = ["Ton Barber", "Michael Trindade", "Valdir Bispo"];
const defaultServices = [
  { id: "corte", name: "Corte masculino", price: 65, duration: 45, active: true },
  { id: "barba", name: "Barba completa", price: 45, duration: 30, active: true },
  { id: "combo", name: "Corte + barba", price: 95, duration: 75, active: true },
  { id: "sobrancelha", name: "Sobrancelha", price: 25, duration: 20, active: true },
  { id: "tratamento", name: "Tratamento capilar", price: 85, duration: 50, active: true },
  { id: "noivo", name: "Dia do noivo / experiencia premium", price: 240, duration: 120, active: true },
  { id: "plano-essencial", name: "Plano Essencial", price: 89.9, duration: 45, active: true },
  { id: "plano-premium", name: "Plano Premium", price: 149.9, duration: 75, active: true },
  { id: "plano-executivo", name: "Plano Executivo", price: 229.9, duration: 90, active: true },
];
const defaultSchedule = ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00", "19:00"];

const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const navPanel = document.querySelector("[data-nav-panel]");
const navLinks = document.querySelectorAll(".nav-panel a");
const whatsappLinks = document.querySelectorAll("[data-whatsapp-link]");
const bookingForm = document.querySelector("[data-booking-form]");
const bookingAuthWarning = document.querySelector("[data-booking-auth-warning]");
const bookingSuccess = document.querySelector("[data-booking-success]");
const bookingError = document.querySelector("[data-booking-error]");
const dateInput = document.querySelector("[data-date-input]");
const timeSelect = document.querySelector("[data-time-select]");
const serviceSelect = document.querySelector("[data-service-select]");
const planLinks = document.querySelectorAll("[data-plan]");
const dashboardLink = document.querySelector("[data-dashboard-link]");
const accountToggle = document.querySelector("[data-account-toggle]");
const accountMenu = document.querySelector("[data-account-menu]");
const accountName = document.querySelector("[data-account-name]");
const accountEmail = document.querySelector("[data-account-email]");
const accountPhone = document.querySelector("[data-account-phone]");
const accountRegister = document.querySelector("[data-account-register]");
const accountLogin = document.querySelector("[data-account-login]");
const accountAppointments = document.querySelector("[data-account-appointments]");
const accountLogout = document.querySelector("[data-account-logout]");

function applyConfig() {
  document.querySelectorAll("[data-brand-name]").forEach((element) => {
    element.textContent = siteConfig.brandName;
  });

  document.querySelectorAll("[data-address]").forEach((element) => {
    element.textContent = siteConfig.address;
  });

  document.querySelectorAll("[data-instagram-link]").forEach((element) => {
    element.href = siteConfig.instagramUrl;
  });

  document.querySelectorAll("[data-whatsapp-text]").forEach((element) => {
    element.textContent = siteConfig.whatsappDisplay;
  });

  const whatsappUrl = `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(siteConfig.whatsappText)}`;

  whatsappLinks.forEach((link) => {
    link.href = whatsappUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
  });
}

function updateHeaderState() {
  header.classList.toggle("is-scrolled", window.scrollY > 24);
}

function closeMenu() {
  menuToggle.classList.remove("is-active");
  menuToggle.setAttribute("aria-expanded", "false");
  navPanel.classList.remove("is-open");
  header.classList.remove("is-open");
  document.body.classList.remove("menu-open");
}

function toggleMenu() {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";

  menuToggle.classList.toggle("is-active", !isOpen);
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  navPanel.classList.toggle("is-open", !isOpen);
  header.classList.toggle("is-open", !isOpen);
  document.body.classList.toggle("menu-open", !isOpen);
}

function initRevealAnimation() {
  const elements = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -60px" },
  );

  elements.forEach((element) => observer.observe(element));
}

function initBookingForm() {
  loadApiServices();
  populateServiceOptions();
  populateTimeOptions();
  fillBookingFromSession();
  updateBookingAuthState();

  if (dateInput) {
    dateInput.min = getTodayDate();
  }

  updateAvailableTimes();

  planLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const plan = link.dataset.plan;
      if (serviceSelect && plan) {
        serviceSelect.value = `Plano ${plan}`;
      }
    });
  });

  if (!bookingForm) {
    return;
  }

  bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const session = getCustomerSession();
    if (!session?.token) {
      showBookingMessage("Para agendar, crie sua conta ou entre com seu email e senha.", "error");
      bookingAuthWarning.hidden = false;
      window.location.href = "cliente.html";
      return;
    }

    if (!bookingForm.checkValidity()) {
      bookingForm.reportValidity();
      return;
    }

    const data = new FormData(bookingForm);
    const name = data.get("name");
    const service = data.get("service");
    const selectedService = getServices().find((item) => item.name === service);
    const phone = data.get("phone");
    const email = data.get("email");
    let barber = data.get("barber");
    const unit = data.get("unit");
    const date = data.get("date");
    const time = data.get("time");
    const paymentMethod = data.get("paymentMethod");
    const notes = data.get("notes");
    if (barber === "Primeiro disponivel") {
      barber = findAvailableBarber(date, time) || barber;
    }

    const validationMessage = validateBooking({ date, time, barber });

    if (validationMessage) {
      showBookingMessage(validationMessage, "error");
      return;
    }

    const booking = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      phone,
      email,
      service,
      barber,
      unit,
      date,
      time,
      price: selectedService?.price ?? 0,
      duration: selectedService?.duration ?? selectedService?.durationMinutes ?? 0,
      paymentMethod,
      paymentStatus: paymentMethod === "Online" ? "Aguardando pagamento online" : "Pagamento presencial pendente",
      notes,
      status: paymentMethod === "Online" ? "Aguardando pagamento" : "Confirmado",
      createdAt: new Date().toISOString(),
    };

    const apiResult = await createApiBooking(booking);

    if (apiResult?.error) {
      return;
    }

    if (apiResult?.id) {
      booking.id = apiResult.id;
      booking.status = normalizeStatus(apiResult.status, booking.status);
      booking.paymentStatus = normalizePaymentStatus(apiResult.paymentStatus, booking.paymentStatus);
      booking.paymentUrl = apiResult.paymentUrl;
    }

    if (paymentMethod === "Online") {
      if (!booking.paymentUrl) {
        showBookingMessage(
          "Nao foi possivel iniciar o pagamento online agora. Tente novamente em instantes ou escolha pagamento presencial.",
          "error",
        );
        return;
      }

      saveBooking(booking);
      showBookingMessage("Horario reservado. Redirecionando para o Mercado Pago para finalizar o pagamento.", "success");
      window.location.href = booking.paymentUrl;
      return;
    }

    saveBooking(booking);

    showBookingMessage(
      `${name}, seu horario foi agendado para ${date} as ${time} com ${barber}. Codigo: ${booking.id}.`,
      "success",
    );
    appendStatusLink(booking.id);
    bookingForm.reset();
    updateAvailableTimes();

    if (dateInput) {
      dateInput.min = getTodayDate();
    }
  });

  dateInput?.addEventListener("change", updateAvailableTimes);
  timeSelect?.addEventListener("change", () => {
    if (bookingError) {
      bookingError.hidden = true;
    }
  });
}

async function loadApiServices() {
  try {
    const response = await fetch(`${siteConfig.apiUrl}/api/servicos`);
    const payload = await response.json().catch(() => null);

    if (!response.ok || !Array.isArray(payload)) {
      return;
    }

    const apiServices = payload.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description || "",
      price: Number(service.price || 0),
      duration: Number(service.durationMinutes || service.duration || 0),
      durationMinutes: Number(service.durationMinutes || service.duration || 0),
      active: true,
    }));

    localStorage.setItem(servicesStorageKey, JSON.stringify(apiServices));
    populateServiceOptions();
  } catch {
    // Mantem os servicos locais se a API nao estiver disponivel.
  }
}

function fillBookingFromSession() {
  if (!bookingForm) {
    return;
  }

  const session = getCustomerSession();
  if (!session) {
    return;
  }

  bookingForm.elements.name.value = session.name || "";
  bookingForm.elements.email.value = session.email || "";
  bookingForm.elements.phone.value = session.phone || "";
}

function updateBookingAuthState() {
  if (!bookingAuthWarning) {
    return;
  }

  const session = getCustomerSession();
  bookingAuthWarning.hidden = Boolean(session?.token);
}

function getCustomerSession() {
  return JSON.parse(localStorage.getItem(customerSessionKey) || "null");
}

function initAccountMenu() {
  renderAccountMenu();

  accountToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleAccountMenu();
  });

  accountMenu?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  accountLogout?.addEventListener("click", () => {
    localStorage.removeItem(customerSessionKey);
    closeAccountMenu();
    renderAccountMenu();
    updateBookingAuthState();
    if (bookingForm) {
      bookingForm.elements.name.value = "";
      bookingForm.elements.email.value = "";
      bookingForm.elements.phone.value = "";
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === customerSessionKey) {
      renderAccountMenu();
      fillBookingFromSession();
      updateBookingAuthState();
    }
  });
}

function renderAccountMenu() {
  const session = getCustomerSession();

  if (!accountName || !accountEmail || !accountPhone || !accountRegister || !accountLogin || !accountAppointments || !accountLogout) {
    return;
  }

  const isLogged = Boolean(session?.token);

  accountName.textContent = isLogged ? session.name : "Visitante";
  accountEmail.textContent = isLogged ? session.email : "Entre para ver seus dados";
  accountPhone.textContent = isLogged ? session.phone || "" : "";
  accountPhone.hidden = !isLogged || !session?.phone;
  accountRegister.hidden = isLogged;
  accountLogin.hidden = isLogged;
  accountAppointments.hidden = !isLogged;
  accountLogout.hidden = !isLogged;

  if (dashboardLink) {
    dashboardLink.hidden = session?.role !== "Admin";
  }
}

function toggleAccountMenu() {
  if (!accountMenu || !accountToggle) {
    return;
  }

  const nextState = accountMenu.hidden;
  accountMenu.hidden = !nextState;
  accountToggle.setAttribute("aria-expanded", String(nextState));
}

function closeAccountMenu() {
  if (!accountMenu || !accountToggle) {
    return;
  }

  accountMenu.hidden = true;
  accountToggle.setAttribute("aria-expanded", "false");
}

async function createApiBooking(booking) {
  try {
    const response = await fetch(`${siteConfig.apiUrl}/api/agendamentos/publico`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getCustomerSession()?.token}`,
      },
      body: JSON.stringify({
        customerName: booking.name,
        customerPhone: booking.phone,
        customerEmail: booking.email || null,
        barberName: booking.barber,
        serviceName: booking.service,
        scheduledAt: `${booking.date}T${booking.time}:00`,
        unit: booking.unit,
        notes: booking.notes,
        payOnline: booking.paymentMethod === "Online",
      }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.message || "Nao foi possivel confirmar o agendamento na API.");
    }

    return payload;
  } catch (error) {
    showBookingMessage(error.message, "error");
    return { error: true, message: error.message };
  }
}

function saveBooking(booking) {
  const bookings = JSON.parse(localStorage.getItem(bookingStorageKey) || "[]");
  bookings.unshift(booking);
  localStorage.setItem(bookingStorageKey, JSON.stringify(bookings));
}

function appendStatusLink(bookingId) {
  if (!bookingSuccess) {
    return;
  }

  const link = document.createElement("a");
  link.href = `status.html?id=${encodeURIComponent(bookingId)}`;
  link.textContent = "Acompanhar meu agendamento";
  link.className = "status-link";
  bookingSuccess.appendChild(document.createElement("br"));
  bookingSuccess.appendChild(link);
}

function normalizeStatus(status, fallback) {
  const map = {
    Scheduled: "Confirmado",
    Cancelled: "Cancelado",
    Completed: "Concluido",
  };

  return map[status] || status || fallback;
}

function normalizePaymentStatus(status, fallback) {
  const map = {
    Paid: "Pago",
    Pending: "Pagamento presencial pendente",
    WaitingMercadoPago: "Aguardando pagamento online",
    Cancelled: "Pagamento cancelado",
    Failed: "Pagamento recusado",
  };

  return map[status] || status || fallback;
}

function populateServiceOptions() {
  if (!serviceSelect) {
    return;
  }

  const currentValue = serviceSelect.value;
  serviceSelect.innerHTML = '<option value="">Selecione uma opcao</option>';

  getServices()
    .filter((service) => service.active !== false)
    .forEach((service) => {
      const option = document.createElement("option");
      option.value = service.name;
      option.textContent = `${service.name} - ${formatCurrency(service.price)} (${service.duration || service.durationMinutes} min)`;
      serviceSelect.appendChild(option);
    });

  serviceSelect.value = currentValue;
}

function populateTimeOptions() {
  if (!timeSelect) {
    return;
  }

  const currentValue = timeSelect.value;
  timeSelect.innerHTML = '<option value="">Escolha o horario</option>';

  getSchedule().forEach((time) => {
    const option = document.createElement("option");
    option.value = time;
    option.textContent = time;
    timeSelect.appendChild(option);
  });

  timeSelect.value = currentValue;
}

function getServices() {
  return JSON.parse(localStorage.getItem(servicesStorageKey) || JSON.stringify(defaultServices));
}

function getSchedule() {
  return JSON.parse(localStorage.getItem(scheduleStorageKey) || JSON.stringify(defaultSchedule));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function validateBooking({ date, time, barber }) {
  if (isPastSlot(date, time)) {
    return "Escolha um horario futuro. Nao e possivel agendar um horario anterior ao momento atual.";
  }

  const bookings = JSON.parse(localStorage.getItem(bookingStorageKey) || "[]");
  const activeBookings = getActiveBookings(bookings);

  if (barber === "Primeiro disponivel") {
    return "Todos os barbeiros ja possuem agendamento nesse horario. Escolha outro horario.";
  }

  const hasConflict = activeBookings.some((booking) => (
    booking.date === date &&
    booking.time === time &&
    booking.barber === barber
  ));

  return hasConflict
    ? `${barber} ja possui um agendamento em ${date} as ${time}. Escolha outro horario ou profissional.`
    : "";
}

function findAvailableBarber(date, time) {
  const bookings = JSON.parse(localStorage.getItem(bookingStorageKey) || "[]");
  const busyBarbers = getActiveBookings(bookings)
    .filter((booking) => booking.date === date && booking.time === time)
    .map((booking) => booking.barber);

  return availableBarbers.find((barber) => !busyBarbers.includes(barber));
}

function getActiveBookings(bookings) {
  return bookings.filter((booking) => !["Cancelado", "Cancelled"].includes(booking.status));
}

function updateAvailableTimes() {
  if (!dateInput || !timeSelect) {
    return;
  }

  Array.from(timeSelect.options).forEach((option) => {
    if (!option.value) {
      return;
    }

    option.disabled = isPastSlot(dateInput.value, option.value);
  });

  if (timeSelect.selectedOptions[0]?.disabled) {
    timeSelect.value = "";
  }
}

function isPastSlot(date, time) {
  if (!date || !time) {
    return false;
  }

  return new Date(`${date}T${time}:00`).getTime() <= Date.now();
}

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function showBookingMessage(message, type) {
  if (bookingSuccess) {
    bookingSuccess.hidden = type !== "success";
    bookingSuccess.textContent = type === "success" ? message : "";
  }

  if (bookingError) {
    bookingError.hidden = type !== "error";
    bookingError.textContent = type === "error" ? message : "";
  }
}

applyConfig();
updateHeaderState();
initRevealAnimation();
initBookingForm();
initAccountMenu();

window.addEventListener("scroll", updateHeaderState, { passive: true });

menuToggle.addEventListener("click", toggleMenu);

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    if (navPanel.classList.contains("is-open")) {
      closeMenu();
    }
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && navPanel.classList.contains("is-open")) {
    closeMenu();
  }

  if (event.key === "Escape" && accountMenu && !accountMenu.hidden) {
    closeAccountMenu();
  }
});

document.addEventListener("click", () => {
  if (accountMenu && !accountMenu.hidden) {
    closeAccountMenu();
  }
});

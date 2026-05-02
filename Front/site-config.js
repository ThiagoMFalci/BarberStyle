export const siteConfig = {
  brand: {
    name: "BarberStyle",
    initials: "BS",
    tagline: "Barbearia Premium",
    clientAreaLabel: "Area do cliente",
    adminAreaLabel: "Admin",
  },
  api: {
    url: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://barberstyle-mvqd.onrender.com" : ""),
  },
  contact: {
    whatsappNumber: "5511999999999",
    whatsappDisplay: "(11) 99999-9999",
    whatsappText: "Ola! Quero falar com a BarberStyle.",
    instagramUrl: "https://instagram.com/barberstyle",
    instagramDisplay: "@barberstyle",
    address: "Rua Exemplo, 123 - Centro, Sao Paulo/SP",
  },
  business: {
    foundedText: "Desde 2016",
    scheduleLabel: "Atendimento com hora marcada",
    openingHours: [
      "Segunda a sexta: 10h as 20h",
      "Sabado: 8h as 16h",
    ],
    stats: [
      { value: "10k+", label: "clientes atendidos" },
      { value: "4.9", label: "avaliacao media" },
      { value: "24h", label: "agenda online no site" },
    ],
  },
  theme: {
    black: "#08090b",
    ink: "#101114",
    graphite: "#191b20",
    paper: "#f4efe5",
    gold: "#c9a45f",
    goldDark: "#98733c",
  },
  images: {
    hero: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=2200&q=88",
    finalCta: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1800&q=85",
    accountHero: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1600&q=80",
  },
  defaultSchedule: ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00", "19:00"],
  defaultBarbers: ["Ton Barber", "Michael Trindade", "Valdir Bispo"],
};

export function applyBrandConfig(root = document) {
  root.querySelectorAll("[data-brand-name]").forEach((element) => {
    element.textContent = siteConfig.brand.name;
  });

  root.querySelectorAll("[data-brand-initials]").forEach((element) => {
    element.textContent = siteConfig.brand.initials;
  });

  root.querySelectorAll("[data-brand-tagline]").forEach((element) => {
    element.textContent = siteConfig.brand.tagline;
  });

  root.querySelectorAll("[data-client-area-label]").forEach((element) => {
    element.textContent = siteConfig.brand.clientAreaLabel;
  });

  root.querySelectorAll("[data-admin-area-label]").forEach((element) => {
    element.textContent = siteConfig.brand.adminAreaLabel;
  });

  root.querySelectorAll("[data-address]").forEach((element) => {
    element.textContent = siteConfig.contact.address;
  });

  root.querySelectorAll("[data-opening-hours]").forEach((container) => {
    container.textContent = "";
    siteConfig.business.openingHours.forEach((line) => {
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      container.appendChild(paragraph);
    });
  });

  root.querySelectorAll("[data-instagram-link]").forEach((element) => {
    element.href = siteConfig.contact.instagramUrl;
    element.textContent = siteConfig.contact.instagramDisplay;
  });

  const whatsappUrl = `https://wa.me/${siteConfig.contact.whatsappNumber}?text=${encodeURIComponent(siteConfig.contact.whatsappText)}`;
  root.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
    link.href = whatsappUrl;
    link.target = "_blank";
    link.rel = "noreferrer";
  });

  root.querySelectorAll("[data-whatsapp-text]").forEach((element) => {
    element.textContent = siteConfig.contact.whatsappDisplay;
  });

  root.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
}

export function applyThemeConfig(root = document.documentElement) {
  root.style.setProperty("--black", siteConfig.theme.black);
  root.style.setProperty("--ink", siteConfig.theme.ink);
  root.style.setProperty("--graphite", siteConfig.theme.graphite);
  root.style.setProperty("--paper", siteConfig.theme.paper);
  root.style.setProperty("--gold", siteConfig.theme.gold);
  root.style.setProperty("--gold-dark", siteConfig.theme.goldDark);
  root.style.setProperty("--hero-image", `url("${siteConfig.images.hero}")`);
  root.style.setProperty("--final-cta-image", `url("${siteConfig.images.finalCta}")`);
  root.style.setProperty("--account-hero-image", `url("${siteConfig.images.accountHero}")`);
}

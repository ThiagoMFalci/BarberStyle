import { applyBrandConfig, applyThemeConfig } from "./site-config.js";

const services = {
  corte: {
    kicker: "Corte masculino",
    title: "Um corte pensado para sustentar sua presenca.",
    description: "Mais do que tirar volume: o corte certo organiza sua imagem, valoriza o rosto e deixa sua rotina mais facil.",
    image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1400&q=88",
    badge: "Acabamento de alto padrao",
    experienceTitle: "Do diagnostico rapido a finalizacao pronta.",
    experience: "O profissional avalia formato do rosto, estilo atual, rotina e referencia desejada. Depois, executa o corte com tecnica, revisao de acabamento e finalizacao para voce sair pronto.",
    steps: ["Consulta de estilo", "Corte com tesoura e maquina", "Finalizacao com produto profissional"],
    gallery: [
      "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=85",
    ],
  },
  barba: {
    kicker: "Barba completa",
    title: "Barba alinhada muda o rosto inteiro.",
    description: "Contorno limpo, desenho proporcional e acabamento com toalha quente para uma barba com presenca.",
    image: "https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?auto=format&fit=crop&w=1400&q=88",
    badge: "Navalha e toalha quente",
    experienceTitle: "Conforto, desenho e acabamento.",
    experience: "O atendimento combina preparacao da pele, desenho de linhas, aparo de volume e finalizacao para deixar a barba mais limpa, simetrica e elegante.",
    steps: ["Preparacao da pele", "Desenho e aparo", "Finalizacao calmante"],
    gallery: [
      "https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=85",
    ],
  },
  combo: {
    kicker: "Corte + barba",
    title: "O pacote completo para uma imagem impecavel.",
    description: "Cabelo e barba trabalhados juntos para o visual ficar coerente, limpo e pronto para qualquer ocasiao.",
    image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1400&q=88",
    badge: "Experiencia completa",
    experienceTitle: "Cabelo e barba no mesmo padrao.",
    experience: "O profissional alinha corte, barba e acabamento para construir um resultado unico. Ideal para reunioes, eventos, encontros ou manutencao semanal.",
    steps: ["Diagnostico visual", "Corte e barba integrados", "Revisao final no espelho"],
    gallery: [
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?auto=format&fit=crop&w=900&q=85",
    ],
  },
  sobrancelha: {
    kicker: "Sobrancelha",
    title: "Detalhe discreto. Diferenca imediata.",
    description: "Design natural para limpar a expressao sem perder masculinidade ou exagerar no desenho.",
    image: "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=1400&q=88",
    badge: "Natural e discreto",
    experienceTitle: "Expressao mais limpa sem exagero.",
    experience: "A proposta e remover excessos, preservar naturalidade e valorizar o olhar com um acabamento quase imperceptivel, mas muito eficiente.",
    steps: ["Mapeamento discreto", "Remocao de excessos", "Acabamento natural"],
    gallery: [
      "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1593702295094-aea22597af65?auto=format&fit=crop&w=900&q=85",
    ],
  },
  tratamento: {
    kicker: "Tratamento capilar",
    title: "Fios mais fortes. Acabamento mais limpo.",
    description: "Protocolos para couro cabeludo e fios que ajudam o corte a durar mais e ficar melhor finalizado.",
    image: "https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?auto=format&fit=crop&w=1400&q=88",
    badge: "Cuidado profissional",
    experienceTitle: "Tratamento que melhora o resultado do corte.",
    experience: "O atendimento trabalha limpeza, hidratacao e controle dos fios para trazer mais saude, textura e acabamento ao visual.",
    steps: ["Analise dos fios", "Aplicacao do protocolo", "Finalizacao orientada"],
    gallery: [
      "https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=85",
    ],
  },
  noivo: {
    kicker: "Dia do noivo",
    title: "Uma preparacao reservada para chegar impecavel.",
    description: "Cabelo, barba e acabamento em uma experiencia premium para o grande dia.",
    image: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1400&q=88",
    badge: "Experiencia reservada",
    experienceTitle: "Atendimento sem pressa para um dia importante.",
    experience: "A experiencia combina planejamento visual, cabelo, barba, acabamento e um atendimento reservado para o noivo chegar confiante.",
    steps: ["Planejamento do visual", "Corte, barba e acabamento", "Experiencia reservada"],
    gallery: [
      "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1593702295094-aea22597af65?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=85",
    ],
  },
};

const params = new URLSearchParams(window.location.search);
const service = services[params.get("tipo")] || services.corte;

applyThemeConfig();
applyBrandConfig();

document.querySelector("[data-service-kicker]").textContent = service.kicker;
document.querySelector("[data-service-title]").textContent = service.title;
document.querySelector("[data-service-description]").textContent = service.description;
document.querySelector("[data-service-image]").src = service.image;
document.querySelector("[data-service-image]").alt = service.kicker;
document.querySelector("[data-service-badge]").textContent = service.badge;
document.querySelector("[data-service-experience-title]").textContent = service.experienceTitle;
document.querySelector("[data-service-experience]").textContent = service.experience;
document.querySelector("[data-service-cta]").textContent = `Pronto para reservar ${service.kicker.toLowerCase()}?`;

document.querySelector("[data-service-steps]").innerHTML = service.steps
  .map((step, index) => `
    <article>
      <span>${String(index + 1).padStart(2, "0")}</span>
      <strong>${step}</strong>
    </article>
  `)
  .join("");

document.querySelector("[data-service-gallery]").innerHTML = service.gallery
  .map((image, index) => `
    <figure>
      <img src="${image}" alt="${service.kicker} referencia ${index + 1}" />
    </figure>
  `)
  .join("");

document.querySelector("[data-service-testimonials]").innerHTML = [
  ["Atendimento sem correria e resultado muito acima de barbearia comum.", "Marcos Lima"],
  ["O acabamento fica limpo e dura mais. Da para sentir o cuidado no detalhe.", "Andre Rocha"],
  ["Experiencia premium de verdade, principalmente pela organizacao do horario.", "Felipe Castro"],
]
  .map(([text, name]) => `
    <article class="testimonial-card reveal">
      <div class="stars" aria-label="5 estrelas">★★★★★</div>
      <p>"${text}"</p>
      <strong>${name}</strong>
      <span>Cliente BarberStyle</span>
    </article>
  `)
  .join("");

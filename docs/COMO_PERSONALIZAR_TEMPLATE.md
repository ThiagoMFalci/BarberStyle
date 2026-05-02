# Como personalizar o template

O arquivo principal para adaptar o site para uma nova barbearia e:

`Front/site-config.js`

Altere primeiro esse arquivo antes de mexer em HTML ou CSS.

## Marca

```js
brand: {
  name: "Nome da Barbearia",
  initials: "NB",
  tagline: "Barbearia Premium",
}
```

## Contato

```js
contact: {
  whatsappNumber: "5511999999999",
  whatsappDisplay: "(11) 99999-9999",
  whatsappText: "Ola! Quero agendar um horario.",
  instagramUrl: "https://instagram.com/seuperfil",
  instagramDisplay: "@seuperfil",
  address: "Rua do Cliente, 123 - Cidade/UF",
}
```

## Cores

```js
theme: {
  black: "#08090b",
  ink: "#101114",
  graphite: "#191b20",
  paper: "#f4efe5",
  gold: "#c9a45f",
  goldDark: "#98733c",
}
```

Use `gold` como cor de destaque. Para clientes que querem outra identidade, troque `gold` e `goldDark` por cobre, vermelho escuro, verde, azul ou outro tom premium.

## Imagens

```js
images: {
  hero: "URL_DA_IMAGEM_PRINCIPAL",
  finalCta: "URL_DA_IMAGEM_FINAL",
  accountHero: "URL_DA_AREA_DO_CLIENTE",
}
```

Prefira imagens horizontais, com boa luz, mostrando ambiente real, cadeira, barbeiro trabalhando ou detalhe de acabamento.

## Horarios padrao

```js
defaultSchedule: ["09:00", "10:30", "12:00", "14:00", "15:30", "17:00", "19:00"]
```

Esses horarios alimentam o frontend quando ainda nao ha configuracao salva no dashboard.

## Profissionais padrao

```js
defaultBarbers: ["Ton Barber", "Michael Trindade", "Valdir Bispo"]
```

Depois da entrega, o ideal e cadastrar os barbeiros reais pela API/dashboard quando essa tela estiver disponivel.

## Textos que normalmente mudam

- Headline do hero em `Front/index.html`.
- Texto da secao "Sobre".
- Planos do clube.
- Depoimentos.
- Fotos da galeria.
- Politica de cancelamento e privacidade.

# Checklist de entrega por barbearia

Use este checklist sempre que vender uma nova instalacao do site.

## 1. Identidade da barbearia

- [ ] Atualizar `Front/site-config.js` com nome, iniciais, slogan, endereco, Instagram e WhatsApp.
- [ ] Atualizar cores em `siteConfig.theme`.
- [ ] Atualizar imagens em `siteConfig.images`.
- [ ] Revisar textos da home em `Front/index.html` quando o cliente quiser um tom diferente.
- [ ] Substituir fotos da galeria por imagens do cliente ou imagens aprovadas.

## 2. Servicos e agenda

- [ ] Cadastrar servicos reais no dashboard.
- [ ] Revisar preco, duracao e nome de cada servico.
- [ ] Ajustar horarios disponiveis no dashboard.
- [ ] Conferir barbeiros cadastrados e nomes exibidos na agenda.
- [ ] Fazer um agendamento presencial de teste.
- [ ] Fazer um agendamento online com Mercado Pago.

## 3. Credenciais por cliente

- [ ] Criar API Render separada para a barbearia.
- [ ] Criar banco Postgres separado para a barbearia.
- [ ] Configurar `ConnectionStrings__DefaultConnection` no Render.
- [ ] Configurar `Jwt__Secret` unico com 32+ caracteres.
- [ ] Configurar `Jwt__Issuer` e `Jwt__Audience`.
- [ ] Configurar `AdminUser__Email`.
- [ ] Configurar `AdminUser__Password` com senha forte temporaria.
- [ ] Configurar `AdminUser__AllowTemporaryAdmin=false`.
- [ ] Configurar credenciais Mercado Pago do cliente.
- [ ] Configurar SMTP ou proxy de email do cliente.

## 4. Dominio e URLs

- [ ] Publicar frontend na Vercel.
- [ ] Apontar dominio do cliente para a Vercel.
- [ ] Atualizar `MercadoPago__FrontendBaseUrl` com dominio final.
- [ ] Atualizar `MercadoPago__PublicBaseUrl` com URL da API Render.
- [ ] Atualizar `Cors__Origins__0` com dominio final.
- [ ] Testar acesso pelo dominio do cliente no celular.

## 5. Pagamento e emails

- [ ] Gerar pagamento real de baixo valor ou usar produto de teste aprovado pelo cliente.
- [ ] Confirmar redirecionamento para "Meus agendamentos".
- [ ] Confirmar status pago no dashboard.
- [ ] Testar cancelamento pelo proprietario e regra de estorno.
- [ ] Testar recuperacao de senha.
- [ ] Confirmar recebimento do email na caixa de entrada e spam.

## 6. Segurança e LGPD

- [ ] Trocar a senha admin antes de entregar.
- [ ] Nunca reutilizar token Mercado Pago, JWT secret, banco ou SMTP entre clientes.
- [ ] Adicionar politica de privacidade da barbearia.
- [ ] Informar que dados coletados: nome, email, WhatsApp e historico de agendamentos.
- [ ] Confirmar que apenas o proprietario tem acesso ao dashboard.
- [ ] Exportar backup inicial do banco quando o site entrar em producao.

## 7. Entrega

- [ ] Enviar URL do site.
- [ ] Enviar URL do dashboard.
- [ ] Enviar usuario admin.
- [ ] Enviar senha temporaria por canal seguro.
- [ ] Explicar como cadastrar servicos.
- [ ] Explicar como cancelar, concluir e acompanhar pagamentos.
- [ ] Registrar data de entrega e combinados de suporte.

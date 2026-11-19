# Gestão privada e MCP

O configurador público funciona sem conta. A gestão está em `/admin` e usa
**NoX Login**. Não há password local, utilizador predefinido ou modo de acesso
anónimo à gestão.

## Instalação no mesmo host do NoX Auth

O NoX Auth deve estar ativo e admitir o email do proprietário. A partir da raiz:

1. Copia `.env.example` para `.env`.
2. Define `PC_CONFIGURATOR_PUBLIC_URL` com a origem exata usada no browser,
   `NOX_AUTH_PUBLIC_URL` com a origem HTTPS do NoX Auth. O email/conta autorizada
   é gerido apenas no NoX Auth existente; não é repetido nesta app.
3. Confirma os nomes dos volumes partilhados do NoX Auth.
4. Arranca com o override de autenticação:

```sh
docker compose -f compose.yaml -f compose.auth.yaml up --build -d
```

O serviço pontual `auth-setup` regista o cliente confidencial `pc-configurator` e
callback exata `${PC_CONFIGURATOR_PUBLIC_URL}/auth/nox/callback`. Sair com código
0 é normal. O segredo é gerado uma vez e guardado em `/data/nox-login.json`, com
permissões 0600; não é pedido ao utilizador nem enviado ao frontend.

Só `auth-setup` recebe o volume de administração do Auth. O serviço normal usa
apenas `/run/nox-suite/nox-auth.sock`, pelo volume de runtime. Os sockets devem
estar acessíveis ao GID 10001, como nos outros produtos NoX. O contentor não inclui
o NoX Auth nem precisa de credenciais Google.

A origem da app pode ser HTTP ou HTTPS segundo o perfil privado do NoX Auth.
Cookies tornam-se Secure em HTTPS. Mantém o reverse proxy a encaminhar os caminhos
da app, `/auth`, `/api`, `/media` e `/mcp` para o mesmo serviço. Não registes query
strings da callback OAuth nos logs do proxy. O registo recusa alterar silenciosamente
as origens já guardadas.

Abre `/admin`, escolhe **NoX Login** e usa a conta Google autorizada no Auth.
Tal como no Backend, uma nova identidade verificada e admitida como administrador
pelo NoX Auth recebe acesso de proprietário automaticamente, sem uma segunda
lista de emails ou atribuição manual. A associação usa `(issuer, subject)` e não
depende de futuros nomes ou alterações de email.

Os papéis locais são opcionais: um proprietário pode restringir uma conta em
**Acesso e MCP**, e essa escolha mantém-se nos logins seguintes. A autorização
central continua obrigatória para todos, incluindo proprietários; não existe
forma de admitir contas localmente no Auth.

## Papéis

| Papel        | Permissões                                                   |
| ------------ | ------------------------------------------------------------ |
| Sem acesso   | Entrar/sair do NoX Login; sem gestão de dados                |
| Leitor       | Consultar gestão, rascunhos, previews, imagens e histórico   |
| Editor       | Leitura, guardar/importar rascunhos e adicionar imagens      |
| Publicador   | Edição, publicar e arquivar componentes                      |
| Proprietário | Tudo acima, papéis locais e criação/revogação de acessos MCP |

Não é possível retirar o acesso ao último proprietário. Retirar um papel bloqueia
as operações que deixaram de ser permitidas, incluindo chamadas MCP seguintes.

## Editar e publicar

Escolhe ou cria um componente, edita os campos, ofertas por mercado, imagens e
dados técnicos. Valores monetários no formulário são líquidos e usam a precisão
do mercado. A API guarda unidades inteiras. Uma oferta não converte preços de
outro mercado.

**Guardar rascunho**, **Pré-visualização privada** e **Publicar** são operações
separadas. A publicação requer a revisão guardada exata. Outro editor a guardar
uma revisão faz o pedido antigo falhar com conflito; não sobrescreve alterações
concorrentes. A pré-visualização não altera a build local, URL pública ou publicação.

Arquivar retira o componente do catálogo público, preservando os links existentes
como referências indisponíveis. Um rascunho pode ser revisto e publicado novamente.

**Importar JSON** aceita até 100 componentes por pedido, no contrato exportado
pela gestão. Importa tudo numa transação e guarda rascunhos; nunca publica por
importação. Um conflito ou campo inválido cancela o pedido completo. **Exportar JSON**
inclui componentes e rascunhos atuais; não inclui ficheiros de imagem ou credenciais.

Mercados/settings e traduções têm editores JSON com o mesmo fluxo de revisão,
preview e publicação. Nomes de parâmetros nas traduções são validados. Os textos
publicados são aplicados na interface pelo locale selecionado. Para categorias,
a lista de tipos técnicos é partilhada pelo domínio; ordem/posições/limites e
nomes apresentados são controlados por settings e locales.

A biblioteca aceita PNG, JPEG e WebP até 2 MB, dimensões até 8192 px e 32 milhões
de píxeis. Imagens novas ficam privadas até serem referidas por um componente
publicado. Guardam-se em `/data/assets`; o histórico identifica upload e publicação.
Não há remoção física de ficheiros pela AI.

## Acesso MCP direto

A app usa **@nox/mcp 0.7.4**, fixado ao artefacto publicado, para o endpoint HTTP
`/mcp`. Suporta clientes MCP de 2025 e o protocolo 2026-07-28. As ferramentas têm
schemas de entrada, permissões e limites de payload/execução. Não há execução de
SQL, shell ou acesso arbitrário a ficheiros.

Em **Acesso e MCP**, cria um acesso com nome, permissões e validade de 1–24 horas.
A leitura está sempre incluída pela interface; permite edição e publicação apenas
quando necessário. O token é mostrado uma única vez. Configura no cliente MCP:

- URL: `${PC_CONFIGURATOR_PUBLIC_URL}/mcp`
- Header: `Authorization: Bearer <token>`

O token é próprio da app; não é uma credencial do NoX Auth. A BD guarda apenas o
seu hash. A AI fica limitada às permissões escolhidas e ao papel atual do criador.
O token depende da sessão que o criou: expiração, revogação ou logout impedem
novas chamadas. A entrada noutra sessão do mesmo browser substitui a anterior.
Não há renovação automática do token MCP nem retries automáticos de mutações.

| Ferramentas                                                                                       | Permissão  |
| ------------------------------------------------------------------------------------------------- | ---------- |
| `pc_catalog_list`, `pc_assets_list`, `pc_audit_list`                                              | Leitura    |
| `pc_component_preview`, `pc_settings_preview`, `pc_locale_preview`                                | Leitura    |
| `pc_component_save`, `pc_catalog_import`, `pc_settings_save`, `pc_locale_save`, `pc_asset_upload` | Edição     |
| `pc_component_publish`, `pc_component_archive`, `pc_settings_publish`, `pc_locale_publish`        | Publicação |

As ferramentas e a gestão HTTP chamam o mesmo `ManagementService`. Validam os
mesmos contratos/revisões e geram auditoria com autor e canal. Um token de leitura
não descobre ferramentas de escrita. Publicação e arquivo são explícitos; um
acesso com publicação pode permitir que a AI execute essas ações sem outro clique.
Uploads MCP usam base64 e o mesmo limite de 2 MB.

Este é o modo MCP direto do SDK, com delegações próprias desta aplicação. Não faz
pairing nem registo automático no Backend/Gateway da Suite e não aceita tokens da
Suite como delegações locais. Essa associação seria uma integração adicional.

## Sessões e indisponibilidade

Código/PKCE, state, nonce, assinatura ES256, issuer, audience e ligação ao access
token são validados no servidor. As transações são limitadas a dez minutos,
consumidas uma vez e vinculadas ao browser. Credenciais Auth nunca entram em
HTML, URLs de sessão ou localStorage.

A app revalida admissão no Auth no máximo a cada cinco minutos desde o início da
verificação, apenas quando há atividade. Uma indisponibilidade não prolonga a
aprovação anterior. Depois do prazo, ações privadas falham até o Auth recuperar;
a parte pública continua a funcionar. Sessões persistem no volume, mas a primeira
utilização depois de reiniciar exige uma nova validação.

A renovação no browser segue os 30 dias do perfil NoX. A UI pede NoX Login quando
necessário, podendo reutilizar SSO sem voltar a escolher conta Google. Durante uma
edição, permite renovar noutra aba e confirmar o regresso sem perder o formulário.
Logout aqui é local à app; não termina sessões dos outros produtos NoX.

## Backup

O backup SQLite preserva catálogo, rascunhos, settings, traduções, permissões e
auditoria, mas remove sessões, transações de login e acessos MCP da cópia. Um
restauro exige novo login e novos acessos MCP; não recupera tokens revogados.

Copia também `/data/assets` para preservar imagens e protege a configuração
`/data/nox-login.json`. Não copies apenas a BD viva enquanto usa WAL. O procedimento
SQLite está no [README](README.md); o volume de dados completo contém informação
privada e deve ser tratado como tal.

## Verificação local

`npm test` usa um provider NoX fictício sobre socket Unix, com JWT assinado e
transporte real do SDK MCP. Não usa contas Google ou o NoX Auth instalado no host.
Cobre login, replay, CSRF, papéis, publicação, revisão, admissão, expiração,
revogação/logout, importação, imagens e backups. O ficheiro `test/preview.ts` é uma
fixture manual isolada e fica fora da imagem de runtime; não é um modo de login
da aplicação. A validação com o NoX Auth real acontece na instalação configurada.

Integrações: [NoX Auth](https://github.com/mapherez/nox-auth) ·
[NoX MCP](https://github.com/mapherez/nox-mcp).

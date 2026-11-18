# Desenvolvimento, CI e release

Node.js 26.13.1+ da série 26, npm 11.20.0 e um único lockfile npm workspaces.
A instalação autoriza explicitamente o script nativo do better-sqlite3.

## Verificações locais

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build:frontend
npm run build:server
```

A suite do servidor usa SQLite real em diretórios temporários e HTTP em loopback.
Cobre arranque inicial, preservação de alterações, transações, validação de preços,
rejeição de BD desconhecida, API sem escrita pública, readiness e backup/restauro.

```sh
docker build -t pc-configurator:local .
npm run test:container
```

O teste cria apenas um contentor e volume próprios, valida a distribuição Linux,
assets e persistência e remove os seus recursos no final. Nunca aponta para o
volume usado pela app normal.

## Hooks e formatação

Os hooks são instalados no `prepare` npm ou com `npm run hooks:install`.
Antes do commit, formatam automaticamente o conteúdo preparado, preservando
alterações parcialmente staged. Antes do push, verificam formatação e código.
Vite+ cobre JS/TS, JSON, CSS/SCSS, HTML e Markdown. Formatadores complementares
cobrem shell, Dockerfile, XML/SVG e SQL; outros textos recebem LF e newline final.
`npm run format` corrige os ficheiros localmente; `format:check` só verifica.
`NOX_SKIP_HOOKS=1` desativa hooks nesse processo; não contorna o CI obrigatório.

## CI

[Workflow](.github/workflows/ci.yml): lint, testes frontend/servidor, tipos, builds,
formatação e teste do contentor. Um novo push cancela o CI anterior da mesma
branch. Os testes da política de release continuam separados. A aprovação só é
emitida se todas as verificações da origem passarem.

## Release

```sh
npm run release
# Ou uma versão explícita:
npm run release -- X.Y.Z
```

Exige árvore limpa. O pedido prepara apenas campos de versão permitidos.
[Workflow](.github/workflows/release.yml) exige aprovação para o commit de origem
exato, aguardando o CI se necessário. Se falhar ou não existir, não publica.
O publisher constrói os artefactos com a versão final e empacota código,
Docker/Compose e os dois builds em `pc-configurator.tar.gz`.

Os testes da origem não são repetidos. Alterações de código/dependências exigem
novo CI. A publicação não altera o host; para atualizar, usa o código/arquivo da
release e reconstrói o serviço mantendo o volume. As releases continuam em fila
sem cancelamento. O procedimento do host está no [README](README.md).

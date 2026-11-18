# PC Configurator

Configurador de computadores com catálogo de componentes, seleção de peças e
verificações de compatibilidade. React/TypeScript e Vite+ no frontend;
Express/TypeScript e SQLite local no servidor. O mesmo serviço serve site e API.

O redesenho público está em `/prototype.html`: catálogo à esquerda, montagem
esquemática ao centro e resumo à direita. Ainda usa dados de exemplo e não precisa
de modelos 3D. O desenvolvimento completo está definido em [SPECIFICATION.md](SPECIFICATION.md).

## Desenvolvimento local

Requisitos: Node.js 26.13.1 ou superior da série 26 e npm 11.20.0.

```sh
npm ci
npm run dev:server
```

Noutro terminal:

```sh
npm run dev:prototype
```

Para a interface anterior, `npm run dev:frontend`. O Vite encaminha `/api` para
`127.0.0.1:3001`, independentemente da porta escolhida para o frontend. Não é
necessário configurar um URL de API ou credenciais de BD. O primeiro arranque do
servidor cria `apps/server/data/catalog.db` e os 14 componentes de exemplo.

## Correr no teu host

Com Docker e Compose, a partir da raiz do repositório:

```sh
docker compose up --build -d
```

Abre `http://127.0.0.1:8080` ou `/prototype.html`. O volume `app-data` guarda a BD
fora do contentor; reiniciar, reconstruir ou substituir o contentor preserva os
componentes e preços existentes. O catálogo inicial só é aplicado numa BD vazia.

A porta fica ligada ao loopback por defeito. Um reverse proxy no host pode servir
o domínio com HTTPS e encaminhar **todos** os caminhos para `127.0.0.1:8080`.
Para acesso direto na LAN: `PC_CONFIGURATOR_BIND=0.0.0.0 docker compose up -d`.
A porta externa pode ser definida com `PC_CONFIGURATOR_PORT`.

```sh
docker compose ps
docker compose logs --tail=100 app
curl --fail http://127.0.0.1:8080/health
```

`/health` responde 200 apenas quando a estrutura da BD está utilizável; responde
503 quando a BD falha. A API pública permite leitura em `GET /api/parts`. A
criação anónima está fechada. A gestão autenticada e MCP são uma entrega futura.

## Backup e restauro

Com a app em execução:

```sh
docker compose exec app node dist/src/backup.js /data/catalog-backup.db
docker compose cp app:/data/catalog-backup.db ./catalog-backup.db
```

Escolhe um nome novo em cada backup. O comando recusa sobrescrever ficheiros e
usa o mecanismo online do SQLite, incluindo alterações ainda presentes no WAL.
Mantém uma cópia fora do host. Não copies apenas `catalog.db` enquanto a app corre.

Para restaurar, mantém o contentor existente mas para o processo, substitui a BD
e elimina os ficheiros auxiliares antigos antes de voltar a arrancar:

```sh
docker compose stop app
docker compose run --rm --no-deps --user 0 --entrypoint sh app -c 'rm -f /data/catalog.db-wal /data/catalog.db-shm'
docker compose cp ./catalog-backup.db app:/data/catalog.db
docker compose run --rm --no-deps --user 0 --entrypoint sh app -c 'chown 10001:10001 /data/catalog.db'
docker compose start app
curl --fail http://127.0.0.1:8080/health
```

O restauro substitui o catálogo atual pelo backup escolhido. Faz um backup atual
antes de restaurar. `docker compose down` preserva o volume; `down -v` apaga-o.

## Executar sem Docker

```sh
npm ci
npm run build:frontend
npm run build:server
NODE_ENV=production npm start
```

O site e API ficam em `http://127.0.0.1:3001`. As opções estão em
[apps/server/.env.example](apps/server/.env.example). Os caminhos relativos são
resolvidos a partir de `apps/server` quando os comandos usam npm workspaces.
Para backup: `npm run db:backup -- /caminho/absoluto/catalog-backup.db`.

## Validação e release

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build:frontend
npm run build:server
docker build -t pc-configurator:local .
npm run test:container
```

O teste do contentor usa uma BD e um volume temporários próprios e remove-os no
fim. Verifica assets, API, backup, reinício, substituição e encerramento.

CI valida código, testes, formatação e contentor. `npm run release` reutiliza a
aprovação do commit de origem e publica um arquivo com código e builds completos,
sem repetir os testes de origem. Não instala nem atualiza automaticamente o host.
Ver [DEVELOPMENT.md](DEVELOPMENT.md).

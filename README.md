# PC Configurator

Configurador de computadores com catálogo de componentes, seleção de peças e
verificações de compatibilidade. React/TypeScript e Vite+ no frontend;
Express/TypeScript e SQLite local no servidor. O mesmo serviço serve site e API.

A interface principal tem catálogo à esquerda, montagem esquemática ao centro e
resumo à direita. Lê o catálogo publicado da API e calcula preços e compatibilidade
com o mesmo módulo do servidor. `/prototype.html` mantém os links já partilhados.
Modelos 3D continuam para uma entrega posterior. Ver [SPECIFICATION.md](SPECIFICATION.md).

A seleção é guiada pela próxima posição obrigatória, sem avançar automaticamente
ou alterar escolhas. **Ver impacto** compara preço e verificações antes de escolher
uma peça. Os conflitos abrem atalhos para as posições envolvidas; quantidades
inválidas podem ser revistas no resumo. Em mobile, a navegação de categorias é
horizontal e uma barra fixa mantém o total e a próxima ação acessíveis.

## Desenvolvimento local

Requisitos: Node.js 26.13.1 ou superior da série 26 e npm 11.20.0.

```sh
npm ci
npm run dev:server
```

Noutro terminal:

```sh
npm run dev:frontend
```

O alias `npm run dev:prototype` abre a mesma app. O Vite encaminha `/api` para
`127.0.0.1:3001`, independentemente da porta escolhida para o frontend. Não é
necessário configurar um URL de API ou credenciais de BD. O primeiro arranque do
servidor cria `apps/server/data/catalog.db` e os 25 componentes de exemplo.

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
503 quando a BD falha. A API pública fornece o catálogo e settings em `GET /api/configurator` e calcula
orçamentos em `POST /api/quote` (operação de leitura). `GET /api/parts` mantém o
contrato de leitura anterior. A criação anónima está fechada. A gestão autenticada está em `/admin`; configuração do NoX Login e MCP em
[MANAGEMENT.md](MANAGEMENT.md).

## Backup e restauro

Com a app em execução:

```sh
docker compose exec app node dist/src/backup.js /data/catalog-backup.db
docker compose cp app:/data/catalog-backup.db ./catalog-backup.db
```

Escolhe um nome novo em cada backup. O comando recusa sobrescrever ficheiros e
usa o mecanismo online do SQLite, incluindo alterações ainda presentes no WAL.
Mantém uma cópia fora do host. Não copies apenas `catalog.db` enquanto a app corre.
O backup remove sessões e acessos MCP da cópia, preservando conteúdo, papéis e
auditoria. Para imagens e configuração NoX, segue também [MANAGEMENT.md](MANAGEMENT.md).

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

## Configuração e catálogo

Os contratos, cálculo de preços, compatibilidade e locales estão em
`packages/domain`. O frontend não inclui uma cópia fixa do catálogo: obtém a
configuração publicada e componentes do SQLite. Se a API falhar, mostra retry e
preserva a seleção guardada. Peças removidas/arquivadas são sinalizadas em links
antigos, sem desaparecerem silenciosamente.

Preços são líquidos em unidades monetárias inteiras; cartões, filtros e resumo
incluem imposto definido no mercado. Portugal mantém a configuração demonstrativa
inicial de 23%. US tem moeda própria mas ainda não tem preços/imposto configurados:
a app não converte nem reutiliza preços de Portugal. Idioma e mercado são escolhas
independentes. Há posições múltiplas para memória, armazenamento e ventoinhas,
quantidades por posição e códigos de compatibilidade traduzidos pelo locale ativo.
Dados insuficientes aparecem como verificação pendente. O exemplo inclui as nove
categorias; armazenamento e cooler são posições obrigatórias, ventoinhas são opcionais.
O SSD `ssd-demo-unverified` não tem interface/conector de propósito, e a ventoinha
RGB tem oferta indisponível, para testar estes estados sem dados comerciais reais.

Uma BD existente mantém o seu catálogo. Para experimentar os novos exemplos nessa
BD, importa os JSON de `apps/server/catalog` pela gestão e revê/publica os rascunhos.
A importação não publica automaticamente nem substitui silenciosamente dados no arranque.

Os JSON e a ordem de aplicação estão documentados em [SETTINGS.md](SETTINGS.md).
A gestão privada e MCP permitem guardar, pré-visualizar, publicar e arquivar estes
dados, com papéis e auditoria. É necessário configurar o NoX Login no host. Os 25 componentes iniciais continuam a ser exemplos, sem garantia de
preços ou disponibilidade comerciais atuais.

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

## Gestão privada

`/admin` permite gerir componentes, preços, imagens, settings, traduções e acessos
MCP. O Compose base mantém a gestão fechada; o override `compose.auth.yaml`
configura a integração com o NoX Auth existente. Não há uma conta/password local.
Procedimento e permissões em [MANAGEMENT.md](MANAGEMENT.md).

## Créditos NoX

Baseado em [nox-mcp](https://github.com/mapherez/nox-mcp) por
[mapherez](https://github.com/mapherez), usado sob CC BY-NC-SA 4.0.
A autenticação integra o serviço separado [nox-auth](https://github.com/mapherez/nox-auth),
por mapherez, através do seu perfil NoX Login.

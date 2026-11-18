# Servidor

Express, TypeScript e better-sqlite3. Servem o catálogo de SQLite e, em produção,
os ficheiros compilados do frontend na mesma origem.

A partir da raiz:

```sh
npm run dev:server
npm run test:run -w apps/server
npm run build:server
NODE_ENV=production npm start
```

O primeiro arranque prepara uma BD vazia e o catálogo de exemplo automaticamente.
O arranque seguinte preserva os dados; não volta a importar os JSON. A estrutura
é verificada antes de servir pedidos. Uma BD de formato desconhecido é recusada
sem substituir os seus dados.

- `GET /health`: disponibilidade real da estrutura SQLite (200/503).
- `GET /api/configurator`: settings efetivas e componentes publicados, com ofertas por mercado.
- `POST /api/quote`: cálculo sem escrita de orçamento e compatibilidade de uma build validada.
- `GET /api/parts`: contrato de leitura anterior, limitado a ofertas EUR de Portugal.
- Escrita pública: 405; a gestão autenticada será implementada separadamente.
- Preços: unidades inteiras na BD; a API atual apresenta o valor líquido decimal
  como string. O novo contrato inclui ofertas próprias por mercado, variantes e
  referências visuais; apenas componentes publicados são públicos.
- Dados iniciais: `catalog/*.json`; não são a fonte de dados após a criação da BD.

Configuração em [.env.example](.env.example). `HOST` predefine loopback e `PORT`
predefine 3001. `PC_CONFIGURATOR_DATA_DIR` predefine `./data` e
`PC_CONFIGURATOR_WEB_DIR` permite escolher o frontend compilado. Em produção o
frontend predefinido é `../frontend/dist`; em desenvolvimento usa-se o Vite.

O ficheiro `.env`, quando usado, fica em `apps/server`. Não é necessário para os
defaults locais. SIGTERM/SIGINT fecha HTTP e SQLite antes de terminar.

Backup online: `npm run db:backup -- /caminho/absoluto/novo-backup.db`.
Ver os procedimentos de alojamento e restauro no [README principal](../../README.md).

Contratos, preços e regras estão em `@pc-configurator/domain`, compilado
automaticamente pelos comandos do servidor. `createPart` e `publishSettings` são
operações internas validadas e transacionais. Não há endpoints públicos para as
executar. Autenticação/permissões de gestão e MCP pertencem à próxima entrega.

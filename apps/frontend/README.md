# Frontend

React, TypeScript e Vite+. Instalar dependências com `npm ci` na raiz.

- `npm run dev:prototype`: novo protótipo em `/prototype.html` com dados de exemplo.
- `npm run dev:frontend`: interface existente, com catálogo vindo de `/api/parts`.
- `npm run build:frontend`: valida tipos e compila os dois entrypoints.
- `npm run test:run -w apps/frontend`: testes de interface e regras.

Em desenvolvimento, `/api` é encaminhado pelo Vite para `127.0.0.1:3001`;
arranca o servidor com `npm run dev:server`. Em produção, site e API são servidos
pelo mesmo processo e origem. Não existe configuração separada do URL da API.

O protótipo usa montagem esquemática 2D. Modelos 3D, gestão e ligação ao catálogo
publicado são entregas posteriores descritas em [SPECIFICATION.md](../../SPECIFICATION.md).

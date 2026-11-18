# Frontend

React, TypeScript e Vite+. Instalar dependências com `npm ci` na raiz.

- `npm run dev:frontend`: configurador principal, ligado à API.
- `npm run dev:prototype`: alias para a mesma app em `/prototype.html`.
- `npm run build:frontend`: valida tipos e compila ambos os endereços.
- `npm run test:run -w apps/frontend`: testes de interface, restauro e integração.

Em desenvolvimento, `/api` é encaminhado pelo Vite para `127.0.0.1:3001`;
arranca o servidor com `npm run dev:server`. Em produção, site e API são servidos
pelo mesmo processo e origem. Não há URL de API separado ou catálogo embutido.

`@pc-configurator/domain` fornece contratos, settings, preços, regras e locales.
Os comandos locais compilam esse workspace automaticamente. Para alterar o módulo
partilhado enquanto o frontend corre, executa `npm run build:domain` novamente.

A montagem é esquemática 2D; modelos 3D ficam para a última entrega. A gestão em `/admin` usa NoX Login e inclui preview privado e acessos MCP. Ver [SPECIFICATION.md](../../SPECIFICATION.md) e
[SETTINGS.md](../../SETTINGS.md).

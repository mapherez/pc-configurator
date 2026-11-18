# PC Configurator — especificação do produto

Referência de trabalho acordada em 18 de novembro de 2026.

## Objetivo

Configurar um PC através de um catálogo de componentes, comparar alternativas,
compreender compatibilidade e orçamento e partilhar a configuração. O produto
inclui um configurador público, gestão privada e operações acessíveis por MCP.
Tudo corre no host do proprietário.

## Experiência pública

- Desktop: componentes à esquerda, área de montagem ao centro, resumo à direita.
- Telemóvel: áreas acessíveis por navegação própria, sem comprimir três colunas.
- A área central é parte principal da experiência. No primeiro protótipo usa uma
  ilustração 2D interativa. Não é necessário implementar WebGL ou fornecer modelos
  3D nesta fase.
- O proprietário ainda não tem modelos 3D. A sua criação será trabalho posterior,
  depois de estabilizar a aplicação. Não bloqueia nenhuma das primeiras entregas.
- O 3D futuro representa peças selecionadas, encaixes e animações de entrada,
  substituição e saída. Deve suportar modelos genéricos e posteriormente modelos
  específicos, com unidades, escala, posições e orientação consistentes.
- Seleção, área visual, orçamento e URL leem a mesma configuração.
- Pesquisa por nome, SKU e marca; filtros relevantes à categoria e preços finais.
- Selecionar ou substituir mostra impacto no orçamento e conflitos associados.
- Compatibilidade distingue conflitos, verificação incompleta e ausência de dados.
  Dados insuficientes não equivalem a uma montagem totalmente compatível.
- Desfazer, recuperação local e links partilháveis preservam o trabalho.
- Quantidades, variantes e posições de montagem são requisitos do modelo final;
  o protótipo inicial limita-se às seis categorias do catálogo existente.
- UI nova, responsiva e acessível: foco visível, teclado, toque, estados vazios,
  erros recuperáveis e preferência de movimento reduzido.

## Mercados, preços e idioma

- Settings globais definem comportamento e apresentação. Settings do mercado
  definem moeda, impostos, preços base e disponibilidade.
- Locale define textos e formatação. Mudar idioma não muda mercado, moeda ou
  regras comerciais. Escolhas explícitas não são substituídas pelo default.
- Preços base não incluem imposto. Cartões, filtros e total final incluem imposto.
  O resumo discrimina valor líquido, imposto e total.
- Dinheiro usa unidades monetárias inteiras; arredondamento de imposto por linha
  é consistente em todos os canais. A futura gestão valida também precisão e moeda.
- Preços e impostos ausentes devem aparecer como indisponíveis. Não se presume
  imposto zero, nem se troca apenas o símbolo de moeda de um preço de outro mercado.
- Todos os textos de interface e códigos de erro traduzíveis vêm de locales.
  Regras de negócio devolvem códigos e parâmetros, não frases fixas.
- Defaults JSON continuam no repo; configuração publicada pode ser gerida no host,
  com validação, importação/exportação e ordem de overrides documentada.
- No protótipo, Portugal usa os preços de exemplo existentes como valores líquidos
  e uma taxa demonstrativa configurada de 23%. O mercado US não tem preços ou
  imposto configurados; é intencionalmente mostrado como indisponível.

## Gestão e MCP

- Acesso público ao configurador; acesso autenticado e autorizado à gestão.
- Integrar NoX Login e o SDK TypeScript nox-mcp através dos contratos existentes.
- Gestão e MCP chamam as mesmas operações de domínio, com as mesmas validações
  e permissões. A AI não recebe acesso direto a SQL ou credenciais administrativas.
- Gerir componentes, categorias, variantes, preços/disponibilidade por mercado,
  settings, locales, imagens e associação de modelos.
- Suportar rascunho, pré-visualização, publicação e arquivo; identificar autor e
  alterações. Arquivar uma peça não deve apagar silenciosamente uma build existente.
- A publicação é uma operação explícita e pode ser permitida a uma AI autorizada.
- A gestão web e a integração MCP são entregas posteriores ao protótipo público.

## Arquitetura alvo

- React e Vite+ no frontend; servidor TypeScript com operações de domínio próprias.
- SQLite local através de better-sqlite3, sem dependência de BD externa.
- Consultas parametrizadas, transações, contratos tipados e validação das entradas.
- Um contentor serve frontend e API na mesma origem. Dados e assets são persistentes.
- Primeiro arranque prepara a estrutura e o catálogo inicial automaticamente.
  Reinícios e atualizações preservam os dados; o catálogo não é reposto por cima
  de alterações administrativas.
- Health/readiness distingue processo vivo de API/BD utilizável.
- Docker Compose, backup/restauro e configuração mínima de domínio/reverse proxy.
- Limpar a configuração e documentação dos alojamentos anteriores na entrega da
  arquitetura alvo. O histórico Git não é reescrito.

## Entregas

1. Esta especificação e protótipo público navegável para avaliar o fluxo e o layout.
2. Persistência local, arranque autónomo, empacotamento e CI funcional.
3. Modelo final de componentes, configuração, preços, locales e regras partilhadas.
4. Configurador completo ligado aos dados publicados.
5. Gestão privada e MCP.
6. Criação/integração dos modelos 3D, animações, desempenho e validação final.

## Estado público atual

O novo configurador é a interface principal em `/`; `/prototype.html` mantém os
links existentes. Obtém catálogo e settings da API, com loading/retry e preservação
de seleção. Preços, regras e contratos são partilhados entre frontend e servidor.
As seis posições principais têm dados iniciais; armazenamento, cooler e ventoinhas
estão preparados mas ainda sem catálogo publicado. Há múltiplas posições e
quantidades, restauro/partilha e indicação de componentes em falta.

A ilustração continua esquemática 2D. Não há ainda gestão privada, autenticação,
MCP ou modelos 3D. Os dados atuais são demonstrativos.

## Critérios finais de aceitação

- Host limpo arranca com o procedimento documentado, sem passos manuais de BD.
- Catálogo e assets sobrevivem a reinício e substituição do contentor.
- Mercado e idioma independentes; todos os preços finais seguem o mercado ativo.
- Seleção, quantidades, posições, orçamento e partilha são coerentes.
- Conflitos e verificações pendentes são apresentados de forma distinta.
- Alterações pela gestão ou MCP respeitam permissões e publicação.
- Percursos públicos e privados testados com BD real e contentor construído.
- Desktop e telemóvel utilizáveis por teclado/toque, com alternativa ao 3D.
- Trabalho local sem commits, push ou execução manual de CI no GitHub.

## Persistência e configuração

SQLite local com criação automática e catálogo inicial apenas numa BD vazia.
Reiniciar não repõe preços ou componentes removidos. Catálogos locais existentes
são preparados automaticamente preservando dados. Ofertas de mercado guardam
moeda, disponibilidade e valor líquido inteiro; settings e publicação persistem.
A API pública só lê componentes publicados e calcula orçamentos sem escrita.

O mesmo processo serve API e frontend. Docker Compose mantém a BD num volume;
backup usa a API online do SQLite. CI verifica imagem, persistência e arranque.
A release reutiliza a aprovação do código. Defaults, overrides publicados e
locales estão descritos em [SETTINGS.md](SETTINGS.md).

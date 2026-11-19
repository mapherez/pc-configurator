# Settings, catálogo e contratos

`packages/domain` é o módulo partilhado entre API e frontend. Os contratos Zod,
cálculos monetários e regras são executados por ambos. Não dependem de React,
Express ou SQLite. A gestão e o SDK MCP usam as mesmas operações.

## Organização

- `packages/domain/src/settings/default.json`: defaults de mercado/idioma,
  funcionalidades, posições de montagem, limites de quantidade, reserva de potência
  do sistema e margem da fonte.
- `packages/domain/src/settings/markets/*.json`: moeda, precisão monetária e taxa
  de imposto por mercado; funcionalidades opcionais podem sobrepor os defaults.
- `packages/domain/src/locales/*.json`: todos os textos da interface e regras.
- `apps/server/catalog/*.json`: catálogo demonstrativo usado apenas no primeiro
  arranque de uma BD vazia. Preços são inteiros líquidos, por mercado e moeda.
- SQLite: catálogo atual, variantes, estado de publicação, ofertas e overrides
  publicados. Mudar os JSON de exemplo não substitui dados existentes no host.

## Ordem de aplicação

1. Defaults globais do repo.
2. Configuração do mercado: aplica moeda/imposto e sobrepõe funcionalidades globais.
3. Overrides publicados em SQLite sobrepõem os campos correspondentes do repo.
4. A escolha explícita de mercado/idioma do visitante sobrepõe apenas os defaults
   de seleção. Não altera regras comerciais ou configuração publicada.

Objetos juntam campos, arrays substituem o array anterior e `null` permanece
explícito. Por exemplo, `taxBasisPoints: null` significa imposto por configurar,
nunca zero. `0` é uma taxa efetivamente configurada de zero.

Os overrides são validados antes de publicar, transacionalmente. Reiniciar
preserva-os. A gestão em `/admin` e o MCP usam as mesmas operações autenticadas de edição,
pré-visualização e publicação. Não há escrita anónima por HTTP. Ver [MANAGEMENT.md](MANAGEMENT.md).

## Dinheiro e mercados

Uma oferta pertence a um componente e mercado. Contém `currency`, `netMinor` e
`available`. Um preço EUR de Portugal não é um preço USD dos EUA.

Por linha: `líquido = preço unitário × quantidade`; o imposto é arredondado uma
única vez nessa linha, para a unidade monetária mais próxima, com metades para
cima. O total soma exatamente as linhas exibidas. Os cálculos de imposto usam
inteiros; não há arredondamentos independentes no resumo ou filtros.

Preço em falta, oferta indisponível, moeda incompatível ou imposto desconhecido
impedem o total. Um componente arquivado/despublicado mantém a referência numa
build partilhada mas precisa de revisão. Não é substituído automaticamente.

Os 23% iniciais de Portugal são uma configuração demonstrativa de mercado.
O mercado US tem imposto desconhecido e não tem ofertas iniciais. A publicação
de um mercado deve incluir os dados comerciais e a política fiscal adequada.

## Builds e compatibilidade

Uma build tem versão de contrato, mercado, idioma e linhas `{slot, componentId,
quantity}`. O mesmo componente pode ocupar posições diferentes. Kits de RAM são
uma unidade de compra; `specs.sticks` indica quantos encaixes físicos consomem.
As posições e limites vêm das settings. Variantes podem referenciar `productId`
e atributos próprios; `visual` reserva associação futura a um asset e anchor.
Nenhum modelo 3D é necessário nesta fase.

Regras devolvem identificadores e `true`, `false` ou `null`. Falta de seleção ou
de dados técnicos é pendente; nunca passa como compatibilidade confirmada. A UI
traduz os identificadores pelo idioma ativo. As regras atuais são básicas; novos
dados/interfaces/conectores podem exigir regras adicionais antes de compra real.
Sem ventoinhas selecionadas não há verificações de ventoinhas pendentes. O mesmo
aplica-se a armazenamento/cooler quando as settings os tornam opcionais.
`complete` indica que todas as posições obrigatórias têm linhas válidas;
`missingRequiredSlots` lista as posições em falta. Não certifica compatibilidade
nem disponibilidade comercial. O filtro da UI oculta conflitos conhecidos;
não elimina peças apenas por faltar informação técnica.

### Campos técnicos usados pelas regras

Campos ausentes significam dados desconhecidos. Contagens aceitam zero para
representar ausência confirmada de encaixes; não se usa zero como campo em falta.
Módulos, capacidades em GB, diâmetros e contagens são inteiros.

| Categoria   | Campos                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU         | `socket`, `tdp` em W                                                                                                                                  |
| Motherboard | `socket`, `ram_type`, `form_factor`, `ram_slots`, `max_ram_gb`, `storage_slots`, `m2_slots`, `sata_ports`, `storage_interfaces`, `storage_connectors` |
| RAM         | `type`, `sticks` por kit, `size_gb` por kit                                                                                                           |
| GPU         | `length_mm`, `tdp` em W                                                                                                                               |
| Fonte       | `wattage`, `form_factor`                                                                                                                              |
| Caixa       | `mobo_support`, `max_gpu_length_mm`, `max_cpu_cooler_height_mm`, `psu_support`, `fan_slots`, `fan_sizes_mm`, `fan_mounts_120`, `fan_mounts_140`       |
| SSD         | `size_gb`, `interface` (`NVMe`/`SATA`), `connector` (`M.2`/`SATA`), `form_factor` descritivo                                                          |
| Cooler a ar | `sockets`, `height_mm`                                                                                                                                |
| Ventoinha   | `diameter_mm`                                                                                                                                         |

RAM soma módulos e GB de todos os kits/quantidades. Armazenamento verifica o total,
portas de cada conector e interfaces suportadas. Ventoinhas somam quantidades entre
posições e respeitam o total e o máximo por diâmetro; esses limites não descrevem
cada localização individual na caixa. Formatos de fonte e alturas de coolers são
verificados separadamente do socket. Um conflito comprovado prevalece mesmo que
outra comparação da mesma regra não tenha dados.

A potência estimada soma CPU + GPU + `systemPowerAllowanceWatts` (100 W por defeito),
uma reserva fixa para motherboard, RAM, discos, ventoinhas e outros consumos.
Aplica-se depois `psuHeadroomBasisPoints` (5000 = 50%) e arredonda-se para cima em
passos de 50 W. É uma estimativa configurável, não uma medição nem uma garantia de
potência térmica do cooler.

As verificações ainda não modelam BIOS, partilha de lanes/portas, espaço ocupado
por radiadores, comprimentos de SSDs M.2, baias SATA da caixa, altura da RAM junto ao cooler, espessura da
GPU ou conectores elétricos. Os exemplos não devem ser usados para validar uma
compra real sem confirmar os fabricantes. Os dados comerciais continuam demonstrativos.

## API pública

- `GET /api/configurator`: snapshot validado, apenas componentes publicados.
- `POST /api/quote`: build validada → linhas, total, problemas e compatibilidade.
  Esta operação não guarda nem modifica dados.
- `GET /api/parts`: contrato de leitura anterior, em EUR para Portugal.

`@pc-configurator/domain` exporta os mesmos schemas e `evaluateBuild` para todos
os canais. Autorização, auditoria e publicação pela gestão/MCP são aplicadas sobre estas
operações; a AI não recebe acesso direto à BD.

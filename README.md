# Quem Estuda Assim?

Ecossistema de estudos para o ENEM em Next.js 16.4, App Router, React 19 e TypeScript estrito. Interface em português, responsiva, com ícones Lucide e animações em CSS que respeitam `prefers-reduced-motion`.

```sh
npm install
npm run dev
```

Abra http://localhost:3000. Para validar:

```sh
npm test
npm run lint
npm run build
npm start
```

Os testes usam o suporte nativo a TypeScript do Node.js 22.18+ (desenvolvido com Node 24). Não há framework adicional de testes. `next/font` baixa as fontes durante o build e as serve localmente na aplicação.

## Estrutura App Router

```text
src/
├── app/
│   ├── layout.tsx                 # Header, footer, fontes e metadados
│   ├── page.tsx                   # Quem Calcula Assim? — /
│   ├── scrolla/page.tsx            # Quem Scrolla Assim? — /scrolla
│   ├── api/rooms/route.ts          # HTTP: criar, entrar, iniciar, responder, sair
│   ├── globals.css                # Tokens visuais, estados e breakpoints
│   └── icon.svg                   # Identidade vetorial
├── components/
│   ├── site-header.tsx
│   ├── site-footer.tsx
│   ├── page-intro.tsx
│   ├── calculator/
│   │   ├── calculator.tsx         # Configuração e seleção de jogo
│   │   ├── solo-game.tsx          # Rodadas, pausa, correção e resultado
│   │   └── multiplayer-game.tsx   # Lobby, sincronização e placar
│   └── scroll/
│       ├── scroll-feed.tsx        # Filtros, snap, paginação e cronômetro
│       └── question-card.tsx      # Enunciado, alternativas e explicação
├── data/questions.json            # Seis questões autorais de demonstração
└── lib/
    ├── questions.ts               # Contrato e validação do banco inicial
    ├── math/
    │   ├── generator.ts           # Motor procedural e validação numérica
    │   └── generator.test.ts
    └── multiplayer/
        ├── types.ts               # Comandos, sessão e snapshot público
        ├── store.ts               # Estado autoritativo de salas
        └── store.test.ts
```

## Geradores matemáticos

`generateEquation(mode, difficulty, random?)` retorna `{ id, expression, answer, hint, explanation }`. A fonte aleatória pode ser injetada para testes reproduzíveis. As contas são construídas a cada rodada; não há uma lista de respostas prontas.

| Nível       | Intervalo básico | Tempo por rodada |
| ----------- | ---------------- | ---------------- |
| Aquecimento | 2–12             | 30 s             |
| Médio       | 2–30             | 25 s             |
| Difícil     | 2–75             | 20 s             |
| Brutal      | 2–150            | 15 s             |

Os intervalos de bases, fatores e dimensões são ajustados por modalidade para manter as contas apropriadas ao cálculo mental.

- **Operações:** soma, subtração, multiplicação e divisão. A divisão é construída como `(a × b) ÷ b`, garantindo divisor não nulo e resultado inteiro. Subtrações podem ter resultado negativo.
- **Potências e raízes:** bases aleatórias, expoentes 2 ou 3 e radicandos construídos como potências perfeitas.
- **Primeiro grau:** escolhe primeiro a solução `x`, o coeficiente `a ≠ 0` e o termo `b`; calcula `c = ax + b`. A solução é inteira, inclusive negativa nos níveis superiores.
- **Logaritmos:** escolhe base `b > 1` e expoente `x`; apresenta `log_b(b^x)`.
- **Geometria:** quadrados, retângulos, triângulos, cubos e blocos. Dimensões positivas; bases pares em triângulos garantem áreas inteiras. A unidade solicitada aparece na instrução.

`parseAnswer` aceita ponto ou vírgula decimal e valores negativos. Rejeita texto, vazio, `NaN`, infinito, notação hexadecimal e entradas ambíguas. A validação numérica tolera apenas diferenças inferiores a 0,005.

O solo aceita 5, 10, 20 ou 30 rodadas, registra o tempo por tentativa, permite pausa e mostra acertos, precisão e tempo médio. O prazo usa relógio absoluto; atrasos do navegador não concedem tempo extra.

## Multiplayer

O servidor gera as equações, autentica cada jogador com token aleatório e decide o vencedor. O snapshot público omite resposta, explicação e tokens dos jogadores até o encerramento da rodada.

```text
POST /api/rooms  { action: "create", name, settings }
POST /api/rooms  { action: "join", code, name }
GET  /api/rooms?code=ABC123
POST /api/rooms  { action: "start", code }
POST /api/rooms  { action: "answer", code, equationId, answer }
POST /api/rooms  { action: "leave", code }
```

Com exceção de criar e entrar, as chamadas exigem `Authorization: Bearer <token>`. O host configura modalidade, nível e rodadas antes de criar a sala. A sala suporta 2–8 jogadores; o código deve ser compartilhado com os convidados, que podem abrir a aplicação em outros navegadores ou dispositivos com acesso ao mesmo servidor.

O primeiro acerto **recebido pelo servidor** ganha um ponto. A alteração de estado ocorre sem `await` entre checagem e atribuição, impedindo pontuação dupla em uma instância. Respostas erradas permitem nova tentativa, com intervalo mínimo de 150 ms. IDs de equação impedem que respostas atrasadas contem na rodada seguinte. Após o acerto ou o prazo, a solução fica visível por 1,8 s. Empates na partida são preservados.

A interface busca snapshots a cada 700 ms, sem requisições sobrepostas. Falhas transitórias acionam reconexão; a pontuação continua autoritativa no servidor. Se o host sair, o próximo participante assume. Sair de uma partida com apenas um jogador restante encerra a partida. Salas sem acesso por uma hora expiram.

**Limite de implantação:** o armazenamento é em memória, compartilhado no processo Node, e funciona com uma única instância persistente (`npm start`). Reiniciar o processo apaga as salas; múltiplas instâncias ou funções serverless não compartilham esse estado. Para esse ambiente, substitua `store.ts` por Redis com operação atômica de vitória ou Supabase com transação/RPC e Realtime, preservando o contrato de `RoomSnapshot`. Não há persistência de sessão após recarregar a página nem detecção automática de jogadores desconectados. A versão inicial não depende de credenciais externas.

## Feed de questões

O container tem altura fixa responsiva e usa `scroll-snap-type: y mandatory`, `scroll-snap-align: start` e scroll nativo. Cada card preserva o enunciado completo em uma área interna rolável para telas pequenas. Também há navegação por botões e pelas setas quando o container está focado.

Os filtros cobrem Matemática, Ciências da Natureza, Ciências Humanas e Linguagens. O modo com tempo aceita 1–30 minutos por questão, pausa o cronômetro e avança automaticamente ao expirar sem resposta. A resposta bloqueia as alternativas, mostra o gabarito e uma explicação; o avanço após responder é manual para permitir a leitura. Alterar área ou tempo reinicia a sessão.

O mock é explicitamente identificado como autoral de demonstração, sem atribuição indevida a provas oficiais. Ao chegar ao fim, o feed acrescenta ciclos de revisão do mesmo banco. Para ampliar, adicione objetos a `src/data/questions.json` com `id` único, `area`, `topic`, `title`, `support`, `prompt`, cinco `alternatives`, `correctIndex` de 0 a 4 e `explanation`. Para um banco grande, substitua a repetição por paginação de API e virtualize os cards antigos.

## Direção visual

- **Tese:** um caderno de estudos contemporâneo, com o treino em primeiro plano e a prática apresentada como um hábito acessível.
- **Âncoras:** papel quente e grafite, terracota nas ações, serifada editorial nos momentos de incentivo; o asterisco identifica o ecossistema.
- **Conteúdo:** configurar → resolver → entender o resultado; no feed, filtrar → ler → responder → aprender.
- **Interação:** estados de seleção, feedback imediato e transições discretas em CSS. Scroll nativo e alternativa por botões; sem efeitos que dependem de hover.
- **Orçamento técnico:** App Router existente, CSS e SVG, apenas Lucide como dependência adicional. Layouts de 320 px a desktop; fontes com fallback de sistema, foco visível e movimento reduzido.

O link externo “Quem Pensa Assim?” abre com `target="_blank"` e `rel="noopener noreferrer"`. A aplicação não requer autenticação externa, banco de dados ou variáveis de ambiente para rodar localmente.

## Verificação realizada

`npm test` passou nos seis testes dos geradores, validação e salas; `npm run lint`, `npm run build` e a checagem de tipos do build passaram. No Chrome headless, foram exercitados resposta, correção, avanço e pausa do solo; uma partida em dois contextos de navegador; filtros, alternativas, pausa e expiração do feed. Não houve erros de execução nessas verificações. As larguras 320, 390, 768, 1024, 1440 e 1920 px passaram sem overflow horizontal.

A auditoria automatizada axe, com regras WCAG A/AA, não reportou violações nas páginas iniciais dos dois módulos em desktop. Isso não equivale a uma auditoria completa: Safari, Firefox, leitores de tela e aparelhos físicos não foram verificados.

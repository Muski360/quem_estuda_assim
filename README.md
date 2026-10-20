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

## Supabase + Cloudflare Workers

Publicação: https://quem-estuda-assim.muski.workers.dev

As CLIs `supabase` e `wrangler` são dependências de desenvolvimento do projeto. Na pasta do projeto, autentique suas contas, um comando por vez:

```sh
npm run login:supabase
npm run login:cloudflare
```

Conclua o fluxo interativo solicitado por cada ferramenta. Esses comandos autenticam as CLIs; não criam projetos, aplicam migrações ou publicam a aplicação. Docker não é necessário para esses logins.

O projeto Supabase é `sgsrjrgdywgppcakfzep` (São Paulo), e o Worker se chama `quem-estuda-assim`. Em um checkout novo, copie `.dev.vars.example` para `.dev.vars` e preencha as três variáveis. O segredo administrativo fica apenas no servidor. Os comandos `dev` e `start` carregam esse arquivo pelo suporte nativo do Node; o build do OpenNext não incorpora seu conteúdo.

```sh
npx supabase link --project-ref sgsrjrgdywgppcakfzep
npm run db:push
npm run build:cloudflare
npm run preview:cloudflare
npm run test:deployment
npm run deploy
```

`db:push` aplica os arquivos de `supabase/migrations` em transações e registra o histórico para não reaplicar versões. Se a rede bloquear a conexão direta ao Postgres, configure `SUPABASE_ACCESS_TOKEN` no ambiente do terminal; o mesmo comando usa a Management API por HTTPS. O token pessoal não deve ir para o Worker. A migração inicial já foi aplicada ao projeto indicado.

`deploy` constrói o Worker, verifica se o pacote contém segredos locais e envia as três variáveis como Secrets da Cloudflare. A senha do banco, se mantida localmente, é excluída desse envio. Arquivos temporários de envio são removidos ao terminar. Para verificar uma publicação, use `npm run test:deployment -- https://URL-DO-WORKER`.

Cache Components e Partial Prefetching foram desativados: a combinação causava requisições sem resposta no runtime Workers. A aplicação não utiliza essas APIs e mantém as páginas estáticas e os endpoints dinâmicos. O adaptador usado é `@opennextjs/cloudflare`; não é necessário R2 para esta configuração.

A publicação atual é feita com `npm run deploy`. Commits locais não publicam o site. Para publicar a cada push, é necessário conectar o repositório ao Worker em Cloudflare Workers Builds e configurar a branch de produção.

## Feedback de estudo

Solo e feed exibem XP da sessão: cada acerto vale 10 XP; a partir de três acertos consecutivos, vale 15 XP. Erros e tempo esgotado encerram o combo, preservando o XP acumulado. Esses números são locais à sessão e não representam um ranking persistente. No multiplayer, o ponto e sua celebração dependem da confirmação do servidor.

O botão de som ativa melodias curtas geradas com Web Audio, inicialmente desligadas. O áudio é interrompido ao silenciar, trocar de rota ou ocultar a aba. Animações de resposta usam CSS e respeitam movimento reduzido. O modo imersivo do feed mantém a navegação por teclado, retém o foco e pode ser fechado com Escape; a meta inicial é concluir cinco questões.

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
│   ├── study-feedback.tsx         # Som opcional, combo e celebração visual
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
    ├── momentum.ts                # XP, sequência e melhor combo da sessão
    ├── math/
    │   ├── generator.ts           # Motor procedural e validação numérica
    │   └── generator.test.ts
    └── multiplayer/
        ├── types.ts               # Comandos, sessão e snapshot público
        ├── store.ts               # Regras do jogo, isoladas por operação
        ├── supabase-store.ts      # Persistência e confirmação atômica por versão
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

O primeiro acerto **confirmado pelo banco** ganha um ponto. O servidor aplica as regras e chama a função Postgres `qe_commit_room` com a versão que leu. Apenas uma atualização concorrente pode confirmar aquela versão; as demais releem o estado antes de tentar novamente. Isso impede pontuação dupla mesmo com diferentes instâncias do Worker. Respostas erradas permitem nova tentativa, com intervalo mínimo de 150 ms. IDs de equação impedem que respostas atrasadas contem na rodada seguinte. Após o acerto ou o prazo, a solução fica visível por 1,8 s. Empates na partida são preservados.

A interface recebe notificações pelo Supabase Realtime, busca snapshots autenticados e ordena as respostas pela revisão do banco. Há sincronização HTTP a cada 5 segundos como alternativa e uma atualização agendada no encerramento de cada rodada. As notificações contêm apenas uma versão, sem dados do jogo, e usam um tópico aleatório compartilhado somente com os participantes admitidos. Mensagens do navegador nunca atribuem pontos. Se o host sair, o próximo participante assume. Sair de uma partida com apenas um jogador restante encerra a partida. Salas sem acesso por uma hora expiram e são limpas ao criar novas salas.

As salas ficam em `public.qe_rooms`, protegida por RLS e permissões que bloqueiam a leitura e escrita pelas chaves públicas. Tokens e gabaritos completos são acessíveis apenas ao servidor. Não há dependência da memória entre requisições. O limite inicial é de 200 salas e 8 participantes por sala. Não há recuperação de sessão após recarregar a página nem remoção automática de jogadores desconectados; saídas pelo botão são registradas imediatamente.

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

O link externo “Quem Pensa Assim?” abre com `target="_blank"` e `rel="noopener noreferrer"`. Solo e feed funcionam sem credenciais. O multiplayer exige as variáveis do Supabase configuradas.

## Verificação realizada

`npm test` passou nos seis testes dos geradores, validação e salas; `npm run lint`, `npm run build` e a checagem de tipos do build passaram. No Chrome headless, foram exercitados resposta, correção, avanço e pausa do solo; uma partida em dois contextos de navegador; filtros, alternativas, pausa e expiração do feed. Não houve erros de execução nessas verificações. As larguras 320, 390, 768, 1024, 1440 e 1920 px passaram sem overflow horizontal.

Na publicação de 20/10/2026, o build OpenNext passou no runtime Workers. A checagem do pacote não encontrou os segredos locais nos arquivos de publicação. `test:deployment` passou pela URL pública: páginas, permissões de banco, evento Realtime, disputa simultânea com ponto único, avanço de rodada, rejeição de resposta atrasada e transferência do host. A aplicação da migração foi repetida para verificar que versões já registradas são ignoradas.

A auditoria automatizada axe, com regras WCAG A/AA, não reportou violações nas páginas iniciais dos dois módulos em desktop. Isso não equivale a uma auditoria completa: Safari, Firefox, leitores de tela e aparelhos físicos não foram verificados.

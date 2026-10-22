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

## Conta opcional com Supabase Auth

`/entrar` e `/cadastro` oferecem e-mail/senha e Google. Há confirmação de e-mail, recuperação em `/recuperar-senha`, nova senha em `/redefinir-senha` e retorno em `/auth/callback`. A sessão persiste no navegador, renova automaticamente e sincroniza o cabeçalho entre abas; “Sair” encerra o acesso neste navegador. Nenhuma ferramenta exige conta, inclusive o multiplayer, que conserva seus tokens de sala independentes.

O Auth reutiliza `@supabase/supabase-js` e as variáveis `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`. `/api/auth/config` entrega apenas esses valores públicos em tempo de execução, sem cache. `SUPABASE_SECRET_KEY` continua exclusiva do servidor e só é necessária para as salas. Sem configuração, as telas explicam a indisponibilidade e oferecem continuar sem entrar. O login atual é usado apenas para identificar a conta na interface; futuras funções privadas deverão validar a sessão no servidor e usar RLS.

Para ativar o serviço remoto (cerca de 10–15 minutos, com acesso ao Google Cloud):

1. Preencha `.dev.vars` a partir de `.dev.vars.example`. Em Supabase Auth, habilite e-mail/senha e confirmação de e-mail. Configure SMTP para entrega aos usuários; o serviço de e-mail de demonstração tem restrições.
2. Em Auth → URL Configuration, defina a Site URL de produção e autorize os retornos abaixo, substituindo o domínio ao usar outro endereço.
3. Crie um cliente OAuth do tipo aplicação web no Google Cloud. Cadastre as origens `http://localhost:3000` e `https://quem-estuda-assim.muski.workers.dev`; a URI de redirecionamento autorizada do Google é `https://sgsrjrgdywgppcakfzep.supabase.co/auth/v1/callback`.
4. Habilite o provedor Google no Supabase e informe o Client ID e Client Secret do Google somente no painel do Supabase. Conclua a configuração de público/usuários de teste da aplicação OAuth conforme sua conta Google.
5. Execute `npm run dev` e teste cadastro → confirmação → saída → login, recuperação de senha e Google. Abra links de e-mail no mesmo navegador que iniciou o fluxo PKCE.

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/callback?recovery=1
https://quem-estuda-assim.muski.workers.dev/auth/callback
https://quem-estuda-assim.muski.workers.dev/auth/callback?recovery=1
```

`supabase/config.toml` já define os retornos do ambiente local e senha mínima de oito caracteres. Esse arquivo não altera as configurações de Auth do projeto hospedado. Referências: [Google no Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google), [senhas e recuperação](https://supabase.com/docs/guides/auth/passwords) e [fluxo PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

## Feedback de estudo

No cálculo, o tempo de cada questão pode ser configurado entre 5 e 180 segundos em todas as modalidades, no solo e no multiplayer. O multiplicador é `clamp(tempoPadrãoDoNível / tempoEscolhido, 0.25, 3)`, arredondado para duas casas. O XP é `round(max(0, 20 - floor(segundosDecorridos)) * multiplicador)`: o valor base perde 1 XP por segundo completo, até zero aos 20 segundos. Expirar o prazo também zera o XP disponível. O valor é fixado na resposta correta, e a pausa do solo congela a contagem. Erros, expiração e pular rendem zero, sem retirar XP acumulado. Acertos avançam em 650 ms; erros do solo mantêm 2,3 s para ler a solução.

No multiplayer, cada jogador tem questão, prazo e pista próprios. Acertar avança um passo; errar mantém o jogador na mesma questão. Vence quem primeiro confirmar a meta de 5, 10, 20 ou 30 acertos. O servidor confirma ponto e XP atomicamente. Salas antigas conservam sessões e progresso na atualização. No feed, os acertos valem 10 XP, ou 15 a partir de três seguidos, multiplicados pela razão entre 3 minutos e o prazo escolhido (0,25–3×); sem tempo vale 1×. XP do solo/feed fica na sessão; XP multiplayer fica na sala e é zerado na revanche.

O botão de som ativa melodias curtas geradas com Web Audio, inicialmente desligadas. O áudio é interrompido ao silenciar, trocar de rota ou ocultar a aba. Animações de resposta usam CSS e respeitam movimento reduzido. O modo imersivo do feed mantém a navegação por teclado, retém o foco e pode ser fechado com Escape; a meta inicial é concluir cinco questões.

Geometria alterna perímetro e área das figuras planas, ou perímetro da base e volume dos sólidos. Os desenhos em SVG incluem círculos, trapézios isósceles e prismas triangulares, além das figuras anteriores. Sólidos podem ser girados por arraste, toque ou botões; tocar nas medidas destaca a dimensão correspondente. Cilindros, cones, pirâmides equiláteras e troncos de cone aparecem em Difícil/Brutal. Respostas com √3 ou π mostram esse fator fixo antes do input: o jogador digita apenas o coeficiente. “Mostrar fórmula” revela a fórmula simbólica da questão com brilho e animação, respeitando movimento reduzido, sem exibir a resposta. A fórmula começa fechada a cada questão, tanto no solo quanto no multiplayer.

## Estrutura App Router

```text
src/
├── app/
│   ├── layout.tsx                 # Header, footer, fontes e metadados
│   ├── page.tsx                   # Quem Calcula Assim? — /
│   ├── scrolla/page.tsx            # Quem Scrolla Assim? — /scrolla
│   ├── api/rooms/route.ts          # HTTP: criar, entrar, iniciar, responder, sair
│   ├── api/auth/config/route.ts    # Configuração pública em tempo de execução
│   ├── entrar/page.tsx            # Login opcional
│   ├── cadastro/page.tsx          # Cadastro opcional
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
│   │   ├── geometry-viewer.tsx    # SVG com rotação e destaque de medidas
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
    │   ├── geometry.ts            # Projeção proporcional dos sólidos
    │   └── generator.test.ts
    └── multiplayer/
        ├── types.ts               # Comandos, sessão e snapshot público
        ├── store.ts               # Regras do jogo, isoladas por operação
        ├── supabase-store.ts      # Persistência e confirmação atômica por versão
        └── store.test.ts
```

## Geradores matemáticos

O treino permite marcar de um a cinco conteúdos ao mesmo tempo. As rodadas intercalam os itens na ordem da seleção, com novas equações a cada passagem. A configuração `mode` aceita uma lista ou uma modalidade única para compatibilidade com salas existentes. A API rejeita listas vazias, duplicadas ou desconhecidas. `generateRound(settings, index)` aplica a mesma sequência no solo e no multiplayer; cada questão informa sua modalidade real para desenhar geometria e formatar equações corretamente.

`generateEquation(mode, difficulty, random?)` retorna `{ id, mode, expression, answer, hint, explanation }`. A fonte aleatória pode ser injetada para testes reproduzíveis. As contas são construídas a cada rodada; não há uma lista de respostas prontas.

| Nível       | Intervalo básico | Tempo padrão |
| ----------- | ---------------- | ---------------- |
| Aquecimento | 0–20             | 30 s             |
| Médio       | 0–50             | 25 s             |
| Difícil     | 0–100            | 20 s             |
| Brutal      | 0–200            | 15 s             |

Esses intervalos são de soma, subtração e quocientes. Bases, fatores e dimensões têm limites próprios: as multiplicações do Aquecimento continuam limitadas a 0–12 × 2–9. Os divisores ficam entre 2 e 12 nesse nível. O solo e cada jogador multiplayer guardam as últimas 12 expressões; o gerador tenta até 24 alternativas para evitar repetições recentes, com limite de tentativas para fontes aleatórias constantes. Salas antigas recebem esse histórico ao avançar, sem perder a sessão.

- **Operações:** soma, subtração, multiplicação e divisão. A divisão é construída como `(a × b) ÷ b`, garantindo divisor não nulo e resultado inteiro. Subtrações podem ter resultado negativo.
- **Potências e raízes:** bases aleatórias, expoentes 2 ou 3 e radicandos construídos como potências perfeitas.
- **Primeiro grau:** escolhe primeiro a solução `x`, o coeficiente `a ≠ 0` e o termo `b`; calcula `c = ax + b`. A solução é inteira, inclusive negativa nos níveis superiores.
- **Logaritmos:** alterna encontrar o expoente em `log_b(n)` e encontrar o argumento em `log_b(x) = e`, com mais bases e resultados exatos.
- **Geometria:** quadrados, retângulos, triângulos, círculos, trapézios, cubos, blocos e prismas triangulares; Difícil/Brutal acrescentam cilindros, cones, pirâmides equiláteras e troncos de cone. Os perímetros de bases usam os lados da base, sem somar a altura do sólido. Triângulos e trapézios de perímetro usam medidas geometricamente consistentes, com lados informados. `measurement` identifica a grandeza pedida e `formula` contém só a fórmula simbólica; `factor?: "√3" | "π"` acompanha respostas com fator fixo.

`parseAnswer` aceita ponto ou vírgula decimal e valores negativos. Rejeita texto, vazio, `NaN`, infinito, notação hexadecimal e entradas ambíguas. A validação numérica tolera apenas diferenças inferiores a 0,005.

O solo aceita 5, 10, 20 ou 30 rodadas, registra o tempo por tentativa, permite pausa e mostra acertos, precisão e tempo médio. O prazo usa relógio absoluto; atrasos do navegador não concedem tempo extra. No solo, pular consome uma rodada sem acerto ou XP. O multiplayer não permite pular: não há botão, comando ou troca automática por tempo esgotado. Depois do prazo, a questão permanece e deve ser resolvida, valendo um acerto e zero XP. No feed, pular trava a questão sem XP, mostra a explicação ao voltar e avança o card.

## Multiplayer

O servidor gera as equações, autentica cada jogador com token aleatório e decide o vencedor. O snapshot inclui só a questão do jogador autenticado e o progresso público dos adversários. Gabarito e explicação da própria questão aparecem só após o acerto; esgotar o tempo não revela a solução. Fórmulas simbólicas podem ser consultadas durante a questão. Tokens e equações dos adversários nunca são expostos.

```text
POST /api/rooms  { action: "create", name, settings }
POST /api/rooms  { action: "join", code, name }
GET  /api/rooms?code=ABC123
POST /api/rooms  { action: "start", code }
POST /api/rooms  { action: "answer", code, equationId, answer }
POST /api/rooms  { action: "leave", code }
```

Com exceção de criar e entrar, as chamadas exigem `Authorization: Bearer <token>`. O host configura modalidade, nível e rodadas antes de criar a sala. A sala suporta 2–8 jogadores; o código deve ser compartilhado com os convidados, que podem abrir a aplicação em outros navegadores ou dispositivos com acesso ao mesmo servidor.

Cada acerto confirmado pelo banco avança a pista do jogador. A função Postgres `qe_commit_room` confirma por versão; operações concorrentes releem o estado antes de tentar novamente. Respostas duplicadas não pontuam duas vezes, e jogadores distintos podem avançar simultaneamente. A primeira confirmação da meta encerra a partida. Há intervalo mínimo de 150 ms entre tentativas. Três respostas incorretas em uma janela estritamente menor que 5 segundos bloqueiam aquele jogador por 5 segundos (HTTP 429). Chamadas antigas de `action: "skip"` recebem HTTP 400 antes de acessar o banco. IDs de equação rejeitam respostas de questões já concluídas. A solução fica visível por 650 ms no acerto. Salas salvas com a antiga revelação por expiração retomam a mesma questão para resolução obrigatória.

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

`npm test` cobre os geradores, perímetros/áreas/volumes de todas as figuras em todos os níveis, diversidade e repetição recente, projeção dos sólidos, tempo/XP, isolamento de pistas, cooldown e permanência da questão depois do prazo. Também verifica a configuração pública do Auth e mensagens de erro. `npm run lint` e `npm run build` validam o código e as rotas.

No Chrome headless, os fluxos de cadastro, confirmação PKCE, sessão após recarregar, login correto/incorreto, saída, recuperação e troca de senha e Google foram exercitados com respostas de Auth simuladas. Isso valida a aplicação; e-mails reais e consentimento Google dependem das credenciais e da configuração remota acima. As telas de login foram verificadas em 320, 390, 768 e 1440 px sem overflow horizontal.

Também foram verificados o perímetro do trapézio, abertura/fechamento e reinício da fórmula, rotação do prisma, coeficiente de π do círculo, pulo no solo, navegação do visitante e rejeição de pulo pela API real. O treino de geometria foi conferido nas mesmas quatro larguras e com movimento reduzido.

`test:deployment` verifica páginas públicas e configuração de Auth, permissões de banco, evento Realtime, respostas concorrentes com pontuação única por questão, pistas independentes, cooldown, rejeição de pulo, rejeição de respostas de questões concluídas, vitória por meta e transferência do host. Esse teste de integração exige um Supabase configurado. O deploy executa a checagem de segredos no pacote antes de publicar.

A auditoria automatizada axe, com regras WCAG A/AA, foi aplicada às telas de treino, resultado e feed em desktop/mobile. Toque e cancelamento do arraste foram simulados no Chrome. Isso não equivale a uma auditoria completa: Safari, Firefox, leitores de tela e aparelhos físicos não foram verificados.

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

## Quem Escreve Assim? · `/escreve`

Treino público e digitado de redação ENEM: **100 desafios (20 por competência), dez oficinas, cinco propostas autorais e cinco leituras guiadas de redações nota 1000 documentadas pelo INEP**. O piloto de 25 desafios, cinco oficinas, uma proposta e uma leitura foi preparado antes da implementação. Conteúdo estático, sem API paga, geração durante o estudo ou correção automática das produções livres.

O diagnóstico opcional tem dois desafios por competência. Sessões de cinco combinam solução com justificativa e ordenação de blocos; as escolhas podem mudar antes da confirmação. Correção comentada, ajuda, pulo, pausa e avanço manual acompanham o treino. As oficinas passam do exemplo comentado para uma produção curta, autoavaliação e aplicação em outro contexto.

O caderno oferece planejamento opcional, contagem de palavras/parágrafos, retomada e exportação `.txt`. Cada rascunho admite até 20 mil caracteres; concluir preserva uma versão imutável. A revisão permite registrar trecho, dificuldade, mudança e “não sei avaliar”; a comparação mostra versões antes/depois. Avaliações recebidas fora do site ficam ligadas à versão corrigida, identificadas como **informadas pelo aluno**. Notas parciais são aceitas; o total é calculado apenas com as cinco competências. Um total isolado não inventa sua distribuição. Linhas digitais não equivalem às 30 linhas manuscritas; não se exige um número fixo de parágrafos.

Visitantes guardam o estudo neste navegador. Pessoas logadas sincronizam após um segundo sem alterações; falhas mantêm a cópia local e permitem tentar novamente. Edições simultâneas preservam cópias para comparação. O armazenamento local indisponível gera aviso e permite continuar na memória e exportar. Textos e versões são privados; a exclusão limpa o conteúdo remoto e deixa somente identificadores para impedir que um envio antigo o recrie. Outros dispositivos recebem a exclusão ao sincronizar; um dispositivo offline pode manter sua cópia até reconectar. Edições pendentes conflitantes são preservadas em separado.

A importação do visitante é opcional, idempotente, preserva o que já existe na conta e não dá XP retroativo. Cada desafio concede **10 XP somente na primeira resposta totalmente correta, sem ajuda e com conta conectada**. Revisões, produções livres e notas declaradas não dão pontos. O perfil inclui `writing_answers`; XP e tentativa são confirmados em uma transação. Primeira precisão, desempenho em revisões, versões e notas externas aparecem separadamente. As missões e metas dos demais módulos mantêm seus critérios.

```sh
npm run db:push
npm run writing:pilot
npm run writing:validate
npm run test:writing
```

`test:writing` exige o servidor local e o ambiente Supabase existente; cria contas temporárias e as remove ao terminar. `/api/escreve?view=catalog` é público. Progresso, histórico, documentos e gravações exigem token; tabelas e funções de commit só são acessadas pelo servidor. A migração é `20261026001300_writing.sql`.

Curadoria, procedência e limites estão em [docs/writing/review.md](docs/writing/review.md). As leituras apontam para o original, sem reproduzir os textos integralmente. O manifesto `docs/writing/release.json` fixa a edição por hash; não altere itens publicados em silêncio. Relatos podem ser consultados por `npm run writing:reports` e resolvidos com `npm run writing:reports -- --resolve=UUID`. Não há painel editorial ou avaliação de professor dentro da plataforma.

## Quem Lê Assim? · `/le`

Jogo público de memória e interpretação, com **44 conceitos e 264 atividades** em Funções da linguagem, Figuras de linguagem, Literatura e Vanguardas. O piloto de seis conceitos/36 atividades foi conferido antes da ampliação. A edição traz exemplos autorais identificados, excertos em domínio público de Gonçalves Dias e Machado de Assis e duas obras da National Gallery of Art servidas pelo próprio projeto. Não há API paga nem geração de conteúdo durante as partidas.

A trilha **Figuras de linguagem** reúne 14 conceitos/84 atividades: metáfora, comparação, metonímia, personificação, sinestesia, hipérbole, eufemismo, ironia, antítese, paradoxo, anáfora, pleonasmo, aliteração e assonância. O foco é reconhecer a construção e explicar seu efeito no contexto, com aplicações diferentes das cartas. [Recorte, requisitos e fontes](docs/reading/figures.md). A edição 2 preserva integralmente a edição 1 para histórico, respostas pendentes e partidas em andamento; mudar de edição não renova o XP de um item já respondido.

Uma partida de treino combina dois tabuleiros de três pares e quatro aplicações: escolher o conceito e a evidência que sustenta a leitura. Há avanço manual, pulo de aplicação, pausa, encerramento, guia, fontes e ampliação de figuras. O embaralhamento fica estável na partida e muda na próxima; os dois tabuleiros usam exemplos diferentes. O quarto desafio retoma uma dificuldade observada. Conteúdo, controles e feedback respeitam teclado, movimento reduzido e leitura entre 320 e 1440 px.

Visitantes guardam partida, escolhas e histórico neste navegador. Pessoas logadas sincronizam esses dados; a importação opcional do estudo de visitante preserva histórico e revisões, sem XP retroativo nem substituição do progresso já existente na conta. O jogo permanece acessível se o login estiver indisponível. Falhas de armazenamento permitem continuar em memória com aviso; falhas de rede mantêm os eventos vinculados à conta original para tentar novamente.

O progresso distingue **Visto**, **Aplicado** (dois exemplos distintos completos sem ajuda) e **Retido** (também uma revisão correta após sete dias sem exposição registrada). A revisão programada começa pela aplicação, antes das cartas ou do guia. Primeiro erro agenda amanhã; primeiro acerto completo, três dias depois. Acertos em revisões devidas seguem 3/7/14/30/30 dias; erro retorna a um dia. Revisões antecipadas não avançam o calendário. Abrir cartas, consultar guia ou ver a correção após pular conta como exposição. O dia usa `America/Sao_Paulo`; o tempo ativo exclui pausa, aba oculta e inatividade acima de 60 segundos.

Cada aplicação concede **10 XP** somente se a primeira resposta for completamente correta, sem ajuda, fora de revisão e com a conta conectada. Pares, combo, importações e repetições não acrescentam XP. O servidor confere respostas e confirma histórico, estado e totais em uma transação, com controle de concorrência e deduplicação. O perfil ganhou `reading_answers` e soma o XP dos três jogos. Os critérios das missões, metas e contadores do Scroll e Calcula permanecem os mesmos.

```sh
npm run db:push
npm run reading:validate
npm run test:reading
```

`test:reading` exige a aplicação em execução e as variáveis existentes do Supabase; cria duas contas temporárias e as remove ao terminar. Verifica acesso público, isolamento, commit restrito ao servidor, reenvio, concorrência, recompensas, calendário, ajuda, importação e totais. A rota `/api/le` oferece catálogo público (`view=catalog`, com `version` opcional), progresso e histórico autenticados; gravação e importação exigem token válido. As novas tabelas são privadas, e a RPC de commit só aceita o papel de serviço usado pelo servidor.

Fontes, conferência e limites editoriais estão em [docs/reading/review.md](docs/reading/review.md). O conteúdo foi preparado e conferido com assistência de IA, **sem alegar revisão de especialista humano**. O manifesto fixa cada edição por hash; o validador recusa alterar uma edição registrada. Para uma nova edição, preserve a anterior em `READING_VERSIONS`, conserve os IDs e prepare o novo manifesto com `node --experimental-strip-types scripts/reading/validate.mjs --prepare`. Não edite a edição publicada nem renove XP por mudança editorial. Histórico usa a versão da tentativa.

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

## Autenticação com Supabase Auth

`/entrar` e `/cadastro` oferecem e-mail/senha e Google. Há confirmação de e-mail, recuperação em `/recuperar-senha`, nova senha em `/redefinir-senha` e retorno em `/auth/callback`. A sessão persiste no navegador, renova automaticamente e sincroniza o cabeçalho entre abas; “Sair” encerra o acesso neste navegador. Calcula, Lê e Escreve funcionam sem conta; o Scroll exige autenticação. O multiplayer conserva seus tokens de sala independentes.

O Auth reutiliza `@supabase/supabase-js` e as variáveis `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`. `/api/auth/config` entrega apenas esses valores públicos em tempo de execução, sem cache. `SUPABASE_SECRET_KEY` fica no servidor e nos scripts administrativos de importação/teste. O Quem Calcula funciona sem conta; o Quem Scrolla exige autenticação para guardar o histórico e excluir questões já respondidas. Login, cadastro e Google preservam o retorno ao Scroll, sem alterar a URL de callback já configurada. Somente caminhos internos conhecidos são aceitos como destino.

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

## Perfil e progresso da conta

O avatar no cabeçalho abre `/perfil`. A página permite editar nome de 2–60 caracteres, escolher entre seis cores, enviar uma foto JPG/PNG/WebP de até 5 MB e remover a foto. A prévia mostra as alterações antes de salvar; nome, cor e foto são persistidos em Supabase Auth. O nome e avatar do Google são usados inicialmente. A foto enviada é recortada ao centro, reduzida para 512×512 e convertida em WebP no navegador. O bucket público `qe-avatars` limita cada arquivo a 2 MB e permite enviar/remover apenas arquivos da pasta do próprio usuário. Cada substituição usa uma URL nova para evitar cache antigo.

O perfil acumula questões do Scroll, rodadas do Calcula, aplicações do Lê, desafios do Escreve e XP total dos quatro módulos. No solo, respostas enviadas a tempo contam mesmo quando incorretas; no multiplayer, contam os acertos que avançam a pista. No Scroll oficial, cada questão entra na contagem uma vez; as revisões têm indicadores separados. Pulos e expirações sem resposta não contam. O Calcula mantém multiplicador e combo; o Scroll dá 10 XP por acerto e 15 a partir do terceiro acerto seguido, sem multiplicador de tempo e sem repetir XP em revisão. A revanche reinicia o placar da sala, mas preserva o acumulado do perfil.

`qe_study_stats` guarda os totais e só permite ler os dados da própria conta. `qe_study_events` registra o ID único de cada atividade; `qe_record_study_activity` valida o usuário e os limites de XP, confirma evento e totais na mesma transação e ignora reenvios. Não há permissão direta para editar contadores. Atividades pendentes são guardadas separadamente por conta e evento no navegador, para sobreviver a recargas e falhas de rede, e são reenviadas ao reconectar. O progresso do visitante não é atribuído a uma conta posteriormente.

Os contadores começam com esta funcionalidade: o histórico antigo existia apenas na sessão e não pode ser recuperado. Esses totais são pessoais; solo/feed calculam o XP no navegador. Antes de usar esse XP em ranking ou recompensas, será necessário validar as respostas no servidor.

Em outro projeto Supabase, aplique `npm run db:push` antes de publicar. A migração `20261021000200_profile_progress.sql` cria as tabelas, função, bucket e políticas; no projeto atual ela já foi aplicada. Depois, `npm run deploy` publica a interface no Worker.

## Feedback de estudo

No cálculo, o tempo de cada questão pode ser configurado entre 5 e 180 segundos em todas as modalidades, no solo e no multiplayer. O multiplicador é `clamp(tempoPadrãoDoNível / tempoEscolhido, 0.25, 3)`, arredondado para duas casas. O XP é `round(max(0, 20 - floor(segundosDecorridos)) * multiplicador)`: o valor base perde 1 XP por segundo completo, até zero aos 20 segundos. Expirar o prazo também zera o XP disponível. O valor é fixado na resposta correta, e a pausa do solo congela a contagem. Erros, expiração e pular rendem zero, sem retirar XP acumulado. Acertos avançam em 650 ms; erros do solo mantêm 2,3 s para ler a solução.

No multiplayer, cada jogador tem questão, prazo e pista próprios. Acertar avança um passo; errar mantém o jogador na mesma questão. Vence quem primeiro confirmar a meta de 5, 10, 20 ou 30 acertos. O servidor confirma ponto e XP atomicamente. Salas antigas conservam sessões e progresso na atualização. No feed, os acertos valem 10 XP, ou 15 a partir de três seguidos, multiplicados pela razão entre 3 minutos e o prazo escolhido (0,25–3×); sem tempo vale 1×. Os placares mostram o XP da sessão/sala; quando há uma conta conectada, o ganho também é acumulado no perfil.

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
│   ├── entrar/page.tsx            # Login com retorno à ferramenta escolhida
│   ├── cadastro/page.tsx          # Cadastro e confirmação de e-mail
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
│       ├── scroll-feed.tsx        # Modos, filtros, sessão e cronômetro
│       └── question-card.tsx      # Leitura, seleção, confirmação e gabarito
├── data/questions.json            # Mock antigo, fora do bundle da aplicação
└── lib/
    ├── questions.ts               # Contrato público das questões oficiais
    ├── scroll/                    # Contratos, validação, cliente e testes do Scroll
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

O solo aceita 5, 10, 20 ou 30 rodadas, registra o tempo por tentativa, permite pausa e mostra acertos, precisão e tempo médio. A opção Aprender mantém a resolução em passos e exige avanço manual depois da resposta. O prazo usa relógio absoluto; atrasos do navegador não concedem tempo extra. No solo, pular consome uma rodada sem acerto ou XP. O multiplayer não permite pular: não há botão, comando ou troca automática por tempo esgotado. Depois do prazo, a questão permanece e deve ser resolvida, valendo um acerto e zero XP. No Scroll, pular consome o item sem resposta ou XP e permite que ele volte em outro estudo.

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

## Quem Scrolla Assim: ENEM oficial

O Scroll exige conta. A tela de estudo ocupa o viewport no celular e no desktop; a rolagem lê o enunciado e o avanço usa botões. Escolher uma alternativa não envia a resposta: é preciso confirmar em **Responder**. Após confirmar, o gabarito aparece e a próxima questão depende do estudante. O primeiro lote de 100 questões também permite abrir uma explicação em passos, com análise das cinco alternativas.

Após a resposta, **2.002 questões** também oferecem um link para a resolução original na Plataforma Assaad, em nova aba. As associações conferem aplicação regular, caderno azul, ano, número, idioma e conteúdo da questão; 285 itens sem correspondência suficiente continuam sem link. As explicações externas permanecem no site de origem. As próprias continuam disponíveis; o filtro “com explicação na plataforma” se refere a elas. Atualização: `npm run learning:links`; renovação completa: `npm run learning:links -- --refresh`. Cobertura, método e limites estão em [docs/learning/external-resolutions.md](docs/learning/external-resolutions.md).

O ritmo da sessão fica visível em um HUD compacto: acertos seguidos, anúncio dos 15 XP a partir do terceiro acerto inédito e blocos de cinco respostas. Pulos não preenchem os blocos; um erro reinicia o combo e mantém o progresso de respostas. Cada bloco fechado é reconhecido antes do avanço manual. Missões existentes mostram progresso e bônus recebidos; os valores continuam confirmados pelo servidor. Acerto ganha retorno breve e rodapé verde; erro indica a alternativa correta e o caminho de revisão. Som é opcional e movimento reduzido mantém todo o feedback essencial.

O início permite um treino direto de cinco questões. No encerramento, **Mais 5 inéditas** abre outra sessão com os filtros atuais; seleção esgotada oferece outros filtros. Acertos, respostas e XP das questões ficam discriminados; bônus de missões aparecem nas missões e no total da conta. Apenas a questão atual permanece montada. Essas mudanças não adicionam XP, multiplicadores, missões ou penalidades novas, e não alteram acesso, cronômetro ou gabaritos.

Há feed de inéditas, sessões de 5/10/20 questões e revisão de erros/favoritos. Sessões podem usar 1–30 minutos por questão, com três minutos como padrão. Pular ou expirar consome um item da sessão, sem resposta, meta ou XP; a questão pode voltar em outra sessão. Respondidas são excluídas das inéditas por conta, incluindo outros dispositivos. Uma revisão correta retira o item dos erros sem alterar a precisão da primeira resposta. Ao esgotar os filtros, o app oferece revisão ou outra seleção.

Os filtros são área, ano disponível e inglês/espanhol; o idioma afeta só as questões estrangeiras. As preferências e a meta diária de 5/10/20 respostas são salvas na conta. Inéditas e revisões contam uma vez por questão no dia, no fuso `America/Sao_Paulo`. Uma resposta inicia a sequência diária; o nível sobe a cada 100 XP totais dos dois módulos. Tempo ativo desconsidera pausa, aba oculta, espera pela rede e inatividade superior a 60 segundos; é limitado a duas horas por questão. Rascunho, sessão e tempo parcial podem ser retomados no mesmo navegador. As respostas confirmadas acompanham a conta.

`/scrolla/progresso` apresenta primeiras respostas, acertos, precisão, revisões, XP, tempo ativo, evolução de 7/14/28 dias e resultados por área. Histórico e favoritos têm paginação; a questão completa pode ser aberta no histórico. Totais do perfil anteriores ao banco oficial são preservados, sem inventar um histórico retroativo. Eventos pendentes do antigo mock permanecem no armazenamento do navegador; não atribuem pontos ao novo banco nem bloqueiam a fila do Calcula.

O backend usa `GET/POST /api/scroll`, com Bearer token do Supabase Auth validado no servidor. As funções Postgres isolam contas, validam comandos e confirmam resposta, XP e contagem na mesma transação. O item da sessão é a chave de idempotência: reenvios ou respostas concorrentes não pontuam novamente. Gabaritos não saem nos itens pendentes; tabelas de conteúdo e progresso bloqueiam acesso direto por chaves públicas. A revisão não aceita XP enviado pelo navegador. O RPC genérico anterior aceita apenas Calcula.

Só a questão atual é montada. O servidor prepara até três itens e o navegador antecipa as imagens da próxima questão. Textos, tabelas e fórmulas usam `react-markdown`, GFM e KaTeX com `trust: false`; HTML não é executado. As figuras são servidas pelo bucket próprio `qe-enem-assets`, com nomes por hash e cache imutável. Há ampliação em diálogo, foco por teclado e movimento reduzido. O banco autoral antigo não é carregado na aplicação.

### Importação e qualidade do acervo

O acervo inicial vem dos arquivos públicos da [API ENEM](https://github.com/yunger7/enem-api), commit fixo `938c56fbd3b391e03d93316c920a90c3e54842e5`, confrontados com os [gabaritos oficiais do INEP](https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos). A API comunitária não é um serviço oficial do governo. Provas e referências bibliográficas originais são identificadas em cada questão; não há afiliação ao INEP/MEC.

Dos **2.757 registros**, **2.287 questões** passaram na validação inicial e **470 ficaram separadas**. Foram publicadas **1.354 imagens**, cerca de 70 MB, no armazenamento próprio. O relatório com IDs, motivos e correções de área está em [docs/enem-import-report.json](docs/enem-import-report.json). A edição 2010 permanece separada porque os PDFs apontados como gabarito não produziram uma tabela de respostas verificável nesta extração. Outros motivos incluem anulações, divergências, alternativas incompletas, imagens ausentes e contexto que exige revisão.

A validação é conservadora: questões curtas de Natureza/Matemática sem contexto textual suficiente ficam separadas, mesmo que possam estar completas em uma figura. A classificação de área segue a numeração oficial de cada edição, corrigindo metadados inconsistentes da fonte comunitária. A amostragem visual cobre as quatro áreas de cada ano aprovado, incluindo alternativas visuais; **não é uma revisão editorial integral**. Itens identificados manualmente ficam em `scripts/enem/exclusions.json` até correção.

Para reproduzir a importação, instale as dependências Python (`python -m pip install -r scripts/enem/requirements.txt`) e execute, em ordem:

```sh
npm run enem:download
npm run enem:validate
npm run enem:gallery
npm run enem:import
```

O último comando é **dry run**: verifica contagens e hashes sem publicar. A galeria fica em `output/enem/gallery.html`; arquivos brutos, PDFs e imagens de trabalho ficam ignorados pelo Git. Para servir a galeria localmente: `python -m http.server 3011 --bind 127.0.0.1 --directory output/enem`.

Após a conferência visual, `npm run enem:import -- --publish` envia somente os aprovados. Exige `npm run db:push` e as variáveis do Supabase. O registro de conferência está em `docs/enem-import-review.json`; o importador verifica o hash do acervo aprovado contra esse registro. Se a fonte ou normalização mudar, refaça a conferência e atualize o registro antes de publicar. O envio retoma imagens já existentes, mantém IDs estáveis, não altera o histórico e recusa substituir um item cujo conteúdo mudou. Itens separados nunca são ativados.

Testes específicos:

```sh
npm run enem:test
npm run test:scroll
```

O teste de integração exige o servidor em `http://localhost:3000` (ou `SCROLL_TEST_BASE_URL`) e um Supabase configurado. Cria contas temporárias sem enviar e-mails e as remove ao terminar. Verifica concorrência, isolamento, filtros, inéditas, revisão, favoritos, meta, pausa, prazo e integração com o Calcula.

## Entender, revisar e evoluir

A home autenticada tem um **Plano de hoje**: retomar a sessão, fazer revisões devidas ou começar com cinco questões com explicação. Visitantes continuam acessando o Calcula em `/`. No solo, **Aprender** mantém a resolução em passos na tela até avançar manualmente; o ritmo rápido e o multiplayer conservam suas regras.

- **Explicações:** 100 aprovadas, 25 por área, produzidas em arquivos editoriais sem API paga nem geração durante o uso. O gabarito oficial é distinguido da explicação da plataforma. Os filtros de matéria, assunto e conteúdo com explicação mostram a cobertura do piloto. Conteúdo e gabarito ficam protegidos antes da primeira resposta; no histórico, a resolução é carregada somente ao abrir.
- **Revisão programada:** erro inicial agenda um dia; acerto inicial, três. Acertos devidos avançam por 3/7/14/30 dias; erro retorna a um. Revisão antecipada não avança o calendário, mas registra o contato para não simular lembrança após sete dias. A fila inclui questões já estudadas nos dois idiomas. Erros e favoritos continuam disponíveis para revisão manual.
- **Missões:** cinco questões distintas no Scroll rendem 20 XP; até três revisões devidas, 15 XP; cinco acertos no Calcula solo, 15 XP. O objetivo de revisão é fixado no primeiro acesso/atividade do dia e só aparece quando há pendências. Máximo de 50 XP extras por dia, sem XP repetido por questão. Pulos, expiração e eventos antigos não completam a missão do Calcula. Metas e sequência do Scroll continuam iguais.
- **Domínio e conquistas:** domínio requer cinco questões distintas, quatro acertos nas últimas cinco primeiras respostas e, para consolidar, revisão correta depois de pelo menos sete dias. Erro posterior em revisão retira a consolidação. Cinco conquistas registram meta, sequências de três/sete dias, dez revisões e primeiro assunto consolidado. As conquistas não concedem XP adicional.
- **Dados:** tentativas, agendamento e bônus são confirmados na mesma transação, com isolamento por conta e idempotência. Totais antigos e primeiras respostas permanecem. Calcula registra modalidade, resultado e data pelo RPC `qe_record_calculator`; o contrato antigo continua aceito sem elegibilidade retroativa. Esse progresso do Calcula é pessoal e informado pelo navegador, sem validação competitiva das respostas.

### Conteúdo editorial e manutenção

As resoluções revisáveis estão em `scripts/learning/content/`; a taxonomia controlada fica em `scripts/learning/taxonomy.json`. O inventário de versões e hashes está em `docs/learning/pilot-lock.json`, a conferência em `docs/learning/review.json` e os candidatos separados em `scripts/learning/quarantine.json`. Essa conferência assistida não equivale a revisão integral por especialistas humanos.

```sh
npm run learning:validate
npm run learning:import -- --publish
npm run learning:reports
npm run test:learning
```

`learning:validate` não publica. Para mudar conteúdo, aumente a versão com `npm run learning:import -- --prepare --version=2`, confira o lote e atualize o registro de revisão para o novo digest antes de publicar. Uma versão já publicada não pode ser sobrescrita com conteúdo diferente. A reimportação do mesmo lote preserva histórico e XP; versões anteriores ficam arquivadas. Uma mudança no checksum da questão exige nova revisão.

Relatos enviados pelos estudantes ficam privados em `qe_content_reports`. `npm run learning:reports -- --resolve=UUID` encerra um relato; `--withdraw=enem-ANO-regular-NUMERO` retira uma explicação, preservando a questão e as versões arquivadas. Uma versão retirada não pode ser republicada por uma reimportação rotineira. A ferramenta usa exclusivamente a chave administrativa no ambiente local.

Os novos recursos estendem `/api/scroll`: `GET ?view=learning`, `GET ?view=explanation&questionId=…` e `POST {action:"report",questionId,version,category,message}`. A versão informada no relato identifica a explicação que foi lida, inclusive se uma versão nova for publicada enquanto a tela está aberta. Novos filtros: `explanationOnly`, `subject` e `topic`; `mode:"due"` abre a revisão programada. A API valida o token Supabase, impede cache público e mantém as tabelas privadas. Não há serviço de IA em produção.

## Direção visual

- **Tese:** um caderno de estudos contemporâneo, com o treino em primeiro plano e a prática apresentada como um hábito acessível.
- **Âncoras:** papel quente e grafite, terracota nas ações, serifada editorial nos momentos de incentivo; o asterisco identifica o ecossistema.
- **Conteúdo:** configurar → resolver → entender o resultado; no feed, filtrar → ler → responder → aprender.
- **Interação:** estados de seleção, feedback imediato e transições discretas em CSS. Scroll nativo e alternativa por botões; sem efeitos que dependem de hover.
- **Orçamento técnico:** App Router existente, CSS, SVG e Lucide; Markdown/KaTeX para preservar os enunciados oficiais. Layouts de 320 px a desktop; fontes com fallback de sistema, foco visível e movimento reduzido.

O link externo “Quem Pensa Assim?” abre com `target="_blank"` e `rel="noopener noreferrer"`. O solo de cálculo e o Quem Lê Assim funcionam sem credenciais. Scroll e multiplayer exigem as variáveis do Supabase configuradas; o Scroll também exige conta.

## Verificação realizada

`npm test` cobre os geradores, perímetros/áreas/volumes de todas as figuras em todos os níveis, diversidade e repetição recente, projeção dos sólidos, tempo/XP, isolamento de pistas, cooldown e permanência da questão depois do prazo. Também verifica a configuração pública do Auth, mensagens de erro, normalização do perfil, validação de fotos e recuperação de atividades pendentes. `npm run lint` e `npm run build` validam o código e as rotas.

No Chrome headless, os fluxos de cadastro, confirmação PKCE, sessão após recarregar, login correto/incorreto, saída, recuperação e troca de senha e Google foram exercitados com respostas de Auth simuladas. Isso valida a aplicação; e-mails reais e consentimento Google dependem das credenciais e da configuração remota acima. As telas de login foram verificadas em 320, 390, 768 e 1440 px sem overflow horizontal.

Também foram verificados o perímetro do trapézio, abertura/fechamento e reinício da fórmula, rotação do prisma, coeficiente de π do círculo, pulo no solo, navegação do visitante e rejeição de pulo pela API real. O treino de geometria foi conferido nas mesmas quatro larguras e com movimento reduzido.

O perfil foi testado com uma conta temporária no Supabase real: upload/remoção de foto, nome/cor após recarga, cabeçalho, respostas corretas e incorretas, exclusão de pulos, XP do solo/feed/multiplayer e recuperação de uma atividade após falha de rede e recarga. RLS, idempotência, limites de XP e bloqueio de edição direta foram exercitados no banco em uma transação revertida. A API real também rejeitou upload na pasta de outra conta. O perfil foi conferido em 320, 390, 768 e 1440 px, sem overflow horizontal. A conta temporária e seus arquivos foram removidos ao terminar.

`test:deployment` verifica páginas públicas e configuração de Auth, permissões de banco, evento Realtime, respostas concorrentes com pontuação única por questão, pistas independentes, cooldown, rejeição de pulo, rejeição de respostas de questões concluídas, vitória por meta e transferência do host. Esse teste de integração exige um Supabase configurado. O deploy executa a checagem de segredos no pacote antes de publicar.

A auditoria automatizada axe, com regras WCAG A/AA, foi aplicada às telas de treino, resultado e feed em desktop/mobile. Toque e cancelamento do arraste foram simulados no Chrome. Isso não equivale a uma auditoria completa: Safari, Firefox, leitores de tela e aparelhos físicos não foram verificados.

A versão com ENEM oficial passou em 33 testes nativos, quatro testes do importador, integração com o Supabase real, lint e build OpenNext para Cloudflare. A importação foi repetida sem duplicar dados. No Chrome, foram verificados retorno do login por senha e callback em outra aba, escolha antes de confirmar, erro de rede com seleção preservada, favoritos, pausa, histórico, recarga e layouts de 320/390/768/1440 px. A auditoria axe A/AA não encontrou violações nas telas atuais de questão, opções, ampliação, progresso e acesso sem login em desktop/mobile. KaTeX, tabelas, remoção de HTML executável e bloqueio de links inseguros também foram exercitados. Contas temporárias foram removidas; o Worker não foi publicado nesta etapa.

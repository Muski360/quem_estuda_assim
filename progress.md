Original prompt: Implementar o plano Quem Lê Assim? — jogo público de memória e aplicação, 30 conceitos/180 atividades, progresso local e por conta, revisões e XP, com validação prévia de um piloto de 36 atividades.

## Concluído — links de resoluções externas

Pedido aprovado: vincular às resoluções originais da Plataforma Assaad, sem copiar/republicar explicações. Indexador de metadados pela API pública WordPress, com identificação estrita de aplicação regular, caderno azul, ano, número e idioma; conferir enunciado/alternativas contra o acervo local. HTML de resolução não será armazenado nem publicado. Guardar somente URLs, identificadores e evidências numéricas/hash de correspondência; separar casos inconclusivos.

Integração: carregar o catálogo de URLs apenas após resposta; oferecer link identificado para nova aba no estudo e no histórico. Preservar as 100 explicações próprias, gabaritos, filtros e regras de XP. Sem migração ou dependência nova. Testar correspondência, PPL/idiomas, fronteira após resposta, segurança do destino, teclado, celular e build.

Entregue: 2.002 links de 2.287 questões, gerados pela API pública e conferidos por metadados + texto anterior à resolução. 156 candidatos insuficientes e 129 sem candidato identificável permaneceram sem link. Catálogo público sob demanda, com cache compartilhado e fallback para explicação própria; iframe, conteúdo de resolução e arquivos externos não são copiados. Relatório/método em `docs/learning/external-resolutions.md` e evidências JSON. `npm run learning:links` retoma; `--refresh` renova a coleta. Robots, limite de requisições, retomada e destino restrito implementados.

Verificado: 69 testes, lint, TypeScript, Next, OpenNext/Cloudflare, integrações reais Scroll e explicações/missões. 16 URLs diretas amostradas por ano/idioma responderam HTTP 200. Sete auditorias axe e fluxos Chrome 320–1440 px passaram em desenvolvimento e produção: link apenas após resposta, idiomas, PPL, histórico, favorito não respondido, nova aba por teclado, ausência de opener/referrer, partida preservada, falha do catálogo e explicação própria. Worker local entregou os 2.002 registros; pacote sem segredos. Capturas finais inspecionadas. Sem publicação ou commit; destinos e qualidade externos podem mudar. Próxima ação: `npm run dev`, responder no `/scrolla` e abrir a resolução original.

## Concluído — engajamento do Scrolla

Pedido: tornar o Scrolla, jogo principal, mais recompensador e estimular respostas e acertos. Skills awwwards, game-ui-and-hud e develop-web-game aplicadas. Plataformas e entradas já definidas pelo projeto: web, celular/desktop 320–1440 px, toque/mouse/teclado. Questão e ações são informação principal; combo, bloco de cinco e recompensa são sinais secundários compactos. Papel, azul escuro, terracota e verde de acerto preservados.

Escopo: HUD de combo com regra de XP explícita, blocos de cinco respostas (pulos não contam), feedback de acerto/erro, missões existentes visíveis, início e encerramento com próxima ação direta. Reutilizar áudio e celebrações; sem novas regras de XP, tabelas, dependências ou mudança das missões. Conferir acessibilidade, falhas, revisão, restauração e ausência de acúmulo de questões.

Entregue: HUD próprio com três cargas de combo, próximo acerto valendo 15 XP quando aplicável, cinco segmentos de respostas e reconhecimento de bloco concluído. Missões no desktop e início móvel; entrada curta de cinco questões e continuação direta com filtros preservados. Rodapé de acerto e explicação/avanço móveis refinados; erro diferencia gabarito e revisão. Celebração breve com áudio existente; aviso de pulo não atravessa outra ação/sessão. Regras de recompensa e backend preservados. Estado textual de teste não inclui gabarito pendente.

Verificado: 64 testes nativos, lint, TypeScript, Next e OpenNext/Cloudflare. Integrações reais Scroll e missões/explicações passaram. 17 auditorias axe A/AA em Chrome, 320–1440 px: combo, erro, blocos, pulo, pausa, explicação, rede/reenvio, recarga, continuação, revisão sem XP repetido, filtros, esgotamento, teclado e movimento reduzido. Loop develop-web-game com fixture autenticada (mesmo driver, acrescido apenas da preparação de rede/autenticação de teste), captura e estado inspecionados. Artefatos em `output/playwright/scroll-engagement`.

Conferência final: as mesmas 17 auditorias e todos os fluxos passaram também na versão compilada. Tela de 320×568 mantém leitura rolável, uma única questão e botões Entender/Próxima dentro do viewport. Loop e capturas finais de produção inspecionados; varredura do pacote Cloudflare sem segredos de servidor.

Limites: engajamento ainda não medido com estudantes ou aparelhos físicos. Nenhuma migração, dependência, commit ou publicação. Próxima ação de uso: `npm run dev`, abrir `/scrolla` com a conta.

## Concluído

1. Piloto de seis conceitos/36 atividades conferido antes da ampliação; catálogo completo de 30 conceitos/180 atividades, fontes, duas imagens próprias e manifesto imutável da edição 1.
2. Jogo público em `/le`: memória, aplicação, comparação, guia, revisão, álbum, histórico paginado, ajuda, pausa e retomada. HTML semântico; skills awwwards e develop-web-game aplicadas. Nenhuma API paga ou geração durante o estudo.
3. Progresso por conta/visitante, importação sem XP retroativo, confirmação transacional e proteção de reenvios. Migração `20261025001200_reading.sql` aplicada no Supabase; totais antigos e critérios das missões preservados.
4. 48 testes nativos, lint, TypeScript, Next, OpenNext e integrações reais do Lê/Scroll/explicações/multiplayer aprovados. Dez auditorias axe A/AA; fluxos Chrome de 320 a 1440 px, rede, autenticação, armazenamento, teclado, imagens e movimento reduzido conferidos. Contas temporárias removidas.
5. Conferência e limites em `docs/reading/verification.md`. Sem revisão de professor ou medição de aprendizagem com estudantes. Não publicado em produção nem commitado.

Próxima ação de publicação: `npm run deploy`.

## Concluído — Quem Escreve Assim?

Pedido: implementar o plano aprovado de escrita ENEM em `/escreve`, público, digitado, sem IA paga, com treino por competência, redações, versões, revisão e notas externas manuais. Piloto editorial antes de frontend/backend; depois 100 desafios, dez oficinas, cinco propostas e cinco leituras verificadas. Skills awwwards e develop-web-game aplicadas; preservar autenticação, missões e totais existentes.

Direção visual: caderno editorial, revisão visível e texto no centro; papel, azul escuro e terracota. Componentes e som existentes reutilizados, sem dependências novas. Piloto validado antes do backend/UI; lote completo com 100 desafios (20/C), dez oficinas, cinco propostas e cinco leituras nota 1000 verificadas na Cartilha INEP 2024. Fontes, hash e limites em `docs/writing/review.md`.

Entregue: diagnóstico, treino, revisão programada, oficinas e transferência, caderno privado com planejamento e limite de 20 mil caracteres, salvamento por documento, versões imutáveis, revisão explícita, comparação, exportação, exclusão e avaliações externas parciais/completas ou total isolado. Precisão original, revisões e notas externas separadas. Visitante local, conta sincronizada, importação sem XP, conflitos preservados e prevenção de envio para outra conta. Integrações do cabeçalho, plano e perfil; migração `20261026001300_writing.sql` aplicada ao Supabase.

Verificado: 61 testes nativos, lint, TypeScript, Next, OpenNext e pacote sem segredos. Integrações reais do Escreve em Next e no Worker local; regressões Lê, Scroll, missões/explicações e multiplayer aprovadas. Chrome 320–1440 px: 19 auditorias axe A/AA; fluxo completo de redação, notas, versões, importação, rede/401, armazenamento indisponível, conflitos entre abas/dispositivos, contas, oficina e revisões. Cursor móvel e contraste corrigidos. Capturas finais e loop develop-web-game inspecionados; contas temporárias removidas.

Limites: sem revisão de professor, teste com estudantes ou aparelhos físicos; nenhum commit ou publicação. Não há correção automática ou nota para texto livre. Próxima ação de publicação: `npm run deploy`.

## Concluído — figuras de linguagem

Pedido: levantar requisitos e implementar as principais figuras úteis ao ENEM, sem cobrir todas. Requisitos e fontes em `docs/reading/figures.md`: 14 conceitos, 84 atividades autorais; nova trilha e catálogo v2 com 44 conceitos/264 atividades. Edição 1 preservada para partidas, respostas pendentes e histórico; IDs e regras de recompensa mantidos. Sem nova migração ou dependência.

Conteúdo preparado: metáfora, comparação, metonímia, personificação, sinestesia, hipérbole, eufemismo, ironia, antítese, paradoxo, anáfora, pleonasmo, aliteração e assonância. Recortes explícitos nos itens com recursos coexistentes; evidências relacionam procedimento e efeito. Sem ranking próprio de incidência, geração em tempo de jogo ou revisão humana alegada.

Verificações concluídas: 53 testes nativos, 16 testes do Lê, hashes das duas edições, lint, TypeScript, Next e OpenNext/Cloudflare. Integração real do Lê confirma nova trilha, preferência, concorrência, XP único entre edições e perfil. Chrome 320–1440 px, 12 auditorias axe A/AA, partidas completas, importação, rede/autenticação, guia, teclado e movimento reduzido aprovados. Sessão v1 retomada preserva escolha, tempo ativo e versão do evento. Capturas do loop develop-web-game e jogo foram inspecionadas; contas temporárias removidas.

Limites: sem revisão de professor, estudantes ou aparelhos físicos. Nenhuma publicação ou commit nesta atualização. Detalhes em `docs/reading/verification.md`, seção edição 2.

Próxima ação de publicação: `npm run deploy`.

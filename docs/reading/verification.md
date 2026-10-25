# Verificação do Quem Lê Assim?

Data: 25/10/2026. Conferência na aplicação compilada em produção local, com Supabase real e Chrome automatizado. O Worker não foi publicado.

## Edição 1 — resultado

| Verificação | Resultado |
| --- | --- |
| Testes nativos (`npm test`) | 48 aprovados, incluindo o Lê, autenticação, perfil, geradores e multiplayer |
| Conteúdo (`npm run reading:validate`) | 30 conceitos, 180 atividades, fontes e duas imagens com hashes conferidos; edição 1 preservada |
| Integração do Lê (`npm run test:reading`) | Acesso público, isolamento entre contas, permissões, concorrência, reenvio, calendário, retenção, ajuda, importação, histórico e totais aprovados |
| Regressões (`test:scroll`, `test:learning`, `test:deployment`) | Scroll, 100 explicações, agendamento, domínio, missões até 50 XP/dia e multiplayer aprovados |
| Código e publicação | Lint, TypeScript, Next e OpenNext/Cloudflare aprovados; nenhuma dependência nova necessária |

Uma execução inicial do teste de multiplayer excedeu a espera de cinco segundos pelo evento Realtime. A repetição recebeu o evento e concluiu concorrência, cooldown, vitória e saída do host. Os arquivos do multiplayer não tiveram alteração funcional nesta entrega.

## Edição 1 — navegador

- Home em 320, 390, 768 e 1440 px; leitura, feedback, guia, resultado e perfil sem overflow horizontal. Dez auditorias axe WCAG A/AA passaram após aguardar as animações finitas do perfil.
- Partida completa, pareamento incorreto/correto, seleção alterável, quatro aplicações, pulo, ajuda direta e consulta ao guia de outro conceito, pausa, encerramento e recarga. Apenas o tabuleiro ou aplicação atual permanece montado. O retorno dos pares mantém a próxima ação visível no celular.
- Revisão começa pela aplicação; uma revisão tardia correta alcança Retido. Histórico de visitante passa de 40 a 45 registros ao carregar mais. Trilhas mistas mantêm alternativas da mesma categoria. Tempo ativo confirmado persiste ao pausar e recarregar.
- Duas contas temporárias exercitaram importação sem XP retroativo, retomada em outro contexto de navegador, saída sem expor o histórico da conta, perfil e sincronização após falhas de conexão e resposta 401. Jogo público também funcionou com Auth indisponível e armazenamento local falhando.
- Teclado: abrir guia por Enter, selecionar rádios com Space, responder com Enter e fechar a ampliação por Escape. Movimento reduzido desativa animação da carta. As duas obras foram inspecionadas visualmente; a ampliação usou a imagem própria de Juan Gris.

O loop da skill develop-web-game também foi executado com captura de imagem e `render_game_to_text`; o jogo usa HTML semântico e não depende de canvas ou de um relógio de simulação. Os artefatos locais ficam em `output/playwright/le-qa/`, ignorados pelo Git. Contas temporárias foram removidas pelos testes em blocos `finally`.

## Limites

Não houve sessão com estudantes para medir aprendizagem, revisão de professor, teste em aparelho físico ou operação manual de leitor de tela. Safari e Firefox não foram exercitados nesta entrega. Auditoria automática de acessibilidade não equivale a certificação. O OpenNext emitiu seu aviso habitual de suporte parcial ao Windows, e o build terminou com sucesso; a execução do Worker em produção depende da publicação.

Regras editoriais e procedência: [review.md](review.md). A migração `20261025001200_reading.sql` foi aplicada sem reescrever os totais existentes. Para publicar o frontend e o Worker: `npm run deploy`.

## Edição 2 — figuras de linguagem

Em 25/10/2026, a nova trilha acrescentou 14 conceitos e 84 atividades autorais. Os requisitos e as referências estão em [figures.md](figures.md). O catálogo anterior conserva seu hash; os 30 conceitos/180 atividades da edição 1 continuam disponíveis para histórico, partidas e respostas pendentes.

| Verificação | Resultado desta atualização |
| --- | --- |
| Testes e conteúdo | 53 testes nativos aprovados; 16 testes do Lê e validação dos dois manifestos aprovados. Conteúdo total: 44 conceitos/264 atividades; IDs, exemplos distintos, evidências e contrastes conferidos |
| Integração real (`test:reading`) | Catálogo v1/v2, preferência da nova trilha, rejeição de item futuro na edição antiga, sessão v1, concorrência e recompensa única, isolamento e totais do perfil aprovados; Calcula preserva os totais do Lê |
| Navegador Chrome | Partida completa de figuras, seleção da trilha com 14 opções, preferência após recarga, guia, ajuda, pares certos/errados, interpretação, resultado, histórico, importação, XP, rede indisponível, resposta 401 e troca de contexto aprovados |
| Compatibilidade e acessibilidade | Retomada visual da edição 1 mantém escolha, 4,2 s de tempo ativo e versão da nova tentativa. Home em 320/390/768/1440 px; figuras e cartas abertas em 320/1440 px; 12 auditorias axe A/AA sem violações; teclado e movimento reduzido aprovados |
| Código e empacotamento | Lint, TypeScript, Next e OpenNext/Cloudflare concluídos; nenhum pacote ou migração adicional |

Foram inspecionadas capturas da seleção, cartas abertas, aplicação e guia. O loop da skill develop-web-game foi executado com estado textual e screenshot. Artefatos ignorados em `output/playwright/le-figures-qa/` e `output/playwright/le-figures-game-loop/`. Contas temporárias removidas. Scroll e Calcula passaram pelas regressões nativas; suas suítes remotas completas da edição 1 não foram repetidas, pois esta atualização não altera suas operações.

Continuam os limites de revisão editorial assistida por IA, sem professor ou avaliação com estudantes, aparelhos físicos e outros navegadores. Não houve deploy nesta atualização.

Original prompt: Implementar o plano Quem Lê Assim? — jogo público de memória e aplicação, 30 conceitos/180 atividades, progresso local e por conta, revisões e XP, com validação prévia de um piloto de 36 atividades.

## Concluído

1. Piloto de seis conceitos/36 atividades conferido antes da ampliação; catálogo completo de 30 conceitos/180 atividades, fontes, duas imagens próprias e manifesto imutável da edição 1.
2. Jogo público em `/le`: memória, aplicação, comparação, guia, revisão, álbum, histórico paginado, ajuda, pausa e retomada. HTML semântico; skills awwwards e develop-web-game aplicadas. Nenhuma API paga ou geração durante o estudo.
3. Progresso por conta/visitante, importação sem XP retroativo, confirmação transacional e proteção de reenvios. Migração `20261025001200_reading.sql` aplicada no Supabase; totais antigos e critérios das missões preservados.
4. 48 testes nativos, lint, TypeScript, Next, OpenNext e integrações reais do Lê/Scroll/explicações/multiplayer aprovados. Dez auditorias axe A/AA; fluxos Chrome de 320 a 1440 px, rede, autenticação, armazenamento, teclado, imagens e movimento reduzido conferidos. Contas temporárias removidas.
5. Conferência e limites em `docs/reading/verification.md`. Sem revisão de professor ou medição de aprendizagem com estudantes. Não publicado em produção nem commitado.

Próxima ação de publicação: `npm run deploy`.

## Concluído — figuras de linguagem

Pedido: levantar requisitos e implementar as principais figuras úteis ao ENEM, sem cobrir todas. Requisitos e fontes em `docs/reading/figures.md`: 14 conceitos, 84 atividades autorais; nova trilha e catálogo v2 com 44 conceitos/264 atividades. Edição 1 preservada para partidas, respostas pendentes e histórico; IDs e regras de recompensa mantidos. Sem nova migração ou dependência.

Conteúdo preparado: metáfora, comparação, metonímia, personificação, sinestesia, hipérbole, eufemismo, ironia, antítese, paradoxo, anáfora, pleonasmo, aliteração e assonância. Recortes explícitos nos itens com recursos coexistentes; evidências relacionam procedimento e efeito. Sem ranking próprio de incidência, geração em tempo de jogo ou revisão humana alegada.

Verificações concluídas: 53 testes nativos, 16 testes do Lê, hashes das duas edições, lint, TypeScript, Next e OpenNext/Cloudflare. Integração real do Lê confirma nova trilha, preferência, concorrência, XP único entre edições e perfil. Chrome 320–1440 px, 12 auditorias axe A/AA, partidas completas, importação, rede/autenticação, guia, teclado e movimento reduzido aprovados. Sessão v1 retomada preserva escolha, tempo ativo e versão do evento. Capturas do loop develop-web-game e jogo foram inspecionadas; contas temporárias removidas.

Limites: sem revisão de professor, estudantes ou aparelhos físicos. Nenhuma publicação ou commit nesta atualização. Detalhes em `docs/reading/verification.md`, seção edição 2.

Próxima ação de publicação: `npm run deploy`.

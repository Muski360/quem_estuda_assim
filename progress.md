Original prompt: Implementar o plano Quem Lê Assim? — jogo público de memória e aplicação, 30 conceitos/180 atividades, progresso local e por conta, revisões e XP, com validação prévia de um piloto de 36 atividades.

## Concluído

1. Piloto de seis conceitos/36 atividades conferido antes da ampliação; catálogo completo de 30 conceitos/180 atividades, fontes, duas imagens próprias e manifesto imutável da edição 1.
2. Jogo público em `/le`: memória, aplicação, comparação, guia, revisão, álbum, histórico paginado, ajuda, pausa e retomada. HTML semântico; skills awwwards e develop-web-game aplicadas. Nenhuma API paga ou geração durante o estudo.
3. Progresso por conta/visitante, importação sem XP retroativo, confirmação transacional e proteção de reenvios. Migração `20261025001200_reading.sql` aplicada no Supabase; totais antigos e critérios das missões preservados.
4. 48 testes nativos, lint, TypeScript, Next, OpenNext e integrações reais do Lê/Scroll/explicações/multiplayer aprovados. Dez auditorias axe A/AA; fluxos Chrome de 320 a 1440 px, rede, autenticação, armazenamento, teclado, imagens e movimento reduzido conferidos. Contas temporárias removidas.
5. Conferência e limites em `docs/reading/verification.md`. Sem revisão de professor ou medição de aprendizagem com estudantes. Não publicado em produção nem commitado.

Próxima ação de publicação: `npm run deploy`.

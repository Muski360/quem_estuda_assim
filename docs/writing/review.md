# Quem Escreve Assim? — conferência editorial

## Piloto · 26/10/2026

25 desafios (cinco por competência), cinco oficinas, uma proposta e uma leitura preparados antes da interface e do backend. Conteúdo didático autoral, com assistência de IA no desenvolvimento, sem geração durante o estudo ou revisão de professor alegada. Escolhas possuem solução e justificativa; ordenações delimitam explicitamente a relação e a ordem pedida. Produções abertas admitem soluções variadas e não recebem correção automática nem nota.

Primeira leitura: Bruno Henrique Alves dos Santos, ENEM 2023. A Cartilha do INEP de 2024 identifica a seção como textos nota 1.000, individualiza o autor no item 9 e comenta suas competências nas páginas impressas 59–61. O expediente permite reprodução com fonte; esta versão utiliza referência ao documento e comentários próprios, sem transcrever a redação. Cópia consultada: https://guiadoestudante.abril.com.br/wp-content/uploads/sites/4/2024/10/cartilha-de-redacao-enem-2024.pdf. O exemplo mostra que uma ocorrência pontual apontada pelo comentário oficial não equivale automaticamente a nota baixa; não ensinamos que qualquer desvio isolado define toda a avaliação.

Critérios: pertinência ao tema; justificativa sustentada pelo trecho; distinção entre hipótese e dado; repertório explicado; intervenção coerente e com respeito a direitos. Fontes temáticas são referências para aprofundamento, não atribuição dos textos autorais a essas instituições. Situações hipotéticas estão identificadas. Conteúdo ambíguo deve ser retirado e registrado em quarentena antes da publicação. Relatos não alteram automaticamente gabaritos nem versões históricas.

Base pedagógica: https://ies.ed.gov/ncee/wwc/PracticeGuide/22. Critérios atuais: https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/enem/enem-2026-cartilha-da-redacao-esta-disponivel. Registro de notas externas é informado pelo aluno e vinculado à versão corrigida; não constitui verificação de autenticidade pelo site.

## Lote completo · edição 1

100 desafios: 20 por competência, com 80 atividades de solução + justificativa e 20 ordenações. Dez oficinas: duas por competência, cada uma com exemplo, comentário, produção, três critérios e transferência para outro contexto. Cinco propostas autorais: acesso à leitura, inclusão digital de pessoas idosas, permanência escolar, participação de pessoas com deficiência em espaços culturais e educação midiática.

Conferência de conteúdo: a solução canônica é o primeiro elemento dos arquivos; no jogo as opções são embaralhadas. Justificativas explicam por que as outras soluções não atendem à tarefa. Ordenações anunciam o encadeamento exigido, sem tratar qualquer outra estrutura de redação como errada. O validador confere contagens, unicidade, alternativas, justificativas, estruturas, quarentena e hash. Essa validação estrutural não substitui revisão pedagógica humana.

As cinco leituras foram conferidas na publicação primária **INEP, A Redação no Enem 2024 — Cartilha do Participante**, edição do exame de 2023. O arquivo consultado está hospedado pelo Guia do Estudante; autoria e comprovação são do INEP. A biblioteca usa referência ao original, perguntas de observação e comentários autorais breves, sem transcrever os textos nem reproduzir suas imagens.

| Autor | Item | Página impressa | Página no PDF |
| --- | --- | --- | --- |
| Bruno Henrique Alves dos Santos | 9 | 59 | 61 |
| Amanda Teixeira Zampiris | 1 | 35 | 37 |
| Lucas Malta de Carvalho | 2 | 38 | 40 |
| Ana Luiza Teodoro Coutinho Loureiro | 4 | 44 | 46 |
| Mariane Clementino Barbosa | 7 | 53 | 55 |

A seção identifica as redações como nota 1.000. Os comentários oficiais seguintes ajudam a conferir a leitura; o aluno também recebe uma pergunta antes de revelar a análise da plataforma. A seleção permite comparar escolhas sobre um mesmo tema; não pretende representar todos os anos ou estilos possíveis. A tese é trabalhada com o recorte temático e o desenvolvimento, sem ensinar uma introdução obrigatória.

Arquivo consultado, 70 páginas: [Cartilha 2024 do INEP, cópia do Guia do Estudante](https://guiadoestudante.abril.com.br/wp-content/uploads/sites/4/2024/10/cartilha-de-redacao-enem-2024.pdf). SHA-256: `6d43d380bbdb6edf6a669f8a044c33dd89e7474b9660c599a44ef6b26d796b82`. Expediente consultado na terceira página do PDF: reprodução permitida com indicação da fonte. A referência completa permanece em cada leitura. Temas motivadores e atividades são identificados como textos didáticos autorais; não são redações reais nem propostas oficiais.

## Operação editorial

Arquivos revisáveis em `src/data/writing/`; recibo em `docs/writing/release.json`. A edição 1 foi fechada após a ampliação, antes da publicação. Não substitua itens já publicados nem reescreva o histórico. Uma nova edição deve conservar IDs e conteúdo da anterior, ampliar o catálogo de versões e atualizar a validação e a API antes de ser disponibilizada.

`scripts/writing/quarantine.json` separa itens indisponíveis; o validador recusa a presença desses IDs no catálogo. Ele não remove conteúdo automaticamente. Para retirar uma atividade, remova-a explicitamente do conjunto publicável e registre motivo e versão. O lote atual não contém itens em quarentena.

`npm run writing:reports` lista até 100 relatos abertos, em ordem de chegada, sem consultar redações particulares. `npm run writing:reports -- --resolve=UUID` resolve o relato. A ferramenta exige o ambiente administrativo local; não deve ser exposta ao navegador. Relatos podem conter texto informado pelo próprio aluno: não inclua esse conteúdo em telemetria ou arquivos públicos.

## Verificações realizadas · 26/10/2026

61 testes nativos passaram, incluindo integridade editorial, sessão, ordenação, deduplicação, primeira precisão separada de revisões, XP, calendário de São Paulo, revisões antecipadas, versões imutáveis e notas parciais ou totais. Lint sem avisos. A integração real do Escreve com duas contas temporárias verificou tabelas privadas, isolamento, concorrência, reenvios, importação sem XP, edição por revisão, versões, notas, relatos e exclusão com proteção contra recriação por envio antigo. Todas as contas de teste foram removidas.

Chrome entre 320 e 1440 px: diagnóstico de dez itens, sessões de cinco, escolhas antes da confirmação, ajuda, pulo, ordenação por teclado, recarga, retomada, exportação, limite de colagem, abas móveis sem desmontar o texto nem perder seleção, revisão, nota total sem distribuição inventada, reescrita, comparação e biblioteca. Testados também importação, falta de rede, resposta 401 com nova tentativa, conflito entre dispositivos preservando os dois textos, segunda sessão, outra conta, logout, armazenamento indisponível, exclusão, oficina com transferência, duas abas concorrentes e revisão devida sem XP. Apenas a atividade atual fica montada. Foram 14 auditorias axe de critérios A/AA sem violações, sem erros JavaScript não tratados.

Regressões reais do Lê, Scroll, explicações/missões e multiplayer passaram, incluindo isolamento, pontos únicos, gabarito privado do Scroll, teto de 50 XP de missões e recusa de pulo no multiplayer. Artefatos locais ficam em `output/playwright/writing-qa` e não fazem parte da publicação. Não se registram conteúdos de redação em logs de uso.

Compilação final: TypeScript, Next e OpenNext/Cloudflare aprovados; varredura do pacote sem segredos de servidor. A suíte real do Escreve passou também no Worker local (`workerd`, porta 8787). Na versão compilada, outras cinco auditorias axe passaram, com capturas da abertura, editor, formulário de notas completas/parciais e página servida pelo Worker. O total de 840 só foi calculado após as cinco notas; um registro com somente C3 preservou os demais campos desconhecidos. O loop oficial da skill develop-web-game foi executado e sua captura e estado foram inspecionados. Nenhuma publicação em produção foi feita.

Limites: conteúdo preparado e conferido com assistência de IA; sem revisão de professor alegada, teste com estudantes, leitor de tela por pessoa ou aparelhos físicos. Não há validação automática da qualidade de texto livre, autenticidade de notas externas ou eficácia pedagógica comprovada. Cópias locais pertencem ao navegador: um dispositivo offline não pode ser apagado remotamente; ao reconectar, recebe a exclusão, preservando em separado edições pendentes conflitantes.

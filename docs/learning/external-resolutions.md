# Resoluções externas · Plataforma Assaad

Implementado em 26/10/2026, conforme a escolha de **vincular ao site original**. Não há reprodução, incorporação em iframe ou hospedagem das explicações da Assaad. As 100 explicações próprias permanecem disponíveis. O gabarito exibido pelo Scrolla continua vindo do acervo conferido com o INEP.

## Cobertura

2.002 das 2.287 questões do banco receberam um link por correspondência automática conservadora. Foram identificados 2.158 candidatos compatíveis com o acervo; 156 não atingiram os critérios textuais. Outras 129 questões não tiveram candidato identificável. As 285 questões sem correspondência aprovada continuam disponíveis normalmente, sem URL presumida.

| Ano | Questões vinculadas |
| --- | ---: |
| 2009 | 163 |
| 2011 | 108 |
| 2012 | 154 |
| 2013 | 139 |
| 2014 | 130 |
| 2015 | 131 |
| 2016 | 117 |
| 2017 | 162 |
| 2018 | 157 |
| 2019 | 155 |
| 2020 | 161 |
| 2021 | 140 |
| 2022 | 133 |
| 2023 | 152 |

2010 não faz parte do acervo aprovado atual. PPL, reaplicações, prova digital e outros cadernos não são associados às questões regulares azuis. Inglês e espanhol possuem IDs e destinos distintos.

## Origem e correspondência

O índice público [Blog de questões](https://plataformaassaad.com.br/blog/provas/) identifica anos e aplicações. O indexador usa a API pública WordPress, consultando somente posts publicados; o robots foi consultado antes da execução e não restringia esse caminho. Há uma pausa mínima de 600 ms entre requisições, timeout, tentativas limitadas para falhas transitórias e respeito a `Retry-After`. Erros 403 ou outros bloqueios interrompem a execução.

Primeiro são coletados ID do post, título e URL. Só os candidatos regulares do caderno azul presentes no banco recebem a conferência textual. O HTML é lido temporariamente; o parser para no início da resolução, gabarito ou seções de comentário. O texto da resolução não participa da correspondência nem é armazenado. O enunciado e alternativas são comparados ao acervo local; permanecem somente contagens, resultado e hash. Não são baixadas imagens da Assaad.

A aprovação exige identificação compatível e uma destas evidências: comando com pelo menos 25 caracteres normalizados e três alternativas textuais coincidentes; comando e dois fragmentos longos de contexto coincidentes; ou três fragmentos de contexto e duas alternativas coincidentes. Fragmentos precisam de pelo menos 70 caracteres normalizados. A fronteira anterior à resolução precisa ser reconhecida. Casos com fórmulas, imagens ou extração insuficiente podem ficar de fora por precaução. Não se presume equivalência apenas pelo número da questão.

O arquivo [external-resolutions.json](external-resolutions.json) registra evidências, checksum do banco, URL, ID do post, data de conferência e itens sem correspondência. A amostra de links diretos inclui uma questão de cada ano e os dois idiomas: 16 URLs responderam HTTP 200. A validação textual foi feita nos candidatos via API; não houve revisão editorial humana de todas as resoluções externas nem teste HTTP individual dos 2.002 destinos.

## Operação

```sh
npm run learning:links
npm run learning:links -- --refresh
```

O primeiro comando retoma pelo cache em `output/external-resolutions/`, sem duplicar o catálogo. `--refresh` renova inventário e conferência; use-o depois de mudanças no site ou no algoritmo. É necessário ter `output/enem/approved.json` do importador. O script usa Node e o parser HTML já instalado no projeto; não requer segredo, login da Assaad ou API paga. Os caches contêm metadados e hashes, sem corpos de páginas ou resoluções.

O catálogo público [scroll-resolutions.json](../../public/data/scroll-resolutions.json) contém apenas IDs e caminhos. Ele é carregado do próprio aplicativo depois de uma resposta confirmada e reutilizado durante a navegação. Não há consulta à Assaad durante a leitura da questão. O aluno só acessa o site externo ao escolher o link. Se o catálogo estiver indisponível, a partida continua e as explicações próprias permanecem utilizáveis.

No estudo e no histórico de questões respondidas, o destino é identificado como **Plataforma Assaad**, abre em nova aba e usa `noopener noreferrer`. Não se envia token de sessão ou referência da página de estudo. Favoritos ainda não respondidos não mostram resolução. O filtro “com explicação na plataforma” continua indicando o conteúdo próprio aprovado; os links externos não alteram esse filtro, XP, metas, missões ou o histórico.

## Validação

69 testes nativos, incluindo parser, separação de aplicação/caderno/idioma, evidência anterior ao comentário, robots, catálogo e segurança do destino. Reexecução do indexador produziu catálogo idêntico. Integrações reais do Scroll e explicações/missões passaram, com gabarito privado e pontos sem duplicação.

Chrome 320/390/768/1440 px: sete auditorias axe A/AA sem violações. Testados link após resposta, catálogo sob demanda, nova aba por teclado, ausência de `window.opener` e referrer, partida preservada, recarga, explicação própria junto da externa, questão desconhecida, PPL rejeitado, idiomas distintos, histórico respondido e favorito ainda não respondido. A falha do catálogo não bloqueou resolução própria ou próxima questão. Movimento reduzido e foco foram conferidos. Artefatos locais: `output/playwright/external-resolutions/`.

Lint, TypeScript, Next e build OpenNext/Cloudflare aprovados. Os mesmos fluxos e sete auditorias passaram também na versão compilada. O Worker local entregou o catálogo completo em `application/json`, idêntico ao arquivo incluído no pacote. A varredura do pacote não encontrou segredos de servidor. Não houve migração, dependência nova ou publicação em produção.

Limites: disponibilidade e conteúdo do destino externo podem mudar. Associação automática não certifica a qualidade pedagógica da resolução de terceiros. Sem testes em aparelhos físicos, avaliação humana integral ou publicação em produção nesta atualização.

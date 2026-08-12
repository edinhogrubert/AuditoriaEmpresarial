# 📑 Manual de Operação e Guia Técnico
## Sistema de Inventário & Auditoria Patrimonial (v2.2)

> **Este manual detalha o funcionamento, as telas e os fluxos de lógica do aplicativo para usuários, gestores e desenvolvedores.**
> Todas as telas são mapeadas diretamente aos componentes React (`.tsx`) do projeto.

---

## 📱 Sumário
1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Arquitetura de Telas & Componentes (`.tsx`)](#2-arquitetura-de-telas--componentes-tsx)
3. [Manual de Telas (Passo a Passo)](#3-manual-de-telas-passo-a-passo)
   - [Dashboard Principal (`MainScreen.tsx`)](#dashboard-principal-mainscreentsx)
   - [Criação de Novo Lote (`NewBatchScreen.tsx`)](#criação-de-novo-lote-newbatchscreentsx)
   - [Leitura de Campo / Scanner (`VerificationScanScreen.tsx` / `CameraScanner.tsx`)](#leitura-de-campo--scanner-verificationscanscreentsx)
   - [Detalhes do Lote & Indicadores (`BatchDetailsScreen.tsx`)](#detalhes-do-lote--indicadores-batchdetailsscreentsx)
   - [Central de Importação (`ImportInventoryScreen.tsx`)](#central-de-importação-importinventoryscreentsx)
   - [Relatórios & Dossiê de Divergências (`AuditResultsScreen.tsx`)](#relatórios--dossiê-de-divergências-auditresultsscreentsx)
   - [Histórico de Operações & Rastreabilidade (`AuditLogScreen.tsx`)](#histórico-de-operações--rastreabilidade-auditlogscreentsx)
4. [Lógicas Especiais de Integração & Dados (Offline-First)](#4-lógicas-especiais-de-integração--dados-offline-first)
   - [Fatiamento e Transferência via QR Code (`qrChunker.ts`)](#fatiamento-e-transferência-via-qr-code-qrchunkerts)
   - [Importador de QR Code Multi-partes (`QrImportScannerScreen.tsx`)](#importador-de-qr-code-multi-partes-qrimportscannerscreentsx)
   - [Central de Backup Inteligente: REPLACE vs. MERGE (`SettingsScreen.tsx`)](#central-de-backup-inteligente-replace-vs-merge-settingsscreentsx)
5. [Fluxos do Dia a Dia (Guia Prático)](#5-fluxos-do-dia-a-dia-guia-prático)

---

## 1. Visão Geral do Sistema

O aplicativo **Inventário & Auditoria Patrimonial** foi projetado para operar de forma totalmente **offline** em dispositivos móveis e coletores de dados, garantindo que equipes em armazéns, escritórios ou locais remotos sem internet consigam realizar auditorias e conferências de ativos físicos sem interrupções.

### Objetivos do Sistema:
* **Eliminar erros manuais** de digitação de códigos de barras ou patrimônios.
* **Controlar duplicidades** em tempo real no campo (evitar contar o mesmo ativo duas vezes).
* **Garantir conciliação instantânea**: saber na hora o que foi encontrado, o que está faltando e o que é excedente.
* **Agilizar o fluxo de dados**: transferir lotes de dados entre aparelhos de forma 100% offline utilizando QR Codes dinâmicos de alta capacidade.

---

## 2. Arquitetura de Telas & Componentes (`.tsx`)

A estrutura do projeto segue as melhores práticas de modularidade no React, mapeando cada tela principal para seu respectivo arquivo `.tsx` na pasta `src/components/`:

```
src/
├── components/
│   ├── MainScreen.tsx             # Dashboard geral com KPIs e atalhos rápidos
│   ├── NewBatchScreen.tsx          # Tela de abertura de novos lotes de auditoria
│   ├── BatchListScreen.tsx         # Listagem de todos os lotes cadastrados no aparelho
│   ├── CameraScanner.tsx           # Componente de câmera integrado com feedback visual
│   ├── VerificationScanScreen.tsx  # Scanner de auditoria contra lista mestra esperada
│   ├── BatchScanScreen.tsx         # Scanner simples para contagem geral (sem lista mestre)
│   ├── SequentialScanScreen.tsx    # Leitor contínuo ultrarrápido com memória temporária
│   ├── BatchDetailsScreen.tsx      # Central de gestão do lote, barra de progresso e ações
│   ├── AuditResultsScreen.tsx      # Dossiê de divergências detalhado e filtros de auditoria
│   ├── ImportInventoryScreen.tsx   # Central para carregar arquivos de ativos esperados
│   ├── ExportBatchesScreen.tsx     # Exportação de lotes consolidados (CSV, JSON, QR Code)
│   ├── SettingsScreen.tsx          # Configurações do sistema, políticas e exportação de backups
│   ├── BackupModal.tsx             # Modal interativo de recuperação e mesclagem de backup
│   ├── QrCodeExportModal.tsx       # Modal de fatiamento e exibição de QR Code inteligente
│   └── QrImportScannerScreen.tsx   # Scanner receptor de transferência de lote via QR Code
├── services/
│   └── storage.ts                  # Engine de persistência em LocalStorage e gerador de CSV
├── utils/
│   ├── qrChunker.ts                # Lógica de fatiamento (chunking) e fusão de dados JSON
│   └── qrDecoder.ts                # Leitor de imagem estática de QR Code via upload de arquivos
└── types.ts                        # Definição dos tipos TypeScript do projeto
```

---

## 3. Manual de Telas (Passo a Passo)

### Dashboard Principal (`MainScreen.tsx`)
A primeira tela exibida ao abrir o sistema. Ela atua como a torre de controle do operador de campo.

* **Indicadores Executivos (KPIs)**:
  * **Total de Ativos**: Soma de todas as leituras válidas feitas no aparelho.
  * **Lotes Pendentes**: Quantidade de inventários em andamento.
  * **Lotes Concluídos**: Quantidade de inventários fechados e prontos para envio.
* **Atalhos de Acesso Rápido**:
  * **Abertura de Lotes**: Direciona para criação de novo inventário.
  * **Leitura Contínua**: Acesso ao leitor rápido sem lote associado.
  * **Importador Geral**: Área para carregar dados externos.
  * **Configurações**: Ajuste de permissões e backups.
* **Feed de Atividades Recentes**: Mostra os últimos registros de leitura com carimbo de data, hora e lote correspondente para rápida orientação.

---

### Criação de Novo Lote (`NewBatchScreen.tsx`)
Para iniciar qualquer coleta de dados, é obrigatório criar um lote de trabalho, o que organiza as leituras cronológica e geograficamente.

* **Tipos de Inventários Disponíveis**:
  1. **Auditoria / Verificação**: Exige a importação prévia de uma Lista Mestra (ativos esperados). O sistema irá calcular divergências (OK, Faltantes, Extras).
  2. **Inventário Simples (Contagem Geral)**: Não exige lista prévia. O operador simplesmente sai lendo os códigos do setor para listar o que existe ali.
* **Campos de Cadastro**:
  * **Nome do Lote / Setor**: Identificador amigável (Ex: *Almoxarifado Central*, *Escritório TI - Bloco B*).
  * **Responsável**: Nome do auditor que está conduzindo a contagem.
  * **Observações**: Campo livre para detalhamento de restrições ou notas de campo.

---

### Leitura de Campo / Scanner (`VerificationScanScreen.tsx` / `CameraScanner.tsx`)
A tela de campo mais utilizada. Ativa a câmera do aparelho para bipe de patrimônios.

* **Indicador de Progresso Superior**: Exibe em tempo real o percentual de ativos auditados do lote atual.
* **Câmera com Retículo Central**: Auxilia a mira correta no código de barras ou QR Code.
* **Bloqueio Automático de Duplicidade**: Se o operador ler o mesmo ativo mais de uma vez no mesmo lote, o sistema exibe um alerta sonoro/visual de duplicidade e ignora a leitura repetida para não inflar os dados.
* **Classificação de Cores do Feedback**:
  * 🟢 **Verde (OK)**: O patrimônio lido consta na Lista Mestra original e foi validado.
  * 🔴 **Vermelho (Pendente)**: Itens que ainda precisam ser localizados no setor (exibidos no resumo abaixo).
  * 🟠 **Laranja (Extra / Sobra)**: O patrimônio foi lido no setor, mas não consta na Lista Mestra enviada pelo sistema. É uma sobra física (ativo fora de lugar ou não cadastrado).

---

### Detalhes do Lote & Indicadores (`BatchDetailsScreen.tsx`)
Visão analítica de cada lote individual. Permite controlar o andamento das leituras e exportar os relatórios específicos daquele lote.

* **Barra Segmentada Multicor**: Representa visualmente a integridade física do lote:
  * **Azul**: Total esperado.
  * **Verde**: Total encontrado (OK).
  * **Vermelho**: Total não localizado (Faltas).
  * **Laranja**: Total de sobras encontradas (Extras).
* **Painel de Diagnóstico Executivo**:
  * Um algoritmo analisa os resultados atuais e imprime um card de orientação dinâmico. Se a acurácia estiver baixa, sugere que a busca continue. Se estiver 100%, dá os parabéns e habilita a conclusão do lote.
* **Funções de Ação**:
  * **Importar Lista Mestra**: Permite carregar ou atualizar os ativos esperados para este lote específico.
  * **Exportar (Ícone Share)**: Abre o seletor de exportação (CSV, JSON ou QR Code Mestre).
  * **Fechar Lote**: Bloqueia novas leituras no lote, alterando seu status para Concluído.

---

### Central de Importação (`ImportInventoryScreen.tsx`)
Permite ao operador carregar as listas de patrimônios esperados que foram geradas pelo ERP corporativo (SAP, Totvs, Senior, etc.).

* **Upload de CSV**: Suporta arquivos separados por vírgula ou ponto e vírgula com colunas de código de barras, descrição e categoria.
* **Leitura de QR Code Mestre**: O celular do auditor pode escanear o QR Code de outro dispositivo (ou de uma folha impressa) para carregar instantaneamente a lista mestra sem cabo ou internet.

---

### Relatórios & Dossiê de Divergências (`AuditResultsScreen.tsx`)
Tela focada na tomada de decisões por parte da coordenação ou auditoria final.

* **Métrica de Acurácia**: Exibida em destaque no topo (Fórmula: `(Itens OK / Total Esperado) * 100`).
* **Filtros Rápidos Estilizados**:
  * **TODOS**: Mostra todos os dados do lote.
  * **OK**: Mostra apenas ativos encontrados corretamente.
  * **DIVERGENTES (Faltas + Extras)**: Foco total nas inconsistências.
  * **PENDENTES (Faltas)**: Lista estrita de itens sumidos para auditoria física.
  * **SOBRAS (Extras)**: Lista de itens que estão fisicamente no setor mas pertencem a outro local ou não possuem cadastro.
* **Gestão de Segurança para Exclusões**:
  * Para evitar fraudes, o aplicativo possui controle de exclusão de leituras (configurável em Ajustes):
    * **Modo Bloqueado**: Ninguém pode apagar leituras feitas.
    * **Uma Vez**: O auditor pode apagar uma leitura incorreta acidental (apenas a última).
    * **Liberado**: Permite gerenciar e apagar quaisquer linhas livremente.

---

### Histórico de Operações & Rastreabilidade (`AuditLogScreen.tsx`)
Para conformidade regulatória e auditoria interna, cada ação de exclusão, alteração, encerramento ou importação é gravada com carimbo de hora e autor no banco local de rastreabilidade, impossibilitando fraudes silenciosas.

---

## 4. Lógicas Especiais de Integração & Dados (Offline-First)

Para viabilizar uma operação robusta sem servidores online ou cabos de dados, o sistema implementa três tecnologias proprietárias na camada cliente:

### A) Fatiamento e Transferência via QR Code (`qrChunker.ts`)
Um dos maiores desafios de usar códigos QR para transferir dados de auditoria é o limite de caracteres físico de um QR Code comum (geralmente suporta até 1200 caracteres de forma legível por câmeras comuns). 

Para contornar isso de forma genial, o sistema implementa a lógica de **QR Code Chunker (Fatiamento Sequencial)**:
1. Ao exportar um lote ou múltiplos lotes como QR Code, os dados JSON completos são convertidos em string.
2. Se a string exceder o tamanho ideal para leitura rápida de câmera (350 caracteres), o `qrChunker` reparte os dados em vários pedaços (chunks).
3. Cada pedaço recebe um cabeçalho estruturado: `CHUNK:[Parte Atual]/[Total de Partes]:[ID_Transferencia]:[Conteúdo_Fatiado]`.
   * *Exemplo*: `CHUNK:1/3:TRX89A:{"loteId":12,"nome":"TI","itens":[`
4. O modal (`QrCodeExportModal.tsx`) exibe um painel dinâmico com botões de paginação, permitindo que o usuário avance de parte em parte à medida que o outro celular realiza a leitura.

---

### B) Importador de QR Code Multi-partes (`QrImportScannerScreen.tsx`)
No celular que está recebendo a transferência (destinatário):
1. O scanner detecta automaticamente o prefixo `CHUNK:`.
2. O sistema armazena as fatias em um mapa em memória (`Map<number, string>`) indexado pelo número da parte.
3. **Liberdade total na leitura**: Não há problema se o usuário escanear a Parte 2 antes da Parte 1! O sistema gerencia a coleção e calcula o percentual de recebimento.
4. O painel indica visualmente o progresso: `Parte 2 de 5 lida! Falta ler as partes restantes (40% concluído)`.
5. Assim que a última parte em falta for escaneada, o sistema une todas as partes na ordem exata e realiza o `JSON.parse` do arquivo completo de forma instantânea.

---

### C) Central de Backup Inteligente: REPLACE vs. MERGE (`SettingsScreen.tsx`)
Nas configurações, o usuário pode exportar um arquivo `.json` contendo um backup completo de todo o banco de dados do aparelho (todos os lotes, leituras e listas mestre). Ao importar esse arquivo em outro celular, o sistema abre o modal interativo `BackupModal.tsx` e apresenta duas estratégias de processamento:

#### 1. Zerar Base e Substituir Tudo (REPLACE)
* **Como funciona**: O banco de dados do aparelho atual é totalmente apagado e os dados do arquivo de backup são inseridos de forma limpa.
* **Indicação**: Ideal para migração definitiva de aparelho, reposição de celular danificado ou formatação de aparelho de campo após o término de um projeto.
* **Segurança**: Exige confirmação dupla em um painel vermelho de alerta para evitar perda acidental do trabalho atual.

#### 2. Mesclar com Dados Locais (MERGE)
* **Como funciona**: O sistema lê o arquivo de backup e o compara com os dados já existentes na memória local do celular atual, aplicando regras de resolução de conflitos:
  * Se um lote do backup já existe no celular atual (ID idêntico), o sistema gera um novo ID de lote, renomeia o lote importado adicionando o sufixo `(Importado)` para evitar confusões e insere as leituras correspondentes sob esse novo ID mapeado.
  * Se as leituras do backup já existirem no mesmo lote com o mesmo código de barras e timestamp exato, elas são ignoradas para evitar duplicidade na mesclagem.
* **Indicação**: Ideal para consolidar no celular do supervisor as auditorias realizadas por 3 ou 4 auditores de campo diferentes. Cada um exporta seu backup, e o supervisor realiza a mesclagem inteligente de todos eles no seu próprio celular.

---

## 5. Fluxos do Dia a Dia (Guia Prático)

### Cenário 1: "Preciso realizar uma auditoria guiada contra uma lista de ativos do ERP"
1. No computador, exporte a planilha de ativos do setor em formato **CSV**.
2. No celular, vá em **Importar Dados** -> **Upload de Lista Mestra** e selecione o arquivo CSV.
3. Crie um **Novo Lote** selecionando o tipo **Auditoria / Verificação**.
4. Associe o arquivo CSV importado ao lote criado.
5. Abra o leitor de câmera e escaneie os patrimônios dos itens à medida que os encontra. O sistema alertará se o item está correto (Verde) ou se é um item de outro setor (Laranja).
6. Ao finalizar, clique em **Ver Relatório** para conferir a acurácia e exporte a planilha de divergências (CSV) para enviar ao financeiro/patrimônio.

---

### Cenário 2: "Trabalho em dupla. Quero passar o lote que contei para o celular do meu colega de equipe de forma rápida e offline"
1. No seu celular, acesse o lote que deseja enviar e clique no botão de **Exportação** (ícone de compartilhamento).
2. Selecione a opção **Gerar QR Code Mestre**.
3. No celular do seu colega, vá na tela de **Importar** e escolha **Leitor de QR Code**.
4. Aponte a câmera do celular dele para a tela do seu celular e escaneie o código QR. Se o lote for grande, navegue pelas partes (Parte 1, Parte 2...) no seu celular enquanto ele escaneia na sequência.
5. Pronto! O lote completo e todas as suas respectivas leituras foram copiadas integralmente para o outro aparelho sem precisar de internet, bluetooth ou cabos.

---

### Cenário 3: "O projeto de auditoria do ano terminou. Preciso salvar tudo com segurança"
1. Vá em **Configurações** (ícone da engrenagem no Dashboard).
2. Na seção de Backup, clique em **Exportar Backup**. Um arquivo `.json` contendo toda a inteligência e histórico do aparelho será baixado automaticamente.
3. Guarde este arquivo em seu computador ou nuvem corporativa. Se precisar auditar novamente ou restaurar o estado do aparelho, basta importar este arquivo no mesmo menu.

# Plano de Implementação: Atualização do PetMobile (Padrão PacienteMobile)

Este documento detalha o plano passo a passo para evoluir a arquitetura e a interface do **PetMobile**, alinhando-o com as robustas melhorias estruturais e de segurança já consolidadas no **PacienteMobile**. 

A abordagem será iterativa, garantindo que cada fase seja implementada, testada e validada antes de avançar para a próxima.

---

## 🚀 FASE 1: Motor de Segurança e Perfis (Usuários) - **[EM FOCO]**
O objetivo desta fase é padronizar os perfis de acesso, reforçar a proteção de rotas e implementar a delegação de autoridade (ex: Secretária agindo em nome de um Veterinário).

### 1.1. Atualização do Banco de Dados (Supabase)
- Revisar a estrutura da tabela `pet_usuarios`.
- Consolidar os perfis permitidos (ex: `Master`, `Administrador`, `Veterinário`, `Secretária`), eliminando ambiguidades (como `Médico`, `MedicoVet`, `Veterinário Geral`).
- Preparar a base para relacionamentos (ex: vincular uma Secretária aos Veterinários que ela atende).

### 1.2. Tipagem e Tipos Estritos (`src/lib/types.ts`)
- Atualizar a interface `Usuario` para suportar os novos papéis e permissões estritas.
- Definir Enums de perfis para uso em toda a aplicação, evitando *magic strings*.

### 1.3. Refatoração da Sessão (`session-context.tsx`)
- Melhorar o `normalizeUser` para refletir a nova estrutura estrita de perfis.
- Otimizar o fluxo de autenticação para evitar múltiplos recarregamentos e falhas de cache.

### 1.4. Refatoração do Guardião de Rotas (`auth-guard.tsx`)
- Implementar o mapeamento restrito de rotas baseado na nova arquitetura (como feito em PacienteMobile).
- Garantir bloqueios efetivos para rotas de administração (`/admin`) e relatórios exclusivos.

### 1.5. Implementação do Contexto de "Veterinário Ativo" (`active-medico`)
- Criar um hook/contexto (similar ao `activeMedico` do PacienteMobile) para que o perfil **Secretária** possa selecionar em nome de qual **Veterinário** ela está operando.
- Adicionar o seletor visual na interface para Secretárias.

---

## 📅 FASE 2: Agenda e Agendamentos
Após a segurança estar sólida, padronizaremos o motor da agenda clínica.

- **Filtros Avançados:** Implementar busca por veterinário, status do agendamento e datas.
- **Componentes Padronizados:** Substituir tabelas antigas pelo novo padrão `SortableTableHead` e hooks de ordenação.
- **Integração de Segurança:** Garantir que Veterinários vejam apenas sua agenda, e Secretárias vejam a agenda do "Veterinário Ativo" selecionado.

---

## 🐶 FASE 3: Pacientes (Pets e Tutores)
Evolução do cadastro e da ficha clínica (Prontuários).

- **Busca Otimizada:** Melhorar a interface de seleção/busca de Pets e Tutores.
- **Privacidade e Acesso:** Espelhar a regra onde Veterinários podem iniciar registros de novos pacientes, mas com restrições de visualização de prontuários de outros colegas (se aplicável).
- **Responsividade:** Garantir que a listagem e os modais de cadastro funcionem perfeitamente em telas móveis.

---

## 📋 FASE 4: Exames, Orçamentos e Materiais
Atualização dos módulos financeiros e operacionais.

- **Novo Motor de Orçamentos:** Implementar a interface de seleção com *fuzzy-search* e layout em abas (Exames vs Materiais) usada no PacienteMobile.
- **Controle de Estoque:** Integrar os dados de inventário (Materiais) no fluxo de uso clínico.
- **Geração de Documentos:** Refinar o layout de impressão de receitas, recibos e requisições para o formato otimizado e com rastreabilidade (auditoria de quem imprimiu).

---

## 📱 FASE 5: Interface Móvel e Melhorias Finais
Polimento geral de UI/UX.

- Revisar fluxos de navegação (ex: corrigir bugs de navegação ao voltar de uma busca).
- Ajustar tamanhos de botões e áreas de toque para uso confortável em celulares.
- Implementar feedbacks visuais de carregamento (Skeletons) e tratamentos de erro graciosos.

---

> **Próximo Passo Proposto:** 
> Podemos iniciar imediatamente a **Fase 1**, começando pela limpeza das regras de perfis no `auth-guard.tsx` e `types.ts`, e conversando sobre como faremos a padronização no Supabase. O que acha de darmos o pontapé inicial analisando os tipos atuais no `types.ts`?

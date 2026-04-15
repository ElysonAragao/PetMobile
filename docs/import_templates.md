# Modelos de Importação de Dados (v2.9)

Este documento detalha os campos e a ordem esperada para a importação de dados no sistema PetMobile, baseando-se no padrão de exportação CSV dos relatórios.

**Formato do Arquivo:** CSV  
**Separador:** `;` (Ponto e vírgula)  
**Codificação:** UTF-8 com BOM

---

## 1. Pets e Tutores (Modalidade: Pets)

| Campo | Descrição | Exemplo |
| :--- | :--- | :--- |
| **Nome_Pet** | Nome do animal | Pipoca |
| **Código_Pet** | Identificador único do pet (opcional na importação) | PET-001 |
| **Tutor_Nome** | Nome completo do responsável | João Silva |
| **Tutor_CPF** | CPF do tutor (somente números) | 12345678901 |
| **Tutor_Telefone**| Telefone de contato | (11) 98888-7777 |
| **Espécie** | Nome da espécie cadastrada | Cão |
| **Raça** | Raça do animal | Golden Retriever |
| **Sexo** | M ou F | M |
| **Nascimento** | Data de nascimento (AAAA-MM-DD) | 2020-05-15 |
| **Plano_Saúde** | Nome do convênio vinculado | Porto Pet |
| **Matricula** | Número da matrícula no convênio | 987654321 |

---

## 2. Catálogo de Exames (Modalidade: Exames)

| Campo | Descrição | Exemplo |
| :--- | :--- | :--- |
| **Código_Exame** | Código interno do sistema | EL001 |
| **ID_Empresa** | Código customizado da clínica | EX-123 |
| **Nome_Exame** | Nome do procedimento | Hemograma Completo |
| **Tipo** | Laboratório ou Imagem | Laboratório |
| **Descrição** | Detalhes do exame | Perfil hematológico ... |
| **Urgência** | Sim ou Não | Não |
| **Plano_Restrito**| Nome do plano se for exclusivo | Todos |

---

## 3. Planos e Convênios (Modalidade: Convênios)

| Campo | Descrição | Exemplo |
| :--- | :--- | :--- |
| **Código_Plano** | Identificador curto do plano | PLA001 |
| **Nome_Plano** | Nome completo comercial | Amigo Pet Gold |

---

## 4. Corpo Clínico e Usuários (Modalidade: Usuários)

| Campo | Descrição | Exemplo |
| :--- | :--- | :--- |
| **Nome_Usuário** | Nome completo do colaborador | Dra. Ana Souza |
| **Email** | E-mail de acesso e contato | ana@clinica.com |
| **Telefone** | Telefone de contato | (11) 98888-7777 |
| **Perfil** | Cargo/Status no sistema | MedicoVet / Admin / Atendente |
| **CRMV_UF** | Registro profissional (apenas veterinários) | 12345/SP |
| **Especialidade** | Especialidade médica | Cardiologia |
| **Validade** | Data de validade do acesso (DD/MM/AAAA) | 31/12/2026 |

---

## 5. Guias e Movimentação (Modalidade: Guias)

| Campo | Descrição | Exemplo |
| :--- | :--- | :--- |
| **ID_Guia** | Número da guia/atendimento | G00001 |
| **Data_Emissão** | Data da geração (DD/MM/AAAA HH:MM) | 20/03/2024 14:30 |
| **Código_Pet** | Código do animal vinculado | PET-001 |
| **Veterinário** | Nome do médico solicitante | Dr. Marcos |
| **Qtd_Exames** | Quantidade de itens na guia | 3 |

---

> [!TIP]
> Use a função **Exportar Excel (CSV)** em cada aba do módulo de Relatórios para obter um arquivo modelo preenchido com dados reais da sua clínica.

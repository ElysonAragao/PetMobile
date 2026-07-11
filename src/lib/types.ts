export interface Pet {
  id: string;
  codPet?: string;
  nome: string;
  especie: string; // Cão, Gato, etc.
  raca?: string;
  sexo?: 'M' | 'F';
  idade?: string;
  dataNascimento?: string;
  tutorNome: string;
  tutorCpf: string;
  tutorEmail?: string;
  tutorTelefone?: string;
  tutorEndereco?: string;
  tutorCep?: string;
  tutorBairro?: string;
  tutorCidade?: string;
  tutorUf?: string;
  healthPlanCode: string;
  healthPlanName: string;
  matricula?: string; // Matrícula do plano pet
  idRegistro?: string; // Tatuagem
  
  // Dados Familiares
  dadosFamiliaresAtivo?: boolean;
  paiNome?: string;
  paiRegistro?: string;
  paiInseminacao?: boolean;
  semenRegistro?: string;
  maeNome?: string;
  maeRegistro?: string;
  paiPedigree?: string;
  maePedigree?: string;
  
  // Dados de Movimentação/Saúde
  dadosMovimentacaoAtivo?: boolean;
  pesagens?: { data: string; peso: string }[];
  statusReprodutivo?: string;
  dataUltimaCria?: string;
  dataInseminacao?: string;
  quantidadeFilhos?: string;
  filhos?: { dataNascimento: string; peso: string; sexo: string }[];
}

export interface Exam {
  id: string;
  examCode: string;
  idExame: string;
  name: string;
  description: string;
  type: 'Laboratório' | 'Imagem';
  isUrgency?: boolean;
}

export interface Veterinario {
  id: string;
  codVet: string;
  nome: string;
  crmv: string; // CRM Veterinário
  email: string;
  telefone: string;
  especialidade?: string;
  validade_acesso?: string | null;
  prontuario_liberado?: boolean;
  validade_prontuario?: string | null;
}

export interface HealthPlan {
  id: string;
  codPlano: string;
  idPlano: string;
  nome: string;
}

export interface Movimentacao {
  id: string;
  movimentoId: string;
  pacienteId: string;
  medicoId: string;
  exameIds: string[];
  data: string; // ISO String
}


export interface QrData {
  pet: Pet;
  exams: Exam[];
  veterinario: Veterinario;
  movimentoId: string;
  data: string;
}

export type UserRole = 
  | 'Master' 
  | 'Administrador' 
  | 'Administrador Auxiliar'
  | 'Veterinário' 
  | 'Secretária' 
  | 'Secretária Geral'
  | 'Leitor' 
  | 'Relatórios';

export interface Usuario {
  id: string;
  empresaId?: string; // NULL para Master
  numUsuario: string;
  nome: string;
  cpf?: string;
  crmvUf?: string;
  email: string;
  telefone?: string;
  status: UserRole;
  dataCadastro: string; // ISO string
  dataValidade: string; // YYYY-MM-DD
  validade?: string; // from api
}

export interface Modelo {
  id: string;
  empresa_id: string;
  medico_id?: string | null; // Null means global for the company
  nome: string;
  tipo: 'Exame_Lab' | 'Exame_Img' | 'Atestado' | 'Laudo' | 'Encaminhamento/Internação' | 'Outros';
  conteudo: string; // The text content or JSON with exam list
  is_favorite?: boolean;
  created_at?: string;
}

export interface Leitura {
  id: string;
  codLeitura: string;        // Código sequencial: LEIT00001, LEIT00002...
  movimentoId: string;       // ID da movimentação lida
  dataLeitura: string;       // ISO string - data/hora da leitura
  usuarioNome: string;       // Nome do usuário que realizou a leitura
  usuarioId: string;         // ID do usuário que realizou a leitura
  // Dados do pet no momento da leitura
  petNome: string;
  especie: string;
  raca: string;
  tutorNome: string;
  tutorCpf: string;
  petHealthPlanCode: string;
  petHealthPlanName: string;
  petMatricula: string;
  // Dados do veterinário
  veterinarioNome: string;
  veterinarioCrmv: string;
  // Dados dos exames (armazenados como JSON string para flexibilidade)
  exames: { examCode: string; idExame: string; name: string; description: string; type: string }[];
  // Fallback fields from metadata / legacy
  pacienteNome?: string;
  medicoNome?: string;
  // Supabase relational columns (snake_case from DB)
  cod_leitura?: string;
  data_leitura?: string;
  metadata?: {
    petHealthPlanCode?: string;
    petHealthPlanName?: string;
    movimentoId?: string;
  };
  paciente_id?: string;
  veterinario_id?: string;
  // Relational join data from Supabase
  pets?: { nome?: string; especie?: string; raca?: string; tutor_nome?: string; tutor_cpf?: string; matricula?: string; idade?: string; sexo?: string };
  veterinarios?: { nome?: string; crmv_uf?: string };
  usuarios?: { nome?: string };
}

export interface Empresa {
  id: string;
  codigo: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  status: 'Ativo' | 'Inativo';
  data_cadastro?: string;
  logo_url?: string;
}

export interface AgendaItem {
  id: string;
  empresaId: string;
  medicoId: string | null;
  dataAgendamento: string; // ISO string
  petId: string | null;
  tutorCpf: string;
  tutorNome: string;
  petNome: string;
  tutorTelefone: string | null;
  status: 'Agendado' | 'Cancelado' | 'Realizado' | 'Bloqueado';
  tipo?: 'Consulta' | 'Retorno' | 'Exame' | 'Cirurgia';
  local?: string | null;
  createdAt: string;
  createdBy?: string | null;
  // Join objects
  medico?: { nome: string; crmv_uf?: string };
  pet?: { nome: string; codPet?: string };
  criador?: { nome: string };
}

export interface Material {
  id: string;
  empresaId: string;
  codigo: string;
  idMaterial?: string;
  descricao: string;
  categoria: string;
  precoUnitario: number;
  unidade: string;
  estoque: number;
  createdAt?: string;
}


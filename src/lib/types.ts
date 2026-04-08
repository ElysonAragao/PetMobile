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
}

export interface Exam {
  id: string;
  examCode: string;
  idExame: string;
  name: string;
  description: string;
  type: 'Laboratório' | 'Imagem';
  healthPlanId?: string | null;
  healthPlanName?: string | null;
}

export interface Veterinario {
  id: string;
  codVet: string;
  nome: string;
  crmv: string; // CRM Veterinário
  email: string;
  telefone: string;
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

export interface Usuario {
  id: string;
  empresaId?: string; // NULL para Master
  numUsuario: string;
  nome: string;
  cpf?: string;
  crmvUf?: string;
  email: string;
  telefone?: string;
  status: 'Master' | 'Administrador' | 'Administrador Auxiliar' | 'Secretária' | 'Secretária Geral' | 'MedicoVet' | 'MedicoVet Geral' | 'Leitor' | 'Leitor Geral' | 'Relatórios';
  dataCadastro: string; // ISO string
  dataValidade: string; // YYYY-MM-DD
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
  // Supabase relational columns (snake_case from DB)
  cod_leitura?: string;
  data_leitura?: string;
  metadata?: {
    petHealthPlanCode?: string;
    petHealthPlanName?: string;
    movimentoId?: string;
  };
  pet_id?: string;
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

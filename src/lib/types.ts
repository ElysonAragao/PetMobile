export interface Patient {
  id: string;
  codPaciente?: string;
  name: string;
  email: string;
  endereco?: string;
  telefone?: string;
  cpf: string;
  dataNascimento?: string;
  idade?: string;
  genero?: string;
  healthPlanCode: string;
  healthPlanName: string;
  matricula?: string;
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

export interface Medico {
  id: string;
  codMed: string;
  name: string;
  crm: string;
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
  patient: Patient;
  exams: Exam[];
  medico: Medico;
  movimentoId: string;
  data: string;
}

export interface Usuario {
  id: string;
  empresaId?: string; // NULL para Master
  numUsuario: string;
  nome: string;
  cpf?: string;
  crmUf?: string;
  email: string;
  telefone?: string;
  status: 'Master' | 'Administrador' | 'Administrador Auxiliar' | 'Secretária' | 'Secretária Geral' | 'Medico' | 'Medico Geral' | 'Leitor' | 'Leitor Geral' | 'Relatórios';
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
  // Dados do paciente no momento da leitura
  pacienteNome: string;
  pacienteCpf: string;
  pacienteTelefone: string;
  pacienteHealthPlanCode: string;
  pacienteHealthPlanName: string;
  pacienteMatricula: string;
  // Dados do médico
  medicoNome: string;
  medicoCrm: string;
  // Dados dos exames (armazenados como JSON string para flexibilidade)
  exames: { examCode: string; idExame: string; name: string; description: string; type: string }[];
  // Supabase relational columns (snake_case from DB)
  cod_leitura?: string;
  data_leitura?: string;
  metadata?: {
    pacienteHealthPlanCode?: string;
    pacienteHealthPlanName?: string;
    movimentoId?: string;
  };
  paciente_id?: string;
  medico_id?: string;
  // Relational join data from Supabase
  pacientes?: { nome?: string; cpf?: string; telefone?: string; matricula?: string; idade?: string; genero?: string };
  medicos?: { nome?: string; crm_uf?: string };
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

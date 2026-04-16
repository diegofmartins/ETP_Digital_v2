export interface ETPData {
  etp_name: string;
  // Novos campos obrigatórios para "fazer pensar" (Diagnóstico Inicial)
  diag_problema_necessidade: string;
  diag_alternativas_solucao: string;
  diag_objeto_vigencia: string;
  diag_exigencias_padroes: string;
  diag_quantidades_valor: string;
  diag_parcelamento_providencias: string;
  diag_correlatas_ambientais: string;
  diag_riscos_sucesso: string;

  processo_spae: string;
  unidade_requisitante: string;
  responsavel: string;
  justificativa_necessidade: string;
  levantamento_mercado: string;
  objeto_sucinto: string;
  especificacoes_tecnicas: string;
  requisitos_header: string;
  descricao_solucao_integral: string;
  requisitos_exigencias: string;
  requisitos_qualidade: string;
  requisitos_marca: string;
  requisitos_continuos: string;
  requisitos_amostra: string;
  requisitos_transicao: string;
  garantia_contratual: string;
  garantia_tecnica: string;
  assistencia_tecnica: string;
  requisitos_vistoria: string;
  requisitos_subcontratacao: string;
  requisitos_execucao: string;
  requisitos_dimensionamento: string;
  estimativa_quantidades_texto: string;
  estimativa_valor_texto: string;
  tabela_estimativa_quantitativos_precos: string;
  justificativa_parcelamento: string;
  resultados_pretendidos: string;
  providencias_adm: string;
  contratacoes_correlatas: string;
  impactos_ambientais: string;
  alinhamento_planejamento: string;
  posicionamento_conclusivo: string;
  analise_riscos_resumo: string;
  tabela_riscos_interna: string;
  tabela_riscos_externa: string;
  include_riscos_interna: boolean;
  include_riscos_externa: boolean;
  fotos: string;
  assinaturas: string;
  _version?: number;
}

export type ETPField = keyof ETPData;

export interface ETPExample {
  title: string;
  content: string;
}

export interface ETPStructureItem {
  id: ETPField;
  label: string;
  icon: string;
  section?: string;
  isAiEnabled?: boolean;
  isEssential?: boolean;
  placeholder?: string;
  instruction?: string;
  helpText?: string;
  examples?: ETPExample[];
}

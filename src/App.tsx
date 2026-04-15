import { useState, useEffect, Fragment } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileText, ClipboardList, Target, CheckCircle, Sparkles, Loader2, Printer, 
  Layout, BarChart, ShieldCheck, Leaf, Settings, Zap, Wand2, Eye, Edit3, 
  AlertTriangle, ChevronDown, ChevronUp, Download, Info, Trash2, PlusCircle,
  ImagePlus, X, ChevronLeft, ChevronRight, ArrowLeft, Lightbulb, Settings2
} from "lucide-react";
import { ETPData, ETPField, ETPStructureItem, ETPExample } from "./types";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table as DocxTable, TableRow as DocxTableRow, TableCell as DocxTableCell, WidthType, ImageRun } from "docx";
import { saveAs } from "file-saver";
import JoditEditor from 'jodit-react';

import { auth, db, googleProvider, OperationType, handleFirestoreError } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, getDoc, addDoc, limit, getDocs } from "firebase/firestore";

const SYSTEM_PROMPT = `Você é um Especialista em Contratações Públicas da Câmara Municipal de Curitiba (CMC), com profundo conhecimento da Lei 14.133/2021.
Sua tarefa é elaborar ou revisar seções de um Estudo Técnico Preliminar (ETP) seguindo RIGOROSAMENTE as diretrizes abaixo:

1. JUSTIFICATIVA (Descrição da Necessidade): FOQUE NO PROBLEMA, não na solução. Responda: Qual o problema? Qual o interesse público? Quais benefícios ao resolvê-lo? (Ex: "A lentidão dos equipamentos atuais está atrasando o atendimento ao cidadão", e não "precisamos de computadores").
2. LEVANTAMENTO DE MERCADO: Não pesquise apenas preços. Analise modelos de contratação, tecnologias e abordagens. Considere o custo-benefício e o ciclo de vida.
3. DESCRIÇÃO DA SOLUÇÃO: Detalhe a solução escolhida considerando todo o ciclo de vida (entrega, instalação, manutenção, descarte).
4. REQUISITOS: Devem ser essenciais e não restritivos. Garanta qualidade, desempenho e segurança.
5. CARACTERIZAÇÃO DE SERVIÇOS OU FORNECIMENTOS CONTÍNUOS (Item 6.3): Determine se o objeto é de natureza contínua (auxiliares e necessários à Administração, que se interrompidos comprometem atividades essenciais e estendem-se por mais de um exercício). Exemplos: vigilância, limpeza, manutenção elétrica/elevadores/veículos.
6. ALINHAMENTO: Mencione o "Planejamento Estratégico 2022-2031" e o "Plano de Contratações Anual (PCA)" APENAS na seção específica de Alinhamento ao Planejamento. Evite repetir essa informação em outras seções.
7. LINGUAGEM: Formal, técnica, EXTREMAMENTE concisa e objetiva. Evite textos longos, redundantes ou prolixos.
8. FORMATAÇÃO E REGRAS DE ESCRITA:
   - NÃO use markdown (não use # para títulos, não use * ou ** para negrito/itálico).
   - NÃO inclua introduções, saudações ou comentários.
   - NÃO repita as mesmas frases ou justificativas em múltiplos campos.
   - Retorne APENAS o texto que será inserido diretamente no documento final.
   - Use listas com hífens (-) para clareza quando necessário.
   - Utilize os dados de DIAGNÓSTICO INICIAL para fundamentar todas as seções.

9. REGRA DE EXCLUSÃO:
   - NUNCA gere conteúdo para o campo "assinaturas" (Assinaturas). Este campo deve permanecer vazio para preenchimento manual do usuário.

REGRA CRÍTICA DE PREENCHIMENTO:
Se os dados fornecidos no Diagnóstico Inicial forem insuficientes para gerar um conteúdo técnico completo e preciso para um determinado campo, você DEVE:
1. Iniciar a resposta com a frase "NECESSITA COMPLEMENTAÇÃO" em letras maiúsculas.
2. Pular uma linha em branco.
3. Fornecer o melhor rascunho possível com as informações disponíveis, indicando entre colchetes [ ] o que o usuário precisa detalhar.`;

const structure: ETPStructureItem[] = [
  // NOVOS CAMPOS OBRIGATÓRIOS (Diagnóstico Inicial Baseado na Lei 14.133/2021)
  { 
    id: 'diag_problema_necessidade', 
    label: '1. Qual é o problema ou necessidade que motiva esta contratação e o que se espera alcançar?', 
    icon: 'AlertTriangle', 
    section: '0. DIAGNÓSTICO INICIAL', 
    isAiEnabled: false, 
    isEssential: true,
    placeholder: 'Descreva o problema e os resultados pretendidos.',
    examples: [
      { title: 'Material de Expediente', content: '"O estoque atual de material de expediente está criticamente baixo, resultando em interrupções nas atividades administrativas e didáticas. A contratação visa garantir o suprimento contínuo por 12 meses, evitando paralisações e otimizando o fluxo de trabalho."' },
      { title: 'Manutenção de Ar-Condicionado', content: '"Os equipamentos de ar-condicionado apresentam falhas frequentes, comprometendo o conforto térmico e a qualidade do ar nos ambientes. A contratação busca assegurar o funcionamento adequado de todos os aparelhos, prolongar sua vida útil e reduzir em 30% os chamados emergenciais."' }
    ]
  },
  { 
    id: 'diag_alternativas_solucao', 
    label: '2. Quais alternativas foram estudadas para resolver o problema e por que a solução escolhida é a melhor?', 
    icon: 'Eye', 
    section: '0. DIAGNÓSTICO INICIAL', 
    isAiEnabled: false, 
    isEssential: true,
    placeholder: 'Descreva as alternativas e a justificativa da escolha.',
    examples: [
      { title: 'Material de Expediente', content: '"Analisamos a compra avulsa versus a contratação de fornecedor único por ata de registro de preços. A ata demonstrou ser mais vantajosa pela padronização, economia de escala e agilidade na aquisição, com redução de 15% nos custos anuais em comparação com compras pontuais."' },
      { title: 'Manutenção de Ar-Condicionado', content: '"Foram avaliadas a manutenção corretiva pontual e a manutenção preventiva e corretiva contínua. A manutenção preventiva e corretiva contínua foi selecionada por ser mais eficaz na prevenção de falhas, otimizando o desempenho dos equipamentos e evitando gastos emergenciais maiores."' }
    ]
  },
  { 
    id: 'diag_objeto_vigencia', 
    label: '3. Como você descreveria o objeto de forma técnica e qual o prazo de vigência necessário?', 
    icon: 'Target', 
    section: '0. DIAGNÓSTICO INICIAL', 
    isAiEnabled: false, 
    isEssential: true,
    placeholder: 'Descrição técnica do objeto e prazo.',
    examples: [
      { title: 'Material de Expediente', content: '"Aquisição de material de expediente, incluindo papel A4, canetas esferográficas, pastas e envelopes, conforme especificações do Anexo I. O prazo de vigência será de 12 meses, com entregas parceladas conforme demanda."' },
      { title: 'Manutenção de Ar-Condicionado', content: '"Prestação de serviços de manutenção preventiva e corretiva em 50 equipamentos de ar-condicionado (splits e centrais), incluindo mão de obra, peças e componentes. O prazo de vigência será de 24 meses, prorrogável por até 60 meses, por se tratar de serviço contínuo."' }
    ]
  },
  { 
    id: 'diag_exigencias_padroes', 
    label: '4. Quais são as exigências técnicas, padrões de qualidade e regras de execução indispensáveis?', 
    icon: 'CheckCircle', 
    section: '0. DIAGNÓSTICO INICIAL', 
    isAiEnabled: false, 
    isEssential: true,
    placeholder: 'Requisitos, qualidade e execução.',
    examples: [
      { title: 'Material de Expediente', content: '"Os materiais devem ser de primeira linha, com certificação ISO 9001 para o fabricante. As entregas devem ser realizadas em até 5 dias úteis após a solicitação, no almoxarifado da CMC, em horário comercial."' },
      { title: 'Manutenção de Ar-Condicionado', content: '"Os técnicos devem possuir certificação NR-10 e NR-35. A manutenção preventiva deve ser mensal, com relatório detalhado. O tempo máximo de atendimento para chamados corretivos emergenciais é de 4 horas, com solução em até 24 horas."' }
    ]
  },
  { 
    id: 'diag_quantidades_valor', 
    label: '5. Qual a quantidade estimada de itens/serviços e qual o valor global previsto?', 
    icon: 'BarChart', 
    section: '0. DIAGNÓSTICO INICIAL', 
    isAiEnabled: false, 
    isEssential: true,
    placeholder: 'Quantidades e estimativa de valor.',
    examples: [
      { title: 'Material de Expediente', content: '"Estimamos o consumo anual de 100 caixas de papel A4, 500 canetas e 200 pastas, com base no histórico dos últimos 2 anos. O valor unitário médio do papel A4 é de R$ 80,00/caixa, totalizando um valor anual estimado de R$ 25.000,00 para todos os itens."' },
      { title: 'Manutenção de Ar-Condicionado', content: '"A estimativa é de 50 equipamentos, com base no inventário atual. O valor mensal por equipamento para manutenção preventiva e corretiva é de R$ 150,00, resultando em um valor anual estimado de R$ 90.000,00."' }
    ]
  },
  { 
    id: 'diag_parcelamento_providencias', 
    label: '6. A contratação será dividida em lotes/itens? Existem providências prévias que a Administração deve tomar?', 
    icon: 'Layout', 
    section: '0. DIAGNÓSTICO INICIAL', 
    isAiEnabled: false, 
    isEssential: true,
    placeholder: 'Parcelamento e providências prévias.',
    examples: [
      { title: 'Material de Expediente', content: '"A contratação será por item, permitindo maior competitividade e a aquisição de diferentes marcas. A Administração deverá designar um fiscal de contrato para acompanhar as entregas e a qualidade dos materiais."' },
      { title: 'Manutenção de Ar-Condicionado', content: '"A contratação será em lote único, pois a divisão poderia comprometer a responsabilidade técnica e a eficiência da manutenção. A Administração deverá fornecer acesso aos locais dos equipamentos e um ponto de apoio para a equipe técnica."' }
    ]
  },
  { 
    id: 'diag_correlatas_ambientais', 
    label: '7. Existem outras contratações relacionadas a esta ou impactos ambientais que precisam ser mitigados?', 
    icon: 'Leaf', 
    section: '0. DIAGNÓSTICO INICIAL', 
    isAiEnabled: false, 
    isEssential: true,
    placeholder: 'Contratações correlatas e impactos ambientais.',
    examples: [
      { title: 'Material de Expediente', content: '"Contratação correlata: serviço de reprografia. Impacto ambiental: consumo de recursos naturais e geração de resíduos. Medida mitigadora: exigência de materiais reciclados ou recicláveis e descarte adequado via coleta seletiva."' },
      { title: 'Manutenção de Ar-Condicionado', content: '"Contratação interdependente: fornecimento de energia elétrica. Impacto ambiental: consumo de energia e descarte de fluidos refrigerantes. Medida mitigadora: exigência de equipamentos com selo Procel A e descarte de fluidos conforme normas ambientais vigentes."' }
    ]
  },
  { 
    id: 'diag_riscos_sucesso', 
    label: '8. Quais são os principais riscos que podem atrapalhar o sucesso desta contratação?', 
    icon: 'AlertTriangle', 
    section: '0. DIAGNÓSTICO INICIAL', 
    isAiEnabled: false, 
    isEssential: true,
    placeholder: 'Riscos e medidas de mitigação.',
    examples: [
      { title: 'Material de Expediente', content: '"Risco: Atraso na entrega dos materiais. Mitigação: Aplicação de multas contratuais e previsão de fornecedores alternativos. Conclusão: A contratação é viável e essencial para a continuidade das operações administrativas."' },
      { title: 'Manutenção de Ar-Condicionado', content: '"Risco: Indisponibilidade de peças de reposição. Mitigação: Exigência de estoque mínimo de peças críticas e prazos de reposição definidos em contrato. Conclusão: A contratação é viável e fundamental para garantir o conforto e a saúde ocupacional."' }
    ]
  },
  { 
    id: 'unidade_requisitante', 
    label: 'Área Demandante', 
    icon: 'Target', 
    section: 'I - INFORMAÇÕES GERAIS', 
    isAiEnabled: false, 
    isEssential: true,
    placeholder: 'Ex: Diretoria de Tecnologia'
  },
  { 
    id: 'processo_spae', 
    label: 'Nº Processo SPAE', 
    icon: 'FileText', 
    section: 'I - INFORMAÇÕES GERAIS', 
    isAiEnabled: false, 
    isEssential: false,
    placeholder: 'Ex: 0123/2026'
  },
  { 
    id: 'justificativa_necessidade', 
    label: '2. DESCRIÇÃO DA NECESSIDADE DA CONTRATAÇÃO (JUSTIFICATIVA DA CONTRATAÇÃO)', 
    icon: 'ClipboardList', 
    section: 'II - DEMANDA E PROSPECÇÃO DE SOLUÇÕES', 
    isAiEnabled: true, 
    isEssential: true,
    placeholder: 'Descreva o problema atual, não a solução.',
    instruction: 'Foque no problema (ex: lentidão, falta de material) e no interesse público.',
    helpText: 'A área demandante deve descrever a necessidade da compra/contratação, evidenciando o problema identificado e a real necessidade que ele gera, bem como o que se almeja alcançar com a contratação. (inciso I, art. 7º, IN 40/2020)\nÉ a identificação e caracterização do problema a ser resolvido. Justifica a decisão de contratar uma solução ou parte de uma solução, devendo responder a questões como:\n    • Qual é o problema que se pretende resolver?;\n    • Quais são os atores interessados na solução desse problema e quais as perspectivas desses atores sobre o problema?;\n    • Qual é o interesse público a ser atendido?;\n    • Quais os resultados e os benefícios que serão alcançados ao resolvê-lo?.\nÉ fundamental focar no problema, e não na solução. Por exemplo, o problema não é "precisamos de computadores", mas sim "a lentidão dos equipamentos atuais está atrasando o atendimento ao cidadão".'
  },
  { 
    id: 'levantamento_mercado', 
    label: '3. LEVANTAMENTO DE MERCADO E ANÁLISE DAS ALTERNATIVAS POSSÍVEIS', 
    icon: 'BarChart', 
    section: 'II - DEMANDA E PROSPECÇÃO DE SOLUÇÕES', 
    isAiEnabled: true,
    helpText: 'Consiste em realizar pesquisa de mercado, a fim de identificar as soluções disponíveis que atendam à necessidade da contratação e aos requisitos estabelecidos, bem como conhecer as condições usuais de aquisição ou de execução do objeto. Essa pesquisa possibilita identificar o que o mercado tem a oferecer para atender à necessidade da Administração, e ter uma noção dos custos envolvidos, comparando o custo-benefício de cada tipo de solução cogitado para a resolução do problema.\nÉ importante considerar se a solução em análise criaria outros problemas ou gargalos para a Administração e se esses gargalos gerados seriam problemas maiores que o problema a ser resolvido, tendo em vista que cada solução a contratar pode expor a organização pública a riscos novos e implica gastos, inclusive com manutenção da solução ao longo do tempo.\nNão se trata apenas de pesquisar preços, mas de analisar modelos de contratação, tecnologias e abordagens distintas. É como pesquisar diferentes modelos de carro antes de decidir qual comprar – um pode ser mais barato na aquisição, outro mais econômico a longo prazo, e um terceiro pode ter a tecnologia exata que você precisa. Este estudo evita que a Administração contrate uma solução ultrapassada, ineficiente ou com custo-benefício ruim.\n    • Deve-se utilizar fontes de pesquisa diversificadas, incluindo:\nConsulta direta a número razoável de potenciais fornecedores;\n    • Consulta junto a outras organizações públicas que tenham realizado contratações similares;\n    • Pesquisa publicada em mídia especializada e em sistemas oficiais de governo.\n Quando houver a possibilidade de compra ou de locação de bens, devem ser considerados os custos e os benefícios de cada opção, com indicação da alternativa mais vantajosa.\nPara o tipo de solução escolhido, caberá à área demandante demonstrar o atendimento aos requisitos estabelecidos, levando em conta razões técnicas e econômicas.\nNessa etapa, pode surgir a necessidade de reavaliar os requisitos da contratação, complementando-os, detalhando-os ou simplificando-os.\nO eventual não preenchimento deste campo deverá ser justificado (art. 18, §2º, parte final, da Lei nº 14.133/2021).'
  },
  { 
    id: 'objeto_sucinto', 
    label: '4. DESCRIÇÃO SUCINTA DO OBJETO', 
    icon: 'Target', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    isEssential: true,
    placeholder: 'Ex: Aquisição de 50 notebooks para o setor administrativo',
    instruction: 'Defina de forma concisa o objeto.',
    helpText: 'Definir, de forma concisa, clara e precisa, o objeto que se pretende contratar, “incluídos sua natureza, os quantitativos, o prazo do contrato e, se for o caso, a possibilidade de sua prorrogação.\nA definição não deve contemplar especificações excessivas, desnecessárias ou irrelevantes, sob risco de frustrar ou limitar indevidamente o caráter competitivo da licitação, podendo até direcionar a licitação para fornecedor específico.\n\nIndicar se a contratação tem por objeto:\n    • Se é compra ou locação de bens ou prestação de serviço;\n    • Se será contínuo ou não contínuo;\n    • Se será entregue em parcela única ou indicar o prazo de vigência do contrato de 1 a 5 anos (5 ANOS se for serviço ou fornecimento CONTÍNUO), podendo ser prorrogado por até 10 anos (prorrogação por 10 ANOS se for serviço ou fornecimento CONTÍNUO);\n    • Se o objeto é comum ou especial;\n    • Se a adjudicação será por lotes ou por itens;\n    • No caso de prestação de serviços, se haverá dedicação exclusiva de mão de obra (DEMO) ou predominância de mão de obra;\n    • Se é com ou sem fornecimento de materiais e equipamentos.'
  },
  { 
    id: 'especificacoes_tecnicas', 
    label: 'ESPECIFICAÇÕES TÉCNICAS MÍNIMAS', 
    icon: 'FileText', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    isEssential: true,
    placeholder: 'Descreva as características mínimas do que será contratado.',
    instruction: 'Liste os requisitos técnicos básicos.',
    helpText: 'Descreva as características mínimas do que será contratado, garantindo a qualidade e o desempenho necessários, sem restringir indevidamente a competição. As especificações devem ser claras e objetivas, utilizando normas técnicas reconhecidas sempre que possível. Devem contemplar requisitos de desempenho, durabilidade, segurança e sustentabilidade. É importante evitar marcas específicas, salvo se tecnicamente justificado, utilizando sempre a expressão "ou equivalente".'
  },
  { 
    id: 'descricao_solucao_integral', 
    label: '5. DESCRIÇÃO DA SOLUÇÃO COMO UM TODO', 
    icon: 'Layout', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true,
    helpText: 'Uma solução é o conjunto de todos os elementos (bens, serviços e outros) necessários para, de forma integrada, gerar os resultados que atendam à necessidade que ocasionou a contratação. Devem ser descritos todos os elementos a se produzir/contratar/executar para que a contratação produza, de fato, os resultados pretendidos pela Administração e atinja, de forma satisfatória, o escopo previamente eleito, com apresentação, quando for o caso, das justificativas técnicas e econômicas do tipo de solução escolhida.\nApós analisar as opções no "Levantamento de Mercado", aqui será descrito em detalhes a solução que foi escolhida. É como se, depois de pesquisar vários carros, você decidisse por um modelo específico e agora fosse descrever todas as suas características: o motor, os itens de série, o plano de revisões e até como ele será descartado no futuro.\nEsta descrição deve considerar todo o "ciclo de vida" do produto ou serviço: como ele será entregue ou instalado, como será sua manutenção, os custos durante o uso e como será seu descarte ou encerramento ao final do contrato.\nEm caso de exigências de qualificação técnica ou econômica:\n    • Necessitam ser específicas e objetivas;\n    • Devem ser justificadas neste tópico;\n    • Caso refiram-se a contratações para: a) entrega imediata, ou, b) contratações com valores inferiores a um quarto do limite para dispensa de licitação para compras em geral, é preciso justificar porque não foram dispensadas as exigências de qualificação técnica ou econômica.\nCaso após o levantamento de mercado a quantidade de fornecedores for considerada restrita, deve-se verificar se os requisitos que limitam a participação são realmente indispensáveis, flexibilizando-os sempre que possível.\nNo caso de serviços com contratação simultânea para o mesmo objeto, caso a Administração pretenda contratar mais de uma empresa para execução do objeto, é necessário atestar ainda que:\n    • Não houve perda da economia de escala;\n    • É possível e conveniente a execução simultânea;\n    • Há controle individualizado para execução de cada contratado (conforme art. 49 da Lei nº 14.133/2021).\nO eventual não preenchimento deste campo deverá ser justificado (art. 18, §2º, parte final da Lei nº 14.133/2021).'
  },
  { 
    id: 'requisitos_header', 
    label: '6. DESCRIÇÃO DOS REQUISITOS DA CONTRATAÇÃO', 
    icon: 'ShieldCheck', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true,
    placeholder: 'Campo informativo ou observações gerais sobre os requisitos.',
    helpText: 'São os elementos necessários ao objeto a ser contratado, para que atenda adequadamente à necessidade que originou a contratação.\nSe a "Descrição da Necessidade" é o "problema", os "Requisitos da Contratação" são a "lista de regras e exigências mínimas" que a solução (seja um produto ou serviço) deve obrigatoriamente cumprir para ser considerada aceitável pela CMC. O objetivo é garantir a qualidade, o desempenho, a segurança e a padronização do que será contratado. É crucial que essas exigências sejam essenciais para atender à necessidade e não restrinjam indevidamente a competição a um único fornecedor.\nO eventual não preenchimento deste campo deverá ser justificado (art. 18, §2º, parte final da Lei nº 14.133/2021).'
  },
  { 
    id: 'requisitos_exigencias', 
    label: '6.1. Exigências Internas e Externas à CMC', 
    icon: 'ShieldCheck', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    helpText: 'Considerar as exigências internas da CMC que estejam relacionadas à execução do objeto, como, por exemplo, a segurança da informação, a proteção de dados pessoais, gestão documental, gestão de riscos.\nConsiderar as exigências externas à organização, como requisitos legais, infralegais e regulatórios, como, por exemplo, aderência a normas técnicas, de saúde e de segurança do trabalho.' 
  },
  { 
    id: 'requisitos_qualidade', 
    label: '6.2. Padrões de Qualidade Exigidos', 
    icon: 'CheckCircle', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    helpText: 'Definir os padrões de qualidade a serem exigidos na execução do objeto, os quais não devem exceder o necessário para atender à necessidade que originou a contratação.\nVale lembrar que as contratações que utilizarão o MENOR PREÇO como critério de julgamento também deverão estabelecer requisitos mínimos de qualidade.\nSe o ETP demonstrar que a avaliação e a ponderação da qualidade técnica das propostas que superarem os requisitos mínimos de qualidade são relevantes aos fins pretendidos pela Administração, poderá ser escolhido o critério de julgamento por TÉCNICA E PREÇO para a seleção do fornecedor nas contratações de objetos listados nos incisos I a V do § 1º do art. 36 da Lei nº 14.133/2021.' 
  },
  { 
    id: 'requisitos_marca', 
    label: '6.2.1. Marca de Referência', 
    icon: 'Target', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    helpText: 'Indicar quais são as marcas de referência dos respectivos itens, se for o caso, seguida das expressões “equivalente/similar ou de melhor qualidade”. Com fundamento no art. 41, I, “d” da Lei nº 14.133/2021, as marcas citadas são utilizadas unicamente como referência de qualidade para definir as características mínimas de desempenho e durabilidade desejadas. Tal indicação serve para facilitar a exata compreensão do objeto, sendo permitida a oferta de produtos de outras marcas, desde que possuam qualidade similar, equivalente ou superior, o que garante a ampla competitividade do certame.\n\nExcepcionalmente será permitida a indicação de uma ou mais marcas ou modelos, desde que justificada tecnicamente no processo, nas hipóteses descritas no art. 41, inciso I, alíneas a, b, c e d da Lei nº 14.133, de 2021.\nSimilaridade: Quando necessária a indicação de marca como referência de qualidade ou facilitação da descrição do objeto, ela deverá ser seguida das expressões “ou equivalente”, “ou similar” e “ou de melhor qualidade”, hipótese em que a Administração poderá exigir que o interessado comprove desempenho, qualidade e produtividade compatíveis com o produto similar ou equivalente à marca de referência mencionada, por meio dos procedimentos de prova de qualidade estabelecidos no art. 42 da Lei nº 14.133, de 2021.' 
  },
  { 
    id: 'requisitos_continuos', 
    label: '6.3. Caracterização de Serviços ou Fornecimentos Contínuos', 
    icon: 'ClipboardList', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    helpText: 'Determinar se o objeto em questão é de natureza contínua ou não. Serviços de natureza contínua são serviços auxiliares e necessários à Administração no desempenho das respectivas atribuições. São aqueles que, se interrompidos, podem comprometer a continuidade de atividades essenciais e cuja contratação deva estender-se por mais de um exercício financeiro.\nSão exemplos de serviços de natureza contínua: vigilância, limpeza e conservação, manutenção elétrica, manutenção de elevadores, manutenção de veículos etc.' 
  },
  { 
    id: 'requisitos_amostra', 
    label: '6.4. Exigência de Amostra ou Prova de Conceito (POC)', 
    icon: 'Eye', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    helpText: 'A Administração poderá solicitar do licitante provisoriamente vencedor a apresentação de amostras, a realização de exames de conformidade ou de provas de conceito, entre outros testes, para avaliar a conformidade do objeto ofertado com as especificações técnicas e requisitos de qualidade, de desempenho e de funcionalidade.\nO objetivo de tais exigências é evitar a contratação de objetos inadequados ou até mesmo inservíveis, que representariam prejuízos aos cofres públicos.\nComo têm o potencial de restringir o universo de participantes na licitação, tais medidas possuem caráter excepcional, devendo ser justificadas formalmente, a fim de demonstrar que são, de fato, imprescindíveis para avaliar a qualidade, o desempenho ou a funcionalidade do objeto ofertado. Ademais, ressalte-se, poderão ser exigidas somente do licitante provisoriamente vencedor.\nCaso o licitante melhor colocado não apresente a amostra ou essa seja reprovada, sua proposta deverá ser desclassificada, devendo a Administração analisar a aceitabilidade da proposta do segundo colocado, procedendo a avaliação das suas amostras.\nA Administração também poderá utilizar um protótipo como parâmetro para demonstrar o objeto que pretende adquirir. Nesse caso, as amostras exigidas do licitante melhor colocado serão comparadas com o protótipo, podendo ser examinadas por instituição especializada.\n    • Exigência de Amostra: descrever quais os itens que deverão ser apresentadas as amostras; descrever os critérios objetivos para aceitação da amostra; determinar o prazo para sua apresentação; informar qual o local de recebimento da amostra e qual área irá acompanhar o seu recebimento; qual o e-mail e telefone para agendamento da entrega das amostras; quantos dias de antecedência é necessário para agendar a entrega da amostra; entre outras informações importantes.\n    • Prova de Conceito (POC): é um teste prático, realizado após a classificação provisória do licitante, para validar se a solução técnica proposta atende às exigências para a contratação antes da assinatura do contrato. Descrever detalhadamente o roteiro de como será a POC, incluindo o horário e local para sua realização; determinar quais os requisitos a serem avaliados; qual a % mínima em cada requisito que a licitante deve atingir para ser aprovada; informar qual estrutura/itens será disponibilizado pela CMC e qual deverá ser disponibilizado pela licitante; determinar o prazo para sua apresentação; qual o e-mail e telefone para agendamento da POC; quantos dias de antecedência é necessário para agendar a realização da POC; entre outras informações importantes.' 
  },
  { 
    id: 'requisitos_transicao', 
    label: '6.5. Necessidade de transição contratual', 
    icon: 'Zap', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    helpText: 'Informar se há necessidade de transição contratual com transferência de conhecimento, tecnologia e técnicas empregadas, capacitação dos técnicos do contratante ou do novo contratado.' 
  },
  { 
    id: 'garantia_contratual', 
    label: '6.6.1. Garantia de Execução do Objeto (Garantia Contratual)', 
    icon: 'ShieldCheck', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    helpText: 'Indicar se é necessário a exigência de garantia para a execução do objeto. Em caso positivo, justifique a necessidade da exigência da garantia e indique qual o % da garantia em razão do valor inicial do contrato (5% para contratações em geral / 10% nos casos de alta complexidade técnica e riscos envolvidos, caso em que deverá haver justificativa específica nos autos).\nNão cabe à Administração definir qual será a forma de garantia, mas apenas o seu percentual. A forma da garantia é uma escolha do contratado, podendo ser prestada por uma das seguintes modalidades: caução em dinheiro ou em títulos da dívida pública; seguro-garantia; ou fiança bancária.\nA decisão de não exigir garantia da contratação também deverá ser acompanhada de uma justificativa técnica ou econômica explícita, a qual diminua a vulnerabilidade da Administração em caso de inexecução ou danos.' 
  },
  { 
    id: 'garantia_tecnica', 
    label: '6.6.2. Garantia Técnica (Garantia do Produto/Serviço)', 
    icon: 'ShieldCheck', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    helpText: 'Importante destacar que esta não se confunde com a Garantia de Execução do Objeto (Garantia Contratual). Enquanto a garantia técnica se refere à necessidade de garantia do produto e assistência técnica pelo fabricante/fornecedor, a garantia contratual consiste em um percentual do valor do contrato que servirá de “caução” para assegurar a prestação do serviço ou fornecimento do produto, conforme regras e percentuais dos arts. 96 a 102 da Lei nº 14.133/21.' 
  },
  { 
    id: 'assistencia_tecnica', 
    label: '6.6.3. Exigências de manutenção e assistência técnica', 
    icon: 'Settings', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    helpText: 'As exigências de manutenção e assistência devem contemplar a definição do local de realização dos serviços, se será admitida a exigência de deslocamento de técnico ao local ou se haverá a exigência de que o contratado tenha unidade de prestação de serviços em distância compatível com as necessidades da CMC.' 
  },
  { 
    id: 'requisitos_vistoria', 
    label: '6.7. Necessidade de Vistoria', 
    icon: 'Eye', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    helpText: 'Informar se haverá necessidade de realização de vistoria técnica; informar qual a diretoria/servidor que a empresa terá de contatar, e-mail, telefone e endereço.\nQuando a avaliação prévia do local de execução for imprescindível para o conhecimento pleno das condições e peculiaridades do objeto a ser contratado, o edital de licitação poderá prever, sob pena de inabilitação, a necessidade de o licitante atestar que conhece o local e as condições de realização da obra ou serviço, assegurado a ele o direito de realização de vistoria prévia.' 
  },
  { 
    id: 'requisitos_subcontratacao', 
    label: '6.8. Subcontratação', 
    icon: 'Layout', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    helpText: 'Informar se não será admitida a subcontratação do objeto contratual OU indicar o % mínimo e máximo do valor da contratação, informando quais as parcelas do objeto podem ser subcontratadas.\nNão exceder 25% de subcontratação para o objeto , conforme o Art. 122, inciso I, da Lei nº 14.133/2021.\nQualquer percentual ou parcela definida deve ser justificada técnica e economicamente no processo administrativo, demonstrando que a subcontratação é vantajosa e não restringe a competitividade.\nA subcontratação integral do objeto é vedada, alinhando-se à Lei nº 14.133/2021.\nDeixar claro que, mesmo com a autorização, a Contratada principal é a única responsável perante a Administração pela qualidade e integralidade dos serviços, e por quaisquer danos decorrentes da atuação da subcontratada.\nLei nº 14.133/2021: Art. 122: A Administração poderá prever no edital a possibilidade de subcontratação de partes ou de parcelas do objeto, desde que:\nI - não exceda o limite máximo de 25% (vinte e cinco por cento) do valor total do contrato;\nII - a subcontratada comprove os requisitos de habilitação;\nIII - a subcontratação seja justificada no processo de licitação;\nIV - o contratado mantenha a responsabilidade integral pela execução;\nV - a subcontratada seja aprovada pela Administração.\n(...)\n§ 2º: É vedada a subcontratação integral do objeto.' 
  },
  { 
    id: 'requisitos_execucao', 
    label: '6.9. Execução do Objeto', 
    icon: 'Zap', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    helpText: 'Consiste na definição de como o contrato deverá produzir os resultados pretendidos desde o seu início até o seu encerramento.\nDescrever a dinâmica do contrato, devendo ser observado, sempre que pertinente:\n    • Definição do prazo para início da execução do objeto, compatível com a necessidade, a natureza e a complexidade do objeto, atentando-se que o prazo mínimo previsto para início da prestação de serviços deverá ser o suficiente para possibilitar a preparação do prestador para o fiel cumprimento do contrato;\n    • Em caso de fornecimento, indicar qual o prazo para entrega PROVISÓRIA e DEFINITIVA do objeto; indicar qual o local e horário de entrega do objeto;\n    • . Em caso de serviço, indicar qual o prazo para iniciar o serviço;\n    • Descrição detalhada dos métodos, rotinas, tecnologias empregadas, procedimentos, frequência e periodicidade de execução do trabalho e das etapas a serem executadas;\n    • Indicar a forma de comunicação a ser utilizada para troca de informações entre a contratada e a administração;\n    • A localidade, o horário de funcionamento do órgão, dentre outros;\n    • A definição das rotinas da execução, a frequência e a periodicidade dos serviços, quando couber;\n    • Os procedimentos, metodologias e tecnologias a serem empregadas, quando for o caso;\n    • Os deveres e disciplina exigidos;\n    • O cronograma de realização dos serviços, incluídas todas as tarefas significativas e seus respectivos prazos;\n    • Demais especificações que se fizerem necessárias para a execução dos serviços.' 
  },
  { 
    id: 'requisitos_dimensionamento', 
    label: '6.10. Informações Importantes para o Dimensionamento da Proposta', 
    icon: 'BarChart', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    helpText: 'Informar detalhadamente sobre o ambiente e condições gerais de execução do objeto, como, por exemplo, se tem estrutura disponível, se tem alguma restrição de acesso, se alguma parcela do objeto ficará às expensas da contratada, entre outras informações.' 
  },
  { 
    id: 'estimativa_quantidades_texto', 
    label: '7. ESTIMATIVA DAS QUANTIDADES', 
    icon: 'FileText', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    isEssential: true,
    placeholder: 'Ex: 50 unidades baseadas no número de servidores novos.',
    instruction: 'Apresente a relação entre a demanda e o quantitativo.',
    helpText: 'Deve ser apresentada a relação entre a demanda prevista e os quantitativos a serem contratados, com as respectivas memórias de cálculo acompanhadas dos documentos que lhes dão suporte. A estimativa deve ser obtida a partir de dados concretos, como, por exemplo, série histórica de consumo, atentando-se a eventual fato futuro apto a impactar o quantitativo demandado.\nNo caso de obras, as quantidades que devem ser levantadas em nível de ETP são aquelas que possibilitarão e nortearão a futura elaboração do projeto básico ou anteprojeto e, ao mesmo tempo, viabilizarão estimativas de custo.\nEm relação às compras, o planejamento deverá considerar a expectativa de consumo anual e determinar (art. 40, inciso III): (...) as unidades e quantidades a serem adquiridas em função de consumo e utilização prováveis, cuja estimativa será obtida, sempre que possível, mediante adequadas técnicas quantitativas, admitido o fornecimento contínuo.\nQuanto aos serviços, deverá ser demonstrada a relação entre a demanda prevista e a quantidade de serviço a ser contratada. A Administração deverá definir um método para quantificar os volumes de serviços demandados.'
  },
  { 
    id: 'estimativa_valor_texto', 
    label: '8. ESTIMATIVA DO VALOR DA CONTRATAÇÃO', 
    icon: 'Zap', 
    section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 
    isAiEnabled: true, 
    isEssential: true,
    placeholder: 'Ex: R$ 250.000,00 baseado em pesquisa preliminar.',
    instruction: 'Indique o valor global estimado para a solução.',
    helpText: 'Para a comparação entre as diversas alternativas estudadas no ETP, a área demandante da contratação deve estimar o valor de cada solução.\nO objetivo dessa estimativa é apoiar a análise de viabilidade da contratação e avaliar a adequação das despesas futuras aos recursos disponíveis para a organização.\nNão é o objetivo principal, neste momento, definir o valor que constará do edital de licitação, mas sim possibilitar a escolha da solução mais vantajosa e o pronunciamento conclusivo sobre a viabilidade da contratação.\nApesar de ser um orçamento simplificado, para fins de análise de viabilidade econômica, é importante utilizar fontes diversificadas de pesquisa. Algumas fontes que podem ser usadas são:\n    • Contratações similares feitas pela Administração Pública;\n    • Dados de pesquisa publicada em mídia especializada;\n    • Tabelas de preços de referência fixados por órgão oficial;\n    • Sistemas oficiais de governo, como o catálogo eletrônico de padronização de compras, serviços e obras;\n    • Junto a fornecedores (essa é a fonte menos confiável de preços).\nAs memórias de cálculo dos preços unitários e do valor total devem ser incluídas, bem como os documentos que lhe dão suporte.\nAlém dos custos diretos para a obtenção da solução (preço de compra, entrega, instalação, seguros etc.), devem ser considerados, para a análise de viabilidade econômica, sempre que possível, os custos indiretos, relacionados ao ciclo de vida do objeto, a exemplo dos custos operacionais (como de consumo de energia, de combustível, de água, custos de peças de reposição e de manutenção, depreciação) e custos de fim de vida (desativação ou descarte final).'
  },
  { id: 'tabela_estimativa_quantitativos_precos', label: 'Tabela de Estimativa de Quantitativos e Preços', icon: 'Layout', section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', isAiEnabled: true, helpText: 'Apresente uma tabela detalhada com os itens, especificações, quantidades e preços estimados. A tabela deve permitir a clara identificação de cada item e a composição do valor total da contratação.' },
  { id: 'justificativa_parcelamento', label: '9. JUSTIFICATIVAS PARA O PARCELAMENTO OU NÃO DA CONTRATAÇÃO (OBRIGATÓRIO - art. 18º, §2º, da Lei nº 14.133/2021)', icon: 'AlertTriangle', section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', isAiEnabled: true, helpText: 'A regra é o parcelamento do objeto, desde que técnica e economicamente viável. O objetivo é aumentar a competição. Não parcelar exige fundamentação robusta no ETP, demonstrando que a divisão do objeto prejudicaria a economia de escala, a integração da solução ou a eficiência administrativa.' },
  { id: 'resultados_pretendidos', label: '10. DEMONSTRATIVO DOS RESULTADOS PRETENDIDOS', icon: 'CheckCircle', section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', isAiEnabled: true, helpText: 'Demonstrar os benefícios e melhorias esperados ("antes e depois"). Pode ser em termos de economicidade, eficácia, eficiência, melhor aproveitamento de recursos ou impactos ambientais positivos. Devem ser definidos indicadores de desempenho para avaliar se os resultados foram alcançados após a execução do contrato.' },
  { id: 'providencias_adm', label: '11. PROVIDÊNCIAS A SEREM ADOTADAS PELA ADMINISTRAÇÃO', icon: 'Settings', section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', isAiEnabled: true, helpText: 'Medidas que a Administração precisa tomar para viabilizar a execução (infraestrutura, elétrica, climatização, espaço físico, capacitação, etc.). Devem ser concluídas antes do início do contrato. O descumprimento dessas providências pode acarretar atrasos na execução e prejuízos à Administração.' },
  { id: 'contratacoes_correlatas', label: '12. CONTRATAÇÕES CORRELATAS E/OU INTERDEPENDENTES', icon: 'Layout', section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', isAiEnabled: true, helpText: 'Mapear o ecossistema da necessidade: contratações Interdependentes (essenciais para o funcionamento) e Correlatas (relacionadas). Identificar impactos entre as soluções e garantir que os cronogramas estejam alinhados para evitar ociosidade de recursos ou interrupção de serviços.' },
  { id: 'impactos_ambientais', label: '13. DESCRIÇÃO DE POSSÍVEIS IMPACTOS AMBIENTAIS E RESPECTIVAS MEDIDAS MITIGADORAS', icon: 'Leaf', section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', isAiEnabled: true, helpText: 'Indicar possíveis impactos ambientais e medidas mitigadoras, considerando todo o ciclo de vida do objeto. O desenvolvimento sustentável é um princípio da Lei 14.133/2021. Devem ser observadas as normas de descarte de resíduos, eficiência energética e uso racional de recursos naturais.' },
  { id: 'alinhamento_planejamento', label: '14. ALINHAMENTO ENTRE A CONTRATAÇÃO E O PLANEJAMENTO DA CÂMARA MUNICIPAL DE CURITIBA', icon: 'Target', section: 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', isAiEnabled: true, helpText: 'Demonstrar que a contratação está de acordo com o Plano de Contratações Anual (PCA) e o Planejamento Estratégico da CMC, provando que não é um ato isolado. Deve-se indicar o item específico do PCA ao qual a contratação se refere.' },
  { id: 'posicionamento_conclusivo', label: '15. POSICIONAMENTO CONCLUSIVO SOBRE A ADEQUAÇÃO DA CONTRATAÇÃO PARA O ATENDIMENTO DA NECESSIDADE A QUE SE DESTINA (OBRIGATÓRIO - art. 18º, §2º, da Lei nº 14.133/2021)', icon: 'ShieldCheck', section: 'IV - POSICIONAMENTO CONCLUSIVO', isAiEnabled: true, helpText: 'Concluir sobre a viabilidade técnica e econômica da contratação. Verificar se a necessidade é clara, se o objeto é legal e se os benefícios compensam os custos. O posicionamento deve ser fundamentado em todos os elementos analisados no ETP.' },
  { id: 'analise_riscos_resumo', label: '16. ANÁLISE DE RISCOS QUE POSSAM COMPROMETER O SUCESSO DA LICITAÇÃO (OBRIGATÓRIO - art. 18º, inc. X, da Lei nº 14.133/2021)', icon: 'AlertTriangle', section: 'V - GESTÃO DE RISCOS', isAiEnabled: true, helpText: 'Registrar riscos que possam comprometer a licitação ou o contrato (processo licitatório, providências prévias, gestão contratual) e propor medidas de tratamento/mitigação. A análise deve considerar a probabilidade de ocorrência e o impacto de cada risco.' },
  { id: 'tabela_riscos_interna', label: 'Anexo I - Riscos Fase Interna', icon: 'Layout', section: 'V - GESTÃO DE RISCOS', isAiEnabled: true, helpText: 'Tabela detalhada dos riscos identificados na fase interna do processo, incluindo descrição, impacto, probabilidade e medidas de mitigação.' },
  { id: 'tabela_riscos_externa', label: 'Anexo I - Riscos Fase Externa', icon: 'Layout', section: 'V - GESTÃO DE RISCOS', isAiEnabled: true, helpText: 'Tabela detalhada dos riscos identificados na fase externa do processo, incluindo descrição, impacto, probabilidade e medidas de mitigação.' },
  { id: 'fotos', label: 'Fotos e Ilustrações do Objeto', icon: 'Eye', section: 'VI - ANEXOS FOTOGRÁFICOS', isAiEnabled: false, helpText: 'Anexe fotos ou ilustrações que ajudem a identificar e descrever o objeto da contratação. As imagens devem ser nítidas e acompanhadas de legendas explicativas.' },
  { 
    id: 'assinaturas', 
    label: 'Assinaturas (NOME, Lotação - uma por linha)', 
    icon: 'Edit3', 
    section: 'VII - ASSINATURAS', 
    isAiEnabled: false, 
    isEssential: true,
    placeholder: 'Maria Santos, Diretoria de Patrimônio e Serviços\nJoão Silva, Seção Administrativa e Financeira',
    helpText: 'Insira o nome e a lotação dos responsáveis pela elaboração do ETP, um por linha. As assinaturas devem ser colhidas após a finalização do documento.'
  },
];

const IconMap: Record<string, any> = {
  FileText, ClipboardList, Target, CheckCircle, Sparkles, Loader2, Printer, 
  Layout, BarChart, ShieldCheck, Leaf, Settings, Zap, Wand2, Eye, Edit3, 
  AlertTriangle, ChevronDown, ChevronUp, Download, Info, Trash2, PlusCircle,
  ImagePlus, X
};

const Icon = ({ name, size = 16, className = "" }: { name: string, size?: number, className?: string }) => {
  const LucideIcon = IconMap[name];
  if (!LucideIcon) return null;
  return <LucideIcon size={size} className={className} />;
};

const FileUploader = ({ value, onChange }: { value: string, onChange: (value: string) => void }) => {
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    if (value) {
      try {
        setImages(JSON.parse(value));
      } catch (e) {
        setImages([]);
      }
    } else {
      setImages([]);
    }
  }, [value]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const newImages = [...images, base64String];
        setImages(newImages);
        onChange(JSON.stringify(newImages));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onChange(JSON.stringify(newImages));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {images.map((img, index) => (
          <div key={index} className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200 group">
            <img src={img} alt={`Upload ${index}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            <button
              onClick={() => removeImage(index)}
              className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Icon name="X" size={12} />
            </button>
          </div>
        ))}
        <label className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all text-slate-400 hover:text-indigo-600">
          <Icon name="ImagePlus" size={24} />
          <span className="text-[10px] font-bold mt-2 uppercase">Adicionar Foto</span>
          <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
        </label>
      </div>
      <p className="text-[10px] text-slate-400 italic">Formatos aceitos: JPG, PNG. Máximo 1MB por imagem.</p>
    </div>
  );
};

const INITIAL_STATE: ETPData = {
  etp_name: 'Novo Estudo Técnico Preliminar',
  diag_problema_necessidade: '', diag_alternativas_solucao: '', diag_objeto_vigencia: '', diag_exigencias_padroes: '',
  diag_quantidades_valor: '', diag_parcelamento_providencias: '', diag_correlatas_ambientais: '', diag_riscos_sucesso: '',
  processo_spae: '', unidade_requisitante: '', responsavel: '',
  justificativa_necessidade: '', levantamento_mercado: '',
  objeto_sucinto: '', especificacoes_tecnicas: '', requisitos_header: '', descricao_solucao_integral: '',
  requisitos_exigencias: '', requisitos_qualidade: '', requisitos_marca: '', requisitos_continuos: '',
  requisitos_amostra: '', requisitos_transicao: '',
  garantia_contratual: '', garantia_tecnica: '', assistencia_tecnica: '',
  requisitos_vistoria: '', requisitos_subcontratacao: '', requisitos_execucao: '', requisitos_dimensionamento: '',
  estimativa_quantidades_texto: '', estimativa_valor_texto: '',
  tabela_estimativa_quantitativos_precos: '',
  justificativa_parcelamento: '', resultados_pretendidos: '',
  providencias_adm: '', contratacoes_correlatas: '', impactos_ambientais: '',
  alinhamento_planejamento: '', posicionamento_conclusivo: '',
  analise_riscos_resumo: '', tabela_riscos_interna: '', tabela_riscos_externa: '',
  fotos: '',
  assinaturas: '',
  _version: 2,
};

const base64ToUint8Array = (base64: string) => {
  const binaryString = window.atob(base64.split(',')[1]);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<'user' | 'master'>('user');
  const [userStatus, setUserStatus] = useState<'pending' | 'approved' | 'disabled'>('pending');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [trashDrafts, setTrashDrafts] = useState<any[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'editor' | 'admin'>('dashboard');
  const [adminTab, setAdminTab] = useState<'etps' | 'users' | 'trash'>('etps');
  
  const [formData, setFormData] = useState<ETPData>(INITIAL_STATE);
  const [isGenerating, setIsGenerating] = useState<ETPField | 'global' | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [apiError, setApiError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showGlobalConfirm, setShowGlobalConfirm] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [confirmDeleteCheckbox, setConfirmDeleteCheckbox] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [examplePopup, setExamplePopup] = useState<{ fieldId: string, examples: ETPExample[] } | null>(null);
  const [helpPopup, setHelpPopup] = useState<{ title: string, content: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'diagnostic' | 'technical'>('diagnostic');
  const [expandedSections, setExpandedSections] = useState<string[]>(['0. DIAGNÓSTICO INICIAL', 'I - INFORMAÇÕES GERAIS', 'II - DEMANDA E PROSPECÇÃO DE SOLUÇÕES', 'III - DESCRIÇÃO DA SOLUÇÃO ESCOLHIDA', 'IV - ANÁLISE DE RISCOS E CONCLUSÃO']);
  const [isAdminViewing, setIsAdminViewing] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
    );
  };

  // Auth Listener
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        const userData = {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          lastActive: serverTimestamp()
        };

        if (userSnap.exists()) {
          const data = userSnap.data();
          setUserRole(data.role);
          setUserStatus(data.status);
          await updateDoc(userRef, { lastActive: serverTimestamp() });
        } else {
          const isMasterEmail = u.email === "diego.martins@cmc.pr.gov.br";
          const role = isMasterEmail ? 'master' : 'user';
          const status = isMasterEmail ? 'approved' : 'pending';
          await setDoc(userRef, {
            ...userData,
            role: role,
            status: status,
            createdAt: serverTimestamp()
          });
          setUserRole(role);
          setUserStatus(status);
        }
      }
      setIsAuthReady(true);
    });
  }, []);

  // Presence Heartbeat
  useEffect(() => {
    if (!user || userStatus !== 'approved') return;

    const updatePresence = async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          lastActive: serverTimestamp()
        });
      } catch (err) {
        console.error("Error updating presence:", err);
      }
    };

    // Update immediately on mount/auth
    updatePresence();

    // Then every 2 minutes
    const interval = setInterval(updatePresence, 120000);
    return () => clearInterval(interval);
  }, [user, userStatus]);

  // Users Listener (Master only)
  useEffect(() => {
    if (userRole === 'master' && userStatus === 'approved') {
      return onSnapshot(collection(db, 'users'), (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    }
  }, [userRole, userStatus]);

  // Trash Listener (Master only)
  useEffect(() => {
    if (userRole === 'master' && userStatus === 'approved') {
      const q = query(collection(db, 'etps'), where('status', '==', 'deleted'));
      return onSnapshot(q, (snapshot) => {
        const now = Date.now();
        const trash = snapshot.docs.map(doc => {
          const data = doc.data();
          const deletedAtDoc = data.deletedAt;
          
          // Robust check for deletedAt timestamp
          if (!deletedAtDoc || typeof deletedAtDoc.toDate !== 'function') {
            return { id: doc.id, ...data, isExpired: false };
          }
          
          const deletedAt = deletedAtDoc.toDate().getTime();
          const isExpired = now - deletedAt > 24 * 60 * 60 * 1000;
          return { id: doc.id, ...data, isExpired };
        });
        
        // Auto-clean expired trash - only if we have a valid deletedAt
        trash.filter(t => t.isExpired && (t as any).deletedAt).forEach(t => {
          deleteDoc(doc(db, 'etps', t.id));
        });

        setTrashDrafts(trash.filter(t => !t.isExpired));
      });
    }
  }, [userRole, userStatus]);

  // Drafts Listener
  useEffect(() => {
    if (!user || userStatus !== 'approved') {
      setDrafts([]);
      return;
    }

    let q;
    if (userRole === 'master' && view === 'admin') {
      q = query(collection(db, 'etps'), limit(100));
    } else {
      q = query(collection(db, 'etps'), where('userId', '==', user.uid), limit(100));
    }

    return onSnapshot(q, (snapshot) => {
      const d = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((doc: any) => doc.status !== 'deleted');
      setDrafts(d);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'etps');
    });
  }, [user, userRole, userStatus, view]);

  const pendingUsersCount = allUsers.filter(u => u.status === 'pending').length;

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setApiError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      // Ignore "auth/cancelled-popup-request" which happens if user clicks again or closes popup
      if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
        setApiError("Erro ao fazer login: " + err.message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (user) {
      try {
        // Set lastActive to null or old date on logout to immediately show as offline
        await updateDoc(doc(db, 'users', user.uid), {
          lastActive: null
        });
      } catch (e) {
        console.error("Error clearing presence on logout", e);
      }
    }
    await signOut(auth);
    setView('dashboard');
    setCurrentDraftId(null);
    setFormData(INITIAL_STATE);
    setIsAdminViewing(false);
  };

  const saveDraft = async (manual = false) => {
    if (!user || !formData || isAdminViewing) return;
    setIsSaving(true);
    try {
      const draftData = {
        userId: user.uid,
        userEmail: user.email,
        title: formData.etp_name || "ETP sem título",
        data: formData,
        status: 'draft',
        updatedAt: serverTimestamp()
      };

      if (currentDraftId) {
        await updateDoc(doc(db, 'etps', currentDraftId), draftData);
      } else {
        const docRef = await addDoc(collection(db, 'etps'), {
          ...draftData,
          createdAt: serverTimestamp()
        });
        setCurrentDraftId(docRef.id);
      }
      if (manual) {
        // Show success message or something
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'etps');
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save
  useEffect(() => {
    if (!user || view !== 'editor') return;
    const timer = setTimeout(() => {
      saveDraft();
    }, 3000);
    return () => clearTimeout(timer);
  }, [formData, user, view]);

  const loadDraft = (draft: any, adminView = false) => {
    if (draft && draft.data) {
      let data = { ...draft.data };
      
      // Crítica do sistema: Migração para inclusão do item 6.3 (Caracterização de Serviços Contínuos)
      // Como os IDs são descritivos (ex: requisitos_amostra), o texto antigo JÁ aparecerá no novo número (6.4)
      // pois o ID requisitos_amostra agora está associado ao rótulo 6.4.
      // Apenas garantimos que o novo campo 6.3 (requisitos_continuos) seja inicializado se não existir.
      if (!data._version || data._version < 2) {
        if (data.requisitos_continuos === undefined) {
          data.requisitos_continuos = '';
        }
        data._version = 2;
      }
      
      setFormData(data);
    } else {
      setFormData(INITIAL_STATE);
    }
    setCurrentDraftId(draft.id);
    setIsAdminViewing(adminView);
    setView('editor');
    setShowAdvanced(false);
  };

  const createNewETP = () => {
    setFormData(INITIAL_STATE);
    setCurrentDraftId(null);
    setIsAdminViewing(false);
    setView('editor');
    setShowAdvanced(false);
  };

  const deleteDraft = async (id: string) => {
    try {
      // Optimistic update
      setDrafts(prev => prev.filter(d => d.id !== id));
      
      await updateDoc(doc(db, 'etps', id), { 
        status: 'deleted',
        deletedAt: serverTimestamp()
      });
      if (currentDraftId === id) {
        setFormData(INITIAL_STATE);
        setCurrentDraftId(null);
        setView('dashboard');
      }
      setDeleteConfirmId(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'etps');
    }
  };

  const restoreDraft = async (id: string) => {
    try {
      await updateDoc(doc(db, 'etps', id), { 
        status: 'active',
        deletedAt: null
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'etps');
    }
  };

  const permanentDeleteDraft = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'etps', id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'etps');
    }
  };

  const updateUserStatus = async (uid: string, newStatus: 'approved' | 'disabled' | 'pending') => {
    try {
      await updateDoc(doc(db, 'users', uid), { status: newStatus });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  const updateUserRole = async (uid: string, newRole: 'user' | 'master') => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'users');
    }
  };

  const deleteUser = async (uid: string) => {
    if (uid === user?.uid) {
      setApiError("Você não pode excluir seu próprio usuário.");
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', uid));
      setUserToDelete(null);
      setConfirmDeleteCheckbox(false);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, 'users');
    }
  };

  const exportBackup = async () => {
    if (userRole !== 'master') return;
    
    setIsSaving(true);
    setApiError(null);
    
    try {
      // Fetch ALL ETPs (including those not in current state)
      const etpsSnap = await getDocs(query(collection(db, 'etps'), limit(500)));
      const allEtps = etpsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Fetch ALL Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsersData = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const backupData = {
        version: 2,
        exportDate: new Date().toISOString(),
        drafts: allEtps,
        users: allUsersData
      };
      
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      saveAs(blob, `ETP_DIGITAL_FULL_BACKUP_${new Date().toISOString().split('T')[0]}.json`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, 'backup');
    } finally {
      setIsSaving(false);
    }
  };

  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        if (!backup.drafts || !Array.isArray(backup.drafts)) {
          throw new Error("Formato de backup inválido.");
        }

        const confirm = window.confirm(`Deseja importar ${backup.drafts.length} ETPs? Isso pode sobrescrever documentos com o mesmo ID.`);
        if (!confirm) return;

        for (const draft of backup.drafts) {
          const { id, ...data } = draft;
          await setDoc(doc(db, 'etps', id), data);
        }
        
        alert("Backup importado com sucesso!");
      } catch (err: any) {
        setApiError("Erro ao importar backup: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleAiAssist = async (fieldId: ETPField) => {
    if (!formData || isAdminViewing) return;
    setApiError(null);
    setIsGenerating(fieldId);
    const field = structure.find(s => s.id === fieldId);
    const fieldName = field?.label;
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const diagnosticInfo = `
      - Problema/Necessidade: ${formData.diag_problema_necessidade}
      - Alternativas: ${formData.diag_alternativas_solucao}
      - Objeto/Vigência: ${formData.diag_objeto_vigencia}
      - Exigências/Padrões: ${formData.diag_exigencias_padroes}
      - Quantidades/Valor: ${formData.diag_quantidades_valor}
      - Parcelamento/Providências: ${formData.diag_parcelamento_providencias}
      - Correlatas/Ambientais: ${formData.diag_correlatas_ambientais}
      - Riscos: ${formData.diag_riscos_sucesso}
      `;

      const prompt = `Com base no DIAGNÓSTICO INICIAL abaixo:
      ${diagnosticInfo}
      
      Redija a seção "${fieldName}" deste Estudo Técnico Preliminar conforme a Lei 14.133/21. 
      Siga as instruções da CMC: ${field?.instruction || ''}
      
      REGRAS CRÍTICAS: 
      - NÃO use markdown (#, *, **). 
      - NÃO inclua introduções ou comentários. 
      - Retorne APENAS o texto final.
      - Se as informações forem insuficientes para um texto técnico completo, você DEVE iniciar a resposta com "NECESSITA COMPLEMENTAÇÃO" seguido de uma linha em branco e o rascunho com colchetes [ ] indicando o que falta.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
        }
      });

      const result = response.text;
      if (result) {
        setFormData(prev => ({ ...prev, [fieldId]: result.trim() }));
      }
    } catch (err: any) {
      setApiError(err.message || "Erro ao gerar conteúdo");
    } finally {
      setIsGenerating(null);
    }
  };

  const isMandatoryFilled = () => {
    if (!formData) return false;
    const mandatoryFields: ETPField[] = [
      'diag_problema_necessidade', 'diag_alternativas_solucao', 'diag_objeto_vigencia', 'diag_exigencias_padroes',
      'diag_quantidades_valor', 'diag_parcelamento_providencias', 'diag_correlatas_ambientais', 'diag_riscos_sucesso'
    ];
    return mandatoryFields.every(field => (String(formData[field] || '').length) > 10);
  };

  const handleGlobalGenerate = async (fillEmpty: boolean = true) => {
    if (!formData || isAdminViewing) return;
    if (!isMandatoryFilled()) {
      setApiError("Por favor, preencha detalhadamente todos os campos do Diagnóstico Inicial e Dados Essenciais antes de solicitar o polimento da IA.");
      return;
    }
    setApiError(null);
    setIsGenerating('global');
    setShowGlobalConfirm(false);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const filledFields = Object.keys(formData).filter(key => key !== '_version' && !!formData[key as keyof ETPData] && String(formData[key as keyof ETPData]).length > 0);
      const emptyFields = structure
        .filter(item => item.isAiEnabled !== false && item.section !== '0. DIAGNÓSTICO INICIAL')
        .filter(item => !formData[item.id as keyof ETPData] || String(formData[item.id as keyof ETPData]).length === 0)
        .map(item => item.id);

      const diagnosticInfo = `
      - Problema/Necessidade: ${formData.diag_problema_necessidade}
      - Alternativas: ${formData.diag_alternativas_solucao}
      - Objeto/Vigência: ${formData.diag_objeto_vigencia}
      - Exigências/Padrões: ${formData.diag_exigencias_padroes}
      - Quantidades/Valor: ${formData.diag_quantidades_valor}
      - Parcelamento/Providências: ${formData.diag_parcelamento_providencias}
      - Correlatas/Ambientais: ${formData.diag_correlatas_ambientais}
      - Riscos: ${formData.diag_riscos_sucesso}
      `;

      const prompt = `Aja como um revisor jurídico sênior da Câmara Municipal de Curitiba. 
      Sua missão é garantir que o ETP seja um documento COESO, sem repetições e com textos diretos.
      
      ${fillEmpty ? `Complete TODOS os campos técnicos do ETP com base nos dados do DIAGNÓSTICO INICIAL fornecidos. 
      Os campos que você DEVE preencher são: ${emptyFields.join(', ')}.` : 'Revise e refine APENAS os campos que já possuem conteúdo. NÃO preencha campos que estão vazios.'}
      
      DIAGNÓSTICO INICIAL:
      ${diagnosticInfo}
      
      CONTEÚDO ATUAL (Para referência e revisão):
      ${filledFields.map(f => `- ${f}: ${formData[f as keyof ETPData]}`).join('\n')}

      INSTRUÇÕES DE COESÃO E QUALIDADE:
      - Garanta que os textos de cada campo se complementem sem repetir as mesmas informações ou frases prontas.
      - Se um campo já possui conteúdo, melhore a redação para que ele se conecte logicamente com os demais.
      - Mantenha os textos CURTOS, TÉCNICOS e focados no que é essencial para cada seção.
      - O "Planejamento Estratégico 2022-2031" deve ser citado APENAS na seção de Alinhamento ao Planejamento.
      - REGRA CRÍTICA: Se os dados do Diagnóstico Inicial forem insuficientes para qualquer campo, inicie o texto desse campo com "NECESSITA COMPLEMENTAÇÃO" seguido de uma linha em branco e o rascunho com colchetes [ ].
      
      Retorne obrigatoriamente um JSON puro com os campos processados. 
      ${!fillEmpty ? 'No JSON de retorno, inclua APENAS os campos que já estavam preenchidos.' : 'No JSON de retorno, inclua TODOS os campos solicitados, especialmente os que estavam vazios.'}
      REGRAS CRÍTICAS: NÃO use markdown (#, *, **). NÃO inclua introduções ou comentários nos campos. Retorne APENAS o texto final para cada campo.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json"
        }
      });

      const resultText = response.text;
      if (resultText) {
        const generatedData = JSON.parse(resultText);
        setFormData(prev => ({ ...prev, ...generatedData }));
        setShowAdvanced(true);
        setActiveTab('technical'); // Switch to technical fields after generation
      }
    } catch (err: any) {
      setApiError(err.message || "Erro na geração global. Tente preencher os campos básicos primeiro.");
    } finally {
      setIsGenerating(null);
    }
  };

  const handleExportDoc = async () => {
    if (!formData) return;
    setApiError(null);
    try {
      const filteredStructure = structure
        .filter(s => !['processo_spae', 'unidade_requisitante', 'responsavel'].includes(s.id))
        .filter(s => s.section !== '0. DIAGNÓSTICO INICIAL')
        .filter(s => s.id !== 'fotos' || (formData && formData.fotos));

      const doc = new Document({
        styles: {
          paragraphStyles: [
            {
              id: "Normal",
              name: "Normal",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: { size: 21, font: "Inter" },
              paragraph: { spacing: { line: 360 } },
            },
            {
              id: "heading1",
              name: "Heading 1",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: { size: 36, bold: true, color: "000000" },
              paragraph: { alignment: AlignmentType.CENTER, border: { bottom: { style: "single", size: 12, color: "000000" } }, spacing: { after: 400 } },
            },
            {
              id: "heading2",
              name: "Heading 2",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: { size: 24, bold: true, color: "000000" },
              paragraph: { 
                shading: { fill: "F0F0F0" }, 
                border: { top: { style: "single", size: 6 }, bottom: { style: "single", size: 6 }, left: { style: "single", size: 6 }, right: { style: "single", size: 6 } },
                spacing: { before: 400, after: 200 } 
              },
            },
            {
              id: "heading3",
              name: "Heading 3",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: { size: 22, bold: true, color: "000000" },
              paragraph: { 
                border: { bottom: { style: "single", size: 6, color: "EEEEEE" } },
                spacing: { before: 300, after: 100 } 
              },
            },
          ],
        },
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [new TextRun({ text: "ESTUDO TÉCNICO PRELIMINAR", bold: true })],
              style: "heading1",
            }),
            new Paragraph({
              children: [new TextRun({ text: formData.etp_name || "Sem título", size: 24, bold: true })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),
            new Paragraph({
              children: [new TextRun({ text: "I - INFORMAÇÕES GERAIS", bold: true })],
              style: "heading2",
            }),
            new Paragraph({
              children: [new TextRun({ text: "1. IDENTIFICAÇÃO DO PROCESSO E ÁREA REQUISITANTE", bold: true })],
              style: "heading3",
            }),
            new DocxTable({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new DocxTableRow({
                  children: [
                    new DocxTableCell({ 
                      shading: { fill: "F9F9F9" },
                      children: [new Paragraph({ children: [new TextRun({ text: "Nº Processo SPAE", size: 18, bold: true })] })] 
                    }),
                    new DocxTableCell({ 
                      shading: { fill: "F9F9F9" },
                      children: [new Paragraph({ children: [new TextRun({ text: "Área Demandante", size: 18, bold: true })] })] 
                    }),
                  ],
                }),
                new DocxTableRow({
                  children: [
                    new DocxTableCell({ children: [new Paragraph({ children: [new TextRun(formData.processo_spae || "---")] })] }),
                    new DocxTableCell({ children: [new Paragraph({ children: [new TextRun(formData.unidade_requisitante || "---")] })] }),
                  ],
                }),
              ],
            }),
            ...filteredStructure
              .filter(item => item.id !== 'assinaturas')
              .flatMap(item => {
                const elements: any[] = [];
                const firstInSection = filteredStructure.find(s => s.section === item.section)?.id === item.id;
                
                if (firstInSection && item.section && item.section !== 'I - INFORMAÇÕES GERAIS') {
                  elements.push(new Paragraph({ children: [new TextRun({ text: item.section, bold: true })], style: "heading2" }));
                }

                elements.push(new Paragraph({
                  children: [new TextRun({ text: item.label.toUpperCase(), bold: true })],
                  style: "heading3",
                }));

                let content = String(formData[item.id] || "---");
                
                if (item.id === 'requisitos_header' && (!formData[item.id] || formData[item.id] === '')) {
                  return elements;
                }

                if (item.id === 'tabela_estimativa_quantitativos_precos') {
                  const parser = new DOMParser();
                  const htmlDoc = parser.parseFromString(content, 'text/html');
                  const tableElement = htmlDoc.querySelector('table');
                  
                  if (tableElement) {
                    const rows = Array.from(tableElement.querySelectorAll('tr'));
                    elements.push(new DocxTable({
                      width: { size: 100, type: WidthType.PERCENTAGE },
                      rows: rows.map(row => new DocxTableRow({
                        children: Array.from(row.querySelectorAll('td, th')).map(cell => new DocxTableCell({
                          shading: cell.tagName === 'TH' ? { fill: "F5F5F5" } : undefined,
                          children: [new Paragraph({ children: [new TextRun({ text: cell.textContent || "", bold: cell.tagName === 'TH' })] })],
                        })),
                      })),
                    }));
                    return elements;
                  }
                  content = htmlDoc.body.textContent || "";
                }

                if (item.id === 'fotos' && formData.fotos) {
                  try {
                    const images = JSON.parse(formData.fotos);
                    images.forEach((img: string) => {
                      if (img && img.includes('base64')) {
                        elements.push(new Paragraph({
                          children: [
                            new ImageRun({
                              data: base64ToUint8Array(img),
                              transformation: {
                                width: 500,
                                height: 350,
                              },
                            } as any),
                          ],
                          alignment: AlignmentType.CENTER,
                          spacing: { before: 200, after: 200 }
                        }));
                      }
                    });
                    return elements;
                  } catch (e) {
                    return elements;
                  }
                }

                elements.push(new Paragraph({
                  children: [new TextRun(String(content))],
                  alignment: AlignmentType.JUSTIFIED,
                  spacing: { after: 200 }
                }));

                return elements;
              }),
            new Paragraph({ children: [new TextRun("")], spacing: { before: 600 } }),
            new DocxTable({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: (() => {
                const signatureLines = (formData.assinaturas || "")
                  .split('\n')
                  .map(line => line.trim())
                  .filter(line => line.length > 0);

                const rows: DocxTableRow[] = [];
                for (let i = 0; i < signatureLines.length; i += 2) {
                  const left = signatureLines[i];
                  const right = signatureLines[i + 1];

                  const rowChildren = [];
                  
                  // Left signature
                  const [leftName, leftDept] = left.split(',').map(s => s.trim());
                  rowChildren.push(new DocxTableCell({
                    borders: { top: { style: "single", size: 6 } },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: (leftName || "").toUpperCase(), size: 18, bold: true })],
                        alignment: AlignmentType.CENTER,
                      }),
                      new Paragraph({
                        children: [new TextRun({ text: leftDept || "", size: 16 })],
                        alignment: AlignmentType.CENTER,
                      })
                    ]
                  }));

                  // Right signature (if exists)
                  if (right) {
                    const [rightName, rightDept] = right.split(',').map(s => s.trim());
                    rowChildren.push(new DocxTableCell({
                      borders: { top: { style: "single", size: 6 } },
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: (rightName || "").toUpperCase(), size: 18, bold: true })],
                          alignment: AlignmentType.CENTER,
                        }),
                        new Paragraph({
                          children: [new TextRun({ text: rightDept || "", size: 16 })],
                          alignment: AlignmentType.CENTER,
                        })
                      ]
                    }));
                  } else {
                    rowChildren.push(new DocxTableCell({ borders: { top: { style: "none" } }, children: [] }));
                  }

                  rows.push(new DocxTableRow({ children: rowChildren }));
                  rows.push(new DocxTableRow({ children: [new DocxTableCell({ children: [new Paragraph({ children: [new TextRun("")] })] }), new DocxTableCell({ children: [new Paragraph({ children: [new TextRun("")] })] })] }));
                }
                return rows;
              })(),
            }),
            new Paragraph({
              children: [new TextRun(`Curitiba, ____ de ____________ de 202_.`)],
              alignment: AlignmentType.CENTER,
              spacing: { before: 600 }
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `ETP_${formData.etp_name || 'Digital'}.docx`);
    } catch (err: any) {
      console.error("Erro ao exportar DOCX:", err);
      setApiError("Erro ao exportar DOCX. Verifique se os dados estão corretos.");
    }
  };

  const handlePrint = () => {
    if (!formData) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>ETP DIGITAL</title>
            <style>
              body { font-family: "Inter", sans-serif; padding: 2cm; color: #1a1a1a; line-height: 1.6; }
              .doc-container { max-width: 21cm; margin: 0 auto; }
              .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #000; padding-bottom: 20px; }
              .header h1 { font-size: 18pt; margin: 0; text-transform: uppercase; }
              .section-title { background: #f0f0f0; padding: 8px 12px; font-weight: bold; text-transform: uppercase; margin-top: 30px; border: 1px solid #ccc; font-size: 12pt; }
              .field-title { font-weight: bold; text-transform: uppercase; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 4px; font-size: 11pt; }
              .field-content { font-size: 10.5pt; text-align: justify; margin-bottom: 15px; white-space: pre-wrap; color: #333; }
              .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; border: 1px solid #000; margin-bottom: 20px; }
              .info-item { padding: 8px; border-right: 1px solid #000; }
              .info-item:last-child { border-right: none; }
              .info-label { font-weight: bold; font-size: 9pt; text-transform: uppercase; display: block; margin-bottom: 4px; }
              .info-value { font-size: 10pt; }
              .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
              .signature-box { border-top: 1px solid #000; padding-top: 8px; text-align: center; font-size: 9pt; }
              .tiptap-content table { border-collapse: collapse; width: 100%; margin: 10px 0; }
              .tiptap-content td, .tiptap-content th { border: 1px solid #000; padding: 5px; text-align: left; font-size: 10pt; }
              .tiptap-content th { background: #f5f5f5; }
              @media print {
                body { padding: 0; }
                .doc-container { width: 100%; }
              }
            </style>
          </head>
          <body>
            <div class="doc-container">
              <div class="header">
                <h1>ESTUDO TÉCNICO PRELIMINAR</h1>
                <div style="font-size: 12pt; margin-top: 10px; font-weight: bold;">${formData.etp_name || 'Sem título'}</div>
              </div>

              <div class="section-title">I - INFORMAÇÕES GERAIS</div>
              <div class="field-title">1. IDENTIFICAÇÃO DO PROCESSO E ÁREA REQUISITANTE</div>
              <div class="info-grid" style="grid-template-columns: 1fr 1fr;">
                <div class="info-item">
                  <span class="info-label">Nº Processo SPAE</span>
                  <div class="info-value">${formData.processo_spae || '---'}</div>
                </div>
                <div class="info-item">
                  <span class="info-label">Área Demandante</span>
                  <div class="info-value">${formData.unidade_requisitante || '---'}</div>
                </div>
              </div>

              ${structure
                .filter(s => !['processo_spae', 'unidade_requisitante', 'responsavel', 'assinaturas'].includes(s.id))
                .filter(s => s.section !== '0. DIAGNÓSTICO INICIAL')
                .map(item => {
                  const content = formData[item.id];
                  if (item.id === 'fotos' && !content) return '';
                  
                  // Section header logic
                  const itemsInSection = structure.filter(s => s.section === item.section && s.section !== '0. DIAGNÓSTICO INICIAL' && !['processo_spae', 'unidade_requisitante', 'responsavel', 'assinaturas'].includes(s.id));
                  const isFirstInSection = itemsInSection[0]?.id === item.id;
                  const sectionHeader = (isFirstInSection && item.section && item.section !== 'I - INFORMAÇÕES GERAIS') 
                    ? `<div class="section-title">${item.section}</div>` 
                    : '';

                  if (item.id === 'requisitos_header') {
                    return `
                      ${sectionHeader}
                      <div class="field-title">${item.label}</div>
                      ${content ? `<div class="field-content">${content}</div>` : ''}
                    `;
                  }

                  let displayContent = '';
                  if (item.id === 'tabela_estimativa_quantitativos_precos') {
                    displayContent = `<div class="tiptap-content">${String(content || '---')}</div>`;
                  } else if (item.id === 'fotos') {
                    try {
                      const images = JSON.parse(String(content));
                      displayContent = `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-top: 10px;">
                        ${images.map((img: string) => `<img src="${img}" style="width: 100%; border-radius: 8px; border: 1px solid #ccc;" />`).join('')}
                      </div>`;
                    } catch (e) { displayContent = ''; }
                  } else {
                    displayContent = `<div class="field-content">${content || '---'}</div>`;
                  }

                  return `
                    ${sectionHeader}
                    <div class="field-title">${item.label}</div>
                    ${displayContent}
                  `;
                }).join('')}

              <div class="signature-grid">
                ${(formData.assinaturas || "")
                  .split('\n')
                  .map(line => line.trim())
                  .filter(line => line.length > 0)
                  .map(line => {
                    const [name, dept] = line.split(',').map(s => s.trim());
                    return `
                      <div class="signature-box">
                        <strong>${(name || "").toUpperCase()}</strong><br/>
                        ${dept || ""}
                      </div>
                    `;
                  }).join('')}
              </div>
              <div style="margin-top: 40px; text-align: center;">
                Curitiba, ____ de ____________ de 202_.
              </div>
            </div>
            <script>
              window.onload = () => {
                window.focus();
                window.print();
                window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.focus();
      window.print();
    }
  };

  const handleClearData = () => {
    setFormData(INITIAL_STATE);
    localStorage.removeItem('etp_pro_v4');
    setShowClearConfirm(false);
    setShowAdvanced(false);
    setViewMode('edit');
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={48} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-12 rounded-[40px] shadow-2xl border border-slate-200 max-w-md w-full text-center"
        >
          <div className="bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-indigo-200">
            <Icon name="Wand2" size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">ETP DIGITAL v2</h1>
          <p className="text-slate-500 mb-10 leading-relaxed">
            Acesse com sua conta institucional para gerenciar seus Estudos Técnicos Preliminares.
          </p>
          
          {apiError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold leading-relaxed">
              {apiError}
            </div>
          )}

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className={`w-full bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-all shadow-sm ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoggingIn ? (
              <Loader2 size={20} className="animate-spin text-indigo-600" />
            ) : (
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            )}
            {isLoggingIn ? 'Autenticando...' : 'Entrar com Google'}
          </button>
          <p className="mt-8 text-[10px] text-slate-400 uppercase font-black tracking-widest">
            Câmara Municipal de Curitiba
          </p>
        </motion.div>
      </div>
    );
  }

  const Modals = () => (
    <AnimatePresence>
      {showGlobalConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border border-slate-200"
          >
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6">
              <Icon name="Sparkles" size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Assistente de Geração Completa</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-8">
              Deseja que a IA sugira o texto para todos os campos técnicos que ainda estão em branco? Isso criará uma primeira versão completa do seu ETP.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleGlobalGenerate(true)}
                className="w-full px-6 py-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                <Icon name="Wand2" size={16} /> Sim, Sugerir Texto para Campos Vazios
              </button>
              <button 
                onClick={() => handleGlobalGenerate(false)}
                className="w-full px-6 py-4 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="Edit3" size={16} /> Não, Apenas Refinar Textos Existentes
              </button>
              <button 
                onClick={() => setShowGlobalConfirm(false)}
                className="w-full px-6 py-3 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200"
          >
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6">
              <Icon name="Trash2" size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Excluir ETP?</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-8">
              Tem certeza que deseja excluir este Estudo Técnico Preliminar?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-6 py-3 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => deleteConfirmId && deleteDraft(deleteConfirmId)}
                className="flex-1 px-6 py-3 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
              >
                Sim, Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200"
          >
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6">
              <Icon name="AlertTriangle" size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Excluir Usuário?</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Você está prestes a excluir permanentemente o usuário <span className="font-bold text-slate-900">{userToDelete.email}</span>. Esta ação não pode ser desfeita.
            </p>
            
            <label className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl border border-red-100 mb-8 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={confirmDeleteCheckbox}
                onChange={(e) => setConfirmDeleteCheckbox(e.target.checked)}
                className="w-5 h-5 rounded border-red-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-xs font-bold text-red-700 uppercase tracking-tight">Tenho certeza</span>
            </label>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setUserToDelete(null);
                  setConfirmDeleteCheckbox(false);
                }}
                className="flex-1 px-6 py-3 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                disabled={!confirmDeleteCheckbox}
                onClick={() => deleteUser(userToDelete.uid)}
                className={`flex-1 px-6 py-3 rounded-xl text-xs font-bold text-white transition-all shadow-lg ${confirmDeleteCheckbox ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-slate-300 cursor-not-allowed shadow-none'}`}
              >
                Sim, Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200"
          >
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-6">
              <Icon name="AlertTriangle" size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Iniciar Novo ETP?</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-8">
              Isso irá apagar permanentemente todos os dados preenchidos até agora. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-6 py-3 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setFormData(INITIAL_STATE);
                  setCurrentDraftId(null);
                  setShowClearConfirm(false);
                  setShowAdvanced(false);
                }}
                className="flex-1 px-6 py-3 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
              >
                Sim, Limpar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {helpPopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Icon name="Info" size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-900">Orientações de Preenchimento</h3>
              </div>
              <button onClick={() => setHelpPopup(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Icon name="X" size={20} className="text-slate-400" />
              </button>
            </div>
            
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
              <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-4">{helpPopup.title}</h4>
              <div className="text-slate-600 text-sm leading-relaxed space-y-4 whitespace-pre-wrap">
                {helpPopup.content}
              </div>
            </div>
            
            <button 
              onClick={() => setHelpPopup(null)}
              className="w-full mt-8 px-6 py-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
            >
              Entendi
            </button>
          </motion.div>
        </div>
      )}

      {examplePopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Icon name="Eye" size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-900">Exemplos de Resposta</h3>
              </div>
              <button onClick={() => setExamplePopup(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Icon name="X" size={20} className="text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-6">
              {examplePopup.examples.map((ex, idx) => (
                <div key={idx} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-2">{ex.title}</h4>
                  <p className="text-slate-600 text-sm leading-relaxed italic">{ex.content}</p>
                  <button 
                    onClick={() => {
                      setFormData(prev => ({ ...prev, [examplePopup.fieldId]: ex.content.replace(/^"|"$/g, '') }));
                      setExamplePopup(null);
                    }}
                    className="mt-4 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors flex items-center gap-1"
                  >
                    <Icon name="PlusCircle" size={12} /> Usar este exemplo
                  </button>
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => setExamplePopup(null)}
              className="w-full mt-8 px-6 py-3 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Fechar
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (userStatus === 'pending' || userStatus === 'disabled') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-12 rounded-[40px] shadow-2xl border border-slate-200 max-w-lg w-full text-center"
        >
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl ${userStatus === 'pending' ? 'bg-orange-50 text-orange-600 shadow-orange-100' : 'bg-red-50 text-red-600 shadow-red-100'}`}>
            <Icon name={userStatus === 'pending' ? "Loader2" : "ShieldCheck"} size={40} className={userStatus === 'pending' ? "animate-spin" : ""} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">
            {userStatus === 'pending' ? "Aguardando Aprovação" : "Acesso Desabilitado"}
          </h2>
          <p className="text-slate-500 mb-10 leading-relaxed">
            {userStatus === 'pending' 
              ? "Seu perfil foi criado com sucesso, mas ainda precisa ser aprovado por um administrador master da CMC para liberar o acesso ao sistema."
              : "Seu acesso ao sistema foi desabilitado por um administrador. Entre em contato com a Diretoria de Contratações se considerar isso um erro."}
          </p>
          <button 
            onClick={handleLogout}
            className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
          >
            Sair da Conta
          </button>
        </motion.div>
      </div>
    );
  }

  const renderDashboard = () => (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Meus ETPs</h2>
          <p className="text-slate-500">Gerencie seus rascunhos e documentos finalizados.</p>
        </div>
        <div className="flex gap-3">
          {userRole === 'master' && (
            <div className="flex gap-2">
              <label className="bg-slate-100 text-slate-600 px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-200 transition-all cursor-pointer">
                <Icon name="Download" size={16} className="rotate-180" /> Importar Backup
                <input type="file" className="hidden" accept=".json" onChange={importBackup} />
              </label>
              <button 
                onClick={exportBackup}
                className="bg-slate-100 text-slate-600 px-4 py-3 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-200 transition-all"
              >
                <Icon name="Download" size={16} /> Exportar Backup
              </button>
              <button 
                onClick={() => setView('admin')}
                className="relative bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-black transition-all"
              >
                <Icon name="ShieldCheck" size={18} /> Painel Master
                {pendingUsersCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
                    {pendingUsersCount}
                  </span>
                )}
              </button>
            </div>
          )}
          <button 
            onClick={createNewETP}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Icon name="PlusCircle" size={18} /> Novo ETP
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {drafts.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-slate-200">
            <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4">
              <Icon name="FileText" size={32} />
            </div>
            <p className="text-slate-400 font-bold">Nenhum ETP encontrado.</p>
            <button onClick={createNewETP} className="text-indigo-600 text-sm font-bold mt-2 hover:underline">Começar meu primeiro ETP</button>
          </div>
        ) : (
          drafts.map(draft => (
            <motion.div 
              key={draft.id}
              whileHover={{ y: -5 }}
              className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-xl transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                  <Icon name="FileText" size={24} />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => loadDraft(draft, false)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                    <Icon name="Edit3" size={16} />
                  </button>
                  <button onClick={() => setDeleteConfirmId(draft.id)} className="p-2 text-slate-300 hover:text-red-600 transition-colors">
                    <Icon name="Trash2" size={16} />
                  </button>
                </div>
              </div>
              <h3 className="font-black text-slate-900 mb-1 line-clamp-2">{draft.title}</h3>
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-4">
                Atualizado em: {draft.updatedAt?.toDate().toLocaleDateString('pt-BR')}
              </p>
              <button 
                onClick={() => loadDraft(draft, false)}
                className="w-full py-3 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold group-hover:bg-indigo-600 group-hover:text-white transition-all"
              >
                Abrir ETP
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-12">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Painel Master</h2>
          <p className="text-slate-500">Visualização global de todos os ETPs e usuários da Câmara.</p>
        </div>
        <button 
          onClick={() => setView('dashboard')}
          className="bg-slate-100 text-slate-600 px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-200 transition-all"
        >
          <Icon name="ChevronDown" size={18} className="rotate-90" /> Voltar
        </button>
      </div>

      <div className="flex gap-1 mb-8 bg-slate-100 p-1 rounded-2xl w-fit">
        <button 
          onClick={() => setAdminTab('etps')}
          className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${adminTab === 'etps' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Documentos ETP
        </button>
        <button 
          onClick={() => setAdminTab('users')}
          className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${adminTab === 'users' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Gerenciar Usuários
        </button>
        <button 
          onClick={() => setAdminTab('trash')}
          className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${adminTab === 'trash' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Lixeira (24h)
        </button>
      </div>

      {adminTab === 'etps' ? (
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Título / Objeto</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Autor</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map(draft => (
                <tr key={draft.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{draft.title}</div>
                    <div className="text-[10px] text-slate-400 uppercase">{draft.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-600">{draft.userEmail}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-600">{draft.updatedAt?.toDate().toLocaleDateString('pt-BR')}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => loadDraft(draft, true)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-2">
                        <Icon name="Eye" size={16} />
                        <span className="text-[10px] font-bold uppercase">Visualizar</span>
                      </button>
                      <button onClick={() => setDeleteConfirmId(draft.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                        <Icon name="Trash2" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : adminTab === 'users' ? (
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome / E-mail</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargo</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map(u => {
                const isOnline = u.lastActive && (Date.now() - u.lastActive.toMillis() < 300000); // 5 minutes threshold
                
                return (
                  <tr key={u.uid} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-bold text-xs">
                            {u.displayName?.substring(0, 2).toUpperCase() || '??'}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-slate-300'}`} title={isOnline ? 'Online agora' : 'Offline'} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            {u.displayName}
                            {isOnline && <span className="text-[8px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">Ativo</span>}
                          </div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      u.status === 'approved' ? 'bg-green-100 text-green-700' : 
                      u.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {u.status === 'approved' ? 'Aprovado' : u.status === 'pending' ? 'Pendente' : 'Desabilitado'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={u.role}
                      onChange={(e) => updateUserRole(u.uid, e.target.value as any)}
                      className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none"
                    >
                      <option value="user">Servidor</option>
                      <option value="master">Master</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {u.status !== 'approved' && (
                        <button 
                          onClick={() => updateUserStatus(u.uid, 'approved')}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-bold hover:bg-green-700 transition-all"
                        >
                          Aprovar
                        </button>
                      )}
                      {u.status === 'approved' && u.role !== 'master' && (
                        <button 
                          onClick={() => updateUserStatus(u.uid, 'disabled')}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold hover:bg-red-100 transition-all"
                        >
                          Desabilitar
                        </button>
                      )}
                      {u.status === 'disabled' && (
                        <button 
                          onClick={() => updateUserStatus(u.uid, 'approved')}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-all"
                        >
                          Reativar
                        </button>
                      )}
                      <button 
                        onClick={() => setUserToDelete(u)}
                        className="p-2 text-slate-300 hover:text-red-600 transition-colors"
                        title="Excluir Usuário Permanentemente"
                      >
                        <Icon name="Trash2" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Título / Objeto</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Excluído por</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tempo Restante</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody>
              {trashDrafts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-bold italic">
                    Lixeira vazia.
                  </td>
                </tr>
              ) : (
                trashDrafts.map(draft => {
                  const deletedAt = draft.deletedAt?.toDate().getTime() || 0;
                  const timeLeft = Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - deletedAt));
                  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                  const minsLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                  return (
                    <tr key={draft.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{draft.title}</div>
                        <div className="text-[10px] text-slate-400 uppercase italic">ID: {draft.id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600">{draft.userEmail}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm font-black ${hoursLeft < 2 ? 'text-red-500' : 'text-amber-500'}`}>
                          {hoursLeft}h {minsLeft}m
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => restoreDraft(draft.id)} 
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-[10px] font-black uppercase tracking-widest"
                          >
                            <Icon name="PlusCircle" size={14} /> Restaurar
                          </button>
                          <button 
                            onClick={() => permanentDeleteDraft(draft.id)} 
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            title="Excluir Permanentemente"
                          >
                            <Icon name="Trash2" size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Modals />
      
      {view === 'dashboard' ? (
        <>
          <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg">
                  <Icon name="Wand2" size={18} />
                </div>
                <h1 className="text-sm font-black uppercase tracking-tight">ETP DIGITAL</h1>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{userRole === 'master' ? 'Master' : 'Servidor'}</div>
                  <div className="text-xs font-bold text-slate-700">{user.displayName}</div>
                </div>
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                  <Icon name="X" size={20} />
                </button>
              </div>
            </div>
          </header>
          {renderDashboard()}
        </>
      ) : view === 'admin' ? (
        <>
          <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-2 rounded-xl text-white shadow-lg">
                  <Icon name="ShieldCheck" size={18} />
                </div>
                <h1 className="text-sm font-black uppercase tracking-tight">ADMINISTRAÇÃO</h1>
              </div>
              <button onClick={() => setView('dashboard')} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                <Icon name="X" size={20} />
              </button>
            </div>
          </header>
          {renderAdmin()}
        </>
      ) : (
        <div className="pb-20 text-slate-900">
          <header className="bg-white border-b border-slate-200 sticky top-0 z-40 no-print shadow-sm">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    setView(isAdminViewing ? 'admin' : 'dashboard');
                    setIsAdminViewing(false);
                  }} 
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <Icon name="ChevronDown" size={20} className="rotate-90 text-slate-400" />
                </button>
                <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg">
                  <Icon name="Wand2" size={18} />
                </div>
                <h1 className="text-sm font-black uppercase tracking-tight">
                  {isAdminViewing ? "VISUALIZAÇÃO ADMIN" : "EDITOR DE ETP"}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {!isAdminViewing && (
                  <div className="flex items-center gap-2 mr-4 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                    <div className={`w-2 h-2 rounded-full ${isSaving ? 'bg-orange-400 animate-pulse' : 'bg-green-500'}`} />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {isSaving ? 'Salvando...' : 'Sincronizado'}
                    </span>
                  </div>
                )}
                {!isAdminViewing && (
                  <button 
                    onClick={() => saveDraft(true)}
                    disabled={isSaving}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                  >
                    <Icon name="CheckCircle" size={14} className={isSaving ? "animate-pulse text-orange-400" : "text-green-500"} />
                    Salvar
                  </button>
                )}
                {isAdminViewing && (
                  <div className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-100 flex items-center gap-2 mr-4">
                    <Icon name="ShieldCheck" size={14} />
                    Modo Somente Leitura
                  </div>
                )}
                <button 
                  onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                >
                  <Icon name={viewMode === 'edit' ? 'Eye' : 'Edit3'} size={14} />
                  {viewMode === 'edit' ? 'Visualizar' : 'Editar'}
                </button>
                <button 
                  onClick={handleExportDoc}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center gap-2"
                >
                  <Icon name="FileDown" size={14} />
                  DOCX
                </button>
                <button 
                  onClick={handlePrint}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                >
                  <Icon name="Printer" size={14} />
                  Imprimir
                </button>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-6 py-12 no-print">
            {viewMode === 'edit' ? (
              <div className="flex flex-col lg:flex-row gap-8">
              {/* TREE SIDEBAR */}
              <aside className={`transition-all duration-300 ease-in-out ${sidebarCollapsed ? 'w-12' : 'w-full lg:w-80'} sticky top-28 h-[calc(100vh-140px)] flex flex-col no-print`}>
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    {!sidebarCollapsed && <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estrutura do ETP</h3>}
                    <button 
                      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
                    >
                      <Icon name={sidebarCollapsed ? "ChevronRight" : "ChevronLeft"} size={16} />
                    </button>
                  </div>

                  {!sidebarCollapsed && (
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      {/* TAB SWITCHER IN SIDEBAR */}
                      <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
                        <button 
                          onClick={() => setActiveTab('diagnostic')}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all ${activeTab === 'diagnostic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Diagnóstico
                        </button>
                        <button 
                          onClick={() => isMandatoryFilled() && setActiveTab('technical')}
                          disabled={!isMandatoryFilled()}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-tight rounded-lg transition-all ${activeTab === 'technical' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 disabled:opacity-30'}`}
                        >
                          Técnico
                        </button>
                      </div>

                      <nav className="space-y-4">
                        {Array.from(new Set(structure.map(s => s.section))).map(section => {
                          const isDiagnosticSection = section === '0. DIAGNÓSTICO INICIAL';
                          if (activeTab === 'diagnostic' && !isDiagnosticSection) return null;
                          if (activeTab === 'technical' && isDiagnosticSection) return null;

                          const sectionItems = structure.filter(s => s.section === section);
                          const isExpanded = expandedSections.includes(section!);

                          return (
                            <div key={section} className="space-y-1">
                              <button 
                                onClick={() => toggleSection(section!)}
                                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left group transition-colors"
                              >
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider group-hover:text-indigo-600">{section}</span>
                                <Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} size={12} className="text-slate-300" />
                              </button>
                              
                              {isExpanded && (
                                <div className="pl-2 space-y-0.5 border-l-2 border-slate-50 ml-2">
                                  {sectionItems.map(item => (
                                    <a 
                                      key={item.id}
                                      href={`#${item.id}`}
                                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                    >
                                      <Icon name={item.icon} size={12} />
                                      <span className="truncate">{item.label}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </nav>
                    </div>
                  )}

                  {!sidebarCollapsed && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                      <button 
                        onClick={() => setShowGlobalConfirm(true)}
                        disabled={!isMandatoryFilled() || !!isGenerating}
                        className={`w-full py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${isMandatoryFilled() ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                      >
                        <Icon name="Sparkles" size={14} />
                        Gerar ETP Completo
                      </button>
                    </div>
                  )}
                </div>
              </aside>

              <div className="flex-1 space-y-6">
                {/* STEP INDICATOR */}
                <div className="flex items-center justify-center gap-4 mb-8 no-print">
                  <button 
                    onClick={() => setActiveTab('diagnostic')}
                    className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all ${activeTab === 'diagnostic' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white text-slate-400 border border-slate-200 hover:border-indigo-200'}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${activeTab === 'diagnostic' ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>1</div>
                    <span className="text-xs font-black uppercase tracking-widest">Diagnóstico</span>
                  </button>
                  <div className="w-12 h-px bg-slate-200" />
                  <button 
                    onClick={() => isMandatoryFilled() && setActiveTab('technical')}
                    disabled={!isMandatoryFilled()}
                    className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all ${activeTab === 'technical' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white text-slate-400 border border-slate-200 hover:border-indigo-200 disabled:opacity-50'}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${activeTab === 'technical' ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>2</div>
                    <span className="text-xs font-black uppercase tracking-widest">Detalhamento Técnico</span>
                  </button>
                </div>

                {activeTab === 'diagnostic' ? (
                  <div className="space-y-6">
                    {/* ETP NAME FIELD */}
                    <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                          <Icon name="Wand2" size={24} />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-slate-900 tracking-tight">Comece por aqui</h2>
                          <p className="text-slate-500 text-sm">Dê um nome ao seu projeto e responda ao diagnóstico inicial para liberar a IA.</p>
                        </div>
                      </div>
                      
                      <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        <Icon name="Edit3" size={14} />
                        Nome do ETP (Identificação Interna)
                      </label>
                      <input 
                        type="text"
                        value={formData?.etp_name || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, etp_name: e.target.value }))}
                        placeholder="Ex: Aquisição de Notebooks - TI 2026"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                      />
                    </div>

                    <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                          <Icon name="ClipboardList" size={20} />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-slate-900 tracking-tight">Diagnóstico Inicial</h2>
                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Responda para fundamentar o estudo</p>
                        </div>
                      </div>

                      <div className="space-y-8">
                        {structure.filter(item => item.section === '0. DIAGNÓSTICO INICIAL').map(item => (
                          <div key={item.id} id={item.id} className="group scroll-mt-24">
                            <div className="flex justify-between items-start mb-3">
                              <label className="flex items-center gap-2 text-[11px] font-black text-slate-600 uppercase tracking-tight">
                                <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-indigo-600 text-[10px] group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                  {structure.filter(s => s.section === '0. DIAGNÓSTICO INICIAL').indexOf(item) + 1}
                                </span>
                                {item.label}
                              </label>
                              {item.examples && (
                                <button 
                                  onClick={() => setExamplePopup({ fieldId: item.id, examples: item.examples! })}
                                  className="text-[10px] font-black text-indigo-600 uppercase bg-white border border-indigo-100 px-4 py-2 rounded-xl hover:bg-indigo-50 transition-all shadow-sm flex items-center gap-2"
                                >
                                  <Icon name="Lightbulb" size={12} /> Ver Exemplos
                                </button>
                              )}
                            </div>
                            <textarea 
                              value={(formData && formData[item.id]) || ''} 
                              onChange={(e) => setFormData(prev => ({...prev, [item.id]: e.target.value}))} 
                              className="textarea-clean min-h-[120px] text-sm font-medium text-slate-600 bg-slate-50/50 border-slate-100 focus:bg-white focus:border-indigo-200" 
                              placeholder={item.placeholder}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center">
                        {!isMandatoryFilled() ? (
                          <div className="text-center space-y-4">
                            <div className="flex justify-center gap-2">
                              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                <div key={i} className={`w-3 h-3 rounded-full transition-all ${String(formData[`diag_${['problema_necessidade', 'alternativas_solucao', 'objeto_vigencia', 'exigencias_padroes', 'quantidades_valor', 'parcelamento_providencias', 'correlatas_ambientais', 'riscos_sucesso'][i-1]}` as keyof ETPData] || '').length > 10 ? 'bg-green-500 scale-110' : 'bg-slate-200'}`} />
                              ))}
                            </div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Complete o diagnóstico para prosseguir</p>
                          </div>
                        ) : (
                          <motion.button 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            onClick={() => setShowGlobalConfirm(true)}
                            className="bg-indigo-600 text-white px-10 py-5 rounded-[32px] font-black uppercase tracking-widest text-sm hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 flex items-center gap-4 group"
                          >
                            <div className="bg-white/20 p-2 rounded-xl group-hover:rotate-12 transition-transform">
                              <Icon name="Sparkles" size={24} />
                            </div>
                            Gerar Estudo Técnico Completo
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-white shadow-lg">
                          <Icon name="Settings2" size={20} />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-slate-900 tracking-tight">Campos Obrigatórios</h2>
                          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Detalhamento Técnico do Objeto</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setActiveTab('diagnostic')}
                        className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-2 hover:underline"
                      >
                        <Icon name="ArrowLeft" size={12} /> Voltar ao Diagnóstico
                      </button>
                    </div>

                    {structure.filter(item => item.section !== '0. DIAGNÓSTICO INICIAL' && !['processo_spae', 'unidade_requisitante', 'responsavel'].includes(item.id)).map(item => (
                      <div key={item.id} id={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-24 transition-all hover:shadow-md">
                        <div className="px-6 py-4 bg-slate-50 border-b flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600">
                              <Icon name={item.icon} size={16} />
                            </div>
                            <div>
                              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-600">{item.label}</h3>
                              {item.instruction && <p className="text-[9px] text-slate-400 font-medium uppercase mt-0.5">{item.instruction}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.helpText && (
                              <button 
                                onClick={() => setHelpPopup({ title: item.label, content: item.helpText! })}
                                className="text-[9px] font-black text-slate-600 uppercase bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all"
                              >
                                <Icon name="Info" size={10} />
                                Ajuda
                              </button>
                            )}
                            {item.isAiEnabled !== false && (
                              <button 
                                onClick={() => handleAiAssist(item.id)} 
                                disabled={isGenerating !== null} 
                                className="text-[9px] font-black text-indigo-600 uppercase bg-white border border-indigo-100 px-3 py-1.5 rounded-full hover:bg-indigo-50 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                              >
                                {isGenerating === item.id ? <Loader2 size={10} className="animate-spin" /> : <Icon name="Sparkles" size={10} />}
                                Refinar com IA
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="p-6">
                          {item.id === 'tabela_estimativa_quantitativos_precos' ? (
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                              <JoditEditor 
                                value={(formData && formData[item.id]) || ''} 
                                config={{
                                  readonly: false,
                                  toolbarAdaptive: false,
                                  buttons: [
                                    'table', '|',
                                    'bold', 'italic', 'underline', '|',
                                    'align', 'list', '|',
                                    'undo', 'redo', '|',
                                    'fullsize', 'source'
                                  ],
                                  height: 400,
                                  placeholder: 'Utilize a ferramenta de tabela acima para compor os quantitativos e preços...',
                                  language: 'pt_br',
                                  askBeforePasteHTML: false,
                                  askBeforePasteFromWord: false,
                                  defaultActionOnPaste: 'insert_clear_html',
                                }}
                                onBlur={(newContent) => setFormData(prev => ({...prev, [item.id]: newContent}))} 
                              />
                            </div>
                          ) : item.id === 'fotos' ? (
                            <FileUploader 
                              value={(formData && formData[item.id]) || ''} 
                              onChange={(value) => setFormData(prev => ({...prev, [item.id]: value}))} 
                            />
                          ) : (
                            <textarea 
                              value={(formData && formData[item.id]) || ''} 
                              onChange={(e) => setFormData(prev => ({...prev, [item.id]: e.target.value}))} 
                              className="textarea-clean min-h-[120px] text-sm resize-y focus:min-h-[250px] transition-all duration-300" 
                              placeholder={item.placeholder || "Preencha aqui..."}
                            />
                          )}
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-center py-8">
                      <button 
                        onClick={() => setShowGlobalConfirm(true)}
                        disabled={!!isGenerating}
                        className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-3"
                      >
                        {isGenerating === 'global' ? <Loader2 size={20} className="animate-spin" /> : <Icon name="Sparkles" size={20} />}
                        Regerar Estudo Completo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white shadow-2xl p-16 border border-slate-200 max-w-4xl mx-auto etp-doc rounded-3xl"
              >
                <div className="text-center mb-12 border-b-2 border-black pb-8">
                  <h1 className="text-xl font-bold uppercase underline">Estudo Técnico Preliminar (ETP)</h1>
                  <p className="text-xs font-bold mt-2">Câmara Municipal de Curitiba</p>
                </div>
                
                <div className="mb-8 p-4 border border-slate-200 rounded-xl bg-slate-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Nº Processo SPAE</span>
                      <span className="text-sm font-medium">{formData.processo_spae || '---'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Área Demandante</span>
                      <span className="text-sm font-medium">{formData.unidade_requisitante || '---'}</span>
                    </div>
                  </div>
                </div>

                {Object.entries(structure
                  .filter(s => !['processo_spae', 'unidade_requisitante', 'responsavel', 'assinaturas'].includes(s.id))
                  .filter(s => s.section !== '0. DIAGNÓSTICO INICIAL')
                  .reduce((acc, item) => {
                  const section = item.section || 'Outros';
                  if (!acc[section]) acc[section] = [];
                  acc[section].push(item);
                  return acc;
                }, {} as Record<string, ETPStructureItem[]>)).map(([section, items]) => (
                  <div key={section} className="mb-12">
                    <h3 className="text-lg font-black text-indigo-600 mb-6 border-b-2 border-indigo-100 pb-2">{section}</h3>
                    {items.map(item => {
                      const content = formData[item.id];
                      if (item.id === 'fotos' && !content) return null;

                      return (
                        <div key={item.id} className="mb-8">
                          <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">{item.label}</h4>
                          {item.id === 'tabela_estimativa_quantitativos_precos' ? (
                            <div 
                              className="tiptap-content text-sm text-slate-700"
                              dangerouslySetInnerHTML={{ __html: String(content || "Pendente.") }} 
                            />
                          ) : item.id === 'fotos' ? (
                            <div className="grid grid-cols-2 gap-4 mt-4">
                              {(() => {
                                try {
                                  const images = JSON.parse(String(content || '[]'));
                                  return images.map((img: string, idx: number) => (
                                    <img key={idx} src={img} className="w-full rounded-xl border border-slate-200" referrerPolicy="no-referrer" />
                                  ));
                                } catch (e) {
                                  return <p className="text-xs text-red-500 italic">Erro ao carregar imagens.</p>;
                                }
                              })()}
                            </div>
                          ) : (
                            <p className="text-sm text-justify leading-relaxed text-slate-700 whitespace-pre-wrap">
                              {content || "Pendente."}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                <div className="mt-16 grid grid-cols-2 gap-8">
                  {(formData.assinaturas || "")
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .map((line, idx) => {
                      const [name, dept] = line.split(',').map(s => s.trim());
                      return (
                        <div key={idx} className="border-t border-black pt-2 text-center">
                          <p className="text-xs font-black uppercase">{name || ""}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">{dept || ""}</p>
                        </div>
                      );
                    })}
                </div>
                <div className="mt-12 text-center text-xs font-bold text-slate-400">
                  Curitiba, ____ de ____________ de 202_.
                </div>
              </motion.div>
            )}
          </main>

          <div className="print-only etp-doc">
            <div style={{textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid black', paddingBottom: '20px'}}>
              <h1 style={{fontSize: '16pt', fontWeight: 'bold', textTransform: 'uppercase'}}>Estudo Técnico Preliminar</h1>
              <p style={{fontSize: '10pt'}}>Administração Pública Direta e Indireta - Lei 14.133/21</p>
            </div>
            {structure.filter(item => item.id !== 'assinaturas').map(item => {
              const content = formData[item.id];
              if (item.id === 'fotos' && !content) return null;

              return (
                <div key={item.id} style={{marginBottom: '25px'}}>
                  <h2 style={{fontSize: '12pt', fontWeight: 'bold', textTransform: 'uppercase', borderBottom: '1px solid black', marginTop: '15pt', paddingBottom: '3pt'}}>{item.label}</h2>
                  {item.id === 'tabela_estimativa_quantitativos_precos' ? (
                    <div 
                      className="tiptap-content"
                      style={{ fontSize: '11pt' }}
                      dangerouslySetInnerHTML={{ __html: String(content || "Não informado.") }} 
                    />
                  ) : item.id === 'fotos' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '10px' }}>
                      {(() => {
                        try {
                          const images = JSON.parse(String(content || '[]'));
                          return images.map((img: string, idx: number) => (
                            <img key={idx} src={img} style={{ width: '100%', borderRadius: '8px', border: '1px solid #ccc' }} referrerPolicy="no-referrer" />
                          ));
                        } catch (e) {
                          return null;
                        }
                      })()}
                    </div>
                  ) : (
                    <p style={{fontSize: '11pt', textAlign: 'justify', marginBottom: '10pt', lineHeight: '1.5', whiteSpace: 'pre-wrap'}}>
                      {content || "Não informado."}
                    </p>
                  )}
                </div>
              );
            })}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '60px' }}>
              {(formData.assinaturas || "")
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map((line, idx) => {
                  const [name, dept] = line.split(',').map(s => s.trim());
                  return (
                    <div key={idx} style={{ borderTop: '1px solid black', paddingTop: '8px', textAlign: 'center', fontSize: '10pt' }}>
                      <strong>{(name || "").toUpperCase()}</strong><br/>
                      {dept || ""}
                    </div>
                  );
                })}
            </div>
            <div style={{ marginTop: '40px', textAlign: 'center', fontSize: '11pt' }}>
              Curitiba, ____ de ____________ de 202_.
            </div>
          </div>

          <AnimatePresence>
            {isGenerating === 'global' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 no-print"
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-xs"
                >
                  <Loader2 size={40} className="mx-auto mb-4 text-indigo-600 animate-spin" />
                  <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg">Consolidando</h3>
                  <p className="text-slate-500 text-xs font-medium">Refinando rascunhos com IA...</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

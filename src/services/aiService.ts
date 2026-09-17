import { ETPData, ETPField } from "../types";

const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.8-flash"
];

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
   - NÃO inclua o nome da seção ou o título do campo no início do texto gerado.
   - NÃO repita as mesmas frases ou justificativas em múltiplos campos.
   - Retorne APENAS o texto que será inserido diretamente no documento final.
   - Em chamadas globais que solicitam JSON, retorne SEMPRE um JSON válido e puro, sem textos explicativos antes ou depois.
   - Use listas com hífens (-) para clareza quando necessário.
   - Utilize os dados de DIAGNÓSTICO INICIAL para fundamentar todas as seções.

9. REGRA DE EXCLUSÃO:
   - NUNCA gere conteúdo para o campo "assinaturas" (Assinaturas). Este campo deve permanecer vazio para preenchimento manual do usuário.

10. REGRAS PARA CAMPOS DE TABELA (MUITO IMPORTANTE):
   - Os campos "tabela_estimativa_quantitativos_precos", "tabela_riscos_interna" e "tabela_riscos_externa" DEVEM obrigatoriamente retornar uma tabela em HTML puro, seguindo EXATAMENTE a estrutura de bordas e cores das tabelas modelo (use border: 1px solid #000 e background-color: #e2e8f0 para cabeçalhos).
   - Para tabelas de riscos, marque a Probabilidade e o Impacto com "( x )" na célula correspondente e "( )" nas demais.
   - Não use classes CSS externas, apenas estilos inline (style="...").

REGRA CRÍTICA DE PREENCHIMENTO:
Se os dados fornecidos no Diagnóstico Inicial forem insuficientes para gerar um conteúdo técnico completo e preciso para um determinado campo, você DEVE:
1. Iniciar a resposta com a frase "NECESSITA COMPLEMENTAÇÃO" em letras maiúsculas.
2. Pular uma linha em branco.
3. Fornecer o melhor rascunho possível com as informações disponíveis, indicando entre colchetes [ ] o que o usuário precisa detalhar.`;

const TABLE_TEMPLATES = {
  quantitativos: `
    <table style="border-collapse:collapse;width:100%;border:1px solid #000">
      <thead>
        <tr style="background-color:#e2e8f0"><th style="border:1px solid #000;padding:8px;text-align:center">Item</th><th style="border:1px solid #000;padding:8px;text-align:center">Descrição</th><th style="border:1px solid #000;padding:8px;text-align:center">Quantidade</th><th style="border:1px solid #000;padding:8px;text-align:center">Valor Unitário</th><th style="border:1px solid #000;padding:8px;text-align:center">Valor Total</th></tr>
      </thead>
      <tbody>
        <!-- Gerar linhas aqui -->
      </tbody>
      <tfoot>
        <tr style="background-color:#e2e8f0;font-weight:bold"><td colspan="4" style="border:1px solid #000;padding:8px;text-align:center uppercase">TOTAL ESTIMADO</td><td style="border:1px solid #000;padding:8px;text-align:center">R$ [Soma Total]</td></tr>
      </tfoot>
    </table>
  `,
  riscos: (fase: "INTERNA" | "EXTERNA") => `
    <table style="border-collapse:collapse;width:100%;border:1px solid #000">
      <thead>
        <tr style="background-color:#e2e8f0"><th style="border:1px solid #000;padding:8px;text-align:right;width:15%">FASE:</th><th colspan="4" style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold">${fase}</th></tr>
        <tr style="background-color:#e2e8f0"><th colspan="5" style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold">Riscos referente a fase de análise escolhida:</th></tr>
      </thead>
      <tbody>
        <!-- Para cada risco, gerar este bloco -->
        <tr style="background-color:#f1f5f9"><th colspan="5" style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold">RISCO [N]</th></tr>
        <tr><td style="border:1px solid #000;padding:8px;font-weight:bold;width:20%">Situação de Risco:</td><td colspan="4" style="border:1px solid #000;padding:8px">[Descrever Risco]</td></tr>
        <tr><td style="border:1px solid #000;padding:8px;font-weight:bold">Probabilidade:</td><td style="border:1px solid #000;padding:8px;text-align:center">( ) Baixa</td><td style="border:1px solid #000;padding:8px;text-align:center">( ) Média</td><td colspan="2" style="border:1px solid #000;padding:8px;text-align:center">( ) Alta</td></tr>
        <tr><td style="border:1px solid #000;padding:8px;font-weight:bold">Impacto:</td><td style="border:1px solid #000;padding:8px;text-align:center">( ) Baixo</td><td style="border:1px solid #000;padding:8px;text-align:center">( ) Médio</td><td colspan="2" style="border:1px solid #000;padding:8px;text-align:center">( ) Alto</td></tr>
        <tr><td style="border:1px solid #000;padding:8px;font-weight:bold">Plano de Mitigação:</td><td colspan="4" style="border:1px solid #000;padding:8px">[Descrever Mitigação]</td></tr>
      </tbody>
    </table>
  `
};

/**
 * Resolve the Gemini API key for static client environments (e.g., GitHub Pages).
 */
export function getClientGeminiApiKey(customApiKey?: string): string | null {
  if (customApiKey && customApiKey.trim().length > 10) {
    return customApiKey.trim();
  }
  try {
    const local = localStorage.getItem("gemini_api_key");
    if (local && local.trim().length > 10) {
      return local.trim();
    }
  } catch (e) {}

  const viteKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (viteKey && typeof viteKey === "string" && viteKey.trim().length > 10) {
    return viteKey.trim();
  }

  return null;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Direct call to Gemini REST API for static deployments where /api/ai/* does not exist (GitHub Pages)
 */
async function callDirectGemini(
  apiKey: string,
  prompt: string,
  systemInstructionText: string = SYSTEM_PROMPT,
  responseMimeType?: string,
  retries: number = 3
): Promise<string> {
  let lastError: any = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    const model = CANDIDATE_MODELS[Math.min(attempt, CANDIDATE_MODELS.length - 1)];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body: any = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstructionText }] }
    };

    if (responseMimeType) {
      body.generationConfig = { responseMimeType };
    }

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        const errMsg = errData?.error?.message || resp.statusText;
        const isQuota = resp.status === 429 || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED");
        const isDemand = resp.status === 503 || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE");

        console.warn(`[Client Gemini API] Tentativa ${attempt + 1} (${model}) falhou: ${errMsg}`);
        lastError = new Error(errMsg);

        if (attempt + 1 < retries) {
          const waitTime = isQuota ? 300 : (1000 * (attempt + 1) + Math.floor(Math.random() * 400));
          await delay(waitTime);
          continue;
        } else {
          throw new Error(isQuota ? "Limite de cota temporária excedido na API Gemini. Tente novamente em instantes." : errMsg);
        }
      }

      const json = await resp.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      throw new Error("A IA retornou uma resposta sem conteúdo de texto.");
    } catch (err: any) {
      lastError = err;
      if (attempt + 1 >= retries) {
        throw err;
      }
      await delay(500);
    }
  }

  throw lastError || new Error("Falha ao comunicar com o serviço Gemini.");
}

/**
 * 1. AI Assist for a single field with automatic server-to-client failover for GitHub Pages
 */
export async function requestAiAssist(params: {
  fieldId: ETPField;
  fieldName?: string;
  instruction?: string;
  formData: ETPData;
  customApiKey?: string;
}): Promise<string> {
  const { fieldId, fieldName, instruction, formData, customApiKey } = params;

  // Step 1: Try backend Express server (/api/ai/assist)
  let backendAvailable = true;
  try {
    const fetchRes = await fetch("/api/ai/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fieldId,
        fieldName,
        instruction: instruction || "",
        formData,
        customApiKey
      })
    });

    // Check if the response is valid JSON and not a 404 / SPA HTML fallback
    const contentType = fetchRes.headers.get("content-type") || "";
    if (fetchRes.status !== 404 && contentType.includes("application/json")) {
      if (!fetchRes.ok) {
        const errJson = await fetchRes.json().catch(() => ({}));
        throw new Error(errJson.error || "Falha ao processar assistente de campo no servidor.");
      }
      const fetchJson = await fetchRes.json();
      if (fetchJson.text) {
        return fetchJson.text;
      }
      throw new Error("A IA do servidor não retornou texto.");
    } else {
      // Backend not running (e.g. GitHub Pages static hosting where /api returns 404)
      backendAvailable = false;
    }
  } catch (err: any) {
    // If it's a TypeError (NetworkError/CORS) or 404, it means we are in static hosting
    if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError") || err.message.includes("404"))) {
      backendAvailable = false;
    } else if (backendAvailable) {
      // It was an actual backend error
      throw err;
    }
  }

  // Step 2: Static fallback (e.g., GitHub Pages)
  const apiKey = getClientGeminiApiKey(customApiKey);
  if (!apiKey) {
    throw new Error(
      "Chave de API do Gemini não configurada para a versão estática (GitHub Pages)! Acesse o 'Painel Master > Configurações' e salve a Chave de API do Gemini da organização (ou configure VITE_GEMINI_API_KEY no repositório)."
    );
  }

  const diagnosticInfo = `
  - Problema/Necessidade: ${formData.diag_problema_necessidade || ""}
  - Alternativas: ${formData.diag_alternativas_solucao || ""}
  - Objeto/Vigência: ${formData.diag_objeto_vigencia || ""}
  - Exigências/Padrões: ${formData.diag_exigencias_padroes || ""}
  - Quantidades/Valor: ${formData.diag_quantidades_valor || ""}
  - Parcelamento/Providências: ${formData.diag_parcelamento_providencias || ""}
  - Correlatas/Ambientais: ${formData.diag_correlatas_ambientais || ""}
  - Riscos: ${formData.diag_riscos_sucesso || ""}
  `;

  let tableInstruction = "";
  if (fieldId === "tabela_estimativa_quantitativos_precos") {
    tableInstruction = `\nREGRAS DE TABELA: Gere uma tabela HTML para os quantitativos e precos seguindo este modelo de aspas simples:\n${TABLE_TEMPLATES.quantitativos.replace(/"/g, "'")}`;
  } else if (fieldId === "tabela_riscos_interna") {
    tableInstruction = `\nREGRAS DE TABELA: Gere uma tabela HTML para riscos fase INTERNA seguindo este modelo de aspas simples:\n${TABLE_TEMPLATES.riscos("INTERNA").replace(/"/g, "'")}`;
  } else if (fieldId === "tabela_riscos_externa") {
    tableInstruction = `\nREGRAS DE TABELA: Gere uma tabela HTML para riscos fase EXTERNA seguindo este modelo de aspas simples:\n${TABLE_TEMPLATES.riscos("EXTERNA").replace(/"/g, "'")}`;
  }

  const prompt = `Com base no DIAGNÓSTICO INICIAL abaixo:
  ${diagnosticInfo}
  
  Redija a seção "${fieldName}" deste Estudo Técnico Preliminar conforme a Lei 14.133/21. 
  Siga as instruções da CMC: ${instruction || ""}${tableInstruction}
  
  REGRAS CRÍTICAS: 
  - NÃO inclua o título "${fieldName}" ou o nome da seção no texto. 
  - NÃO use markdown (#, *, **). 
  - NÃO inclua introduções ou comentários. 
  - Retorne APENAS o texto final (ou HTML da tabela se aplicável).
  - Se as informações forem insuficientes para um texto técnico completo, você DEVE iniciar a resposta com "NECESSITA COMPLEMENTAÇÃO" seguido de uma linha em branco e o rascunho com colchetes [ ] indicando o que falta.`;

  return await callDirectGemini(apiKey, prompt, SYSTEM_PROMPT);
}

/**
 * 2. Extract Document from previous TR/ETP with automatic failover for GitHub Pages
 */
export async function requestAiExtractDoc(params: {
  text: string;
  isTruncated?: boolean;
  customApiKey?: string;
}): Promise<string> {
  const { text, isTruncated, customApiKey } = params;

  let backendAvailable = true;
  try {
    const fetchRes = await fetch("/api/ai/extract-doc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, isTruncated, customApiKey })
    });

    const contentType = fetchRes.headers.get("content-type") || "";
    if (fetchRes.status !== 404 && contentType.includes("application/json")) {
      if (!fetchRes.ok) {
        const errJson = await fetchRes.json().catch(() => ({}));
        throw new Error(errJson.error || "Falha ao extrair documento no servidor.");
      }
      const fetchJson = await fetchRes.json();
      if (fetchJson.result) {
        return fetchJson.result;
      }
      throw new Error("A IA do servidor não retornou os dados extraídos.");
    } else {
      backendAvailable = false;
    }
  } catch (err: any) {
    if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError") || err.message.includes("404"))) {
      backendAvailable = false;
    } else if (backendAvailable) {
      throw err;
    }
  }

  // Fallback for static hosting (GitHub Pages)
  const apiKey = getClientGeminiApiKey(customApiKey);
  if (!apiKey) {
    throw new Error(
      "Chave de API do Gemini não configurada para a versão estática (GitHub Pages)! Acesse o 'Painel Master > Configurações' e salve a Chave de API do Gemini da organização."
    );
  }

  const prompt = `Você é um assessor de licitações especialista na Lei 14.133/2021 (Nova Lei de Licitações) e na elaboração de Estudos Técnicos Preliminares (ETP).
Recebemos um termo de referência (TR), edital ou ETP de uma contratação anterior ou similar com o seguinte conteúdo:
---
${text}
---
${isTruncated ? "\n(Atenção: O documento acima foi parcialmente delimitado para viabilizar a análise técnica no navegador do usuário, mas contém todas as partes principais relevantes)\n" : ""}

Sua tarefa é analisar o documento antigo acima e preencher as 8 perguntas essenciais (Diagnóstico Inicial) para iniciar o novo ETP.
Você deve retornar APENAS um objeto JSON válido, contendo as respostas para os campos do Diagnóstico Inicial e alguns metadados básicos.

Campos a preencher no JSON (use o idioma português brasileiro de forma técnica e formal):
{
  "etp_name": "Um título curto e claro para o novo ETP baseado no objeto do documento (ex: 'Aquisição de Licenças de Software Microsoft')",
  "diag_problema_necessidade": "Resposta técnica para: Qual é o problema ou necessidade que motiva esta contratação e o que se espera alcançar?",
  "diag_alternativas_solucao": "Resposta técnica para: Quais alternativas de solução foram consideradas (ou praticadas no documento) e qual foi a escolhida?",
  "diag_objeto_vigencia": "Resposta técnica para: Qual é o objeto exato e seu prazo/vigência estimado?",
  "diag_exigencias_padroes": "Resposta técnica para: Quais exigências técnicas, padrões de qualidade ou marcas mínimas são apontadas no documento?",
  "diag_quantidades_valor": "Resposta técnica para: Quais as quantidades estimadas e o valor total estimado (se constar)?",
  "diag_parcelamento_providencias": "Resposta técnica para: Como se dará o de parcelamento e quais providências administrativas prévias são necessárias?",
  "diag_correlatas_ambientais": "Resposta técnica para: Há contratações correlatas/interdependentes envolvidas ou requisitos ambientais/sustentabilidade?",
  "diag_riscos_sucesso": "Resposta técnica para: Quais são as principais ameaças/riscos identificados no documento antigo para o sucesso da contratação?"
}

Retorne estritamente o JSON puro sem aspas triples ou marcações do markdown. Suas respostas devem ser robustas, fundamentadas e formais.`;

  return await callDirectGemini(apiKey, prompt, SYSTEM_PROMPT, "application/json");
}

/**
 * 3. Complete Global ETP Generation with automatic failover for GitHub Pages
 */
export async function requestAiGenerateGlobal(params: {
  formData: ETPData;
  customApiKey?: string;
}): Promise<Partial<ETPData>> {
  const { formData, customApiKey } = params;

  let backendAvailable = true;
  try {
    const fetchRes = await fetch("/api/ai/generate-global", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        diag_problema_necessidade: formData.diag_problema_necessidade || "",
        diag_alternativas_solucao: formData.diag_alternativas_solucao || "",
        diag_objeto_vigencia: formData.diag_objeto_vigencia || "",
        diag_exigencias_padroes: formData.diag_exigencias_padroes || "",
        diag_quantidades_valor: formData.diag_quantidades_valor || "",
        diag_parcelamento_providencias: formData.diag_parcelamento_providencias || "",
        diag_correlatas_ambientais: formData.diag_correlatas_ambientais || "",
        diag_riscos_sucesso: formData.diag_riscos_sucesso || "",
        customApiKey
      })
    });

    const contentType = fetchRes.headers.get("content-type") || "";
    if (fetchRes.status !== 404 && contentType.includes("application/json")) {
      if (!fetchRes.ok) {
        const errJson = await fetchRes.json().catch(() => ({}));
        throw new Error(errJson.error || "Falha na geração global no servidor.");
      }
      const fetchJson = await fetchRes.json();
      if (fetchJson.combinedData) {
        return fetchJson.combinedData;
      }
      throw new Error("O servidor retornou dados vazios.");
    } else {
      backendAvailable = false;
    }
  } catch (err: any) {
    if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError") || err.message.includes("404"))) {
      backendAvailable = false;
    } else if (backendAvailable) {
      throw err;
    }
  }

  // Fallback for static hosting (GitHub Pages)
  const apiKey = getClientGeminiApiKey(customApiKey);
  if (!apiKey) {
    throw new Error(
      "Chave de API do Gemini não configurada para a versão estática (GitHub Pages)! Acesse o 'Painel Master > Configurações' e salve a Chave de API do Gemini da organização (ou configure VITE_GEMINI_API_KEY no repositório)."
    );
  }

  const diagnosticInfo = `
  - Problema/Necessidade: ${formData.diag_problema_necessidade || ""}
  - Alternativas: ${formData.diag_alternativas_solucao || ""}
  - Objeto/Vigência: ${formData.diag_objeto_vigencia || ""}
  - Exigências/Padrões: ${formData.diag_exigencias_padroes || ""}
  - Quantidades/Valor: ${formData.diag_quantidades_valor || ""}
  - Parcelamento/Providências: ${formData.diag_parcelamento_providencias || ""}
  - Correlatas/Ambientais: ${formData.diag_correlatas_ambientais || ""}
  - Riscos: ${formData.diag_riscos_sucesso || ""}
  `;

  const fieldsGroup1 = [
    "justificativa_necessidade",
    "levantamento_mercado",
    "objeto_sucinto",
    "especificacoes_tecnicas",
    "descricao_solucao_integral",
    "requisitos_header",
    "requisitos_exigencias",
    "requisitos_qualidade",
    "requisitos_marca"
  ];

  const fieldsGroup2 = [
    "requisitos_continuos",
    "requisitos_amostra",
    "requisitos_transicao",
    "garantia_contratual",
    "garantia_tecnica",
    "assistencia_tecnica",
    "requisitos_vistoria",
    "requisitos_subcontratacao",
    "requisitos_execucao",
    "requisitos_dimensionamento"
  ];

  const fieldsGroup3 = [
    "estimativa_quantidades_texto",
    "estimativa_valor_texto",
    "tabela_estimativa_quantitativos_precos",
    "justificativa_parcelamento",
    "resultados_pretendidos",
    "providencias_adm",
    "contratacoes_correlatas",
    "impactos_ambientais",
    "alinhamento_planejamento",
    "posicionamento_conclusivo",
    "analise_riscos_resumo",
    "tabela_riscos_interna",
    "tabela_riscos_externa"
  ];

  const tableInstructions = `
  Para os campos de tabela, você DEVE obrigatoriamente gerar HTML de tabela bonito, profissional, moderno e responsivo seguindo estes modelos exatos.
  ATENÇÃO EXTREMA: Em todo o código HTML das tabelas geradas, você DEVE usar OBRIGATORIAMENTE apenas aspas simples (') para delimitar atributos HTML (exemplo: style='...', colspan='...', border='...'). NÃO use aspas duplas (") sob nenhuma circunstância dentro das strings HTML, caso contrário o JSON será corrompido!
  
  Modelos de tabelas (com aspas simples):
  - tabela_estimativa_quantitativos_precos: ${TABLE_TEMPLATES.quantitativos.replace(/"/g, "'")}
  - tabela_riscos_interna: ${TABLE_TEMPLATES.riscos("INTERNA").replace(/"/g, "'")}
  - tabela_riscos_externa: ${TABLE_TEMPLATES.riscos("EXTERNA").replace(/"/g, "'")}
  `;

  const prompt1 = `Aja como um revisor jurídico sênior da Câmara Municipal de Curitiba.
  Sua missão é gerar o conteúdo completo do Estudo Técnico Preliminar (ETP) com base nas respostas do DIAGNÓSTICO INICIAL fornecidas.
  
  DIAGNÓSTICO INICIAL:
  ${diagnosticInfo}
  
  Você DEVE gerar conteúdo técnico substancial, formal, completo, detalhado e coerente para os seguintes campos técnicos de texto:
  ${fieldsGroup1.map(f => `- ${f}`).join("\n")}
  
  INSTRUÇÕES DE COESÃO E QUALIDADE:
  - Garanta que os textos se complementem perfeitamente.
  - Mantenha os textos objetivos, técnicos, formais e focados nas necessidades do município de Curitiba.
  - REGRA CRÍTICA: Se os dados do Diagnóstico Inicial forem insuficientes para qualquer campo, inicie o texto de rascunho desse campo com "NECESSITA COMPLEMENTAÇÃO" seguido de uma linha em branco e o rascunho com colchetes [ ].
  
  Retorne obrigatoriamente um JSON puro contendo exatamente as chaves do grupo (com textos gerados):
  ${JSON.stringify(fieldsGroup1)}
  
  REGRAS CRÍTICAS: NÃO use markdown (#, *, **). NÃO inclua introduções, comentários ou explicações fora do JSON.`;

  const prompt2 = `Aja como um revisor jurídico sênior da Câmara Municipal de Curitiba.
  Sua missão é gerar o conteúdo completo do Estudo Técnico Preliminar (ETP) com base nas respostas do DIAGNÓSTICO INICIAL fornecidas.
  
  DIAGNÓSTICO INICIAL:
  ${diagnosticInfo}
  
  Você DEVE gerar conteúdo técnico substancial, formal, completo, detalhado e coerente para os seguintes campos técnicos de texto:
  ${fieldsGroup2.map(f => `- ${f}`).join("\n")}
  
  INSTRUÇÕES DE COESÃO E QUALIDADE:
  - Garanta que os textos se complementem perfeitamente.
  - Mantenha os textos objetivos, técnicos, formais e focados.
  - REGRA CRÍTICA: Se os dados do Diagnóstico Inicial forem insuficientes para qualquer campo, inicie o texto de rascunho desse campo com "NECESSITA COMPLEMENTAÇÃO" seguido de uma linha em branco e o rascunho com colchetes [ ].
  
  Retorne obrigatoriamente um JSON puro contendo exatamente as chaves do grupo (com textos gerados):
  ${JSON.stringify(fieldsGroup2)}
  
  REGRAS CRÍTICAS: NÃO use markdown (#, *, **). NÃO inclua introduções, comentários ou explicações fora do JSON.`;

  const prompt3 = `Aja como um revisor jurídico sênior da Câmara Municipal de Curitiba.
  Sua missão é gerar o conteúdo completo do Estudo Técnico Preliminar (ETP) com base nas respostas do DIAGNÓSTICO INICIAL fornecidas.
  
  DIAGNÓSTICO INICIAL:
  ${diagnosticInfo}
  
  Você DEVE gerar conteúdo técnico substancial, formal, completo e detalhado para as seguintes chaves de texto e tabelas:
  ${fieldsGroup3.map(f => `- ${f}`).join("\n")}
  
  ${tableInstructions}
  
  INSTRUÇÕES DE COESÃO E QUALIDADE:
  - Mantenha os textos objetivos, técnicos, formais e focados.
  - O "Planejamento Estratégico 2022-2031" deve ser citado APENAS na seção de Alinhamento ao Planejamento.
  - REGRA CRÍTICA: Se os dados do Diagnóstico Inicial forem insuficientes para qualquer campo de texto, inicie o texto dele com "NECESSITA COMPLEMENTAÇÃO" seguido de uma linha em branco e o rascunho com colchetes [ ].
  
  Retorne obrigatoriamente um JSON puro contendo exatamente as chaves do grupo (com textos ou HTML das tabelas gerados):
  ${JSON.stringify(fieldsGroup3)}
  
  REGRAS CRÍTICAS DE SINTAXE: 
  1. NÃO use markdown (#, *, **) para formatar o texto dos campos. 
  2. NÃO inclua introduções, comentários ou explicações fora do JSON.
  3. Use APENAS aspas simples (') para todos os atributos das marcações HTML das tabelas (como style='...', colspan='...', border='...'). NÃO use aspas duplas (") dentro das tabelas, sob pena de gerar uma resposta JSON inválida e corrompida.`;

  const [text1, text2, text3] = await Promise.all([
    callDirectGemini(apiKey, prompt1, SYSTEM_PROMPT, "application/json"),
    callDirectGemini(apiKey, prompt2, SYSTEM_PROMPT, "application/json"),
    callDirectGemini(apiKey, prompt3, SYSTEM_PROMPT, "application/json")
  ]);

  const parseJson = (text: string, groupName: string) => {
    try {
      const cleaned = text.replace(/```json\n?|```/g, "").trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.error(`[Client Global Gen JSON parse failure] Group: ${groupName}, Content:`, text);
      throw new Error(`A IA retornou um formato inválido para o ${groupName}.`);
    }
  };

  const data1 = parseJson(text1, "Grupo 1 (Demanda e Solução)");
  const data2 = parseJson(text2, "Grupo 2 (Requisitos e Execução)");
  const data3 = parseJson(text3, "Grupo 3 (Estimativas e Riscos)");

  return { ...data1, ...data2, ...data3 };
}

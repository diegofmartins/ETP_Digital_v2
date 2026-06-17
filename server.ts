import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

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

// Helper function to initialize Gemini API with custom or environment key
const getAiClient = (customKey?: string) => {
  const apiKey = (customKey && customKey.trim().length > 10) ? customKey.trim() : process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length < 10) {
    throw new Error(
      "Chave de API do Gemini não configurada! Verifique na aba Administrador se a chave está inserida ou defina o segredo GEMINI_API_KEY."
    );
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
};

// Generic delay utility for automatic retries
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to fetch Gemini content with automatic retries for resilience
const generateWithRetry = async (ai: GoogleGenAI, prompt: string, mimeType?: "application/json", retries = 2) => {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: SYSTEM_PROMPT,
          ...(mimeType ? { responseMimeType: mimeType } : {})
        }
      });
      if (response && response.text) {
        return response.text;
      }
      throw new Error("Resposta vazia retornada pela IA.");
    } catch (err: any) {
      attempt++;
      console.warn(`[Gemini API] Tentativa ${attempt} falhou: ${err?.message || err}. Tentando novamente...`);
      if (attempt > retries) {
        throw err;
      }
      await delay(1000 * attempt); // Backoff linear simples
    }
  }
  throw new Error("Falha ao gerar conteúdo após múltiplas tentativas.");
};

// API Endpoint checks
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "2.4.2-fs" });
});

// 1. EXTRACT DOCUMENT ENDPOINT
app.post("/api/ai/extract-doc", async (req, res) => {
  const { text, isTruncated, customApiKey } = req.body;
  if (!text) {
    return res.status(400).json({ error: "O texto do documento é obrigatório." });
  }

  try {
    const ai = getAiClient(customApiKey);
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

    const resultText = await generateWithRetry(ai, prompt, "application/json");
    res.json({ result: resultText });
  } catch (err: any) {
    console.error("[Backend Extract Doc Error]:", err);
    res.status(500).json({ error: err?.message || "Erro interno ao extrair documento." });
  }
});

// 2. FIELD ASSIST ENDPOINT
app.post("/api/ai/assist", async (req, res) => {
  const { fieldId, fieldName, instruction, formData, customApiKey } = req.body;
  
  if (!fieldId || !fieldName || !formData) {
    return res.status(400).json({ error: "Parâmetros 'fieldId', 'fieldName' e 'formData' são obrigatórios." });
  }

  try {
    const ai = getAiClient(customApiKey);
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

    const resultText = await generateWithRetry(ai, prompt);
    res.json({ text: resultText });
  } catch (err: any) {
    console.error("[Backend Assist Error]:", err);
    res.status(500).json({ error: err?.message || "Erro interno no assistente de campo." });
  }
});

// 3. GLOBAL GENERATION ENDPOINT
app.post("/api/ai/generate-global", async (req, res) => {
  const { diag_problema_necessidade, diag_alternativas_solucao, diag_objeto_vigencia, diag_exigencias_padroes, diag_quantidades_valor, diag_parcelamento_providencias, diag_correlatas_ambientais, diag_riscos_sucesso, customApiKey } = req.body;

  try {
    const ai = getAiClient(customApiKey);
    const diagnosticInfo = `
    - Problema/Necessidade: ${diag_problema_necessidade || ""}
    - Alternativas: ${diag_alternativas_solucao || ""}
    - Objeto/Vigência: ${diag_objeto_vigencia || ""}
    - Exigências/Padrões: ${diag_exigencias_padroes || ""}
    - Quantidades/Valor: ${diag_quantidades_valor || ""}
    - Parcelamento/Providências: ${diag_parcelamento_providencias || ""}
    - Correlatas/Ambientais: ${diag_correlatas_ambientais || ""}
    - Riscos: ${diag_riscos_sucesso || ""}
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

    // Process using sequential or parallel requests elegantly. Let's do sequential or Promise.all.
    // In backend, Promise.all runs smoothly. Let's run with our robust retry helper.
    const [text1, text2, text3] = await Promise.all([
      generateWithRetry(ai, prompt1, "application/json"),
      generateWithRetry(ai, prompt2, "application/json"),
      generateWithRetry(ai, prompt3, "application/json")
    ]);

    const parseJson = (text: string, groupName: string) => {
      try {
        const cleaned = text.replace(/```json\n?|```/g, "").trim();
        return JSON.parse(cleaned);
      } catch (e) {
        console.error(`[Global Gen JSON parse failure] Group: ${groupName}, Content:`, text);
        throw new Error(`A IA retornou um formato inválido para o ${groupName}. Detalhes salvos no log.`);
      }
    };

    const data1 = parseJson(text1, "Grupo 1 (Demanda e Solução)");
    const data2 = parseJson(text2, "Grupo 2 (Requisitos e Execução)");
    const data3 = parseJson(text3, "Grupo 3 (Estimativas e Riscos)");

    const combinedData = { ...data1, ...data2, ...data3 };
    res.json({ combinedData: combinedData });
  } catch (err: any) {
    console.error("[Backend Global Gen Error]:", err);
    res.status(500).json({ error: err?.message || "Erro interno na geração automatizada de ETP." });
  }
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

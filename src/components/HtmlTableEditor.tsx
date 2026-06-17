import { useState, useRef, useEffect } from 'react';
import { 
  Bold, Italic, Underline, Table, Code, Eye, 
  Trash2, FileText
} from "lucide-react";

interface HtmlTableEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  fieldId: string;
}

export function HtmlTableEditor({ value, onChange, readOnly = false, placeholder = '', fieldId }: HtmlTableEditorProps) {
  const [activeTab, setActiveTab] = useState<'visual' | 'code'>('visual');
  const editorRef = useRef<HTMLDivElement>(null);
  const [htmlValue, setHtmlValue] = useState(value);

  // Sync state with prop if edited externally (e.g., loaded draft or AI filled)
  useEffect(() => {
    if (value !== htmlValue) {
      setHtmlValue(value);
      if (editorRef.current && activeTab === 'visual') {
        editorRef.current.innerHTML = value;
      }
    }
  }, [value]);

  const updateContent = (newHtml: string) => {
    setHtmlValue(newHtml);
    onChange(newHtml);
  };

  const handleVisualChange = () => {
    if (editorRef.current) {
      updateContent(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value: string = '') => {
    if (readOnly) return;
    document.execCommand(command, false, value);
    handleVisualChange();
    if (editorRef.current) {
      editorRef.current.focus();
    }
  };

  const insertTableTemplate = () => {
    if (readOnly) return;
    let template = '';
    
    if (fieldId === 'tabela_estimativa_quantitativos_precos') {
      template = `
        <table style="border-collapse:collapse;width:100%;border:1px solid #000">
          <thead>
            <tr style="background-color:#e2e8f0;font-weight:bold">
              <th style="border:1px solid #000;padding:8px;text-align:center">Item</th>
              <th style="border:1px solid #000;padding:8px;text-align:center">Descrição</th>
              <th style="border:1px solid #000;padding:8px;text-align:center">Quantidade</th>
              <th style="border:1px solid #000;padding:8px;text-align:center">Valor Unitário</th>
              <th style="border:1px solid #000;padding:8px;text-align:center">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid #000;padding:8px;text-align:center">1</td>
              <td style="border:1px solid #000;padding:8px;text-align:left">Item de Exemplo</td>
              <td style="border:1px solid #000;padding:8px;text-align:center">10</td>
              <td style="border:1px solid #000;padding:8px;text-align:right">R$ 100,00</td>
              <td style="border:1px solid #000;padding:8px;text-align:right">R$ 1.000,00</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background-color:#e2e8f0;font-weight:bold">
              <td colspan="4" style="border:1px solid #000;padding:8px;text-align:center uppercase">TOTAL ESTIMADO</td>
              <td style="border:1px solid #000;padding:8px;text-align:center">R$ 1.000,00</td>
            </tr>
          </tfoot>
        </table>
      `;
    } else if (fieldId === 'tabela_riscos_interna') {
      template = `
        <table style="border-collapse:collapse;width:100%;border:1px solid #000">
          <thead>
            <tr style="background-color:#e2e8f0;font-weight:bold">
              <th style="border:1px solid #000;padding:8px;text-align:right;width:15%">FASE:</th>
              <th colspan="4" style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold">INTERNA</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color:#f1f5f9;font-weight:bold">
              <th colspan="5" style="border:1px solid #000;padding:8px;text-align:center">RISCO 1</th>
            </tr>
            <tr>
              <td style="border:1px solid #000;padding:8px;font-weight:bold;width:20%">Situação de Risco:</td>
              <td colspan="4" style="border:1px solid #000;padding:8px">Descreva o risco interno aqui...</td>
            </tr>
            <tr>
              <td style="border:1px solid #000;padding:8px;font-weight:bold">Probabilidade:</td>
              <td style="border:1px solid #000;padding:8px;text-align:center">( ) Baixa</td>
              <td style="border:1px solid #000;padding:8px;text-align:center">( x ) Média</td>
              <td colspan="2" style="border:1px solid #000;padding:8px;text-align:center">( ) Alta</td>
            </tr>
            <tr>
              <td style="border:1px solid #000;padding:8px;font-weight:bold">Impacto:</td>
              <td style="border:1px solid #000;padding:8px;text-align:center">( x ) Baixo</td>
              <td style="border:1px solid #000;padding:8px;text-align:center">( ) Médio</td>
              <td colspan="2" style="border:1px solid #000;padding:8px;text-align:center">( ) Alto</td>
            </tr>
            <tr>
              <td style="border:1px solid #000;padding:8px;font-weight:bold">Mitigação:</td>
              <td colspan="4" style="border:1px solid #000;padding:8px">Plano de mitigação correspondente...</td>
            </tr>
          </tbody>
        </table>
      `;
    } else {
      template = `
        <table style="border-collapse:collapse;width:100%;border:1px solid #000">
          <thead>
            <tr style="background-color:#e2e8f0;font-weight:bold">
              <th style="border:1px solid #000;padding:8px;text-align:right;width:15%">FASE:</th>
              <th colspan="4" style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold">EXTERNA</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color:#f1f5f9;font-weight:bold">
              <th colspan="5" style="border:1px solid #000;padding:8px;text-align:center">RISCO 1</th>
            </tr>
            <tr>
              <td style="border:1px solid #000;padding:8px;font-weight:bold;width:20%">Situação de Risco:</td>
              <td colspan="4" style="border:1px solid #000;padding:8px">Descreva o risco externo aqui...</td>
            </tr>
            <tr>
              <td style="border:1px solid #000;padding:8px;font-weight:bold">Probabilidade:</td>
              <td style="border:1px solid #000;padding:8px;text-align:center">( x ) Baixa</td>
              <td style="border:1px solid #000;padding:8px;text-align:center">( ) Média</td>
              <td colspan="2" style="border:1px solid #000;padding:8px;text-align:center">( ) Alta</td>
            </tr>
            <tr>
              <td style="border:1px solid #000;padding:8px;font-weight:bold">Impacto:</td>
              <td style="border:1px solid #000;padding:8px;text-align:center">( ) Baixo</td>
              <td style="border:1px solid #000;padding:8px;text-align:center">( x ) Médio</td>
              <td colspan="2" style="border:1px solid #000;padding:8px;text-align:center">( ) Alto</td>
            </tr>
            <tr>
              <td style="border:1px solid #000;padding:8px;font-weight:bold">Mitigação:</td>
              <td colspan="4" style="border:1px solid #000;padding:8px">Plano de mitigação correspondente...</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    if (activeTab === 'visual') {
      if (editorRef.current) {
        editorRef.current.innerHTML = template;
        updateContent(template);
      }
    } else {
      updateContent(template);
    }
  };

  const clearContent = () => {
    if (readOnly) return;
    if (window.confirm("Deseja realmente limpar todo o conteúdo deste campo?")) {
      if (activeTab === 'visual' && editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      updateContent('');
    }
  };

  return (
    <div className="flex flex-col border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden min-h-[350px]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/50 p-2 gap-2">
        <div className="flex items-center gap-1">
          {/* View Toggles */}
          <button
            type="button"
            onClick={() => setActiveTab('visual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'visual' 
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Eye size={14} />
            Visual
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('code');
              // Make sure textarea receives latest value
              setHtmlValue(value);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'code' 
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Code size={14} />
            Código HTML
          </button>
        </div>

        {/* Action button grouping */}
        {!readOnly && (
          <div className="flex items-center gap-1.5">
            {activeTab === 'visual' && (
              <>
                <button
                  type="button"
                  onClick={() => execCommand('bold')}
                  title="Negrito"
                  className="p-1.5 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                  <Bold size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('italic')}
                  title="Itálico"
                  className="p-1.5 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                  <Italic size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => execCommand('underline')}
                  title="Sublinhado"
                  className="p-1.5 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                >
                  <Underline size={15} />
                </button>
                <div className="w-[1px] h-4 bg-slate-200 mx-1" />
              </>
            )}

            <button
              type="button"
              onClick={insertTableTemplate}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors"
              title="Restaurar Tabela Modelo"
            >
              <Table size={13} />
              Tabela Modelo
            </button>

            <button
              type="button"
              onClick={clearContent}
              className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg transition-all"
              title="Limpar Conteúdo"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Editor Space */}
      <div className="flex-1 min-h-[300px] flex">
        {activeTab === 'visual' ? (
          <div
            ref={editorRef}
            contentEditable={!readOnly}
            onBlur={handleVisualChange}
            onInput={handleVisualChange}
            dangerouslySetInnerHTML={{ __html: value || '' }}
            className="flex-1 w-full p-6 outline-none bg-white font-sans text-sm overflow-y-auto contenteditable-custom min-h-[300px]"
            style={{
              minHeight: '300px',
              fontFamily: '"Inter", sans-serif',
              lineHeight: '1.6',
            }}
          />
        ) : (
          <textarea
            value={htmlValue}
            onChange={(e) => updateContent(e.target.value)}
            disabled={readOnly}
            placeholder={placeholder}
            className="flex-1 w-full p-6 outline-none border-0 font-mono text-xs text-slate-700 bg-slate-900 text-slate-100 overflow-y-auto min-h-[300px]"
            style={{
              minHeight: '300px',
            }}
          />
        )}
      </div>
    </div>
  );
}

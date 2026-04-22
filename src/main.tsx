import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (e: any) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
      <h2>Erro de Inicialização</h2>
      <pre>${e.message || String(e)}</pre>
      <p>Por favor, tente recarregar a página. Se o erro persistir, limpe o cache do navegador.</p>
    </div>`;
  }
}

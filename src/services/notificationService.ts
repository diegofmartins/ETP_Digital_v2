
/**
 * Service to send notifications to Google Chat via Webhook
 */

const ENV_WEBHOOK_URL = import.meta.env.VITE_GOOGLE_CHAT_WEBHOOK_URL;

export async function sendGoogleChatNotification(message: string, overrideUrl?: string) {
  const url = overrideUrl || ENV_WEBHOOK_URL;
  
  if (!url) {
    console.warn("Google Chat Webhook URL not configured.");
    return;
  }

  try {
    // Tentativa 1: Requisição padrão (pode falhar por CORS em sites estáticos)
    // Tentativa 2: Usando 'no-cors' para pelo menos enviar a requisição (fogo e esquece)
    // Nota: 'no-cors' não permite ler a resposta e limita o Content-Type a text/plain
    
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors', 
      headers: {
        'Content-Type': 'text/plain', // Usando text/plain para evitar Preflight OPTIONS (CORS)
      },
      body: JSON.stringify({
        text: message
      }),
    });
    
    console.log("Chamada de notificação enviada (modo no-cors).");
  } catch (error) {
    console.error("Erro crítico ao enviar notificação:", error);
  }
}

export async function notifyNewUserRegistration(userEmail: string, displayName: string, webhookUrl?: string) {
  const message = `🚀 *Novo Registro no ETP Digital*\n\n*Usuário:* ${displayName}\n*E-mail:* ${userEmail}\n*Status:* Aguardando Aprovação\n\nPor favor, acesse o Painel Master para aprovar o acesso.`;
  await sendGoogleChatNotification(message, webhookUrl);
}

export async function notifyUserApproved(userEmail: string, displayName: string, webhookUrl?: string) {
  const message = `✅ *Usuário Aprovado no ETP Digital*\n\n*Usuário:* ${displayName}\n*E-mail:* ${userEmail}\n\nO acesso ao sistema foi liberado.`;
  await sendGoogleChatNotification(message, webhookUrl);
}

export async function notifyNewETPCreated(userEmail: string, etpTitle: string, webhookUrl?: string) {
  const message = `📄 *Novo ETP Criado*\n\n*Título:* ${etpTitle}\n*Autor:* ${userEmail}\n\nUm novo Estudo Técnico Preliminar foi iniciado no sistema.`;
  await sendGoogleChatNotification(message, webhookUrl);
}

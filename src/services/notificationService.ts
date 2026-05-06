
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
    // Note: Calling Google Chat webhooks directly from the browser (e.g. GitHub Pages)
    // usually hits CORS restrictions. 'no-cors' allows the request to be sent,
    // although we won't be able to read the response.
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        text: message
      }),
    });
    
    // With no-cors, we don't get response details, so we assume it was sent
    console.log("Notification request sent to Google Chat.");
  } catch (error) {
    console.error("Error sending notification to Google Chat:", error);
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

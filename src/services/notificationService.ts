
/**
 * Service to send notifications to Google Chat via Webhook
 */

const WEBHOOK_URL = import.meta.env.VITE_GOOGLE_CHAT_WEBHOOK_URL;

export async function sendGoogleChatNotification(message: string) {
  if (!WEBHOOK_URL) {
    console.warn("GOOGLE_CHAT_WEBHOOK_URL not configured. Notification not sent.");
    return;
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        text: message
      }),
    });

    if (!response.ok) {
      console.error("Failed to send notification to Google Chat:", response.statusText);
    }
  } catch (error) {
    console.error("Error sending notification to Google Chat:", error);
  }
}

export async function notifyNewUserRegistration(userEmail: string, displayName: string) {
  const message = `🚀 *Novo Registro no ETP Digital*\n\n*Usuário:* ${displayName}\n*E-mail:* ${userEmail}\n*Status:* Aguardando Aprovação\n\nPor favor, acesse o Painel Master para aprovar o acesso.`;
  await sendGoogleChatNotification(message);
}

export async function notifyUserApproved(userEmail: string, displayName: string) {
  const message = `✅ *Usuário Aprovado no ETP Digital*\n\n*Usuário:* ${displayName}\n*E-mail:* ${userEmail}\n\nO acesso ao sistema foi liberado.`;
  await sendGoogleChatNotification(message);
}

export async function notifyNewETPCreated(userEmail: string, etpTitle: string) {
  const message = `📄 *Novo ETP Criado*\n\n*Título:* ${etpTitle}\n*Autor:* ${userEmail}\n\nUm novo Estudo Técnico Preliminar foi iniciado no sistema.`;
  await sendGoogleChatNotification(message);
}

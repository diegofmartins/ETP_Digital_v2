import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // Resend Initialization
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

  // API Route: Notify Admin
  app.post("/api/notify-admin", async (req, res) => {
    const { email, displayName, uid } = req.body;

    if (!resend) {
      console.error("[Server] RESEND_API_KEY is missing.");
      return res.status(500).json({ error: "Email service not configured." });
    }

    try {
      const { data, error } = await resend.emails.send({
        from: "Sistema ETP <onboarding@resend.dev>",
        to: ["diego.martins@cmc.pr.gov.br"],
        subject: "🔔 Novo Pedido de Acesso - ETP Digital",
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #4f46e5;">Novo usuário solicitou acesso!</h2>
            <p>Um novo perfil foi criado no sistema e aguarda sua aprovação na Tela Master.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Nome:</strong> ${displayName || 'Não informado'}</p>
              <p><strong>E-mail:</strong> ${email}</p>
              <p><strong>UID:</strong> ${uid}</p>
            </div>
            <p>Acesse a <strong>Tela Master</strong> no sistema para aprovar ou desabilitar este usuário.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <small style="color: #6b7280;">Este é um e-mail automático enviado pelo Sistema ETP Digital.</small>
          </div>
        `,
      });

      if (error) {
        console.error("[Server] Resend error:", error);
        return res.status(400).json(error);
      }

      console.log("[Server] Notificação enviada para o administrador:", email);
      res.json({ status: "ok", data });
    } catch (err) {
      console.error("[Server] Unexpected error sending email:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files from dist
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}

startServer();

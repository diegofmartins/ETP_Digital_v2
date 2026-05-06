/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CHAT_WEBHOOK_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

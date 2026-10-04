/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BOT_USERNAME?: string;
  readonly VITE_APP_SHORT_NAME?: string;
  readonly VITE_ADSGRAM_BLOCK_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;

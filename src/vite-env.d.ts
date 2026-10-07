/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BOT_USERNAME?: string;
  readonly VITE_APP_SHORT_NAME?: string;
  readonly VITE_ADSGRAM_BLOCK_ID?: string;
  readonly VITE_MONETAG_ZONE_ID?: string;
  readonly VITE_MONETAG_SDK_URL?: string;
  /** 'mock' fuerza el proveedor simulado aunque haya IDs (útil en staging). */
  readonly VITE_ADS_PROVIDER?: 'auto' | 'mock' | 'none';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;

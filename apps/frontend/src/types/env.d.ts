/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MARKET?: 'pt' | 'us'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}


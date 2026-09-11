/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_MAPS_CLIENT_KEY?: string;
  readonly NEXT_PUBLIC_APP_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

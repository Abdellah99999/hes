import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContextStore {
  requestId?: string;
  userId?: string;
  [key: string]: unknown;
}

export const requestContextStorage =
  new AsyncLocalStorage<RequestContextStore>();

/**
 * Récupère le requestId de la requête courante depuis le contexte AsyncLocalStorage.
 * Retourne undefined si l'exécution a lieu hors contexte de requête HTTP (ex: bootstrap, scripts CLI).
 */
export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}

/**
 * Récupère le store de contexte complet de la requête en cours.
 */
export function getRequestContext(): RequestContextStore | undefined {
  return requestContextStorage.getStore();
}

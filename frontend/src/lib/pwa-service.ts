/**
 * HES Transport & Logistique - PWA & Service Worker Lifecycle Management
 * Architecture : Single-tenant multi-agences
 * Sécurité : Exclusion absolue de l'API /api/* du CacheStorage
 */

export interface PwaRegistrationOptions {
  onUpdateAvailable?: (applyUpdate: () => void) => void;
  onOfflineReady?: () => void;
}

/**
 * Détermine si une requête est éligible à la mise en cache par le Service Worker.
 * RÈGLE CRITIQUE CYBERSÉCURITÉ :
 * - Aucune requête vers /api/* n'est jamais mise en cache (données sensibles, CIN, COD).
 * - Aucune requête non-GET (POST, PUT, PATCH, DELETE) n'est jamais mise en cache.
 */
export function shouldCacheRequest(urlStr: string, method = "GET"): boolean {
  if (method.toUpperCase() !== "GET") {
    return false;
  }

  try {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost";
    const parsedUrl = new URL(urlStr, baseUrl);

    // Exclusion stricte de toute route API
    if (
      parsedUrl.pathname.startsWith("/api/") ||
      parsedUrl.pathname.includes("/api/v1")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Traite une requête avec simulation ou exécution de stratégie de cache pour tests et SW.
 * Garantit formellement qu'aucune requête /api/ n'est écrite dans CacheStorage.
 */
export async function executeFetchStrategy(
  request: Request,
  cache: {
    match: (req: Request | string) => Promise<Response | undefined>;
    put: (req: Request | string, res: Response) => Promise<void>;
  },
  fetchFn: (req: Request) => Promise<Response>,
): Promise<Response> {
  const isCacheable = shouldCacheRequest(request.url, request.method);

  if (!isCacheable) {
    // RÈGLE STRICTE NETWORK-ONLY : Zéro interaction avec cache.put
    try {
      return await fetchFn(request);
    } catch {
      return new Response(
        JSON.stringify({
          statusCode: 503,
          error: "Service Unavailable",
          message:
            "Connexion réseau indisponible. Cette action en ligne ne peut pas être exécutée hors-ligne.",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // Requête statique / App Shell éligible au cache
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetchFn(request);
  if (networkResponse && networkResponse.status === 200) {
    await cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

/**
 * Enregistrement du Service Worker avec gestion sécurisée des mises à jour multi-onglets
 */
export async function registerServiceWorker(
  options: PwaRegistrationOptions = {},
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  // Ne pas enregistrer le worker pendant les tests unitaires
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    // 1. Détection d'un worker déjà en attente (multi-onglets ou rechargement)
    if (registration.waiting) {
      notifyUpdate(registration.waiting, options.onUpdateAvailable);
    }

    // 2. Détection d'un nouveau worker en cours d'installation
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          // Nouveau code prêt mais pas encore actif
          notifyUpdate(newWorker, options.onUpdateAvailable);
        } else if (
          newWorker.state === "installed" &&
          !navigator.serviceWorker.controller
        ) {
          if (options.onOfflineReady) options.onOfflineReady();
        }
      });
    });

    // 3. Rafraîchissement sécurisé sur controllerchange après confirmation utilisateur
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    return registration;
  } catch (err) {
    console.warn("[PWA] Enregistrement Service Worker non disponible:", err);
    return null;
  }
}

function notifyUpdate(
  worker: ServiceWorker,
  onUpdateAvailable?: (applyUpdate: () => void) => void,
) {
  if (!onUpdateAvailable) return;

  // Déclenche le callback avec la fonction de mise à jour sécurisée
  onUpdateAvailable(() => {
    worker.postMessage({ type: "SKIP_WAITING" });
  });
}

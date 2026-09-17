import { SetMetadata } from "@nestjs/common";

export const REQUIRE_IDEMPOTENCY_KEY = "REQUIRE_IDEMPOTENCY_KEY";

/**
 * Décorateur forçant la présence obligatoire de l'en-tête `Idempotency-Key`
 * sur l'endpoint décoré. En cas d'absence, l'intercepteur IdempotencyInterceptor
 * lève immédiatement une exception HTTP 400 Bad Request.
 */
export const RequireIdempotencyKey = () =>
  SetMetadata(REQUIRE_IDEMPOTENCY_KEY, true);

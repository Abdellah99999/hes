import {
  useQuery,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { customFetch } from "../lib/api-client";

export interface ServiceHealthDetail {
  status: "up" | "down";
  latencyMs: number;
  error?: string;
}

export interface HealthServicesMap {
  database: ServiceHealthDetail;
  redis: ServiceHealthDetail;
  storage: ServiceHealthDetail;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  version: string;
  uptimeSeconds: number;
  services: HealthServicesMap;
}

export const getHealth = async (
  options?: RequestInit,
): Promise<HealthResponse> => {
  return customFetch<HealthResponse>("/health", {
    ...options,
    method: "GET",
  });
};

export const getHealthQueryKey = () => ["health"] as const;

export const useGetHealth = <TData = HealthResponse>(options?: {
  query?: Partial<
    UseQueryOptions<
      HealthResponse,
      Error,
      TData,
      ReturnType<typeof getHealthQueryKey>
    >
  >;
  request?: RequestInit;
}): UseQueryResult<TData, Error> => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getHealthQueryKey();

  return useQuery({
    queryKey,
    queryFn: () => getHealth(requestOptions),
    ...queryOptions,
  });
};

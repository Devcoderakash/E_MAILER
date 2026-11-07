import { useQuery } from "@tanstack/react-query";
import type { HealthResponse } from "@/types";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with status: ${res.status}`);
  }
  return res.json();
}

export function useHealth() {
  return useQuery<HealthResponse, Error>({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 15000,
    retry: 1,
    staleTime: 10000,
  });
}


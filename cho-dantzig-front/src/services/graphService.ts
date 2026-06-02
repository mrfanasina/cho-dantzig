import type { ApiGraph, DantzigResult, ApiResponse } from "../types/graph";

const API_BASE_URL = "http://localhost:3001/api";

class GraphService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.message || `Erreur HTTP: ${response.status}`,
        };
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Erreur de connexion",
      };
    }
  }

  async runDantzig(
    graph: ApiGraph,
    sourceNode?: string,
    optimizationType: "min" | "max" = "min"
  ): Promise<ApiResponse<DantzigResult>> {
    return this.request<DantzigResult>("/dantzig/run", {
      method: "POST",
      body: JSON.stringify({ graph, sourceNode, optimizationType }),
    });
  }

  async checkHealth(): Promise<ApiResponse<{ timestamp: string }>> {
    return this.request("/health");
  }
}

export const graphService = new GraphService();

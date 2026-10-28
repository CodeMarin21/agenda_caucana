import { GoogleGenAI } from '@google/genai';

export interface GeminiClientConfig {
  apiKey: string;
  modelos: string[];
  maxOutputTokens: number;
  temperature: number;
}

export interface GeminiResult {
  texto: string;
  modelo: string;
}

/**
 * Cliente Gemini con cascada de modelos (Strategy).
 * Si un modelo devuelve 503/429/404, prueba el siguiente.
 * Si todos fallan, devuelve null y el servicio usa fallback local.
 */
export class GeminiClient {
  private readonly ai: GoogleGenAI | null;
  private readonly modelos: string[];
  private readonly maxOutputTokens: number;
  private readonly temperature: number;

  constructor(config: GeminiClientConfig) {
    this.ai = config.apiKey?.trim() ? new GoogleGenAI({ apiKey: config.apiKey }) : null;
    this.modelos = config.modelos;
    this.maxOutputTokens = config.maxOutputTokens;
    this.temperature = config.temperature;
  }

  get disponible(): boolean {
    return this.ai !== null;
  }

  async generate(pregunta: string, systemPrompt: string): Promise<GeminiResult | null> {
    if (!this.ai) return null;

    for (const modelo of this.modelos) {
      const texto = await this.intentarModelo(modelo, pregunta, systemPrompt);
      if (texto) return { texto, modelo };
    }
    return null;
  }

  private async intentarModelo(
    modelo: string,
    pregunta: string,
    systemPrompt: string
  ): Promise<string | null> {
    if (!this.ai) return null;
    try {
      const response = await this.ai.models.generateContent({
        model: modelo,
        contents: pregunta,
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: this.maxOutputTokens,
          temperature: this.temperature,
        },
      });
      return response.text ?? null;
    } catch (error: unknown) {
      const status = this.extraerStatus(error);
      // 503 = saturado | 429 = rate limit | 404 = modelo no existe
      if (status === 503 || status === 429 || status === 404) {
        console.warn(`[Gemini] Modelo ${modelo} no disponible (HTTP ${status}). Probando siguiente...`);
        return null;
      }
      // Cualquier otro error (red, key inválida) → no reintentar y dejar fallback
      console.warn(`[Gemini] Error en ${modelo}:`, (error as Error)?.message);
      return null;
    }
  }

  private extraerStatus(error: unknown): number {
    const e = error as { status?: number; error?: { code?: number } };
    return e?.status ?? e?.error?.code ?? 0;
  }
}
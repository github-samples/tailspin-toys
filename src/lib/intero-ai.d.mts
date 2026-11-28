export type ProviderId = 'google-ai-studio' | 'groq';

export interface ProviderStatus {
    googleAiStudio: boolean;
    groq: boolean;
}

export interface AdviceRequest {
    provider: ProviderId;
    prompt: string;
    roomSummary: string;
}

export function getProviderStatus(env?: Record<string, string | undefined>): ProviderStatus;
export function parseAdviceRequest(body: unknown): AdviceRequest;
export function generateDesignAdvice(options: {
    provider: ProviderId;
    prompt: string;
    roomSummary?: string;
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
}): Promise<string>;

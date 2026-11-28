import { describe, expect, it, vi } from 'vitest';
import { generateDesignAdvice, getProviderStatus, parseAdviceRequest } from './intero-ai.mjs';

describe('Intero provider configuration', () => {
    it('reports whether server keys are configured without returning their values', () => {
        expect(getProviderStatus({})).toEqual({ googleAiStudio: false, groq: false });
        expect(getProviderStatus({ GOOGLE_AI_STUDIO_API_KEY: 'x' })).toEqual({
            googleAiStudio: true,
            groq: false,
        });
    });
});

describe('parseAdviceRequest', () => {
    it('accepts a bounded text-only design request', () => {
        expect(parseAdviceRequest({
            provider: 'groq',
            prompt: '  Suggest a calm palette.  ',
            roomSummary: '4.8 m × 3.6 m × 2.7 m',
        })).toEqual({
            provider: 'groq',
            prompt: 'Suggest a calm palette.',
            roomSummary: '4.8 m × 3.6 m × 2.7 m',
        });
    });

    it('rejects unsupported providers and oversized prompts', () => {
        expect(() => parseAdviceRequest({ provider: 'other', prompt: 'Ideas' })).toThrow('Choose Google AI Studio or Groq');
        expect(() => parseAdviceRequest({ provider: 'groq', prompt: 'x'.repeat(1001) })).toThrow('1000 characters');
    });
});

describe('generateDesignAdvice', () => {
    it('does not make a provider request when its server key is missing', async () => {
        const fetchImpl = vi.fn();
        await expect(generateDesignAdvice({
            provider: 'groq',
            prompt: 'Suggest a reading corner.',
            env: {},
            fetchImpl,
        })).rejects.toThrow('Groq is not configured on the server.');
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('sends Google AI Studio a text-only request and returns its suggestion', async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'Use warm neutrals.' }] } }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        const advice = await generateDesignAdvice({
            provider: 'google-ai-studio',
            prompt: 'Suggest a palette.',
            roomSummary: '4 m × 3 m',
            env: { GOOGLE_AI_STUDIO_API_KEY: 'x' },
            fetchImpl,
        });

        expect(advice).toBe('Use warm neutrals.');
        expect(fetchImpl).toHaveBeenCalledOnce();
        const [requestUrl, requestInit] = fetchImpl.mock.calls[0];
        expect(new URL(String(requestUrl)).searchParams.has('key')).toBe(true);
        const payload = JSON.parse(String(requestInit?.body)) as {
            systemInstruction: { parts: Array<{ text: string }> };
        };
        expect(payload.systemInstruction.parts[0].text).toContain('Do not claim to create');
    });

    it('sends Groq requests using the server-side Groq key', async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
            choices: [{ message: { content: 'Try a soft green accent.' } }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        const advice = await generateDesignAdvice({
            provider: 'groq',
            prompt: 'Suggest an accent colour.',
            env: { GROQ_API_KEY: 'x' },
            fetchImpl,
        });

        expect(advice).toBe('Try a soft green accent.');
        expect(fetchImpl).toHaveBeenCalledOnce();
        const [requestUrl, requestInit] = fetchImpl.mock.calls[0];
        expect(requestUrl).toBe('https://api.groq.com/openai/v1/chat/completions');
        expect(new Headers(requestInit?.headers).get('Authorization')).toBe('Bearer x');
    });

    it('does not expose provider error details', async () => {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('sensitive upstream detail', { status: 500 }));
        await expect(generateDesignAdvice({
            provider: 'groq',
            prompt: 'Suggest a palette.',
            env: { GROQ_API_KEY: 'x' },
            fetchImpl,
        })).rejects.toThrow('The selected AI provider request failed.');
    });
});

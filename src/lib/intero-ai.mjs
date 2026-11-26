const GOOGLE_AI_STUDIO_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DESIGN_ONLY_INSTRUCTION =
    'You are Intero, an interior design text assistant. Offer concise, practical suggestions only. ' +
    'Do not claim to create, inspect, or validate floor-plan geometry, 3D models, lighting simulations, or rendered images.';

/**
 * @typedef {'google-ai-studio' | 'groq'} ProviderId
 * @typedef {{ googleAiStudio: boolean, groq: boolean }} ProviderStatus
 * @typedef {{ provider: ProviderId, prompt: string, roomSummary: string }} AdviceRequest
 */

/** @param {NodeJS.ProcessEnv} [env] @returns {ProviderStatus} */
export function getProviderStatus(env = process.env) {
    return {
        googleAiStudio: Boolean(env.GOOGLE_AI_STUDIO_API_KEY?.trim()),
        groq: Boolean(env.GROQ_API_KEY?.trim()),
    };
}

/**
 * @param {unknown} body
 * @returns {AdviceRequest}
 */
export function parseAdviceRequest(body) {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        throw new Error('Provide a design question and provider.');
    }

    const request = /** @type {Record<string, unknown>} */ (body);
    if (request.provider !== 'google-ai-studio' && request.provider !== 'groq') {
        throw new Error('Choose Google AI Studio or Groq.');
    }
    if (typeof request.prompt !== 'string' || request.prompt.trim().length === 0 || request.prompt.length > 1000) {
        throw new Error('Your design question must be between 1 and 1000 characters.');
    }
    if (request.roomSummary !== undefined && (typeof request.roomSummary !== 'string' || request.roomSummary.length > 300)) {
        throw new Error('Room summary must be 300 characters or fewer.');
    }

    return {
        provider: request.provider,
        prompt: request.prompt.trim(),
        roomSummary: typeof request.roomSummary === 'string' ? request.roomSummary.trim() : '',
    };
}

/**
 * @param {{ provider: ProviderId, prompt: string, roomSummary?: string, env?: NodeJS.ProcessEnv, fetchImpl?: typeof fetch }} options
 * @returns {Promise<string>}
 */
export async function generateDesignAdvice({
    provider,
    prompt,
    roomSummary = '',
    env = process.env,
    fetchImpl = globalThis.fetch,
}) {
    if (provider !== 'google-ai-studio' && provider !== 'groq') {
        throw new Error('Choose Google AI Studio or Groq.');
    }
    const key = (provider === 'google-ai-studio' ? env.GOOGLE_AI_STUDIO_API_KEY : env.GROQ_API_KEY)?.trim();
    if (!key) {
        throw Object.assign(
            new Error(`${provider === 'google-ai-studio' ? 'Google AI Studio' : 'Groq'} is not configured on the server.`),
            { status: 503 },
        );
    }

    const userContent = [
        roomSummary ? `User-confirmed room summary: ${roomSummary}` : '',
        `Design question: ${prompt}`,
    ].filter(Boolean).join('\n\n');

    let url;
    let headers;
    let body;
    if (provider === 'google-ai-studio') {
        const model = encodeURIComponent(env.GOOGLE_AI_STUDIO_MODEL?.trim() || 'gemini-2.5-flash');
        url = `${GOOGLE_AI_STUDIO_ENDPOINT}/${model}:generateContent?key=${encodeURIComponent(key)}`;
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({
            systemInstruction: { parts: [{ text: DESIGN_ONLY_INSTRUCTION }] },
            contents: [{ parts: [{ text: userContent }] }],
            generationConfig: { maxOutputTokens: 350, temperature: 0.6 },
        });
    } else {
        url = GROQ_ENDPOINT;
        headers = {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
        };
        body = JSON.stringify({
            model: env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: DESIGN_ONLY_INSTRUCTION },
                { role: 'user', content: userContent },
            ],
            max_tokens: 350,
            temperature: 0.6,
        });
    }

    let response;
    try {
        response = await fetchImpl(url, {
            method: 'POST',
            headers,
            body,
            signal: AbortSignal.timeout(25_000),
        });
    } catch {
        throw Object.assign(new Error('The selected AI provider could not be reached.'), { status: 502 });
    }
    if (!response.ok) {
        throw Object.assign(new Error('The selected AI provider request failed.'), { status: 502 });
    }

    let result;
    try {
        result = await response.json();
    } catch {
        throw Object.assign(new Error('The selected AI provider returned an unreadable response.'), { status: 502 });
    }

    const advice = provider === 'google-ai-studio'
        ? result?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('\n').trim()
        : result?.choices?.[0]?.message?.content?.trim();
    if (typeof advice !== 'string' || advice.length === 0) {
        throw Object.assign(new Error('The selected AI provider returned no text suggestions.'), { status: 502 });
    }
    return advice.slice(0, 4000);
}

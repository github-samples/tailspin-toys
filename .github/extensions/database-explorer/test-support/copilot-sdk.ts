export interface CanvasContext {
    instanceId: string;
}

export interface CanvasAction {
    name: string;
    description: string;
    inputSchema?: Record<string, unknown>;
    handler: (ctx: { input?: { query?: unknown } }) => Promise<unknown>;
}

export interface CanvasDefinition {
    id: string;
    displayName: string;
    description: string;
    actions: CanvasAction[];
    open: (ctx: CanvasContext) => Promise<{ title: string; url: string }>;
    onClose: (ctx: CanvasContext) => Promise<void>;
}

export class CanvasError extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
        this.name = 'CanvasError';
    }
}

let registeredCanvas: CanvasDefinition | undefined;

export function createCanvas(definition: CanvasDefinition): CanvasDefinition {
    return definition;
}

export async function joinSession(options: { canvases: CanvasDefinition[] }): Promise<void> {
    if (options.canvases.length !== 1 || registeredCanvas) {
        throw new Error('Expected exactly one Database Explorer registration.');
    }
    registeredCanvas = options.canvases[0];
}

export function getRegisteredCanvas(): CanvasDefinition {
    if (!registeredCanvas) {
        throw new Error('The extension has not registered its canvas.');
    }
    return registeredCanvas;
}

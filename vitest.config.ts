import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            '@github/copilot-sdk/extension': fileURLToPath(
                new URL('./.github/extensions/database-explorer/test-support/copilot-sdk.ts', import.meta.url),
            ),
        },
    },
    test: {
        include: ['db/**/*.test.ts', 'src/**/*.test.ts', '.github/extensions/database-explorer/**/*.test.ts'],
        environment: 'node',
    },
});

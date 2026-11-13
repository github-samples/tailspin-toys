import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['db/**/*.test.ts', 'src/**/*.test.ts', '.github/extensions/**/*.test.mjs'],
        environment: 'node',
    },
});

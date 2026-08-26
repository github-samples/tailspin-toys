/**
 * Configures Vitest for the repository's Node-based unit tests.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['db/**/*.test.ts', 'src/**/*.test.ts'],
        environment: 'node',
    },
});

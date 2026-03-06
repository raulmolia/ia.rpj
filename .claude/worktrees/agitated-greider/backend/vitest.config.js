import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        coverage: {
            enabled: false,
        },
        reporters: ['default'],
        isolate: true,
    },
});

// vitest.config.ts
// IT: Configurazione separata per i test, per non interferire con la build di produzione (vite.config.ts).
// EN: Separate test configuration, to avoid interfering with the production build (vite.config.ts).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // IT: 'happy-dom' fornisce le API del browser (File, Blob, window) richieste da litegraph.js e dalle librerie di parsing.
    // EN: 'happy-dom' provides the browser APIs (File, Blob, window) required by litegraph.js and the parsing libraries.
    environment: 'happy-dom',
    // IT: Cerca i file di test accanto al codice sorgente.
    // EN: Looks for test files alongside the source code.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});

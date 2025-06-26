import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
// import { Buffer } from 'buffer'; // IT: Non necessario importare qui, 'globalThis.Buffer' usato in define. EN: Not needed here, 'globalThis.Buffer' used in define.

// https://vitejs.dev/config/
export default defineConfig(({ command }) => { // IT: Configurazione come funzione per accedere a 'command'. EN: Configuration as a function to access 'command'.
  return {
    plugins: [react()],
    define: {
      // IT: Inietta 'globalThis.Buffer' per 'global.Buffer'.
      // Risolve problemi di build con esbuild e assicura compatibilità
      // affidandosi al polyfill 'buffer' per rendere Buffer disponibile globalmente.
      // EN: Injects 'globalThis.Buffer' for 'global.Buffer'.
      // Resolves esbuild build issues and ensures compatibility
      // by relying on the 'buffer' polyfill to make Buffer globally available.
      'global.Buffer': 'globalThis.Buffer', 
      
      // IT: Definisce la variabile d'ambiente NODE_DEBUG come stringa "false".
      // EN: Defines the NODE_DEBUG environment variable as the string "false".
      'process.env.NODE_DEBUG': JSON.stringify('false'), 
    },
    resolve: {
      alias: {
        // IT: Alias per il polyfill 'buffer', necessario per le librerie che usano Buffer.
        // EN: Alias for the 'buffer' polyfill, required for libraries using Buffer.
        'buffer': 'buffer/',
      }
    },
    // IT: Imposta il percorso base condizionatamente per sviluppo e produzione.
    // EN: Conditionally sets the base path for development and production.
    base: command === 'build' ? '/ComfyUI-Workflow-Inspector/' : '/', 
  }
})
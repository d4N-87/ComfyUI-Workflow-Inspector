import { defineConfig } from 'vite' // Rimosso loadEnv se non usato direttamente per 'base'
import react from '@vitejs/plugin-react-swc'
import { Buffer } from 'buffer' // Mantenuto se 'global.Buffer': Buffer funziona per te localmente

// https://vitejs.dev/config/
export default defineConfig(({ command }) => { // La configurazione è ora una funzione per accedere a 'command'
  return {
    plugins: [react()],
    define: {
      // IT: Inietta l'oggetto Buffer globale per compatibilità con alcune librerie.
      // EN: Injects the global Buffer object for compatibility with some libraries.
      'global.Buffer': Buffer, 
      
      // IT: Definisce la variabile d'ambiente NODE_DEBUG come stringa "false".
      // EN: Defines the NODE_DEBUG environment variable as the string "false".
      'process.env.NODE_DEBUG': JSON.stringify('false'), 
    },
    resolve: {
      alias: {
        // IT: Assicura che le importazioni del modulo 'buffer' utilizzino il polyfill.
        // EN: Ensures that imports of the 'buffer' module use the polyfill.
        'buffer': 'buffer/',
      }
    },
    // IT: Imposta il percorso base dell'applicazione in modo condizionale.
    // '/ComfyUI-Workflow-Inspector/' per il build di produzione (es. GitHub Pages).
    // '/' per lo sviluppo locale (comando 'serve').
    // EN: Conditionally sets the application's base path.
    // '/ComfyUI-Workflow-Inspector/' for production builds (e.g., GitHub Pages).
    // '/' for local development ('serve' command).
    base: command === 'build' ? '/ComfyUI-Workflow-Inspector/' : '/', 
  }
})
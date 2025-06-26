import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { Buffer } from 'buffer' // Importa Buffer

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Aggiungi questa sezione per definire variabili globali
  define: {
    'global.Buffer': Buffer, // Definisce global.Buffer per le librerie che lo usano
    'process.env.NODE_DEBUG': 'false', // Un'altra variabile che a volte è richiesta
     // Aggiungi qui altre definizioni se necessario
  },
  // Aggiungi questa sezione per la risoluzione dei moduli
  resolve: {
    alias: {
      // Questo aiuta le librerie a trovare il polyfill giusto
      'buffer': 'buffer/',
    }
  },
  // GITHUB PAGES:
  base: '/ComfyUI-Workflow-Inspector/' 
})
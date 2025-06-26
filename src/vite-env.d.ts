// src/vite-env.d.ts

// IT: Dichiarazioni di moduli per librerie senza tipi o per tipi di file specifici.
// EN: Module declarations for libraries without types or for specific file types.

// IT: Permette l'import di 'png-chunks-extract' senza errori di tipo.
// EN: Allows importing 'png-chunks-extract' without type errors.
declare module 'png-chunks-extract';

// IT: Permette l'import di file .css.
// EN: Allows importing .css files.
declare module '*.css';

// IT: Dichiarazione generica per 'litegraph.js' (tipi specifici in comfy.d.ts).
// EN: Generic declaration for 'litegraph.js' (specific types in comfy.d.ts).
declare module 'litegraph.js';

// IT: Estende l'interfaccia Window per il polyfill Buffer.
// EN: Extends Window interface for Buffer polyfill.
interface Window {
  Buffer: typeof import('buffer').Buffer;
}

// IT: Include tipi client di Vite (es. import.meta.env).
// EN: Includes Vite client types (e.g., import.meta.env).
/// <reference types="vite/client" />
// src/utils/paths.ts

// IT: Costruisce l'URL di una risorsa relativo al BASE_URL di Vite, normalizzando le doppie slash.
//     Serve a far funzionare i percorsi sia in locale ("/") sia su GitHub Pages (sottocartella).
// EN: Builds a resource URL relative to Vite's BASE_URL, normalizing double slashes.
//     Makes paths work both locally ("/") and on GitHub Pages (subfolder).
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`.replace(/\/\//g, '/');
}

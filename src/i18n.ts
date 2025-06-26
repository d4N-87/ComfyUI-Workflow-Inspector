// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

// IT: Costruisce il percorso base per i file di traduzione.
// Utilizza import.meta.env.BASE_URL per la compatibilità con deploy in sottocartelle (es. GitHub Pages).
// EN: Constructs the base path for translation files.
// Uses import.meta.env.BASE_URL for compatibility with subfolder deployments (e.g., GitHub Pages).
const loadPathBase = `${import.meta.env.BASE_URL}locales/{{lng}}/{{ns}}.json`.replace(/\/\//g, '/');

i18n
  .use(HttpApi) // IT: Carica traduzioni via HTTP (da file JSON). EN: Loads translations via HTTP (from JSON files).
  .use(LanguageDetector) // IT: Rileva automaticamente la lingua del browser/utente. EN: Automatically detects user/browser language.
  .use(initReactI18next) // IT: Inizializza i18next per React. EN: Initializes i18next for React.
  .init({
    supportedLngs: ['en', 'it', 'fr', 'de', 'es'], // IT: Lingue supportate. EN: Supported languages.
    fallbackLng: 'en', // IT: Lingua di fallback se la lingua rilevata non è supportata. EN: Fallback language if detected language is not supported.
    
    // IT: Abilita i log di debug di i18next solo in modalità sviluppo.
    // EN: Enables i18next debug logs only in development mode.
    debug: import.meta.env.DEV, 
    
    interpolation: {
      escapeValue: false, // IT: React già gestisce l'escaping XSS. EN: React already handles XSS escaping.
    },
    backend: {
      // IT: Percorso da cui caricare i file di traduzione JSON.
      // EN: Path to load JSON translation files from.
      loadPath: loadPathBase, 
    },
    // IT: Opzioni specifiche per react-i18next.
    // EN: Options specific to react-i18next.
    react: {
      // IT: Usa React Suspense per gestire il caricamento asincrono delle traduzioni.
      // EN: Uses React Suspense to handle asynchronous loading of translations.
      useSuspense: true, 
    }
  });

export default i18n;
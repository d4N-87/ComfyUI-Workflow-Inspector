// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend'; // IT: Per caricare traduzioni da public/locales. EN: For loading translations from public/locales.

i18n
  // IT: Usa HttpApi per caricare traduzioni da backend.
  // EN: Use HttpApi to load translations from backend.
  .use(HttpApi)
  // IT: Rileva la lingua del browser.
  // EN: Detect browser language.
  .use(LanguageDetector)
  // IT: Integra i18next con React.
  // EN: Integrate i18next with React.
  .use(initReactI18next)
  // IT: Inizializza i18next.
  // EN: Initialize i18next.
  .init({
    supportedLngs: ['en', 'it', 'fr', 'de', 'es'], // IT: Lingue supportate. EN: Supported languages.
    fallbackLng: 'en', // IT: Lingua di fallback. EN: Fallback language.
    // IT: Abilita debug in modalità sviluppo.
    // EN: Enable debug in development mode.
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // IT: React gestisce l'escaping. EN: React handles escaping.
    },
    backend: {
      // IT: Percorso per file di traduzione JSON.
      // EN: Path to JSON translation files.
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });

export default i18n;
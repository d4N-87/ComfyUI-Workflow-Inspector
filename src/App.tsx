// src/App.tsx

import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';

import { extractAndNormalizeWorkflow } from './utils/workflowExtractor';
import { registerComfyNodes } from './utils/litegraph-setup';
import LiteGraphViewer from './components/LiteGraphViewer';
import WorkflowParametersDisplay from './components/WorkflowParameters';
import NeuralNetwork from './components/NeuralNetwork';
import type { NormalizedWorkflow } from './types/comfy';

// IT: Interfaccia per informazioni sui nodi ComfyUI.
// EN: Interface for ComfyUI node information.
interface ComfyNodeInfo {
  name: string;
  display_name?: string;
  [key: string]: any;
}

// IT: Componente principale dell'applicazione.
// EN: Main application component.
function App() {
  const { t, i18n } = useTranslation();

  // IT: Stati del componente.
  // EN: Component states.
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<NormalizedWorkflow | null>(null);
  const [objectInfo, setObjectInfo] = useState<Record<string, ComfyNodeInfo> | null>(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  const repositoryUrl = "https://github.com/d4N-87/ComfyUI-Workflow-Inspector"; 

  // IT: Inizializzazione dell'app: carica object_info.json e registra i nodi.
  // EN: App initialization: loads object_info.json and registers nodes.
  useEffect(() => {
    async function initializeApp() {
      try {
        // IT: Costruisce il percorso per object_info.json tenendo conto del BASE_URL di Vite.
        // Necessario per il corretto funzionamento sia in locale che su GitHub Pages (sottocartella).
        // EN: Constructs the path for object_info.json considering Vite's BASE_URL.
        // Necessary for correct operation both locally and on GitHub Pages (subfolder).
        const objectInfoPath = `${import.meta.env.BASE_URL}object_info.json`.replace(/\/\//g, '/');
        const response = await fetch(objectInfoPath);
        
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status} while fetching object_info.json`);
        }
        const fetchedObjectInfo = await response.json();
        registerComfyNodes(fetchedObjectInfo);
        setObjectInfo(fetchedObjectInfo);
        setIsAppReady(true);
      } catch (error) {
        console.error(t('errorInit'), error);
        setErrorMessage(t('errorInit'));
      }
    }
    initializeApp();
  }, [t]); // IT: La dipendenza da 't' è per ri-tradurre i messaggi di errore se la lingua cambia. EN: Dependency on 't' is to re-translate error messages if language changes.

  // IT: Gestisce il cambio del file di input.
  // EN: Handles input file change.
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(null);
    setErrorMessage(null);
    setWorkflow(null);

    const file = event.target.files?.[0];
    if (!file || !objectInfo) return; // IT: Esce se non c'è file o objectInfo non è pronto. EN: Exit if no file or objectInfo not ready.
    setFileName(file.name);

    try {
      const result = await extractAndNormalizeWorkflow(file, objectInfo);
      if (result) {
        setWorkflow(result);
      } else {
        setErrorMessage(t('errorNoWorkflow'));
      }
    } catch (error) {
      console.error(t('errorLoadingFile', { error: (error as Error).message }), error);
      setErrorMessage(t('errorUnexpected'));
    }
  };

  // IT: Cambia la lingua dell'interfaccia.
  // EN: Changes the interface language.
  const changeLanguage = (event: ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(event.target.value);
  };

  // IT: Opzioni per il selettore lingua.
  // EN: Options for the language selector.
  const languageOptions = [
    { value: 'en', label: 'English' },
    { value: 'it', label: 'Italiano' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'es', label: 'Español' },
  ];

  return (
    <div className="bg-background text-primary-text min-h-screen flex flex-col font-sans antialiased relative">
      {/* Background container with the animation and a gradient overlay */}
      <div className="fixed inset-0 z-0">
        <NeuralNetwork />
        <div className="absolute inset-0 z-10 [background-image:linear-gradient(to_bottom,transparent_70%,#030b17_100%)]"></div>
      </div>

      {/* Main content container, stacked above the background */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Language selector */}
        <div className="absolute top-4 right-4 z-20 px-4 md:px-8">
          <select
            onChange={changeLanguage}
            value={i18n.language.split('-')[0]}
            className="bg-surface text-primary-text p-2 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-primary-accent"
          >
            {languageOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {/* Application header */}
        <header className="w-full bg-surface/70 border-b border-border shadow-lg backdrop-blur-sm">
          <div className="container mx-auto px-4 md:px-8 py-4 md:py-6 flex flex-col md:flex-row items-center md:items-end">
            <div className="flex-none mb-4 md:mb-0 md:mr-6">
              <a href={repositoryUrl} target="_blank" rel="noopener noreferrer" title={t('githubRepoLinkTooltip')}>
                <img
                  src={`${import.meta.env.BASE_URL}workflow_inspector_logo.webp`.replace(/\/\//g, '/')}
                  alt="ComfyUI Workflow Inspector Logo"
                  className="h-24 md:h-26 lg:h-32 w-auto transition-opacity duration-300 hover:opacity-80 filter drop-shadow-[0_2px_2px_rgba(255,255,255,0.2)]"
                />
              </a>
            </div>
            <div className="flex-grow text-center md:text-left">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display text-primary-text tracking-tight">{t('appTitle')}</h1>
              <p className="text-secondary-text mt-1 text-md sm:text-lg">{t('appSubtitle')}</p>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-grow p-4 md:p-8">
          <div className="w-full max-w-md bg-surface border border-border rounded-xl p-6 text-center shadow-lg shadow-black/20 mb-8 backdrop-blur-sm mx-auto">
            <label htmlFor="file-upload" className={`cursor-pointer bg-surface hover:bg-primary-accent/20 text-primary-text font-bold py-3 px-6 rounded-lg transition-all duration-200 ease-in-out inline-block ring-2 ring-border hover:ring-primary-accent ${!isAppReady ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isAppReady
                ? (fileName ? t('uploadButtonLoaded', { fileName }) : t('uploadButton'))
                : t('uploadButtonReady')}
            </label>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/png,image/webp,video/mp4,audio/flac,application/json"
              disabled={!isAppReady}
            />
          </div>

          <main className="w-full flex-grow flex flex-col md:flex-row gap-8 h-[70vh]">
            {workflow && workflow.nodeList.length > 0 && (
              <aside className="w-full md:w-1/3 lg:w-1/4 bg-surface border border-border rounded-xl p-4 flex flex-col h-full">
                <h3 className="text-lg font-bold mb-3 text-secondary-text flex-shrink-0">
                  {t('detectedNodesTitle', { count: workflow.nodeList.length })}
                </h3>
                <div className="overflow-y-auto pr-2 flex-grow">
                  <ul className="space-y-2">
                    {workflow.nodeList.map((node) => (
                      <li
                        key={`${node.id}-${node.name}`}
                        className="font-mono text-sm bg-background/60 p-2 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-600/80 hover:shadow-lg hover:shadow-primary-accent/10"
                        onMouseEnter={() => setHighlightedNodeId(node.id)}
                        onMouseLeave={() => setHighlightedNodeId(null)}
                      >
                        {node.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            )}

            <div className="flex-grow h-full relative">
              {errorMessage && (
                <div className="absolute inset-0 bg-red-900/50 text-red-300 flex items-center justify-center p-4 rounded-xl border border-red-700">
                  <p className="text-center">{errorMessage}</p>
                </div>
              )}
              <div className="w-full h-full rounded-xl overflow-hidden border border-border">
                <LiteGraphViewer graphData={workflow} highlightedNodeId={highlightedNodeId} />
              </div>
            </div>
          </main>

          {workflow?.notes && workflow.notes.length > 0 && (
            <section className="w-full mt-8">
              <h2 className="text-2xl font-bold text-primary-accent mb-4">{t('workflowNotesTitle')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {workflow.notes.map(note => (
                  <div
                    key={note.id}
                    className="bg-surface border border-border rounded-xl p-4 transition-all duration-200 hover:border-primary-accent hover:scale-105"
                    onMouseEnter={() => setHighlightedNodeId(note.id)}
                    onMouseLeave={() => setHighlightedNodeId(null)}
                  >
                    <h3 className="font-mono text-sm text-secondary-accent mb-2">{t('noteLabel', { id: note.id })}</h3>
                    <div className="text-primary-text font-sans text-base break-words">
                      {note.type === 'MarkdownNote' ? (
                        <div className="markdown-content">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.text}</ReactMarkdown>
                        </div>
                      ) : (
                        <pre className="whitespace-pre-wrap font-sans">{note.text}</pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {workflow?.parameters && (
            <WorkflowParametersDisplay parameters={workflow.parameters} />
          )}
        </div>

        <footer className="w-full text-center py-4 border-t border-border px-4 md:px-8">
          <p className="text-secondary-text text-sm">
            {t('footerNote')}
          </p>
          <p className="text-gray-600 text-xs mt-1">
            {t('footerPrivacyNote')}
          </p>
          <p className="text-gray-600 text-xs mt-2">
            <a href={repositoryUrl} target="_blank" rel="noopener noreferrer" className="text-primary-accent hover:underline">{t('footerRepoLink')}</a>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
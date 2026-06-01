// src/App.tsx

import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';

import { extractAndNormalizeWorkflow, WorkflowParseError } from './utils/workflowExtractor';
import { registerComfyNodes } from './utils/litegraph-setup';
import { assetUrl } from './utils/paths';
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
  // IT: True mentre si trascina un file sopra la pagina (mostra l'overlay "rilascia qui").
  // EN: True while dragging a file over the page (shows the "drop here" overlay).
  const [isDragging, setIsDragging] = useState(false);
  // IT: Contatore per evitare lo sfarfallio dell'overlay entrando/uscendo dagli elementi figli.
  // EN: Counter to avoid overlay flicker when entering/leaving child elements.
  const dragCounter = useRef(0);

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
        const objectInfoPath = assetUrl('object_info.json');
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

  // IT: Logica di caricamento condivisa: usata sia dal pulsante sia dal drag & drop.
  // EN: Shared loading logic: used by both the button and drag & drop.
  const processFile = async (file: File) => {
    setFileName(null);
    setErrorMessage(null);
    setWorkflow(null);

    if (!objectInfo) return; // IT: Esce se objectInfo non è pronto. EN: Exit if objectInfo isn't ready.
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
      // IT: Distingue i dati corrotti (messaggio specifico) dagli errori imprevisti.
      // EN: Distinguishes corrupt data (specific message) from unexpected errors.
      setErrorMessage(error instanceof WorkflowParseError ? t('errorCorruptFile') : t('errorUnexpected'));
    }
  };

  // IT: Gestisce il cambio del file dal pulsante di caricamento.
  // EN: Handles file change from the upload button.
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  };

  // IT: Riferimenti sempre aggiornati, per evitare closure obsolete nei listener globali.
  // EN: Always-current refs, to avoid stale closures in the global listeners.
  const processFileRef = useRef(processFile);
  processFileRef.current = processFile;
  const isAppReadyRef = useRef(isAppReady);
  isAppReadyRef.current = isAppReady;

  // IT: Drag & drop a livello di window. Intercettare gli eventi sull'intera finestra (e non su un
  //     singolo div) è necessario perché il file può essere rilasciato sopra il canvas di litegraph,
  //     che altrimenti lascerebbe partire il comportamento di default del browser (apre il file).
  // EN: Window-level drag & drop. Listening on the whole window (not a single div) is necessary
  //     because the file can be dropped over the litegraph canvas, which would otherwise let the
  //     browser's default behavior run (opening the file).
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (!isAppReadyRef.current) return;
      dragCounter.current += 1;
      // IT: Mostra l'overlay solo se si trascinano dei file. EN: Show the overlay only when dragging files.
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) setIsDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault(); // IT: necessario per abilitare il drop. EN: required to enable dropping.
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragging(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      if (!isAppReadyRef.current) return;
      const file = e.dataTransfer?.files?.[0];
      if (file) processFileRef.current(file);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

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
      {/* IT: Overlay mostrato durante il trascinamento di un file. EN: Overlay shown while dragging a file. */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-4 border-dashed border-primary-accent pointer-events-none">
          <div className="text-center px-6">
            <p className="text-3xl font-bold text-primary-accent">{t('dropOverlayTitle')}</p>
            <p className="text-secondary-text mt-2 text-lg">{t('dropOverlayHint')}</p>
          </div>
        </div>
      )}

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
            aria-label={t('languageSelectorLabel')}
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
                  src={assetUrl('workflow_inspector_logo.webp')}
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
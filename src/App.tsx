// src/App.tsx

import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';

import { extractAndNormalizeWorkflow } from './utils/workflowExtractor';
import { registerComfyNodes } from './utils/litegraph-setup';
import LiteGraphViewer from './components/LiteGraphViewer';
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
  const [fileName, setFileName] = useState<string | null>(null); // IT: Nome del file caricato. EN: Name of the loaded file.
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // IT: Messaggio di errore. EN: Error message.
  const [workflow, setWorkflow] = useState<NormalizedWorkflow | null>(null); // IT: Dati del workflow. EN: Workflow data.
  const [objectInfo, setObjectInfo] = useState<Record<string, ComfyNodeInfo> | null>(null); // IT: Info sui tipi di nodo. EN: Node type info.
  const [isAppReady, setIsAppReady] = useState(false); // IT: Flag di prontezza dell'app. EN: App readiness flag.
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null); // IT: ID nodo evidenziato. EN: Highlighted node ID.

  const repositoryUrl = "https://github.com/LasteNight/ComfyUI-Workflow-Inspector"; 

  // IT: Inizializzazione dell'app: carica object_info.json e registra i nodi.
  // EN: App initialization: loads object_info.json and registers nodes.
  useEffect(() => {
    async function initializeApp() {
      try {
        const response = await fetch('/object_info.json');
        if (!response.ok) {
          throw new Error(`Errore HTTP: ${response.status}`);
        }
        const fetchedObjectInfo = await response.json();
        registerComfyNodes(fetchedObjectInfo);
        setObjectInfo(fetchedObjectInfo);
        setIsAppReady(true);
      } catch (error)
      {
        console.error(t('errorInit'), error);
        setErrorMessage(t('errorInit'));
      }
    }
    initializeApp();
  }, [t]); 

  // IT: Gestisce il cambio del file di input.
  // EN: Handles input file change.
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(null);
    setErrorMessage(null);
    setWorkflow(null);

    const file = event.target.files?.[0];
    if (!file || !objectInfo) return;
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
    <div className="bg-gray-900 text-white min-h-screen flex flex-col font-sans antialiased">
      {/* IT: Selettore lingua. EN: Language selector. */}
      <div className="absolute top-4 right-4 z-10 px-4 md:px-8">
        <select 
          onChange={changeLanguage} 
          value={i18n.language.split('-')[0]} 
          className="bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-500"
        >
          {languageOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {/* IT: Header dell'applicazione. EN: Application header. */}
      <header className="w-full bg-gray-800/70 border-b border-gray-700 shadow-lg backdrop-blur-sm">
        <div className="container mx-auto px-4 md:px-8 py-4 md:py-6 flex flex-col md:flex-row items-center md:items-end">
          {/* IT: Logo. EN: Logo. */}
          <div className="flex-none mb-4 md:mb-0 md:mr-6">
            <a href={repositoryUrl} target="_blank" rel="noopener noreferrer" title="Vai al Repository GitHub">
              <img 
                src="/workflow_inspector_logo.webp" 
                alt="ComfyUI Workflow Inspector Logo" 
                className="h-24 md:h-26 lg:h-32 w-auto transition-opacity duration-300 hover:opacity-80 
                           filter drop-shadow-[0_2px_2px_rgba(255,255,255,0.2)]"
              />
            </a>
          </div>
          
          {/* IT: Titolo e sottotitolo. EN: Title and subtitle. */}
          <div className="flex-grow text-center md:text-left">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-100 tracking-tight">{t('appTitle')}</h1>
            <p className="text-gray-400 mt-1 text-md sm:text-lg">{t('appSubtitle')}</p>
          </div>
        </div>
      </header>
      
      {/* IT: Contenuto principale. EN: Main content. */}
      <div className="flex-grow p-4 md:p-8">
        {/* IT: Area di caricamento file. EN: File upload area. */}
        <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-xl p-6 text-center shadow-lg shadow-black/20 mb-8 backdrop-blur-sm mx-auto">
          <label htmlFor="file-upload" className={`cursor-pointer bg-gray-700 hover:bg-gray-600 text-gray-200 font-bold py-3 px-6 rounded-lg transition-all duration-200 ease-in-out inline-block ring-2 ring-gray-600 hover:ring-yellow-500 ${!isAppReady ? 'opacity-50 cursor-not-allowed' : ''}`}>
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

        {/* IT: Layout principale: lista nodi e visualizzatore grafo. EN: Main layout: node list and graph viewer. */}
        <main className="w-full flex-grow flex flex-col md:flex-row gap-8 h-[70vh]">
          {/* IT: Lista dei nodi rilevati. EN: Detected nodes list. */}
          {workflow && workflow.nodeList.length > 0 && (
            <aside className="w-full md:w-1/3 lg:w-1/4 bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col h-full">
              <h3 className="text-lg font-bold mb-3 text-gray-300 flex-shrink-0">
                {t('detectedNodesTitle', { count: workflow.nodeList.length })}
              </h3>
              <div className="overflow-y-auto pr-2 flex-grow">
                <ul className="space-y-2">
                  {workflow.nodeList.map((node) => (
                    <li 
                      key={`${node.id}-${node.name}`} 
                      className="font-mono text-sm bg-gray-700/60 p-2 rounded-md 
                                 transition-all duration-200 ease-in-out 
                                 hover:bg-gray-600/80 hover:shadow-lg hover:shadow-yellow-500/10"
                      // IT: Evidenzia nodo nel grafo al passaggio del mouse. EN: Highlight node in graph on mouse enter.
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

          {/* IT: Area visualizzatore grafo e messaggi di errore. EN: Graph viewer area and error messages. */}
          <div className="flex-grow h-full relative">
            {/* IT: Messaggio di errore. EN: Error message. */}
            {errorMessage && (
               <div className="absolute inset-0 bg-red-900/50 text-red-300 flex items-center justify-center p-4 rounded-xl border border-red-700">
                  <p className="text-center">{errorMessage}</p> 
               </div>
            )}
            {/* IT: Visualizzatore LiteGraph. EN: LiteGraph viewer. */}
            <div className="w-full h-full rounded-xl overflow-hidden border border-gray-700">
              <LiteGraphViewer graphData={workflow} highlightedNodeId={highlightedNodeId} />
            </div>
          </div>
        </main>

        {/* IT: Sezione note del workflow. EN: Workflow notes section. */}
        {workflow?.notes && workflow.notes.length > 0 && (
          <section className="w-full mt-8">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4">{t('workflowNotesTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workflow.notes.map(note => (
                <div 
                  key={note.id} 
                  className="bg-gray-800 border border-gray-700 rounded-xl p-4 transition-all duration-200 hover:border-yellow-400 hover:scale-105"
                  // IT: Evidenzia nota nel grafo al passaggio del mouse. EN: Highlight note in graph on mouse enter.
                  onMouseEnter={() => setHighlightedNodeId(note.id)}
                  onMouseLeave={() => setHighlightedNodeId(null)}
                >
                  <h3 className="font-mono text-sm text-yellow-500 mb-2">{t('noteLabel', { id: note.id })}</h3>
                  <div className="text-gray-300 font-sans text-base break-words">
                    {/* IT: Renderizza Markdown o testo semplice. EN: Renders Markdown or plain text. */}
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
      </div>

      {/* IT: Footer. EN: Footer. */}
      <footer className="w-full text-center py-4 border-t border-gray-800 px-4 md:px-8">
        <p className="text-gray-500 text-sm">
          {t('footerNote')}
        </p>
        <p className="text-gray-600 text-xs mt-2">
          <a href={repositoryUrl} target="_blank" rel="noopener noreferrer" className="text-yellow-500 hover:underline">{t('footerRepoLink')}</a>
        </p>
      </footer>
    </div>
  );
}

export default App;
// src/utils/workflowExtractor.ts

import * as mm from 'music-metadata-browser';
import ExifReader from 'exifreader';
import type { ApiNode, NormalizedWorkflow, LLink, LGraphGroup, LGraphNode, WorkflowParameters, SamplerParameters, SubgraphDefinition } from '../types/comfy';
import { registerDynamicNode } from './litegraph-setup';
import { isWidgetInput, getInputType, isSeedInput, SEED_CONTROL_VALUES } from './comfyWidgets';

// IT: Interfaccia per informazioni sui nodi ComfyUI.
// EN: Interface for ComfyUI node information.
interface ComfyNodeInfo {
  name: string;
  display_name?: string;
  [key: string]: any;
}

// IT: Tipi di nodo "passanti": non contengono il dato, lo lasciano solo transitare.
//     Vanno attraversati per risalire alla vera sorgente (es. un Reroute tra il prompt e il sampler).
// EN: "Pass-through" node types: they don't hold the data, they just let it flow through.
//     They are traversed to reach the true source (e.g. a Reroute between the prompt and the sampler).
const PASS_THROUGH_NODE_TYPES = new Set(['Reroute', 'PrimitiveNode']);

// IT: Risale i collegamenti partendo da un input con un dato nome (es. 'positive') e restituisce
//     il NODO di origine, attraversando i nodi passanti (Reroute) e proteggendosi dai cicli.
// EN: Walks the links from a named input (e.g. 'positive') and returns the ORIGIN node,
//     traversing pass-through nodes (Reroute) and guarding against cycles.
function followInput(
  startNode: LGraphNode,
  inputName: string,
  nodesById: Map<number, LGraphNode>,
  linksById: Map<number, LLink>,
): LGraphNode | undefined {
  const visited = new Set<number>();
  let input = startNode.inputs?.find(i => i.name === inputName);

  while (input && input.link != null) {
    const link = linksById.get(input.link);
    if (!link) return undefined;
    const originNode = nodesById.get(link[1]); // IT: link[1] = id nodo di origine. EN: link[1] = origin node id.
    if (!originNode || visited.has(originNode.id)) return undefined; // IT: stop su nodo mancante o ciclo. EN: stop on missing node or cycle.
    visited.add(originNode.id);

    if (PASS_THROUGH_NODE_TYPES.has(originNode.type)) {
      input = originNode.inputs?.[0]; // IT: prosegue a ritroso attraverso il nodo passante. EN: keep walking back through the pass-through node.
      continue;
    }
    return originNode;
  }
  return undefined;
}

// IT: Come followInput, ma restituisce il primo valore testuale del nodo di origine
//     (tipicamente il testo di un CLIPTextEncode).
// EN: Like followInput, but returns the first text value of the origin node
//     (typically the text of a CLIPTextEncode).
function traceTextFromInput(
  startNode: LGraphNode,
  inputName: string,
  nodesById: Map<number, LGraphNode>,
  linksById: Map<number, LLink>,
): string | undefined {
  const origin = followInput(startNode, inputName, nodesById, linksById);
  const value = origin?.widgets_values?.[0];
  return typeof value === 'string' ? value : undefined;
}

// IT: Costruisce una mappa { nomeWidget -> valore } per un nodo, basandosi sulla definizione
//     in object_info. È robusta perché segue i NOMI invece di indici fissi, salta gli input che
//     sono collegamenti (socket) e gestisce il widget extra "control_after_generate" dopo i seed.
// EN: Builds a { widgetName -> value } map for a node, based on its object_info definition.
//     Robust because it follows NAMES instead of fixed indices, skips link inputs (sockets),
//     and handles the extra "control_after_generate" widget after seeds.
function buildWidgetMap(
  node: LGraphNode,
  objectInfo: Record<string, ComfyNodeInfo>,
): Record<string, unknown> {
  const info = objectInfo[node.type];
  const values = node.widgets_values;
  const map: Record<string, unknown> = {};
  if (!info?.input || !Array.isArray(values)) return map;

  // IT: Input che in QUESTO nodo sono stati convertiti in socket: non occupano widgets_values.
  // EN: Inputs that in THIS node were converted to sockets: they don't occupy widgets_values.
  const socketInputNames = new Set((node.inputs ?? []).map(i => i.name));
  let valueIndex = 0;

  for (const section of [info.input.required, info.input.optional]) {
    if (!section) continue;
    for (const inputName of Object.keys(section)) {
      const def = section[inputName];
      // IT: salta socket e input forzati a collegamento: non occupano widgets_values.
      // EN: skip sockets and force-input inputs: they don't occupy widgets_values.
      if (!isWidgetInput(def) || socketInputNames.has(inputName)) continue;
      if (valueIndex >= values.length) return map;

      map[inputName] = values[valueIndex++];

      // IT: dopo un seed intero, salta l'eventuale valore di control_after_generate.
      // EN: after an integer seed, skip the possible control_after_generate value.
      if (getInputType(def) === 'INT' && isSeedInput(inputName)
          && valueIndex < values.length && SEED_CONTROL_VALUES.has(String(values[valueIndex]))) {
        valueIndex++;
      }
    }
  }
  return map;
}

// IT: Estrae i parametri da un sampler "custom" (SamplerCustom / SamplerCustomAdvanced), i cui
//     valori sono sparsi su nodi collegati: lo scheduler (sigmas), il selettore (sampler) e il
//     guider (cfg). I valori vengono letti per NOME dei widget, così da gestire le varie varianti.
// EN: Extracts parameters from a "custom" sampler (SamplerCustom / SamplerCustomAdvanced), whose
//     values are spread across connected nodes: the scheduler (sigmas), the selector (sampler) and
//     the guider (cfg). Values are read by widget NAME, to handle the various variants.
function extractCustomSamplerParameters(
  node: LGraphNode,
  objectInfo: Record<string, ComfyNodeInfo>,
  nodesById: Map<number, LGraphNode>,
  linksById: Map<number, LLink>,
): SamplerParameters {
  const sigmasNode = followInput(node, 'sigmas', nodesById, linksById);     // IT: scheduler. EN: scheduler.
  const samplerSelectNode = followInput(node, 'sampler', nodesById, linksById); // IT: es. KSamplerSelect. EN: e.g. KSamplerSelect.
  const guiderNode = followInput(node, 'guider', nodesById, linksById);     // IT: es. CFGGuider (solo Advanced). EN: e.g. CFGGuider (Advanced only).

  const sigmasWidgets = sigmasNode ? buildWidgetMap(sigmasNode, objectInfo) : {};
  const samplerWidgets = samplerSelectNode ? buildWidgetMap(samplerSelectNode, objectInfo) : {};
  const guiderWidgets = guiderNode ? buildWidgetMap(guiderNode, objectInfo) : {};
  const ownWidgets = buildWidgetMap(node, objectInfo); // IT: SamplerCustom tiene cfg/seed sul nodo stesso. EN: SamplerCustom keeps cfg/seed on the node itself.

  return {
    id: String(node.id),
    nodeTitle: node.title || node.type,
    steps: sigmasWidgets.steps as number | undefined,
    cfg: (guiderWidgets.cfg ?? ownWidgets.cfg) as number | undefined,
    samplerName: samplerWidgets.sampler_name as string | undefined,
    scheduler: sigmasWidgets.scheduler as string | undefined,
  };
}

// IT: Tipo di file riconosciuto, usato per scegliere come estrarre il workflow.
// EN: Recognized file kind, used to choose how to extract the workflow.
type FileKind = 'json' | 'image' | 'audio' | 'video' | 'unknown';

// IT: Errore sollevato quando il file CONTIENE dei dati ma non sono leggibili/validi come workflow
//     (es. JSON corrotto). Diverso dal semplice "nessun workflow presente" (che ritorna null).
// EN: Error thrown when the file CONTAINS data that isn't readable/valid as a workflow
//     (e.g. corrupt JSON). Different from a plain "no workflow present" (which returns null).
export class WorkflowParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowParseError';
  }
}

// IT: Determina il tipo di file usando prima il MIME e, se assente/inaffidabile, l'estensione.
//     Il MIME a volte è vuoto (es. file trascinati o senza tipo registrato dal sistema).
// EN: Determines the file kind using the MIME type first and, if missing/unreliable, the extension.
//     The MIME is sometimes empty (e.g. dragged files or with no system-registered type).
function getFileKind(file: File): FileKind {
  const type = file.type;
  if (type === 'application/json') return 'json';
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('video/')) return 'video';

  // IT: Fallback sull'estensione. EN: Fallback to the file extension.
  const ext = file.name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json': return 'json';
    case 'png': case 'webp': case 'jpg': case 'jpeg': return 'image';
    case 'flac': case 'mp3': case 'ogg': case 'wav': return 'audio';
    case 'mp4': case 'webm': case 'mov': return 'video';
    default: return 'unknown';
  }
}

// IT: Estrae la stringa JSON del workflow da metadati di file audio/video o immagini.
// EN: Extracts workflow JSON string from audio/video or image file metadata.
async function extractFromFile(file: File, kind: FileKind): Promise<string | null> {
  try {
    // IT: Gestione file audio/video.
    // EN: Handle audio/video files.
    if (kind === 'audio' || kind === 'video') {
      const metadata = await mm.parseBlob(file);
      // IT: Cerca nei commenti comuni.
      // EN: Search in common comments.
      if (metadata.common.comment && metadata.common.comment.length > 0) {
        const comment = metadata.common.comment[0];
        if (comment.trim().startsWith('{')) return comment;
      }
      // IT: Cerca nei tag Vorbis.
      // EN: Search in Vorbis tags.
      if (metadata.native && metadata.native.vorbis) {
        const workflowComment = metadata.native.vorbis.find(c => c.id === 'WORKFLOW');
        if (workflowComment) return workflowComment.value;
        const promptComment = metadata.native.vorbis.find(c => c.id === 'PROMPT');
        if (promptComment) return promptComment.value;
      }
      return null;
    }
    
    // IT: Gestione file immagine.
    // EN: Handle image files.
    if (kind === 'image') {
      const buffer = await file.arrayBuffer();
      const tags: any = await ExifReader.load(buffer);
      // IT: Cerca nei tag EXIF 'workflow' o 'prompt'.
      // EN: Search in EXIF 'workflow' or 'prompt' tags.
      if (tags.workflow?.value && typeof tags.workflow.value === 'string') return tags.workflow.value;
      if (tags.prompt?.value && typeof tags.prompt.value === 'string') return tags.prompt.value;
      // IT: Gestione specifica WebP.
      // EN: Specific WebP handling.
      const webpWorkflowSource = tags.Make?.description || tags.Model?.description;
      if (webpWorkflowSource) {
        const match = String(webpWorkflowSource).match(/{.*}/s);
        if (match) return match[0];
      }
    }
    return null;
  } catch (error) {
    console.error(`Errore durante l'estrazione da un file di tipo '${kind}':`, error);
    return null;
  }
}

// IT: Estrae e normalizza il workflow da un file (JSON o con metadati).
// EN: Extracts and normalizes the workflow from a file (JSON or with metadata).
export async function extractAndNormalizeWorkflow(
  file: File,
  objectInfo: Record<string, ComfyNodeInfo> // IT: Info sui tipi di nodo per arricchimento. EN: Node type info for enrichment.
): Promise<NormalizedWorkflow | null> {
  let jsonString: string | null = null;
  
  try {
    // IT: Sceglie come ottenere il JSON in base al tipo di file (MIME, con fallback sull'estensione).
    // EN: Choose how to get the JSON based on the file kind (MIME, with extension fallback).
    const kind = getFileKind(file);
    if (kind === 'json') {
      jsonString = await file.text();
    } else if (kind === 'unknown') {
      return null; // IT: formato non supportato → nessun workflow. EN: unsupported format → no workflow.
    } else {
      jsonString = await extractFromFile(file, kind);
    }

    if (!jsonString) return null; // IT: nessun metadato di workflow nel file. EN: no workflow metadata in the file.

    // IT: Parsing del JSON (gestendo il doppio encoding). Un errore qui significa dati CORROTTI,
    //     non assenza di workflow: lo segnaliamo con un errore tipizzato.
    // EN: Parse the JSON (handling double encoding). An error here means CORRUPT data,
    //     not an absent workflow: we signal it with a typed error.
    let data: any;
    try {
      data = JSON.parse(jsonString.trim());
      if (typeof data === 'string') data = JSON.parse(data);
    } catch {
      throw new WorkflowParseError('I dati del workflow contenuti nel file sembrano corrotti.');
    }

    // IT: Identifica la sorgente dati del workflow (root, 'prompt', o 'workflow').
    // EN: Identify workflow data source (root, 'prompt', or 'workflow').
    let workflowSource = data;
    if (data?.prompt) workflowSource = data.prompt;
    if (data?.workflow) workflowSource = data.workflow;
    if (typeof workflowSource === 'string') {
      try {
        workflowSource = JSON.parse(workflowSource);
      } catch {
        throw new WorkflowParseError('I dati del workflow contenuti nel file sembrano corrotti.');
      }
    }

    // IT: Se non è un oggetto, non è un workflow valido. EN: If it's not an object, it's not a valid workflow.
    if (!workflowSource || typeof workflowSource !== 'object') return null;

    let nodes: LGraphNode[] = []; 
    let links: LLink[] = [];
    const groups: LGraphGroup[] = workflowSource.groups || [];

    // IT: Normalizza nodi e link dai formati LiteGraph o API.
    // EN: Normalize nodes and links from LiteGraph or API formats.
    if (Array.isArray(workflowSource.nodes)) { // IT: Formato LiteGraph. EN: LiteGraph format.
      nodes = workflowSource.nodes;
      links = Array.isArray(workflowSource.links) ? workflowSource.links : [];
    } else { // IT: Formato API. EN: API format.
      let linkIdCounter = 1;
      Object.entries(workflowSource as Record<string, unknown>).forEach(([id, details]) => {
        // IT: Considera solo le voci che sembrano davvero nodi (oggetti con class_type). Questo
        //     evita di interpretare un JSON qualsiasi come workflow generando "nodi spazzatura".
        // EN: Only consider entries that actually look like nodes (objects with class_type). This
        //     avoids treating arbitrary JSON as a workflow and producing "garbage nodes".
        if (!details || typeof details !== 'object' || !('class_type' in details)) return;
        const node = details as ApiNode;
        const { inputs, ...nodeData } = node;
        nodes.push({ id: Number(id), type: node.class_type, ...nodeData } as unknown as LGraphNode);
        // IT: Crea link dagli input.
        // EN: Create links from inputs.
        if (inputs) {
          Object.values(inputs).forEach((input: unknown, target_slot: number) => {
            if (Array.isArray(input) && typeof input[0] === 'string' && typeof input[1] === 'number') {
              links.push([ linkIdCounter++, Number(input[0]), input[1], Number(id), target_slot, "*" ]);
            }
          });
        }
      });
    }

    // IT: Nessun nodo valido = il file non contiene un workflow ComfyUI riconoscibile.
    // EN: No valid nodes = the file doesn't contain a recognizable ComfyUI workflow.
    if (nodes.length === 0) return null;

    const nodeList: { id: string; name: string }[] = [];
    const extractedNotes: { id: string; text: string; type: 'Note' | 'MarkdownNote' }[] = [];
    const parameters: WorkflowParameters = { samplers: [] };

    // IT: Ordina i nodi per garantire l'ordine di esecuzione cronologico.
    // EN: Sort nodes to ensure chronological execution order.
    nodes.sort((a, b) => a.order - b.order);

    // IT: Itera sui nodi per normalizzazione finale, estrazione note e parametri.
    // EN: Iterate over nodes for final normalization, note/parameter extraction.
    nodes.forEach(node => {
      if (!node.type && (node as any).class_type) {
        node.type = (node as any).class_type;
      }

      const info = objectInfo[node.type];
      let correctName = info?.display_name || info?.name || node.type;

      // IT: Gestione dei nodi Subgraph, che hanno un UUID come tipo.
      // EN: Handle Subgraph nodes, which have a UUID as their type.
      if (!info && workflowSource.definitions?.subgraphs) {
        const subgraphDef = workflowSource.definitions.subgraphs.find(
          (sg: SubgraphDefinition) => sg.id === node.type
        );
        if (subgraphDef) {
          correctName = subgraphDef.name || 'Subgraph'; // IT: Fallback a 'Subgraph'. EN: Fallback to 'Subgraph'.
          // IT: Registra dinamicamente il tipo di nodo se non esiste.
          // EN: Dynamically register the node type if it doesn't exist.
          registerDynamicNode(subgraphDef);
        }
      }

      if (!node.title || node.title === node.type) {
        node.title = correctName;
      }
      
      if (node.type === 'Note' || node.type === 'MarkdownNote') {
        const noteText = node.widgets_values?.[0] || '';
        if (noteText) {
          extractedNotes.push({ 
            id: String(node.id), 
            text: String(noteText),
            type: node.type
          });
        }
      } else {
        nodeList.push({ id: String(node.id), name: node.title || correctName });
      }

      // IT: Estrae i parametri chiave del workflow.
      // EN: Extract key workflow parameters.
      const widgetValues = node.widgets_values;
      if (widgetValues) {
        // IT: FALLBACK basato sul titolo. Usato solo se il tracciamento via link (più sotto) non
        //     trova nulla — utile per i workflow che non espongono i link degli input.
        // EN: Title-based FALLBACK. Only used if link tracing (below) finds nothing —
        //     useful for workflows that don't expose input links.
        if (node.type.includes('CLIPTextEncode') && node.title?.toLowerCase().includes('positive')) {
          parameters.positivePrompt = widgetValues[0] || parameters.positivePrompt;
        } else if (node.type.includes('CLIPTextEncode') && node.title?.toLowerCase().includes('negative')) {
          parameters.negativePrompt = widgetValues[0] || parameters.negativePrompt;
        } else if (node.type === 'KSampler' || node.type === 'KSamplerAdvanced') {
          const isAdvanced = node.type === 'KSamplerAdvanced';
          const sampler: SamplerParameters = {
            id: String(node.id),
            nodeTitle: node.title || node.type,
            steps: isAdvanced ? widgetValues[3] : widgetValues[2],
            cfg: isAdvanced ? widgetValues[4] : widgetValues[3],
            samplerName: isAdvanced ? widgetValues[5] : widgetValues[4],
            scheduler: isAdvanced ? widgetValues[6] : widgetValues[5],
          };
          parameters.samplers.push(sampler);
        }
      }
    });

    // IT: Estrazione robusta dei prompt: invece di affidarsi al titolo del nodo, parte dal nodo
    //     di campionamento (quello con input 'positive' e 'negative') e segue i collegamenti
    //     fino al nodo testuale di origine. Ha priorità sul fallback basato sul titolo.
    // EN: Robust prompt extraction: instead of relying on the node title, it starts from the
    //     sampler node (the one with 'positive' and 'negative' inputs) and follows the links
    //     back to the source text node. It takes priority over the title-based fallback.
    const nodesById = new Map<number, LGraphNode>(nodes.map(n => [n.id, n]));
    const linksById = new Map<number, LLink>();
    for (const link of links) {
      if (Array.isArray(link)) linksById.set(link[0], link); // IT: link[0] = id del collegamento. EN: link[0] = link id.
    }

    const samplerNode = nodes.find(
      n => n.inputs?.some(i => i.name === 'positive') && n.inputs?.some(i => i.name === 'negative')
    );
    if (samplerNode) {
      const tracedPositive = traceTextFromInput(samplerNode, 'positive', nodesById, linksById);
      const tracedNegative = traceTextFromInput(samplerNode, 'negative', nodesById, linksById);
      if (tracedPositive !== undefined) parameters.positivePrompt = tracedPositive;
      if (tracedNegative !== undefined) parameters.negativePrompt = tracedNegative;
    }

    // IT: Parametri dei sampler "custom" (pipeline moderna): i valori sono su nodi collegati,
    //     quindi vanno raccolti seguendo i link. I KSampler classici sono già gestiti nel ciclo sopra.
    // EN: "Custom" sampler parameters (modern pipeline): values live on connected nodes,
    //     so they are gathered by following links. Classic KSamplers are handled in the loop above.
    for (const node of nodes) {
      if (node.type === 'SamplerCustom' || node.type === 'SamplerCustomAdvanced') {
        parameters.samplers.push(extractCustomSamplerParameters(node, objectInfo, nodesById, linksById));
      }
    }

    // IT: Restituisce workflow normalizzato con i parametri.
    // EN: Return normalized workflow with parameters.
    return { nodes, links, groups, nodeList, notes: extractedNotes, parameters };

  } catch (error) {
    // IT: Gli errori di "dati corrotti" vengono propagati, per mostrare un messaggio specifico.
    //     Gli altri errori imprevisti vengono loggati e trattati come "nessun workflow".
    // EN: "Corrupt data" errors are propagated to show a specific message.
    //     Other unexpected errors are logged and treated as "no workflow".
    if (error instanceof WorkflowParseError) throw error;
    console.error(`Errore finale nel processare il workflow per ${file.name}:`, error);
    return null;
  }
}
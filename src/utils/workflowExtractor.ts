// src/utils/workflowExtractor.ts

import * as mm from 'music-metadata-browser';
import ExifReader from 'exifreader';
import type { ApiNode, ApiWorkflow, NormalizedWorkflow, LLink, LGraphGroup, LGraphNode, WorkflowParameters, SamplerParameters, SubgraphDefinition } from '../types/comfy';
import { registerDynamicNode } from './litegraph-setup';

// IT: Interfaccia per informazioni sui nodi ComfyUI.
// EN: Interface for ComfyUI node information.
interface ComfyNodeInfo {
  name: string;
  display_name?: string;
  [key: string]: any;
}

// IT: Estrae la stringa JSON del workflow da metadati di file audio/video o immagini.
// EN: Extracts workflow JSON string from audio/video or image file metadata.
async function extractFromFile(file: File): Promise<string | null> {
  const fileType = file.type;
  
  try {
    // IT: Gestione file audio/video.
    // EN: Handle audio/video files.
    if (fileType.startsWith('audio/') || fileType.startsWith('video/')) {
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
    if (fileType.startsWith('image/')) {
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
    console.error(`Errore durante l'estrazione da ${fileType}:`, error);
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
    // IT: Ottiene la stringa JSON del workflow.
    // EN: Get the workflow JSON string.
    if (file.type === 'application/json') {
      jsonString = await file.text();
    } else {
      jsonString = await extractFromFile(file);
    }

    if (!jsonString) return null;

    // IT: Parsing della stringa JSON, gestendo possibile doppio encoding.
    // EN: Parse JSON string, handling possible double encoding.
    let data = JSON.parse(jsonString.trim());
    if (typeof data === 'string') data = JSON.parse(data);
    
    // IT: Identifica la sorgente dati del workflow (root, 'prompt', o 'workflow').
    // EN: Identify workflow data source (root, 'prompt', or 'workflow').
    let workflowSource = data;
    if (data.prompt) workflowSource = data.prompt;
    if (data.workflow) workflowSource = data.workflow;
    if (typeof workflowSource === 'string') workflowSource = JSON.parse(workflowSource);

    let nodes: LGraphNode[] = []; 
    let links: LLink[] = [];
    const groups: LGraphGroup[] = workflowSource.groups || [];

    // IT: Normalizza nodi e link dai formati LiteGraph o API.
    // EN: Normalize nodes and links from LiteGraph or API formats.
    if (Array.isArray(workflowSource.nodes)) { // IT: Formato LiteGraph. EN: LiteGraph format.
      nodes = workflowSource.nodes;
      links = workflowSource.links;
    } else { // IT: Formato API. EN: API format.
      const apiFormat: ApiWorkflow = workflowSource;
      let linkIdCounter = 1;
      Object.entries(apiFormat).forEach(([id, details]: [string, ApiNode]) => {
        const { inputs, ...nodeData } = details;
        nodes.push({ id: Number(id), type: details.class_type, ...nodeData } as unknown as LGraphNode);
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
      
    // IT: Restituisce workflow normalizzato con i parametri.
    // EN: Return normalized workflow with parameters.
    return { nodes, links, groups, nodeList, notes: extractedNotes, parameters };

  } catch (error) {
    console.error(`Errore finale nel processare il workflow per ${file.name}:`, error);
    return null;
  }
}
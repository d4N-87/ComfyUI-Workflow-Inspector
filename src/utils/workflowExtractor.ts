// src/utils/workflowExtractor.ts

import * as mm from 'music-metadata-browser';
import ExifReader from 'exifreader';
import type { ApiNode, ApiWorkflow, NormalizedWorkflow, LLink, LGraphGroup, LGraphNode } from '../types/comfy';

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
    let groups: LGraphGroup[] = workflowSource.groups || [];

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

    const nodeList: { id: string; name: string }[] = []; // IT: Lista nodi per UI. EN: Node list for UI.
    const extractedNotes: { id: string; text: string; type: 'Note' | 'MarkdownNote' }[] = []; // IT: Note estratte. EN: Extracted notes.

    // IT: Itera sui nodi per normalizzazione finale, estrazione note e nomi.
    // EN: Iterate over nodes for final normalization, note/name extraction.
    nodes.forEach(node => {
      // IT: Assicura 'node.type'.
      // EN: Ensure 'node.type'.
      if (!node.type && (node as any).class_type) {
        node.type = (node as any).class_type;
      }

      const info = objectInfo[node.type];
      const correctName = info?.display_name || info?.name || node.type;

      // IT: Imposta titolo nodo per leggibilità.
      // EN: Set node title for readability.
      if (!node.title || node.title === node.type) {
        node.title = correctName;
      }
      
      // IT: Estrae testo da nodi Note/MarkdownNote.
      // EN: Extract text from Note/MarkdownNote nodes.
      if (node.type === 'Note' || node.type === 'MarkdownNote') {
        const noteText = node.widgets_values?.[0] || '';
        if (noteText) {
          extractedNotes.push({ 
            id: String(node.id), 
            text: String(noteText), // IT: Assicura stringa. EN: Ensure string.
            type: node.type
          });
        }
      } else {
        nodeList.push({ id: String(node.id), name: node.title || correctName });
      }
    });
      
    // IT: Restituisce workflow normalizzato.
    // EN: Return normalized workflow.
    return { nodes, links, groups, nodeList, notes: extractedNotes };

  } catch (error) {
    console.error(`Errore finale nel processare il workflow per ${file.name}:`, error);
    return null;
  }
}
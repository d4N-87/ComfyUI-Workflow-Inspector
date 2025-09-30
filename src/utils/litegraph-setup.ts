// src/utils/litegraph-setup.ts

import { LiteGraph } from 'litegraph.js';
import type { LGraphNode as LGraphNodeInterface, SubgraphDefinition } from '../types/comfy';

// IT: Flag per evitare registrazioni multiple.
// EN: Flag to prevent multiple registrations.
let hasBeenRegistered = false;

// IT: Registra i tipi di nodo ComfyUI in LiteGraph.
// EN: Registers ComfyUI node types in LiteGraph.
export function registerComfyNodes(objectInfo: Record<string, any>): void {
  if (hasBeenRegistered) {
    return;
  }

  console.log("Inizio registrazione nodi ComfyUI...");

  // IT: FASE 1: Registra nodi generici.
  // EN: PHASE 1: Register generic nodes.
  for (const nodeName in objectInfo) {
    // IT: Salta nodi con gestione speciale.
    // EN: Skip nodes with special handling.
    if (['Note', 'PrimitiveNode', 'Reroute', 'MarkdownNote'].includes(nodeName)) {
      continue;
    }

    const nodeInfo = objectInfo[nodeName];
    // IT: Costruttore per nodi generici.
    // EN: Constructor for generic nodes.
    const NodeConstructor = function(this: LGraphNodeInterface) {
      // IT: Aggiunge input richiesti.
      // EN: Add required inputs.
      if (nodeInfo.input?.required) for (const inputName in nodeInfo.input.required) this.addInput(inputName, nodeInfo.input.required[inputName][0]);
      // IT: Aggiunge input opzionali.
      // EN: Add optional inputs.
      if (nodeInfo.input?.optional) for (const inputName in nodeInfo.input.optional) this.addInput(inputName, nodeInfo.input.optional[inputName][0]);
      // IT: Aggiunge output.
      // EN: Add outputs.
      if (nodeInfo.output) {
        const outputNames = nodeInfo.output_name || nodeInfo.output;
        nodeInfo.output.forEach((outputType: string, i: number) => this.addOutput(outputNames[i], outputType));
      }
    };
    LiteGraph.registerNodeType(nodeInfo.name, NodeConstructor as any);
  }
  console.log("✅ Registrazione dei nodi generici completata.");


  // IT: FASE 2: Registrazione per "Note" e "MarkdownNote".
  // EN: PHASE 2: Registration for "Note" and "MarkdownNote".
  const createNoteConstructor = () => {
    return function(this: LGraphNodeInterface) {
      // IT: Aggiunge widget stringa multiriga.
      // EN: Add multiline string widget.
      this.addWidget("string", "", "", () => {}, { multiline: true });
      // IT: Popola widget al caricamento/configurazione.
      // EN: Populate widget on load/configuration.
      this.onConfigure = function() {
        if (this.widgets && this.widgets_values && this.widgets_values.length > 0) {
          this.widgets[0].value = this.widgets_values[0];
        }
      };
    };
  };
  LiteGraph.registerNodeType("Note", createNoteConstructor() as any);
  console.log("✅ Registrazione specifica per 'Note' completata.");
  LiteGraph.registerNodeType("MarkdownNote", createNoteConstructor() as any); // IT: Usa stesso costruttore. EN: Uses same constructor.
  console.log("✅ Registrazione specifica per 'MarkdownNote' completata.");


  // IT: FASE 3: Registrazione per "PrimitiveNode".
  // EN: PHASE 3: Registration for "PrimitiveNode".
  const PrimitiveNodeConstructor = function(this: LGraphNodeInterface) { /* IT: Costruttore vuoto. EN: Empty constructor. */ };
  LiteGraph.registerNodeType("PrimitiveNode", PrimitiveNodeConstructor as any);
  console.log("✅ Registrazione specifica per 'PrimitiveNode' completata.");


  // IT: FASE 4: Registrazione per "Reroute".
  // EN: PHASE 4: Registration for "Reroute".
  const RerouteNodeConstructor = function(this: LGraphNodeInterface) { /* IT: Costruttore vuoto. EN: Empty constructor. */ };
  LiteGraph.registerNodeType("Reroute", RerouteNodeConstructor as any);
  console.log("✅ Registrazione specifica per 'Reroute' completata.");

  hasBeenRegistered = true;
}

// IT: Registra un tipo di nodo dinamicamente, ad esempio per i Subgraph.
// EN: Registers a node type dynamically, e.g., for Subgraphs.
export function registerDynamicNode(subgraphDef: SubgraphDefinition): void {
  // IT: Controlla se il nodo è già registrato per evitare duplicati.
  // EN: Check if the node is already registered to avoid duplicates.
  if (LiteGraph.getNodeType(subgraphDef.id)) {
    return;
  }

  console.log(`Registrazione dinamica del nodo: ${subgraphDef.name} (${subgraphDef.id})`);

  // IT: Costruttore per il nodo Subgraph.
  // EN: Constructor for the Subgraph node.
  const SubgraphNodeConstructor = function(this: LGraphNodeInterface) {
    // IT: Aggiunge input e output basandosi sulla definizione del Subgraph.
    // EN: Add inputs and outputs based on the Subgraph definition.
    subgraphDef.inputs?.forEach(input => {
      this.addInput(input.name, input.type);
    });
    subgraphDef.outputs?.forEach(output => {
      this.addOutput(output.name, output.type);
    });
  };

  LiteGraph.registerNodeType(subgraphDef.id, SubgraphNodeConstructor as any);
  console.log(`✅ Nodo ${subgraphDef.name} registrato dinamicamente.`);
}
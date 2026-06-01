// src/utils/litegraph-setup.ts

import { LiteGraph } from 'litegraph.js';
import type { LGraphNode as LGraphNodeInterface, SubgraphDefinition } from '../types/comfy';
import {
  isWidgetInput,
  getInputType,
  getInputConfig,
  isSeedInput,
  SEED_CONTROL_VALUES,
  type InputDefinition,
} from './comfyWidgets';

// IT: Flag per evitare registrazioni multiple.
// EN: Flag to prevent multiple registrations.
let hasBeenRegistered = false;

// IT: Aggiunge a un nodo il widget corretto per un input ComfyUI di tipo "valore", scegliendo
//     il widget LiteGraph adatto (numero, menù, testo, interruttore). Dopo un seed intero aggiunge
//     anche il widget "control_after_generate", come fa ComfyUI, per mantenere l'allineamento dei
//     valori salvati in widgets_values.
// EN: Adds to a node the correct widget for a "value" ComfyUI input, picking the right LiteGraph
//     widget (number, combo, text, toggle). After an integer seed it also adds the
//     "control_after_generate" widget, as ComfyUI does, to keep saved widgets_values aligned.
function addComfyWidget(node: LGraphNodeInterface, name: string, def: InputDefinition): void {
  const type = getInputType(def);
  const config = getInputConfig(def) ?? {};
  const noop = () => {};

  if (Array.isArray(type) || type === 'COMBO') {
    // IT: menù a tendina (combo): opzioni dall'array (vecchio formato) o da config.options (recente).
    // EN: dropdown (combo): options from the array (old format) or from config.options (recent).
    const values = (Array.isArray(type) ? type : (config.options as unknown[])) ?? [];
    node.addWidget('combo', name, config.default ?? values[0], noop, { values });
  } else if (type === 'INT' || type === 'FLOAT') {
    node.addWidget('number', name, config.default ?? 0, noop, {});
    if (type === 'INT' && isSeedInput(name)) {
      node.addWidget('combo', 'control_after_generate', 'randomize', noop, { values: [...SEED_CONTROL_VALUES] });
    }
  } else if (type === 'BOOLEAN') {
    node.addWidget('toggle', name, config.default ?? false, noop, {});
  } else {
    // IT: STRING e altri tipi-valore testuali.
    // EN: STRING and other textual value types.
    node.addWidget('text', name, config.default ?? '', noop, {});
  }
}

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
      // IT: Scorre gli input nell'ordine di ComfyUI (prima required, poi optional). Gli input di
      //     tipo "valore" diventano widget dentro il nodo; gli altri restano socket (collegamenti).
      //     Questo rende l'anteprima molto più fedele a ComfyUI rispetto a "tutto socket".
      // EN: Iterates inputs in ComfyUI's order (required first, then optional). "Value" inputs
      //     become widgets inside the node; the others remain sockets (links).
      //     This makes the preview far more faithful to ComfyUI than "everything as sockets".
      for (const section of [nodeInfo.input?.required, nodeInfo.input?.optional]) {
        if (!section) continue;
        for (const inputName in section) {
          const def = section[inputName];
          if (isWidgetInput(def)) {
            addComfyWidget(this, inputName, def);
          } else {
            this.addInput(inputName, getInputType(def) as string);
          }
        }
      }
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
  //     Il valore di una primitiva è salvato in widgets_values; al caricamento creiamo un widget
  //     di testo per ciascun valore, così il nodo non appare vuoto (es. Width/Height, prompt...).
  // EN: PHASE 3: Registration for "PrimitiveNode".
  //     A primitive's value lives in widgets_values; on load we create a text widget for each value
  //     so the node isn't empty (e.g. Width/Height, prompt...).
  const PrimitiveNodeConstructor = function(this: LGraphNodeInterface) {
    this.onConfigure = function() {
      if (!Array.isArray(this.widgets_values)) return;
      for (const value of this.widgets_values) {
        this.addWidget("text", "", value, () => {});
      }
    };
  };
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
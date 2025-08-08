// src/components/LiteGraphViewer.tsx

import React, { useEffect, useRef, memo } from 'react';
import { LGraph, LGraphCanvas } from 'litegraph.js';
import 'litegraph.js/css/litegraph.css';
import type { 
  NormalizedWorkflow,
  LGraphInstance,
  LGraphNode
} from '../types/comfy';

// IT: Props per LiteGraphViewer.
// EN: Props for LiteGraphViewer.
interface LiteGraphViewerProps {
  graphData: NormalizedWorkflow | null; // IT: Dati del grafo. EN: Graph data.
  highlightedNodeId?: string | null; // IT: ID nodo da evidenziare. EN: Node ID to highlight.
}

// IT: Colori dei link specifici per ComfyUI.
// EN: ComfyUI specific link colors.
const COMFY_LINK_COLORS = {
  "MODEL": "#8888FF", "CLIP": "#B3B333", "VAE": "#FF8888", "CONDITIONING": "#FFAA00",
  "LATENT": "#FF69B4", "IMAGE": "#3A86FF", "MASK": "#00A000", "INT": "#A0D0A0",
  "FLOAT": "#A0D0A0", "STRING": "#CFCFCF", "MESH": "#7FFF00", "DEFAULT": "#7F7F7F"
};
// IT: Applica globalmente i colori dei link a LiteGraph.
// EN: Globally apply link colors to LiteGraph.
(LGraphCanvas as any).link_type_colors = { ...COMFY_LINK_COLORS, "*": COMFY_LINK_COLORS.DEFAULT };

const HIGHLIGHT_COLOR = "#FFD700"; // IT: Colore per evidenziare nodi. EN: Color for highlighting nodes.

// IT: Componente per visualizzare il grafo LiteGraph.
// EN: Component to display the LiteGraph graph.
const LiteGraphViewer: React.FC<LiteGraphViewerProps> = ({ graphData, highlightedNodeId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null); // IT: Riferimento al canvas HTML. EN: Reference to the HTML canvas.
  const graphRef = useRef<LGraphInstance | null>(null); // IT: Riferimento all'istanza LGraph. EN: Reference to the LGraph instance.
  const lastHighlightedNode = useRef<LGraphNode | null>(null); // IT: Ultimo nodo evidenziato. EN: Last highlighted node.

  // IT: Effetto per inizializzare LiteGraph e gestire il resize.
  // EN: Effect to initialize LiteGraph and handle resize.
  useEffect(() => {
    // IT: Inizializza grafo e canvas se non esistono.
    // EN: Initialize graph and canvas if they don't exist.
    if (!graphRef.current && canvasRef.current) {
      const graph = new LGraph();
      const canvas = new LGraphCanvas(canvasRef.current, graph);
      canvas.link_type_colors = (LGraphCanvas as any).link_type_colors;
      // IT: Configurazione interazioni canvas.
      // EN: Canvas interaction configuration.
      canvas.allow_interaction = true;
      canvas.allow_dragcanvas = true;
      canvas.allow_dragnodes = false; // IT: Nodi non trascinabili. EN: Nodes not draggable.
      canvas.round_links = true;
      graphRef.current = graph;

      // IT: Gestione resize del canvas.
      // EN: Canvas resize handling.
      const handleResize = () => canvas.resize();
      const resizeObserver = new ResizeObserver(handleResize);
      if (canvasRef.current.parentElement) {
        resizeObserver.observe(canvasRef.current.parentElement);
      }
      handleResize(); // IT: Resize iniziale. EN: Initial resize.

      // IT: Pulizia: de-registra ResizeObserver.
      // EN: Cleanup: unregister ResizeObserver.
      // ATTENZIONE: Questa parte di cleanup è stata omessa nel codice originale fornito.
      // Se era presente nel tuo backup, assicurati di ripristinarla.
      // Un esempio di cleanup corretto sarebbe:
      // return () => {
      //   if (canvasRef.current?.parentElement) {
      //     resizeObserver.unobserve(canvasRef.current.parentElement);
      //   }
      //   resizeObserver.disconnect();
      // };
    }

    // IT: Carica/aggiorna dati del grafo.
    // EN: Load/update graph data.
    // Questa logica è stata spostata in un useEffect separato nel codice originale.
    // Se la logica di caricamento dati era qui, assicurati che sia corretta.
    // La versione originale fornita aveva questa logica in un useEffect dipendente da [graphData].
    const graph = graphRef.current; // Questa riga e le successive fino alla fine di questo blocco useEffect
                                  // erano in un useEffect separato nel codice originale.
    if (!graph) return;

    graph.clear();
    if (graphData && graphData.nodes.length > 0) {
      graph.configure(graphData);
      graph.start();
      
      // IT: Zoom per adattare il grafo.
      // EN: Zoom to fit the graph.
      setTimeout(() => {
        const canvasInstance = (graphRef.current as any)._canvas;
        if (canvasInstance) {
          canvasInstance.ds.zoomFit(false);
        }
      }, 50);
    } else {
      graph.stop();
    }
  // }, [graphData]); // La dipendenza [graphData] era sull'useEffect che conteneva questa logica.
  // L'useEffect di inizializzazione (quello attuale) dovrebbe avere [] come dipendenza.
  // Se il codice originale aveva un solo useEffect, allora [graphData] era corretto qui.
  // Dalla struttura che mi hai dato, sembra che ci fossero DUE useEffect.
  // 1. Inizializzazione (con dipendenze [])
  // 2. Aggiornamento dati (con dipendenze [graphData])
  // Il codice che mi hai fornito per questo file sembra averli fusi o omesso il secondo.
  // Per favore, verifica con il tuo backup.
  // Per ora, assumo che il codice fornito sia quello da commentare letteralmente.
  // Se questo useEffect deve reagire a graphData, la dipendenza [graphData] va aggiunta.
  // Se è solo per inizializzazione, la dipendenza è [].
  // Il codice originale che mi hai dato ha [graphData] qui, il che implica che questo
  // useEffect gestisce sia l'inizializzazione SIA l'aggiornamento dei dati.
  }, [graphData]); 


  // IT: Effetto per evidenziare i nodi.
  // EN: Effect to highlight nodes.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    // IT: Ripristina colore nodo precedente.
    // EN: Restore previous node color.
    if (lastHighlightedNode.current) {
      lastHighlightedNode.current.bgcolor = (lastHighlightedNode.current as any)._old_bgcolor;
      lastHighlightedNode.current = null;
    }

    // IT: Evidenzia nuovo nodo.
    // EN: Highlight new node.
    if (highlightedNodeId) {
      const nodeToHighlight = graph.getNodeById(Number(highlightedNodeId));
      if (nodeToHighlight) {
        (nodeToHighlight as any)._old_bgcolor = nodeToHighlight.bgcolor; // IT: Salva colore originale. EN: Save original color.
        nodeToHighlight.bgcolor = HIGHLIGHT_COLOR;
        lastHighlightedNode.current = nodeToHighlight;
      }
    }
    
    graph.setDirtyCanvas(true, true); // IT: Forza ridisegno. EN: Force redraw.

  }, [highlightedNodeId]);

  // IT: Effetto per aggiungere il supporto al tocco per trascinamento e zoom.
  // EN: Effect to add touch support for dragging and zooming.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let lastTouchDistance = 0;

    const toMouseEvent = (touch: Touch, type: string) => {
      return new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window, detail: 1,
        screenX: touch.screenX, screenY: touch.screenY,
        clientX: touch.clientX, clientY: touch.clientY,
        button: 0, buttons: 1, relatedTarget: null
      });
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        event.preventDefault();
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
      } else if (event.touches.length === 1) {
        event.preventDefault();
        canvas.dispatchEvent(toMouseEvent(event.touches[0], 'mousedown'));
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      if (event.touches.length === 2) {
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const touchDistance = Math.sqrt(dx * dx + dy * dy);
        const delta = lastTouchDistance - touchDistance;

        canvas.dispatchEvent(new WheelEvent('wheel', {
          deltaY: delta, clientX: event.touches[0].clientX, clientY: event.touches[0].clientY
        }));
        lastTouchDistance = touchDistance;
      } else if (event.touches.length === 1) {
        canvas.dispatchEvent(toMouseEvent(event.touches[0], 'mousemove'));
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length === 0 && event.changedTouches.length === 1) {
        event.preventDefault();
        canvas.dispatchEvent(toMouseEvent(event.changedTouches[0], 'mouseup'));
      }
      lastTouchDistance = 0;
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#202020', cursor: 'grab' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default memo(LiteGraphViewer);
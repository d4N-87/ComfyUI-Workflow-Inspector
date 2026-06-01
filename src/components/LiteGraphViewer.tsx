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
  // IT: Riferimento all'istanza LGraphCanvas (tipo strutturale: serve solo l'helper di zoom).
  // EN: Reference to the LGraphCanvas instance (structural type: only the zoom helper is needed).
  const canvasInstanceRef = useRef<{ ds: { zoomFit: (center?: boolean) => void } } | null>(null);
  const lastHighlightedNode = useRef<LGraphNode | null>(null); // IT: Ultimo nodo evidenziato. EN: Last highlighted node.

  // IT: Effetto di inizializzazione (una sola volta): crea grafo, canvas e gestione del resize.
  //     Il cleanup ferma il rendering e disconnette l'observer, evitando memory leak allo smontaggio.
  // EN: Initialization effect (once): creates the graph, canvas and resize handling.
  //     The cleanup stops rendering and disconnects the observer, preventing a memory leak on unmount.
  useEffect(() => {
    if (!canvasRef.current) return;

    const graph = new LGraph();
    const canvas = new LGraphCanvas(canvasRef.current, graph);
    canvas.link_type_colors = (LGraphCanvas as any).link_type_colors;
    // IT: Configurazione interazioni canvas.
    // EN: Canvas interaction configuration.
    canvas.allow_interaction = true;
    canvas.allow_dragcanvas = true;
    // IT: Trascinamento nodi attivo (stile ComfyUI). In litegraph il toggle di collasso (click sul
    //     titolo) è agganciato a questo flag, quindi così si possono anche aprire/chiudere i nodi.
    // EN: Node dragging enabled (ComfyUI-style). In litegraph the collapse toggle (title click) is
    //     tied to this flag, so this also lets nodes be expanded/collapsed.
    canvas.allow_dragnodes = true;

    // IT: Disabilita la ricerca nodi (doppio click) e il menu contestuale (tasto destro).
    // EN: Disable node search (double-click) and context menu (right-click).
    canvas.allow_searchbox = false;
    canvas.showContextMenu = () => {};

    canvas.round_links = true;
    graphRef.current = graph;
    canvasInstanceRef.current = canvas;

    // IT: Gestione resize del canvas tramite ResizeObserver sul contenitore.
    // EN: Canvas resize handling via a ResizeObserver on the container.
    const handleResize = () => canvas.resize();
    const resizeObserver = new ResizeObserver(handleResize);
    const parent = canvasRef.current.parentElement;
    if (parent) resizeObserver.observe(parent);
    handleResize(); // IT: Resize iniziale. EN: Initial resize.

    return () => {
      resizeObserver.disconnect();
      // IT: Ferma il loop di rendering del canvas (altrimenti continuerebbe dopo lo smontaggio).
      // EN: Stop the canvas render loop (otherwise it would keep running after unmount).
      (canvas as any).stopRendering?.();
      graph.stop();
      graphRef.current = null;
      canvasInstanceRef.current = null;
    };
  }, []);

  // IT: Effetto per caricare/aggiornare i dati del grafo quando cambia graphData.
  // EN: Effect to load/update the graph data when graphData changes.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    graph.clear();
    if (graphData && graphData.nodes.length > 0) {
      graph.configure(graphData);
      // IT: Niente graph.start(): per un visualizzatore non serve il loop di ESECUZIONE del grafo
      //     (spreca CPU/batteria). Il canvas ha già il proprio loop di rendering per pan/zoom/drag.
      // EN: No graph.start(): a viewer doesn't need the graph EXECUTION loop (wastes CPU/battery).
      //     The canvas already runs its own render loop for pan/zoom/drag.
      requestAnimationFrame(() => {
        canvasInstanceRef.current?.ds?.zoomFit?.(false); // IT: adatta lo zoom al grafo. EN: fit zoom to the graph.
        graph.setDirtyCanvas(true, true);
      });
    } else {
      graph.setDirtyCanvas(true, true); // IT: ridisegna la tela vuota. EN: redraw the empty canvas.
    }
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
        button: 0, buttons: type === 'mouseup' ? 0 : 1, relatedTarget: null
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

        const wheelEvent = new CustomEvent('mousewheel', {
          bubbles: true,
          cancelable: true,
          detail: -delta
        });
        Object.assign(wheelEvent, {
            clientX: event.touches[0].clientX,
            clientY: event.touches[0].clientY,
            wheelDelta: -delta / 3,
        });
        canvas.dispatchEvent(wheelEvent);

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
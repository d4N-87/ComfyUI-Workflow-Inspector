// src/utils/__tests__/workflowExtractor.test.ts
//
// IT: Test di "caratterizzazione" per l'estrattore di workflow. Fotografano il comportamento
//     ATTUALE della funzione, così da fare da rete di sicurezza prima di rifattorizzare la logica.
// EN: "Characterization" tests for the workflow extractor. They capture the CURRENT behavior
//     of the function, acting as a safety net before refactoring the logic.

import { describe, it, expect } from 'vitest';
import { extractAndNormalizeWorkflow } from '../workflowExtractor';

// IT: object_info minimale, sufficiente per i nodi usati nei test.
// EN: Minimal object_info, enough for the nodes used in the tests.
const mockObjectInfo = {
  CheckpointLoaderSimple: { name: 'CheckpointLoaderSimple', display_name: 'Load Checkpoint' },
  CLIPTextEncode: { name: 'CLIPTextEncode', display_name: 'CLIP Text Encode (Prompt)' },
  KSampler: { name: 'KSampler', display_name: 'KSampler' },
  // IT: Nodi della pipeline "custom" (formato recente: combo come stringa 'COMBO').
  // EN: "Custom" pipeline nodes (recent format: combo as the string 'COMBO').
  SamplerCustomAdvanced: { name: 'SamplerCustomAdvanced', display_name: 'SamplerCustomAdvanced' },
  KSamplerSelect: { name: 'KSamplerSelect', input: { required: { sampler_name: ['COMBO', {}] } } },
  RandomNoise: { name: 'RandomNoise', input: { required: { noise_seed: ['INT', {}] } } },
  BasicScheduler: {
    name: 'BasicScheduler',
    input: { required: { model: ['MODEL'], scheduler: ['COMBO', {}], steps: ['INT', {}], denoise: ['FLOAT', {}] } },
  },
  CFGGuider: {
    name: 'CFGGuider',
    input: { required: { model: ['MODEL'], positive: ['CONDITIONING'], negative: ['CONDITIONING'], cfg: ['FLOAT', {}] } },
  },
};

// IT: Crea un File JSON in memoria, come farebbe il browser al caricamento.
// EN: Creates an in-memory JSON File, as the browser would on upload.
function jsonFile(data: unknown): File {
  return new File([JSON.stringify(data)], 'workflow.json', { type: 'application/json' });
}

describe('extractAndNormalizeWorkflow — formato LiteGraph', () => {
  // IT: Workflow tipico salvato dall'interfaccia di ComfyUI (nodi come array).
  // EN: Typical workflow saved from the ComfyUI interface (nodes as an array).
  const litegraphWorkflow = {
    nodes: [
      { id: 1, type: 'CheckpointLoaderSimple', order: 0, widgets_values: ['model.safetensors'] },
      { id: 2, type: 'CLIPTextEncode', title: 'Positive', order: 1, widgets_values: ['a cat'] },
      { id: 3, type: 'CLIPTextEncode', title: 'Negative', order: 2, widgets_values: ['blurry'] },
      // IT: Ordine widget KSampler: [seed, control_after_generate, steps, cfg, sampler_name, scheduler, denoise]
      // EN: KSampler widget order: [seed, control_after_generate, steps, cfg, sampler_name, scheduler, denoise]
      { id: 4, type: 'KSampler', order: 3, widgets_values: [123456, 'randomize', 20, 7.5, 'euler', 'normal', 1.0] },
      { id: 5, type: 'Note', order: 4, widgets_values: ['questa è una nota'] },
    ],
    links: [],
    groups: [],
  };

  it('restituisce un workflow normalizzato non nullo', async () => {
    const result = await extractAndNormalizeWorkflow(jsonFile(litegraphWorkflow), mockObjectInfo);
    expect(result).not.toBeNull();
  });

  it('elenca i nodi escludendo le note', async () => {
    const result = await extractAndNormalizeWorkflow(jsonFile(litegraphWorkflow), mockObjectInfo);
    // IT: 5 nodi totali - 1 nota = 4 nella lista nodi.
    // EN: 5 total nodes - 1 note = 4 in the node list.
    expect(result!.nodeList).toHaveLength(4);
  });

  it('estrae le note separatamente', async () => {
    const result = await extractAndNormalizeWorkflow(jsonFile(litegraphWorkflow), mockObjectInfo);
    expect(result!.notes).toHaveLength(1);
    expect(result!.notes![0]).toMatchObject({ id: '5', text: 'questa è una nota', type: 'Note' });
  });

  it('estrae i prompt positivo e negativo dal titolo del nodo (comportamento attuale)', async () => {
    const result = await extractAndNormalizeWorkflow(jsonFile(litegraphWorkflow), mockObjectInfo);
    expect(result!.parameters!.positivePrompt).toBe('a cat');
    expect(result!.parameters!.negativePrompt).toBe('blurry');
  });

  it('estrae i parametri del KSampler per indice dei widget (comportamento attuale)', async () => {
    const result = await extractAndNormalizeWorkflow(jsonFile(litegraphWorkflow), mockObjectInfo);
    expect(result!.parameters!.samplers).toHaveLength(1);
    expect(result!.parameters!.samplers[0]).toMatchObject({
      steps: 20,
      cfg: 7.5,
      samplerName: 'euler',
      scheduler: 'normal',
    });
  });
});

describe('extractAndNormalizeWorkflow — estrazione prompt via link (#3)', () => {
  // IT: Workflow con titoli GENERICI (il vecchio metodo basato sul titolo fallirebbe),
  //     ma con i link corretti dai CLIPTextEncode agli input positive/negative del KSampler.
  // EN: Workflow with GENERIC titles (the old title-based method would fail),
  //     but with correct links from the CLIPTextEncode nodes to the KSampler positive/negative inputs.
  const workflowWithLinks = {
    nodes: [
      { id: 1, type: 'CheckpointLoaderSimple', order: 0, widgets_values: ['model.safetensors'],
        outputs: [{ name: 'MODEL', type: 'MODEL', links: [30] }] },
      { id: 2, type: 'CLIPTextEncode', order: 1, widgets_values: ['a beautiful cat'],
        inputs: [{ name: 'clip', type: 'CLIP', link: 10 }],
        outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [20] }] },
      { id: 3, type: 'CLIPTextEncode', order: 2, widgets_values: ['ugly, blurry'],
        inputs: [{ name: 'clip', type: 'CLIP', link: 11 }],
        outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [21] }] },
      { id: 4, type: 'KSampler', order: 3, widgets_values: [123, 'randomize', 25, 8, 'dpmpp_2m', 'karras', 1],
        inputs: [
          { name: 'model', type: 'MODEL', link: 30 },
          { name: 'positive', type: 'CONDITIONING', link: 20 },
          { name: 'negative', type: 'CONDITIONING', link: 21 },
          { name: 'latent_image', type: 'LATENT', link: 31 },
        ] },
    ],
    // IT: [id_link, id_nodo_origine, slot_origine, id_nodo_dest, slot_dest, tipo]
    // EN: [link_id, origin_node_id, origin_slot, target_node_id, target_slot, type]
    links: [
      [20, 2, 0, 4, 1, 'CONDITIONING'],
      [21, 3, 0, 4, 2, 'CONDITIONING'],
    ],
    groups: [],
  };

  it('estrae i prompt seguendo i link, anche con titoli generici', async () => {
    const result = await extractAndNormalizeWorkflow(jsonFile(workflowWithLinks), mockObjectInfo);
    expect(result!.parameters!.positivePrompt).toBe('a beautiful cat');
    expect(result!.parameters!.negativePrompt).toBe('ugly, blurry');
  });

  it('attraversa i nodi Reroute risalendo al nodo testuale', async () => {
    // IT: Inserisce un Reroute tra il CLIPTextEncode positivo e il KSampler.
    // EN: Inserts a Reroute between the positive CLIPTextEncode and the KSampler.
    const withReroute = {
      nodes: [
        { id: 2, type: 'CLIPTextEncode', order: 1, widgets_values: ['cat through reroute'],
          outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [20] }] },
        { id: 9, type: 'Reroute', order: 2,
          inputs: [{ name: '', type: '*', link: 20 }],
          outputs: [{ name: '', type: '*', links: [22] }] },
        { id: 3, type: 'CLIPTextEncode', order: 3, widgets_values: ['neg'],
          outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [21] }] },
        { id: 4, type: 'KSampler', order: 4, widgets_values: [1, 'fixed', 20, 7, 'euler', 'normal', 1],
          inputs: [
            { name: 'positive', type: 'CONDITIONING', link: 22 },
            { name: 'negative', type: 'CONDITIONING', link: 21 },
          ] },
      ],
      links: [
        [20, 2, 0, 9, 0, 'CONDITIONING'],
        [22, 9, 0, 4, 1, 'CONDITIONING'],
        [21, 3, 0, 4, 2, 'CONDITIONING'],
      ],
      groups: [],
    };
    const result = await extractAndNormalizeWorkflow(jsonFile(withReroute), mockObjectInfo);
    expect(result!.parameters!.positivePrompt).toBe('cat through reroute');
    expect(result!.parameters!.negativePrompt).toBe('neg');
  });
});

describe('extractAndNormalizeWorkflow — pipeline sampler "custom" (SamplerCustomAdvanced)', () => {
  // IT: Pipeline moderna: i parametri sono sparsi su nodi collegati (scheduler, selettore, guider).
  //     steps -> BasicScheduler, sampler -> KSamplerSelect, cfg -> CFGGuider, prompt -> via CFGGuider.
  // EN: Modern pipeline: parameters are spread across connected nodes (scheduler, selector, guider).
  const customPipeline = {
    nodes: [
      { id: 50, type: 'RandomNoise', order: 0, widgets_values: [42, 'fixed'],
        outputs: [{ name: 'NOISE', type: 'NOISE', links: [100] }] },
      { id: 51, type: 'KSamplerSelect', order: 1, widgets_values: ['dpmpp_2m'],
        outputs: [{ name: 'SAMPLER', type: 'SAMPLER', links: [101] }] },
      { id: 52, type: 'BasicScheduler', order: 2, widgets_values: ['karras', 25, 1.0],
        inputs: [{ name: 'model', type: 'MODEL', link: 200 }],
        outputs: [{ name: 'SIGMAS', type: 'SIGMAS', links: [102] }] },
      { id: 53, type: 'CFGGuider', order: 3, widgets_values: [7.5],
        inputs: [
          { name: 'model', type: 'MODEL', link: 201 },
          { name: 'positive', type: 'CONDITIONING', link: 103 },
          { name: 'negative', type: 'CONDITIONING', link: 104 },
        ],
        outputs: [{ name: 'GUIDER', type: 'GUIDER', links: [105] }] },
      { id: 54, type: 'CLIPTextEncode', order: 4, widgets_values: ['a robot'],
        outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [103] }] },
      { id: 55, type: 'CLIPTextEncode', order: 5, widgets_values: ['low quality'],
        outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [104] }] },
      { id: 56, type: 'SamplerCustomAdvanced', order: 6,
        inputs: [
          { name: 'noise', type: 'NOISE', link: 100 },
          { name: 'guider', type: 'GUIDER', link: 105 },
          { name: 'sampler', type: 'SAMPLER', link: 101 },
          { name: 'sigmas', type: 'SIGMAS', link: 102 },
          { name: 'latent_image', type: 'LATENT', link: 106 },
        ] },
    ],
    links: [
      [100, 50, 0, 56, 0, 'NOISE'],
      [101, 51, 0, 56, 2, 'SAMPLER'],
      [102, 52, 0, 56, 3, 'SIGMAS'],
      [105, 53, 0, 56, 1, 'GUIDER'],
      [103, 54, 0, 53, 1, 'CONDITIONING'],
      [104, 55, 0, 53, 2, 'CONDITIONING'],
    ],
    groups: [],
  };

  it('raccoglie i parametri seguendo i link ai nodi scheduler/selettore/guider', async () => {
    const result = await extractAndNormalizeWorkflow(jsonFile(customPipeline), mockObjectInfo);
    expect(result!.parameters!.samplers).toHaveLength(1);
    expect(result!.parameters!.samplers[0]).toMatchObject({
      steps: 25,            // IT: da BasicScheduler. EN: from BasicScheduler.
      cfg: 7.5,             // IT: da CFGGuider. EN: from CFGGuider.
      samplerName: 'dpmpp_2m', // IT: da KSamplerSelect. EN: from KSamplerSelect.
      scheduler: 'karras',  // IT: da BasicScheduler. EN: from BasicScheduler.
    });
  });

  it('estrae i prompt attraverso il CFGGuider (che porta positive/negative)', async () => {
    const result = await extractAndNormalizeWorkflow(jsonFile(customPipeline), mockObjectInfo);
    expect(result!.parameters!.positivePrompt).toBe('a robot');
    expect(result!.parameters!.negativePrompt).toBe('low quality');
  });
});

describe('extractAndNormalizeWorkflow — formato API', () => {
  // IT: Workflow in formato API (oggetto con chiavi = id nodo, link dedotti dagli input).
  // EN: API-format workflow (object keyed by node id, links inferred from inputs).
  const apiWorkflow = {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'model.safetensors' } },
    '4': { class_type: 'KSampler', inputs: { seed: 1, steps: 20, cfg: 7.5, model: ['1', 0] } },
  };

  it('normalizza i nodi e deduce i link dagli input collegati', async () => {
    const result = await extractAndNormalizeWorkflow(jsonFile(apiWorkflow), mockObjectInfo);
    expect(result).not.toBeNull();
    expect(result!.nodeList).toHaveLength(2);
    // IT: Un solo input è un collegamento (model -> ["1", 0]); gli altri sono valori scalari.
    // EN: Only one input is a link (model -> ["1", 0]); the others are scalar values.
    expect(result!.links).toHaveLength(1);
  });

  it('non estrae i parametri dal formato API (limite attuale noto)', async () => {
    const result = await extractAndNormalizeWorkflow(jsonFile(apiWorkflow), mockObjectInfo);
    // IT: Il formato API non contiene widgets_values, quindi i parametri non vengono estratti oggi.
    // EN: The API format has no widgets_values, so parameters are not extracted today.
    expect(result!.parameters!.positivePrompt).toBeUndefined();
    expect(result!.parameters!.samplers).toHaveLength(0);
  });
});

describe('extractAndNormalizeWorkflow — input non valido', () => {
  // IT: BUG NOTO (da correggere in Step 2 #8 - validazione/gestione errori).
  //     Un JSON che non è un workflow dovrebbe restituire null, ma oggi viene interpretato
  //     come "formato API" e produce un nodo spazzatura (id: NaN, type: undefined).
  //     Quando sistemeremo la validazione, questo test diventerà rosso e l'aspettativa
  //     andrà cambiata in `toBeNull()`.
  // EN: KNOWN BUG (to fix in Step 2 #8 - validation/error handling).
  //     A non-workflow JSON should return null, but today it is treated as "API format"
  //     and produces a garbage node (id: NaN, type: undefined).
  //     Once validation is fixed, this test will go red and the expectation should
  //     become `toBeNull()`.
  it('documenta il comportamento attuale: NON restituisce null per un JSON privo di nodi (bug noto)', async () => {
    const result = await extractAndNormalizeWorkflow(jsonFile({ foo: 'bar' }), mockObjectInfo);
    expect(result).not.toBeNull();
  });
});

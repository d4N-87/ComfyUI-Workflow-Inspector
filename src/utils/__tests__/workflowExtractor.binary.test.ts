// src/utils/__tests__/workflowExtractor.binary.test.ts
//
// IT: Test sull'estrazione dei metadati da file reali (PNG/WebP) prodotti da ComfyUI.
//     I file di esempio vivono accanto a questo test.
// EN: Tests for metadata extraction from real ComfyUI files (PNG/WebP).
//     The sample files live next to this test.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { extractAndNormalizeWorkflow } from '../workflowExtractor';

const here = dirname(fileURLToPath(import.meta.url));

// IT: Carica l'object_info reale dell'app per nomi/registrazione corretti.
// EN: Loads the app's real object_info for correct names/registration.
let objectInfo: Record<string, { name: string; display_name?: string }>;
beforeAll(() => {
  const objectInfoPath = resolve(here, '../../../public/object_info.json');
  objectInfo = JSON.parse(readFileSync(objectInfoPath, 'utf-8'));
});

// IT: Crea un File a partire dai byte su disco, come farebbe il browser.
// EN: Builds a File from the on-disk bytes, as the browser would.
function fileFromDisk(name: string, type: string): File {
  const bytes = new Uint8Array(readFileSync(resolve(here, name)));
  return new File([bytes], name, { type });
}

describe('estrazione da file reali (PNG/WebP)', () => {
  it('estrae un workflow dal PNG di esempio', async () => {
    const result = await extractAndNormalizeWorkflow(fileFromDisk('sample.png', 'image/png'), objectInfo);
    expect(result).not.toBeNull();
    expect(result!.nodes.length).toBeGreaterThan(0);
    expect(result!.nodeList.length).toBeGreaterThan(0);
    // IT: Verifica che il tracciamento via link (#3) funzioni su un file reale.
    // EN: Verifies that link tracing (#3) works on a real file.
    expect(result!.parameters?.positivePrompt).toMatch(/panda/i);
    // IT: La pipeline custom (SamplerCustomAdvanced) deve produrre i parametri via link.
    // EN: The custom pipeline (SamplerCustomAdvanced) must yield parameters via links.
    const sampler = result!.parameters?.samplers[0];
    expect(sampler?.steps).toBe(20);
    expect(sampler?.samplerName).toBe('euler');
  });

  it('estrae workflow, prompt e parametri dal WebP di esempio', async () => {
    const result = await extractAndNormalizeWorkflow(fileFromDisk('sample.webp', 'image/webp'), objectInfo);
    expect(result).not.toBeNull();
    expect(result!.nodes.length).toBeGreaterThan(0);
    expect(result!.nodeList.length).toBeGreaterThan(0);
    expect(result!.parameters?.positivePrompt).toMatch(/panda/i);
    expect(result!.parameters?.samplers[0]?.samplerName).toBe('euler');
  });
});

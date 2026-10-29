// @vitest-environment node
import { demoImportFile } from '@credo/ui/import-demo';
import { describe, expect, it } from 'vitest';

// The walk spec makes the demo company's staff file in Node, outside any page, and hands its bytes
// to the browser's file field; the page tests make it on jsdom.
describe('the demo company’s staff file, made in Node as the walk spec makes it', () => {
  it('is an .xlsx file of bytes, in either language and with or without the name column', async () => {
    for (const language of ['vi', 'en'] as const) {
      for (const which of ['import', 'import-no-name'] as const) {
        const file = await demoImportFile(language, which);
        const bytes = new Uint8Array(await file.arrayBuffer());

        expect(file.name, `${which} ${language}`).toBe(`${which}.xlsx`);
        expect(file.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        // a zip archive, which is what an .xlsx file is
        expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
      }
    }
  });
});

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './database.ts';

export interface Document { id: string; source: string; text: string }

export async function retrieveKnowledge(brandId: string): Promise<Document[]> {
  const dir = path.join(ROOT, 'data', 'knowledge');
  const results: Document[] = [];
  for (const name of (await readdir(dir)).sort()) {
    const text = await readFile(path.join(dir, name), 'utf8');
    if (text.includes(`Brand: ${brandId}`) || text.includes('Brand: all')) {
      results.push({ id: name, source: 'external operational note', text });
    }
  }
  return results;
}

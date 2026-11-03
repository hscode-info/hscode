import { writeFileSync } from 'node:fs';

const url = process.env.HSCODE_SPEC_URL ?? 'https://hscode.info/api/v1/openapi.json';
const res = await fetch(url);
if (!res.ok) throw new Error(`GET ${url} failed with ${res.status}`);
const spec = await res.json();
writeFileSync(new URL('../../openapi.json', import.meta.url), JSON.stringify(spec, null, '\t') + '\n');

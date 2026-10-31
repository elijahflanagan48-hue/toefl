import { parseAll } from './audit.mjs';
const R = parseAll(process.argv[2]);
const words = s => (s.match(/[A-Za-z0-9’'-]+/g) || []).length;
for (const t of R.ctw) console.log(`## ${t.type}${t.n} (${words(t.full)})\n${t.full}\n`);

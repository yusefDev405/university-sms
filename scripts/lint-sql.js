import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendSrc = path.resolve(__dirname, '../backend/src');

const BAD_PATTERNS = [
  { regex: /\.query\s*\(\s*`[^`]*\$\{/, message: 'Template literal interpolation inside .query()' },
  { regex: /SELECT[\s\S]{0,80}\$\{/i, message: 'Template literal interpolation inside SQL SELECT' },
  { regex: /INSERT[\s\S]{0,80}\$\{/i, message: 'Template literal interpolation inside SQL INSERT' },
  { regex: /UPDATE[\s\S]{0,80}\$\{/i, message: 'Template literal interpolation inside SQL UPDATE' },
  { regex: /DELETE[\s\S]{0,80}\$\{/i, message: 'Template literal interpolation inside SQL DELETE' }
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

const files = fs.existsSync(backendSrc) ? walk(backendSrc) : [];
const violations = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const rule of BAD_PATTERNS) {
    if (rule.regex.test(content)) {
      // Allow safe dynamic clause assembly ONLY when marked // sql-safe: whitelisted identifiers
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (/\$\{/.test(line) && /(SELECT|INSERT|UPDATE|DELETE|\.query\()/i.test(line) && !line.includes('sql-safe')) {
          violations.push(`${path.relative(backendSrc, file)}:${idx + 1} - ${rule.message}`);
        }
      });
    }
  }
}

if (violations.length > 0) {
  console.error('SQL safety lint failed:\n' + violations.join('\n'));
  process.exit(1);
}
console.log(`SQL safety lint passed (${files.length} files checked).`);

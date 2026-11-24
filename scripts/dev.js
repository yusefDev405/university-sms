import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

function launch(name, args) {
  const child = spawn(npmCmd, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWindows
  });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });
  return child;
}

const backend = launch('backend', ['--prefix', 'backend', 'run', 'dev']);
const frontend = launch('frontend', ['--prefix', 'frontend', 'run', 'dev']);

function shutdown() {
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

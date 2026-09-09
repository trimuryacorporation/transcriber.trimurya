import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(repoRoot, 'frontend');
const frontendDist = path.join(frontendRoot, 'dist');
const publicDir = path.join(backendRoot, 'public');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, cwd = backendRoot) {
  execFileSync(command, args, { stdio: 'inherit', cwd, shell: process.platform === 'win32' });
}

function runNode(script) {
  execFileSync(process.execPath, [script], { stdio: 'inherit', cwd: backendRoot });
}

if (fs.existsSync(path.join(frontendRoot, 'package.json'))) {
  run(npm, ['install'], frontendRoot);
  run(npm, ['run', 'build'], frontendRoot);
  fs.rmSync(publicDir, { recursive: true, force: true });
  fs.cpSync(frontendDist, publicDir, { recursive: true });
  console.log(`Frontend build copied to ${publicDir}`);
  runNode(path.join(__dirname, 'inlineFrontendAssets.js'));
} else {
  console.log('Frontend source folder not found; using existing backend/public build.');
}

runNode(path.join(__dirname, 'verifyFrontendBuild.js'));

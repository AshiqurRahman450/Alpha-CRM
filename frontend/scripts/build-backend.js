const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

try {
  const backendDir = path.resolve(__dirname, '../../backend');
  const backendTsconfig = path.join(backendDir, 'tsconfig.json');
  const tscCandidates = [
    path.join(backendDir, 'node_modules/typescript/bin/tsc'),
    path.resolve(__dirname, '../node_modules/typescript/bin/tsc'),
  ];
  const tscPath = tscCandidates.find((p) => fs.existsSync(p));

  if (fs.existsSync(backendTsconfig) && tscPath) {
    console.log('[build-backend] Compiling backend TypeScript into backend/dist...');
    execSync(`"${process.execPath}" "${tscPath}" --project "${backendTsconfig}"`, {
      stdio: 'inherit',
      cwd: backendDir,
    });
    console.log('[build-backend] Backend TypeScript compiled successfully.');

    // On Linux VPS, schedule a non-blocking PM2 reload of the backend process so crmapi picks up new dist/
    if (process.platform === 'linux') {
      try {
        const child = spawn(
          'sh',
          [
            '-c',
            'sleep 2 && (pm2 reload all --update-env || pm2 restart all) >/dev/null 2>&1',
          ],
          {
            detached: true,
            stdio: 'ignore',
          }
        );
        child.unref();
        console.log('[build-backend] Scheduled PM2 backend reload on Linux VPS.');
      } catch (pm2Err) {
        console.warn('[build-backend] PM2 reload skipped:', pm2Err.message);
      }
    }
  }
} catch (err) {
  console.warn('[build-backend] Warning during backend pre-build:', err.message);
}

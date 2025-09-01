// scripts/write-version.js
const fs = require('fs');
const path = require('path');

const buildId =
    process.env.BUILD_ID ||
    process.env.RAILWAY_GIT_COMMIT_SHA || // Railway suele exponer esto
    new Date().toISOString();             // fallback

const out = { version: buildId };
const outPath = path.join(__dirname, '..', 'dist', 'version.json');
fs.writeFileSync(outPath, JSON.stringify(out), 'utf8');
console.log('[version.json] ->', buildId);

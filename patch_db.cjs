const fs = require('fs');
let code = fs.readFileSync('api/database.ts', 'utf-8');

// Replace .from('app_state') with .from('global_state')
code = code.replace(/\.from\('app_state'\)/g, ".from('global_state')");

fs.writeFileSync('api/database.ts', code);

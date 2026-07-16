const fs = require('fs');
let code = fs.readFileSync('api/database.ts', 'utf-8');

// Fix fetch query to use id='global_state' first
code = code.replace(
  /\.eq\('key', 'global_state'\)/g,
  ".eq('id', 'global_state')"
);

fs.writeFileSync('api/database.ts', code);

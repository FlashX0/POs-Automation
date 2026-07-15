const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf-8');

// 1. Wrap mongoose.connection.once("open", ...) in try-catch if not already
// But we should just wrap the whole inside:
/*
mongoose.connection.once("open", async () => {
  try { ... } catch (err) { console.error(err); }
});
*/

// 2. Remove db.json writes
code = code.replace(/fs\.writeFileSync\(DB_FILE,.*?\);/g, '// fs.writeFileSync(DB_FILE, ...); removed');
code = code.replace(/fs\.writeFileSync\(BACKUP_FILE,.*?\);/g, '// fs.writeFileSync(BACKUP_FILE, ...); removed');

// We also need to fix `mergeDbChanges` for engineerLedgers
fs.writeFileSync('api/app.ts', code);

const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

code = code.replace(/onAddTimesheet\(newSheet\);/, 'onSave([newSheet, ...timesheets]);');

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

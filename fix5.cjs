const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');
code = code.replace(/\\nconst AI_MODELS/g, "\nconst AI_MODELS");
code = code.replace(/\\n/g, "\n");
fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

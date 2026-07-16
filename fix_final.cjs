const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');
code = code.replace(/\\nconst AI_MODELS/g, "\n\nconst AI_MODELS");
fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

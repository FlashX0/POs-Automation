const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');
code = code.replace("import * as XLSX from 'xlsx-js-style';\\nconst AI_MODELS = [", "import * as XLSX from 'xlsx-js-style';\nconst AI_MODELS = [");
fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

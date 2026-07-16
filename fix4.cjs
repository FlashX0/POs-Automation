const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');
const search = "import * as XLSX from 'xlsx-js-style';\\nconst AI_MODELS = [";
const replace = "import * as XLSX from 'xlsx-js-style';\nconst AI_MODELS = [";
code = code.split(search).join(replace);
fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

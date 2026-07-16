const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

code = code.replace(
  /    setShowCreateForm\(false\);\n    setNewWorker\(''\);/,
  `    setShowCreateForm(false);
    setNewWorker('');
    setAiExtractedDays(null);`
);

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

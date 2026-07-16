const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');
code = code.replace(
  /onChange=\{handleLaborOCR\}/g,
  `onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setAiFile(file);
                        setShowAiModal(true);
                        setShowCreateForm(false);
                      }
                    }}`
);
fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

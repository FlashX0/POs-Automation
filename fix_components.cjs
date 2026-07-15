const fs = require('fs');

// Fix LaborTimesheet.tsx
let laborContent = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');
laborContent = laborContent.replace(
  "const handleLaborOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {",
  "const handleLaborOCR = async (file: File, model: string, useAdvanced: boolean) => {"
);
laborContent = laborContent.replace(
  "const file = e.target.files?.[0];\n    if (!file) return;",
  "if (!file) return;"
);
laborContent = laborContent.replace(
  "e.target.value = '';",
  ""
);
fs.writeFileSync('src/components/LaborTimesheet.tsx', laborContent);

// Fix SubcontractorCertificates.tsx
let subContent = fs.readFileSync('src/components/SubcontractorCertificates.tsx', 'utf-8');
subContent = subContent.replace(
  "e.target.value = '';",
  ""
);
fs.writeFileSync('src/components/SubcontractorCertificates.tsx', subContent);

console.log("Done fixing components");

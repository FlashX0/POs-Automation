const fs = require('fs');

let laborContent = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');
laborContent = laborContent.replace(
  "const handleLaborOCR = async (file: File, model: string, useAdvanced: boolean) => {",
  "const handleLaborOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {"
);
laborContent = laborContent.replace(
  "if (!file) return;",
  "const file = e.target.files?.[0];\n    if (!file) return;"
);
laborContent = laborContent.replace(
  "formData.append('selectedAIModel', model);",
  "formData.append('selectedAIModel', 'gemini-2.5-pro');"
);
laborContent = laborContent.replace(
  "formData.append('useAdvanced', useAdvanced ? 'true' : 'false');",
  "formData.append('useAdvanced', 'false');"
);
// add e.target.value = ''; back at the end
laborContent = laborContent.replace(
  "setIsProcessingAI(false);",
  "setIsProcessingAI(false);\n      e.target.value = '';"
);
fs.writeFileSync('src/components/LaborTimesheet.tsx', laborContent);

let subContent = fs.readFileSync('src/components/SubcontractorCertificates.tsx', 'utf-8');
subContent = subContent.replace(
  "const handleSubcontractorOCR = async (file: File, model: string, useAdvanced: boolean) => {",
  "const handleSubcontractorOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {"
);
subContent = subContent.replace(
  "if (!file) return;",
  "const file = e.target.files?.[0];\n    if (!file) return;"
);
subContent = subContent.replace(
  "formData.append('selectedAIModel', model);",
  "formData.append('selectedAIModel', 'gemini-2.5-pro');"
);
subContent = subContent.replace(
  "formData.append('useAdvanced', useAdvanced ? 'true' : 'false');",
  "formData.append('useAdvanced', 'false');"
);
subContent = subContent.replace(
  "setIsProcessingAI(false);",
  "setIsProcessingAI(false);\n      e.target.value = '';"
);
fs.writeFileSync('src/components/SubcontractorCertificates.tsx', subContent);

console.log("Reverted OCR functions");

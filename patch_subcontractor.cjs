const fs = require('fs');
let code = fs.readFileSync('src/components/SubcontractorCertificates.tsx', 'utf8');

// 1. Import AIUploadModal
if (!code.includes('AIUploadModal')) {
  code = code.replace(
    "import React, { useState, useEffect, useRef } from 'react';",
    "import React, { useState, useEffect, useRef } from 'react';\nimport { AIUploadModal } from './AIUploadModal';"
  );
}

// 2. Add state for AIUploadModal
if (!code.includes('const [isAIModalOpen, setIsAIModalOpen] = useState(false);')) {
  code = code.replace(
    "const [isProcessingAI, setIsProcessingAI] = useState(false);",
    "const [isProcessingAI, setIsProcessingAI] = useState(false);\n  const [isAIModalOpen, setIsAIModalOpen] = useState(false);"
  );
}

// 3. Update handleSubcontractorOCR to accept file, model, useAdvanced
let search = `  const handleSubcontractorOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;`;

let replace = `  const handleSubcontractorOCR = async (file: File, model: string, useAdvanced: boolean) => {
    if (!file) return;`;

code = code.replace(search, replace);

// 4. Send the new parameters in formData
let formDataSearch = `    formData.append('file', file);`;
let formDataReplace = `    formData.append('file', file);\n    formData.append('selectedAIModel', model);\n    formData.append('useAdvanced', useAdvanced ? 'true' : 'false');`;
code = code.replace(formDataSearch, formDataReplace);

// 5. Close the modal when done
let closeSearch = `      if (res.ok && data.success) {`;
let closeReplace = `      if (res.ok && data.success) {\n        setIsAIModalOpen(false);`;
code = code.replace(closeSearch, closeReplace);

// 6. Update the JSX to use the button instead of label+input
let jsxSearch = `                <label className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0">
                  <Upload className="w-4 h-4" />
                  <span>{isProcessingAI ? 'جاري معالجة المستند... ⏳' : 'رفع وتحليل بالذكاء الاصطناعي 🤖'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleSubcontractorOCR}
                    disabled={isProcessingAI}
                    className="hidden"
                  />
                </label>`;

let jsxReplace = `                <button
                  type="button"
                  onClick={() => setIsAIModalOpen(true)}
                  disabled={isProcessingAI}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isProcessingAI ? 'جاري معالجة المستند... ⏳' : 'رفع وتحليل بالذكاء الاصطناعي 🤖'}</span>
                </button>`;

code = code.replace(jsxSearch, jsxReplace);

// 7. Add AIUploadModal to JSX root
let rootSearch = `      {/* PDF Generation Hidden Container */}`;
let rootReplace = `      <AIUploadModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onConfirm={handleSubcontractorOCR}
        isProcessing={isProcessingAI}
        title="ملء مستخلص مقاول الباطن بالذكاء الاصطناعي"
        description="ارفع المستخلص الورقي أو الرقمي وسيقوم الذكاء الاصطناعي باستخراج البنود والكميات والأسعار وتعبئتها."
      />
      {/* PDF Generation Hidden Container */}`;

code = code.replace(rootSearch, rootReplace);

fs.writeFileSync('src/components/SubcontractorCertificates.tsx', code);

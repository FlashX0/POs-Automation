const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf8');

// 1. Import AIUploadModal
if (!code.includes('AIUploadModal')) {
  code = code.replace(
    "import React, { useState, useMemo, useEffect, useRef } from 'react';",
    "import React, { useState, useMemo, useEffect, useRef } from 'react';\nimport { AIUploadModal } from './AIUploadModal';"
  );
}

// 2. Add state
if (!code.includes('const [isAIModalOpen, setIsAIModalOpen] = useState(false);')) {
  code = code.replace(
    "const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);",
    "const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);\n  const [isAIModalOpen, setIsAIModalOpen] = useState(false);"
  );
}

// 3. Update handleTimesheetOCR
let search = `  const handleTimesheetOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;`;

let replace = `  const handleTimesheetOCR = async (file: File, model: string, useAdvanced: boolean) => {
    if (!file) return;`;

code = code.replace(search, replace);

// 4. Send the new parameters
let formDataSearch = `    formData.append('file', file);`;
let formDataReplace = `    formData.append('file', file);\n    formData.append('selectedAIModel', model);\n    formData.append('useAdvanced', useAdvanced ? 'true' : 'false');`;
code = code.replace(formDataSearch, formDataReplace);

// 5. Add setIsAIModalOpen(false) to the response check
let responseSearch = `        if (data.success && data.data) {`;
let responseReplace = `        if (data.success && data.data) {\n          setIsAIModalOpen(false);`;
code = code.replace(responseSearch, responseReplace);

// 6. Replace input label with button
let jsxSearch = `                <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0">
                  <Upload className="w-4 h-4" />
                  <span>{isProcessingAI ? 'جاري معالجة الكشف... ⏳' : 'رفع وتحليل بالذكاء الاصطناعي 🤖'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleTimesheetOCR}
                    disabled={isProcessingAI}
                    className="hidden"
                  />
                </label>`;

let jsxReplace = `                <button
                  type="button"
                  onClick={() => setIsAIModalOpen(true)}
                  disabled={isProcessingAI}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isProcessingAI ? 'جاري معالجة الكشف... ⏳' : 'رفع وتحليل بالذكاء الاصطناعي 🤖'}</span>
                </button>`;

code = code.replace(jsxSearch, jsxReplace);

// 7. Add AIUploadModal to root
let rootSearch = `      {/* Print View Hidden Container */}`;
let rootReplace = `      <AIUploadModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onConfirm={handleTimesheetOCR}
        isProcessing={isProcessingAI}
        title="ملء كشف العمالة بالذكاء الاصطناعي"
        description="ارفع صورة أو ملف كشف العمالة اليومية، وسيقوم النظام بتفريغ الأسماء وتوزيع الأيام تلقائياً."
      />
      {/* Print View Hidden Container */}`;

code = code.replace(rootSearch, rootReplace);

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

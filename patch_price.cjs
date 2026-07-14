const fs = require('fs');
let code = fs.readFileSync('src/components/PriceComparison.tsx', 'utf8');

// 1. Import AIModelSelector
if (!code.includes('AIModelSelector')) {
  code = code.replace(
    "import React, { useState, useEffect } from 'react';",
    "import React, { useState, useEffect } from 'react';\nimport { AIModelSelector } from './AIModelSelector';"
  );
}

// 2. Add AI states
if (!code.includes('const [useAdvancedAI, setUseAdvancedAI] = useState(true);')) {
  code = code.replace(
    "const [isAnalyzing, setIsAnalyzing] = useState(false);",
    "const [isAnalyzing, setIsAnalyzing] = useState(false);\n  const [useAdvancedAI, setUseAdvancedAI] = useState(true);\n  const [selectedAIModel, setSelectedAIModel] = useState('gpt-5.6-luna');"
  );
}

// 3. Append to formData
let formDataSearch = `    formData.append('fallbackQuantity', String(quantity));`;
let formDataReplace = `    formData.append('fallbackQuantity', String(quantity));\n    formData.append('selectedAIModel', selectedAIModel);\n    formData.append('useAdvanced', useAdvancedAI ? 'true' : 'false');`;
code = code.replace(formDataSearch, formDataReplace);

// 4. Update the JSX title
let titleSearch = `<span>مساعد المشتريات والتحليل الذكي بالذكاء الاصطناعي (Gemini 3.5 Flash)</span>`;
let titleReplace = `<span>مساعد المشتريات والتحليل الذكي بالذكاء الاصطناعي (NaraRouter)</span>`;
code = code.replace(titleSearch, titleReplace);

// 5. Add AIModelSelector to the UI
let jsxSearch = `                {/* Upload Zone */}`;
let jsxReplace = `                {/* Upload Zone */}\n                <div className="lg:col-span-12">\n                  <AIModelSelector\n                    useAdvanced={useAdvancedAI}\n                    setUseAdvanced={setUseAdvancedAI}\n                    selectedModel={selectedAIModel}\n                    setSelectedModel={setSelectedAIModel}\n                  />\n                </div>`;

code = code.replace(jsxSearch, jsxReplace);

fs.writeFileSync('src/components/PriceComparison.tsx', code);

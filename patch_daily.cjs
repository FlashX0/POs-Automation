const fs = require('fs');
let code = fs.readFileSync('src/components/DailyBoxMovement.tsx', 'utf8');

// 1. Import AIModelSelector
if (!code.includes('AIModelSelector')) {
  code = code.replace(
    "import React, { useState, useEffect, useMemo, useRef } from 'react';",
    "import React, { useState, useEffect, useMemo, useRef } from 'react';\nimport { AIModelSelector } from './AIModelSelector';"
  );
}

// 2. Add useAdvancedAI
if (!code.includes('const [useAdvancedAI, setUseAdvancedAI] = useState(true);')) {
  code = code.replace(
    "const [selectedAIModel, setSelectedAIModel] = useState('gpt-5.6-luna');",
    "const [selectedAIModel, setSelectedAIModel] = useState('gpt-5.6-luna');\n  const [useAdvancedAI, setUseAdvancedAI] = useState(true);"
  );
}

// 3. Update formData
let formDataSearch = `      formData.append('selectedAIModel', selectedAIModel);`;
let formDataReplace = `      formData.append('selectedAIModel', selectedAIModel);\n      formData.append('useAdvanced', useAdvancedAI ? 'true' : 'false');`;
code = code.replace(formDataSearch, formDataReplace);

// 4. Update the Select in JSX
let jsxSearch = `              {/* 1. Model Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">اختر موديل الذكاء الاصطناعي:</label>
                <select
                  value={selectedAIModel}
                  onChange={(e) => setSelectedAIModel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <optgroup label="موديلات الرؤية والصور (Vision)">
                    <option value="gpt-5.6-luna">gpt-5.6-luna</option>
                    <option value="claude-sonnet-5-bynara">claude-sonnet-5-bynara</option>
                  </optgroup>
                  <optgroup label="موديلات الإكسيل (سريعة)">
                    <option value="deepseek-v4-flash-bynara">deepseek-v4-flash-bynara</option>
                  </optgroup>
                </select>
              </div>`;

let jsxReplace = `              {/* 1. Model Selection */}
              <AIModelSelector
                useAdvanced={useAdvancedAI}
                setUseAdvanced={setUseAdvancedAI}
                selectedModel={selectedAIModel}
                setSelectedModel={setSelectedAIModel}
              />`;

code = code.replace(jsxSearch, jsxReplace);

fs.writeFileSync('src/components/DailyBoxMovement.tsx', code);

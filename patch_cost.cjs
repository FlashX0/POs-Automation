const fs = require('fs');
let code = fs.readFileSync('src/components/CostAnalysis.tsx', 'utf8');

// 1. Import AIModelSelector
if (!code.includes('AIModelSelector')) {
  code = code.replace(
    "import React, { useState, useEffect, useMemo, useRef } from 'react';",
    "import React, { useState, useEffect, useMemo, useRef } from 'react';\nimport { AIModelSelector } from './AIModelSelector';"
  );
}

// 2. Add AI states
if (!code.includes('const [useAdvancedAI, setUseAdvancedAI] = useState(true);')) {
  code = code.replace(
    "const [isParsingExcel, setIsParsingExcel] = useState<boolean>(false);",
    "const [isParsingExcel, setIsParsingExcel] = useState<boolean>(false);\n  const [useAdvancedAI, setUseAdvancedAI] = useState(true);\n  const [selectedAIModel, setSelectedAIModel] = useState('deepseek-v4-pro-bynara');"
  );
}

// 3. Append to fetch in processExcelFile
let formDataSearch = `    formData.append('file', file);`;
let formDataReplace = `    formData.append('file', file);\n    formData.append('selectedAIModel', selectedAIModel);\n    formData.append('useAdvanced', useAdvancedAI ? 'true' : 'false');`;
code = code.replace(formDataSearch, formDataReplace);

// 4. Append to fetch in handleAiAggregate
let aggSearch = `      const res = await fetch('/api/ai/aggregate-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceUpdate: true })
      });`;
let aggReplace = `      const res = await fetch('/api/ai/aggregate-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceUpdate: true, selectedAIModel, useAdvanced: useAdvancedAI })
      });`;
code = code.replace(aggSearch, aggReplace);

// 5. Append to fetch in handleEngineerAiAggregation
let engAggSearch = `      const res = await fetch('/api/ai/aggregate-engineer-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerName: targetEngineer,
          month: targetMonth
        })
      });`;
let engAggReplace = `      const res = await fetch('/api/ai/aggregate-engineer-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerName: targetEngineer,
          month: targetMonth,
          selectedAIModel,
          useAdvanced: useAdvancedAI
        })
      });`;
code = code.replace(engAggSearch, engAggReplace);

// 6. Add AIModelSelector to the UI
let jsxSearch = `      {/* --- AI-Powered Excel Upload & Classification Section --- */}`;
let jsxReplace = `      {/* --- AI-Powered Excel Upload & Classification Section --- */}
      <AIModelSelector
        useAdvanced={useAdvancedAI}
        setUseAdvanced={setUseAdvancedAI}
        selectedModel={selectedAIModel}
        setSelectedModel={setSelectedAIModel}
      />`;

code = code.replace(jsxSearch, jsxReplace);

fs.writeFileSync('src/components/CostAnalysis.tsx', code);

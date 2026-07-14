const fs = require('fs');
let code = fs.readFileSync('src/components/EngineerManagement.tsx', 'utf8');

// 1. Import AIModelSelector
if (!code.includes('AIModelSelector')) {
  code = code.replace(
    "import React, { useState, useEffect, useRef } from 'react';",
    "import React, { useState, useEffect, useRef } from 'react';\nimport { AIModelSelector } from './AIModelSelector';"
  );
}

// 2. Add AI states
if (!code.includes('const [useAdvancedAI, setUseAdvancedAI] = useState(true);')) {
  code = code.replace(
    "const [monthToAnalyze, setMonthToAnalyze] = useState<string>('');",
    "const [monthToAnalyze, setMonthToAnalyze] = useState<string>('');\n  const [useAdvancedAI, setUseAdvancedAI] = useState(true);\n  const [selectedAIModel, setSelectedAIModel] = useState('deepseek-v4-pro-bynara');"
  ); // For Excel/Text analysis, deepseek-v4-pro is a better default
}

// 3. Append to fetch body in handleRunAIAnalysis
let fetchSearch = `      const res = await fetch('/api/ai/aggregate-engineer-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerName: selectedEngineerFolder.name,
          month: monthToAnalyze
        })
      });`;
let fetchReplace = `      const res = await fetch('/api/ai/aggregate-engineer-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerName: selectedEngineerFolder.name,
          month: monthToAnalyze,
          selectedAIModel,
          useAdvanced: useAdvancedAI
        })
      });`;
code = code.replace(fetchSearch, fetchReplace);

// 4. Add AIModelSelector to the UI before Aggregation Control Panel
let jsxSearch = `              {/* Aggregation Control Panel */}`;
let jsxReplace = `              <AIModelSelector
                useAdvanced={useAdvancedAI}
                setUseAdvanced={setUseAdvancedAI}
                selectedModel={selectedAIModel}
                setSelectedModel={setSelectedAIModel}
              />
              {/* Aggregation Control Panel */}`;

code = code.replace(jsxSearch, jsxReplace);

fs.writeFileSync('src/components/EngineerManagement.tsx', code);

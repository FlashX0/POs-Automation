const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Import AIModelSelector
if (!code.includes('AIModelSelector')) {
  code = code.replace(
    "import React, { useState, useEffect, useMemo, useRef } from 'react';",
    "import React, { useState, useEffect, useMemo, useRef } from 'react';\nimport { AIModelSelector } from './components/AIModelSelector';"
  );
}

// 2. Add state
if (!code.includes('const [useAdvancedAI, setUseAdvancedAI] = useState(true);')) {
  code = code.replace(
    "const [uploadInstructions, setUploadInstructions] = useState<string>('');",
    "const [uploadInstructions, setUploadInstructions] = useState<string>('');\n  const [useAdvancedAI, setUseAdvancedAI] = useState(true);\n  const [selectedAIModel, setSelectedAIModel] = useState('gpt-5.6-luna');"
  );
}

// 3. Update handleDirectFileUpload
let search = `    if (uploadInstructions && uploadInstructions.trim() !== '') {
      formData.append('instructions', uploadInstructions.trim());
    }`;
let replace = `    if (uploadInstructions && uploadInstructions.trim() !== '') {
      formData.append('instructions', uploadInstructions.trim());
    }
    formData.append('selectedAIModel', selectedAIModel);
    formData.append('useAdvanced', useAdvancedAI ? 'true' : 'false');`;

code = code.replace(search, replace);

// 4. Render AIModelSelector before the upload zone
let jsxSearch = `          <div className="bg-[#111c30] rounded-xl border border-slate-800 p-1 mb-5">`;
let jsxReplace = `          <AIModelSelector
            useAdvanced={useAdvancedAI}
            setUseAdvanced={setUseAdvancedAI}
            selectedModel={selectedAIModel}
            setSelectedModel={setSelectedAIModel}
          />
          <div className="bg-[#111c30] rounded-xl border border-slate-800 p-1 mb-5">`;

code = code.replace(jsxSearch, jsxReplace);

fs.writeFileSync('src/App.tsx', code);

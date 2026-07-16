const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

code = code.replace(
  /const \[aiInstructions, setAiInstructions\] = useState<string>\(''\);/,
  `const [aiInstructions, setAiInstructions] = useState<string>('');
  const [aiSelectedModel, setAiSelectedModel] = useState<string>('gemini-2.5-pro');`
);

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

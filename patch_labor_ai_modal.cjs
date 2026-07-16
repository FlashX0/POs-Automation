const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

code = code.replace(
  /const \[showAiModal, setShowAiModal\] = useState<boolean>\(false\);/,
  `const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [aiExtractedDays, setAiExtractedDays] = useState<any[] | null>(null);`
);

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

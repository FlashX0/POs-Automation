const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

code = code.replace(
  /const \[showCreateForm, setShowCreateForm\] = useState<boolean>\(false\);/,
  `const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiInstructions, setAiInstructions] = useState<string>('');`
);

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

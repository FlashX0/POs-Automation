const fs = require('fs');
let content = fs.readFileSync('src/components/AIUploadModal.tsx', 'utf-8');

content = content.replace(
  'const [useAdvanced, setUseAdvanced] = useState(true);',
  'const [useAdvanced, setUseAdvanced] = useState(false);'
);

fs.writeFileSync('src/components/AIUploadModal.tsx', content);
console.log("AIUploadModal useAdvanced default changed to false");

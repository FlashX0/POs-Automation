const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  'const [useAdvancedAI, setUseAdvancedAI] = useState(true);',
  'const [useAdvancedAI, setUseAdvancedAI] = useState(false);'
);

fs.writeFileSync('src/App.tsx', content);
console.log("Fixed App.tsx useAdvancedAI default");

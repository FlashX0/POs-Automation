const fs = require('fs');

const files = [
  'src/components/EngineerManagement.tsx',
  'src/components/CostAnalysis.tsx',
  'src/components/PriceComparison.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf-8');
    content = content.replace(
      'const [useAdvancedAI, setUseAdvancedAI] = useState(true);',
      'const [useAdvancedAI, setUseAdvancedAI] = useState(false);'
    );
    fs.writeFileSync(file, content);
    console.log("Fixed", file);
  }
});

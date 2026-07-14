const fs = require('fs');

function addStates(file) {
  let code = fs.readFileSync(file, 'utf8');
  if (!code.includes('const [useAdvancedAI')) {
    // Find the first useState or similar to inject after
    // Actually, find the main component declaration
    const componentRegex = /export (?:default )?function [A-Za-z0-9_]+\([^)]*\) \{/;
    const match = code.match(componentRegex);
    if (match) {
      const index = match.index + match[0].length;
      const stateDeclarations = `\n  const [useAdvancedAI, setUseAdvancedAI] = useState(true);\n  const [selectedAIModel, setSelectedAIModel] = useState("gpt-5.6-luna");`;
      code = code.slice(0, index) + stateDeclarations + code.slice(index);
      fs.writeFileSync(file, code);
      console.log('Patched ' + file);
    } else {
      console.log('Could not find component in ' + file);
    }
  }
}

addStates('src/components/DailyBoxMovement.tsx');
addStates('src/components/EngineerManagement.tsx');
addStates('src/components/PriceComparison.tsx');

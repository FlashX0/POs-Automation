const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
\`            <input 
          <AIModelSelector
            useAdvanced={useAdvancedAI}
            setUseAdvanced={setUseAdvancedAI}
            selectedModel={selectedAIModel}
            setSelectedModel={setSelectedAIModel}
          />\`,
\`            <AIModelSelector
            useAdvanced={useAdvancedAI}
            setUseAdvanced={setUseAdvancedAI}
            selectedModel={selectedAIModel}
            setSelectedModel={setSelectedAIModel}
          />
          <input \`
);

fs.writeFileSync('src/App.tsx', code);

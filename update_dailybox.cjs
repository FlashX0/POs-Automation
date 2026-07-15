const fs = require('fs');
let content = fs.readFileSync('src/components/DailyBoxMovement.tsx', 'utf-8');

// Set useAdvancedAI default to false
content = content.replace(
  'const [useAdvancedAI, setUseAdvancedAI] = useState(true);',
  'const [useAdvancedAI, setUseAdvancedAI] = useState(false);'
);

// Update button styling
const oldButtonClass = "bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-900/50 hover:-translate-y-0.5";
const newButtonClass = "bg-slate-200 hover:bg-white text-black hover:shadow-slate-200/50 hover:-translate-y-0.5";
content = content.replace(oldButtonClass, newButtonClass);

fs.writeFileSync('src/components/DailyBoxMovement.tsx', content);

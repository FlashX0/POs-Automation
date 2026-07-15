const fs = require('fs');
let content = fs.readFileSync('src/components/DailyBoxMovement.tsx', 'utf-8');

// Change toggle default
content = content.replace(
  'const [useAdvancedAI, setUseAdvancedAI] = useState(true);',
  'const [useAdvancedAI, setUseAdvancedAI] = useState(false);'
);

// Change cancel button style
content = content.replace(
  'className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"',
  'className="px-4 py-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"'
);

// Change run button style
content = content.replace(
  'className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-850 disabled:text-slate-500 text-white text-xs font-black rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"',
  'className="px-5 py-2 bg-slate-200 hover:bg-white disabled:bg-slate-850 disabled:text-slate-500 text-black text-xs font-black rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"'
);

fs.writeFileSync('src/components/DailyBoxMovement.tsx', content);
console.log("DailyBoxMovement AI Modal UI updated");

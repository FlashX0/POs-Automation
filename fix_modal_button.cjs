const fs = require('fs');
let content = fs.readFileSync('src/components/AIUploadModal.tsx', 'utf-8');

content = content.replace(
  'className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-850 disabled:text-slate-500 text-white text-xs font-black rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"',
  'className="px-5 py-2 bg-slate-200 hover:bg-white disabled:bg-slate-850 disabled:text-slate-500 text-black text-xs font-black rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"'
);

fs.writeFileSync('src/components/AIUploadModal.tsx', content);
console.log("Modal button updated");

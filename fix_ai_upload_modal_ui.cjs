const fs = require('fs');
let content = fs.readFileSync('src/components/AIUploadModal.tsx', 'utf-8');

// Change cancel button style
content = content.replace(
  'className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer disabled:opacity-50"',
  'className="px-4 py-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded-xl transition-all cursor-pointer disabled:opacity-50"'
);

fs.writeFileSync('src/components/AIUploadModal.tsx', content);
console.log("AIUploadModal UI updated");

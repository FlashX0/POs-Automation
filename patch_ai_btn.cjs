const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

code = code.replace(
  /<button\n                type="button"\n                onClick=\{\(\) => setShowCreateForm\(!showCreateForm\)\}\n                className="bg-indigo-600\/15 hover:bg-indigo-600\/25 border border-indigo-500\/30 text-indigo-400 px-3\.5 py-1\.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1\.5 cursor-pointer"\n              >\n                <Plus className="w-4 h-4" \/>\n                <span>إنشاء كشف حضور جديد 📅<\/span>\n              <\/button>/,
  `<button
                type="button"
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-400 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء كشف حضور جديد 📅</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 border border-indigo-500 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>⚡ تفريغ شيت بالذكاء الاصطناعي (صورة/ملف)</span>
              </button>`
);

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

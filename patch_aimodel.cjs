const fs = require('fs');
let code = fs.readFileSync('src/components/AIModelSelector.tsx', 'utf8');

code = code.replace(
  '<div className="space-y-3 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 mt-4 mb-4" dir="rtl">',
  '<div className="flex flex-col gap-4 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60 mt-2 mb-4 shadow-sm" dir="rtl" onClick={(e) => e.stopPropagation()}>'
);

code = code.replace(
  '<div className="flex items-center justify-between">',
  '<div className="flex flex-row-reverse items-center justify-between w-full">'
);

code = code.replace(
  '<label className="relative inline-flex items-center cursor-pointer">',
  '<label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>'
);

code = code.replace(
  '<div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>',
  '<div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:right-[2px] after:bg-slate-200 after:border-slate-200 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>'
);

code = code.replace(
  '<div className="space-y-2 pt-3 border-t border-slate-800 animate-in fade-in zoom-in-95 duration-200" ref={dropdownRef}>',
  '<div className="space-y-3 pt-4 border-t border-slate-700/50 animate-in fade-in zoom-in-95 duration-200" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>'
);

code = code.replace(
  'onClick={() => setIsOpen(!isOpen)}',
  'onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}'
);

code = code.replace(
  'className="w-full bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer flex justify-between items-center text-right"',
  'className="w-full bg-slate-950/80 border border-slate-600 text-white text-xs font-bold rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer flex justify-between items-center text-right hover:border-slate-500 transition-colors"'
);

fs.writeFileSync('src/components/AIModelSelector.tsx', code);
console.log('Done!');

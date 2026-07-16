const fs = require('fs');

let content = fs.readFileSync('src/components/AggregatedStatement.tsx', 'utf8');

// The area we want to replace is within the table.
// Let's replace the classes one by one in the whole file to be safe and consistent.
// We are only concerned about the table and the header of the print area.

// Header container
content = content.replace(/className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800\/30"/g, 'className="p-6 border-b flex justify-between items-center" style={{ backgroundColor: "#1e293b", borderColor: "#1e293b" }}');

content = content.replace(/className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl" ref=\{printRef\}/g, 'className="rounded-2xl border overflow-hidden shadow-2xl" style={{ backgroundColor: "#0f172a", borderColor: "#1e293b" }} ref={printRef}');

content = content.replace(/<h2 className="text-lg font-bold text-white">/g, '<h2 className="text-lg font-bold" style={{ color: "#ffffff" }}>');
content = content.replace(/<div className="text-sm text-slate-400">/g, '<div className="text-sm" style={{ color: "#94a3b8" }}>');

content = content.replace(/<tr className="bg-slate-800\/80 text-slate-300">/g, '<tr style={{ backgroundColor: "#1e293b", color: "#cbd5e1" }}>');

content = content.replace(/<th className="px-4 py-3 font-semibold text-amber-400 bg-amber-500\/5">/g, '<th className="px-4 py-3 font-semibold" style={{ color: "#fbbf24", backgroundColor: "#fdf3c8" }}>');

content = content.replace(/<th className="px-4 py-3 font-semibold text-emerald-400 bg-emerald-500\/5">/g, '<th className="px-4 py-3 font-semibold" style={{ color: "#34d399", backgroundColor: "#ecfdf5" }}>');

content = content.replace(/<tbody className="divide-y divide-slate-800\/50">/g, '<tbody className="divide-y" style={{ borderColor: "#1e293b" }}>');

content = content.replace(/<td colSpan=\{7\} className="px-4 py-8 text-center text-slate-500">/g, '<td colSpan={7} className="px-4 py-8 text-center" style={{ color: "#64748b" }}>');

content = content.replace(/<tr key=\{row.id\} className="hover:bg-slate-800\/30 transition-colors group">/g, '<tr key={row.id} className="transition-colors group" style={{ borderBottomColor: "#1e293b" }}>');

// Select input
content = content.replace(/className="w-full bg-slate-900\/50 border border-slate-700\/50 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500"/g, 'className="w-full rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500" style={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#ffffff" }}');

content = content.replace(/<optgroup key=\{group.label\} label=\{group.label\} className="bg-slate-800 text-indigo-300">/g, '<optgroup key={group.label} label={group.label} style={{ backgroundColor: "#1e293b", color: "#a5b4fc" }}>');

content = content.replace(/<option key=\{opt.value\} value=\{opt.value\} className="text-slate-200">/g, '<option key={opt.value} value={opt.value} style={{ color: "#e2e8f0" }}>');

// Number inputs (regular)
content = content.replace(/className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white text-left focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"/g, 'className="w-full rounded-lg px-3 py-1.5 text-sm text-left focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" style={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#ffffff" }}');

// Number inputs (amber bg)
content = content.replace(/<td className="px-4 py-3 bg-amber-500\/5 font-bold text-amber-400">/g, '<td className="px-4 py-3 font-bold" style={{ backgroundColor: "#fdf3c8", color: "#fbbf24" }}>');
content = content.replace(/className="w-full bg-transparent border-0 px-1 py-1.5 text-sm text-amber-400 text-left font-bold focus:ring-0"/g, 'className="w-full border-0 px-1 py-1.5 text-sm text-left font-bold focus:ring-0" style={{ backgroundColor: "transparent", color: "#fbbf24" }}');

// Number inputs (emerald bg)
content = content.replace(/<td className="px-4 py-3 bg-emerald-500\/5 font-bold text-emerald-400">/g, '<td className="px-4 py-3 font-bold" style={{ backgroundColor: "#ecfdf5", color: "#34d399" }}>');
content = content.replace(/className="w-full bg-transparent border-0 px-1 py-1.5 text-sm text-emerald-400 text-left font-bold focus:ring-0"/g, 'className="w-full border-0 px-1 py-1.5 text-sm text-left font-bold focus:ring-0" style={{ backgroundColor: "transparent", color: "#34d399" }}');


content = content.replace(/<tfoot className="bg-slate-800 border-t border-slate-700">/g, '<tfoot className="border-t" style={{ backgroundColor: "#1e293b", borderColor: "#334155" }}>');

content = content.replace(/<td className="px-4 py-4 font-bold text-white text-left">/g, '<td className="px-4 py-4 font-bold text-left" style={{ color: "#ffffff" }}>');
content = content.replace(/<td className="px-4 py-4 font-bold text-white text-left" dir="ltr">/g, '<td className="px-4 py-4 font-bold text-left" dir="ltr" style={{ color: "#ffffff" }}>');

content = content.replace(/<td className="px-4 py-4 font-bold text-amber-400 bg-amber-500\/10 text-left" dir="ltr">/g, '<td className="px-4 py-4 font-bold text-left" dir="ltr" style={{ color: "#fbbf24", backgroundColor: "#fef3c7" }}>');

content = content.replace(/<td className="px-4 py-4 font-bold text-emerald-400 bg-emerald-500\/10 text-left" dir="ltr">/g, '<td className="px-4 py-4 font-bold text-left" dir="ltr" style={{ color: "#34d399", backgroundColor: "#d1fae5" }}>');

fs.writeFileSync('src/components/AggregatedStatement.tsx', content);
console.log('Fixed styles.');

const fs = require('fs');
let content = fs.readFileSync('src/components/AIUploadModal.tsx', 'utf-8');

content = content.replace('text-slate-300', 'text-emerald-400');
content = content.replace('text-slate-300', 'text-emerald-400');

fs.writeFileSync('src/components/AIUploadModal.tsx', content);

let content2 = fs.readFileSync('src/components/DailyBoxMovement.tsx', 'utf-8');
content2 = content2.replace('text-slate-300 block">اختر شهر', 'text-emerald-400 block">اختر شهر');
content2 = content2.replace('text-slate-300 block">تفعيل الذاكرة', 'text-emerald-400 block">تفعيل الذاكرة');
fs.writeFileSync('src/components/DailyBoxMovement.tsx', content2);

const fs = require('fs');
let code = fs.readFileSync('src/components/CostAnalysis.tsx', 'utf-8');

// Replace alerts on connection errors with console.error to avoid spam
code = code.replace(/alert\('فشل الاتصال بالخادم: ' \+ err\.message\);/g, "console.error('فشل الاتصال بالخادم: ' + err.message);");
code = code.replace(/alert\('حدث خطأ أثناء الحفظ: ' \+ err\.message\);/g, "console.error('حدث خطأ أثناء الحفظ: ' + err.message);");

fs.writeFileSync('src/components/CostAnalysis.tsx', code);

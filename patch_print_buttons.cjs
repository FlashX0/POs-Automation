const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Rename PDF button
code = code.replace(
  /<span>تنزيل ملف PDF مباشر 📥<\/span>/g,
  '<span>تحميل PDF (تنسيق Excel) 📥</span>'
);

// 2. Remove the "Open in new window" button
code = code.replace(
  /\{\/\* Force Open in New Tab URL Anchor for sandboxed bypass \*\/\}[\s\S]*?<\/a>/,
  ''
);

// 3. Remove the iframe warning entirely, since we have the PDF download button that works fine
const warningRegex = /\{\/\* Iframe restricted browser print warning \*\/\}[\s\S]*?\{isInIframe && \([\s\S]*?<\/div>\s*<\/div>\s*\)\}/;
code = code.replace(warningRegex, '');

fs.writeFileSync('src/App.tsx', code);

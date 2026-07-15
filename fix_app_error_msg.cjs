const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace the error message
code = code.replace(
/'خطأ في الاتصال بالخادم\. تأكد من تشغيل Express Backend\.'/g,
`'السيرفر غير متاح'`
);

// If there are alerts for "Failed to fetch", change them
code = code.replace(
/alert\('فشل الاتصال بالخادم: ' \+ err\.message\);/g,
`console.error('فشل الاتصال بالخادم: ' + err.message);`
);

fs.writeFileSync('src/App.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf-8');

code = code.replace(
  /if \(type === 'labor'\) \{\n    systemInstruction = `You are an expert AI accountant and timesheet\/attendance processor\.[\s\S]*?'هايد بارك' if appropriate\.`;/,
  `if (type === 'labor') {
    systemInstruction = \`You are an expert AI accountant and timesheet/attendance processor.
Analyze the provided document (which is a timesheet, labor attendance sheet, or manual log in Arabic or English, including WhatsApp screenshots) and extract worker details.
CRITICAL INSTRUCTION FOR EGYPTIAN WHATSAPP/MESSAGES: 
إذا قرأت (12 ساعة إضافي)، فهذا يعني أن الحضور = 1 (يومية عمل عادية)، والإضافي = 4 ساعات (بافتراض أن يوم العمل الطبيعي 8 ساعات، وما زاد فهو إضافي)، أو اتبع تعليمات المستخدم الحرفية إذا ذكر غير ذلك. التفريق بين (الإضافي) و (السهرة) ضروري.
Extract:
1. weekStartDate: The start date of the week in YYYY-MM-DD.
2. workerName: The daily wage worker's name (اسم العامل).
3. dailyRate: Daily wage rate (الفئة اليومية) as a number if mentioned.
4. overtimeRate: Overtime day or hour rate (فئة الإضافي) as a number if mentioned.
5. sohraRate: Sohra (evening) rate (فئة السهرة) as a number if mentioned.
6. days: An array of 7 objects representing the days of the week starting from Wednesday (الأربعاء) to Tuesday (الثلاثاء) in sequence. Each day object must contain:
   - dayName: Standard Arabic name (الأربعاء, الخميس, الجمعة, السبت, الأحد, الإثنين, الثلاثاء)
   - date: Calculated date in YYYY-MM-DD (extrapolated from weekStartDate + offset of the day)
   - attendance: Number of days worked (e.g., 0, 0.5, 1, 1.5, 2)
   - overtime: Number of overtime hours worked (number)
   - sohra: Number of sohra hours worked (number)
   - project: Project name. Map to one of known projects: \${JSON.stringify(defaultProjects)} or default to 'الساحل' or 'البروج' or 'هايد بارك' if appropriate.\`;`
);

fs.writeFileSync('api/app.ts', code);

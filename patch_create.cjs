const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

code = code.replace(
  /    for \(let i = 0; i < diffDays; i\+\+\) \{[\s\S]*?      \}\);\n      daysArr\.push\(\{[\s\S]*?      \}\);\n    \}/,
  `    if (aiExtractedDays && aiExtractedDays.length > 0) {
      aiExtractedDays.forEach((dDay: any) => {
        const pName = dDay.project || 'الساحل';
        const pVals: { [projectName: string]: { daily: number; overtime: number; sohra: number } } = {};
        activeProjects.forEach(p => { pVals[p] = { daily: 0, overtime: 0, sohra: 0 }; });
        if (!pVals[pName]) pVals[pName] = { daily: 0, overtime: 0, sohra: 0 };
        pVals[pName] = {
          daily: parseFloat(dDay.attendance || dDay.daily || 0),
          overtime: parseFloat(dDay.overtime || 0),
          sohra: parseFloat(dDay.sohra || 0)
        };
        daysArr.push({
          dayName: dDay.dayName || 'يوم',
          date: dDay.date || newStart,
          projectValues: pVals
        });
      });
    } else {
      for (let i = 0; i < diffDays; i++) {
        const currDate = new Date(start);
        currDate.setDate(start.getDate() + i);
        const dayName = currDate.toLocaleDateString('ar-EG', { weekday: 'long' });
        const projectValues: { [projectName: string]: { daily: number; overtime: number; sohra: number } } = {};
        activeProjects.forEach(p => {
          projectValues[p] = { daily: 0, overtime: 0, sohra: 0 };
        });
        daysArr.push({
          dayName: dayName,
          date: currDate.toISOString().split('T')[0],
          projectValues: projectValues
        });
      }
    }`
);

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

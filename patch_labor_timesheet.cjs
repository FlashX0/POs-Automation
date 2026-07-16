const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

const regex = /const daysArr: DayEntry\[\] = \[\];\s+const activeProjects = projectsList && projectsList\.length > 0 \? projectsList : \[\];\s+for \(let i = 0; i < diffDays; i\+\+\) \{[\s\S]*?daysArr\.push\(\{[\s\S]*?date: currDate\.toISOString\(\)\.split\('T'\)\[0\],[\s\S]*?projectValues: projectValues[\s\S]*?\}\);\s+\}/;

const newLoop = `const daysArr: DayEntry[] = [];
    let activeProjects = projectsList && projectsList.length > 0 ? [...projectsList] : ["العام"];
    
    // Add any projects found in AI extraction that are missing from activeProjects
    if (aiExtractedDays && aiExtractedDays.length > 0) {
      aiExtractedDays.forEach(aiDay => {
        if (aiDay.project && !activeProjects.includes(aiDay.project)) {
          activeProjects.push(aiDay.project);
        }
      });
    }

    for (let i = 0; i < diffDays; i++) {
      const currDate = new Date(start);
      currDate.setDate(start.getDate() + i);
      const currDateStr = currDate.toISOString().split('T')[0];
      
      const dayName = currDate.toLocaleDateString('ar-EG', { weekday: 'long' });
      
      let dayProject = "العام";
      let dayDaily = 0;
      let dayOvertime = 0;
      let daySohra = 0;

      if (aiExtractedDays && aiExtractedDays.length > 0) {
        const aiDay = aiExtractedDays.find((d: any) => d.date === currDateStr) || aiExtractedDays[i];
        if (aiDay) {
          dayProject = aiDay.project || "العام";
          dayDaily = Number(aiDay.attendance) || 0;
          dayOvertime = Number(aiDay.overtime) || 0;
          daySohra = Number(aiDay.sohra) || 0;
        }
      }

      const projectValues: { [projectName: string]: { daily: number; overtime: number; sohra: number } } = {};
      (activeProjects || []).forEach(p => {
        projectValues[p] = { 
          daily: p === dayProject ? dayDaily : 0, 
          overtime: p === dayProject ? dayOvertime : 0, 
          sohra: p === dayProject ? daySohra : 0 
        };
      });

      daysArr.push({
        dayName: dayName,
        date: currDateStr,
        projectValues: projectValues
      });
    }`;

code = code.replace(regex, newLoop);
fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

const replacement = `
          // Parse AI extraction and directly create the timesheet for user review
          if (ext.workerName) {
            setNewWorker(ext.workerName);
          } else if (ext.names && ext.names.length > 0) {
            setNewWorker(ext.names[0]);
          }

          let extractedDays = ext.days || [];

          // Create new timesheet directly so user can review the days in the main grid
          const prevTotalVal = parseFloat(ext.previousTotal || ext.previous_total) || 0;
          const prevPaidVal = parseFloat(ext.previousPaid || ext.previous_paid) || 0;
          
          let stDate = ext.weekStartDate || ext.startDate || (ext.dates && ext.dates.length > 0 ? ext.dates[0] : null);
          let enDate = ext.endDate || null;
          
          if (!stDate && extractedDays.length > 0) {
            stDate = extractedDays[0].date;
          }
          if (stDate && !enDate) {
            try {
              const d = new Date(stDate);
              d.setDate(d.getDate() + 6);
              enDate = d.toISOString().split('T')[0];
            } catch(e) {}
          }
          
          if (!stDate) stDate = newStart;
          if (!enDate) enDate = newEnd;

          // Process the days array from AI
          const processedDays = [];
          if (extractedDays.length > 0) {
            extractedDays.forEach((dDay: any) => {
              const pName = dDay.project || 'الساحل';
              const pVals = {};
              projectsList.forEach(p => { pVals[p] = { daily: 0, overtime: 0, sohra: 0 }; });
              if (!pVals[pName]) pVals[pName] = { daily: 0, overtime: 0, sohra: 0 };
              pVals[pName] = {
                daily: parseFloat(dDay.attendance || dDay.daily || 0),
                overtime: parseFloat(dDay.overtime || 0),
                sohra: parseFloat(dDay.sohra || 0)
              };
              processedDays.push({
                dayName: dDay.dayName || 'يوم',
                date: dDay.date || stDate,
                projectValues: pVals
              });
            });
          }

          const newSheet = {
            id: \`timesheet-\${Date.now()}\`,
            workerName: ext.workerName || ext.names?.[0] || 'عامل جديد',
            startDate: stDate,
            endDate: enDate,
            previousTotal: prevTotalVal,
            previousPaid: prevPaidVal,
            dailyRate: parseFloat(ext.dailyRate || ext.amounts?.[0]) || 300,
            overtimeRate: parseFloat(ext.overtimeRate) || 300,
            sohraRate: parseFloat(ext.sohraRate) || 45,
            days: processedDays,
            projects: projectsList,
            currentPaid: 0,
            status: 'draft'
          };
          
          if (processedDays.length > 0) {
            onAddTimesheet(newSheet);
            setSelectedSheetId(newSheet.id);
            if (onNotify) onNotify('success', 'تم إنشاء الكشف بنجاح', 'يمكنك الآن مراجعة اليوميات في الجدول.');
          }
`;

code = code.replace(
  /\/\/ Read workerName[\s\S]*?if \(ext\.previousPaid\) setNewPrevPaid\(ext\.previousPaid\.toString\(\)\);/,
  replacement
);

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

import fs from 'fs';
let code = fs.readFileSync('src/components/AggregatedStatement.tsx', 'utf8');

const oldHandleChangeRow = /const handleChangeRow = \(id: string, field: string, value: any\) => \{[\s\S]*?return r;\n    \}\)\);\n  \};/;
const newHandleChangeRow = `const handleChangeRow = (id: string, field: string, value: any) => {
    try {
      setRows(prevRows => prevRows.map(r => {
        if (r.id === id) {
          let updated = { ...r, [field]: value };
          
          if (field === 'entityId') {
            let type = '';
            let name = '';
            for (const group of (entityOptions || [])) {
              const opt = (group.options || []).find(o => o.value === value);
              if (opt) {
                type = opt.type || '';
                name = opt.label || '';
                break;
              }
            }
            updated.entityType = type;
            updated.entityName = name;

            if (fromDate && toDate && type && name) {
              try {
                const calcs = calculateEntityData(type, name);
                updated.previousBalance = calcs?.previousBalance || 0;
                updated.operatingExpenses = calcs?.operatingExpenses || 0;
                updated.paymentsReceived = calcs?.paymentsReceived || 0;
              } catch (calcErr) {
                console.error("Error calculating entity data:", calcErr);
              }
            }
          }

          if (['previousBalance', 'operatingExpenses', 'paymentsReceived', 'entityId'].includes(field)) {
            updated.totalDue = safeNum(updated.previousBalance) + safeNum(updated.operatingExpenses);
            updated.actualRemainingBalance = safeNum(updated.totalDue) - safeNum(updated.paymentsReceived);
          }

          return updated;
        }
        return r;
      }));
    } catch (err) {
      console.error("Error updating row:", err);
    }
  };`;

code = code.replace(oldHandleChangeRow, newHandleChangeRow);

// Also wrap the whole body of calculateEntityData inside try-catch to avoid crashes inside it.
const oldCalculateData = /const calculateEntityData = \(entityType: string, entityName: string\) => \{[\s\S]*?return \{ previousBalance, operatingExpenses, paymentsReceived \};\n  \};/;
const newCalculateData = `const calculateEntityData = (entityType: string, entityName: string) => {
    let previousBalance = 0;
    let operatingExpenses = 0;
    let paymentsReceived = 0;

    try {
      const from = fromDate ? new Date(fromDate) : new Date(0);
      const to = toDate ? new Date(toDate) : new Date();
      to.setHours(23, 59, 59, 999);

      if (entityType === 'engineer') {
        const eng = (engineers || []).find(e => e?.name === entityName);
        previousBalance += eng ? safeNum(eng.initialBalance) : 0;

        (pettyCashBoxDays || []).forEach(day => {
          if (day?.engineer === entityName) {
            const dayDate = new Date(day?.date || 0);
            if (dayDate < from) {
              const dayExpenses = (day?.transactions || []).filter((t: any) => t?.type === 'expense').reduce((sum: number, t: any) => sum + safeNum(t?.amount), 0);
              const dayIncomes = (day?.transactions || []).filter((t: any) => t?.type === 'income').reduce((sum: number, t: any) => sum + safeNum(t?.amount), 0);
              previousBalance += dayIncomes - dayExpenses;
            } else if (dayDate >= from && dayDate <= to) {
              const expenses = (day?.transactions || []).filter((t: any) => t?.type === 'expense').reduce((sum: number, t: any) => sum + safeNum(t?.amount), 0);
              const incomes = (day?.transactions || []).filter((t: any) => t?.type === 'income').reduce((sum: number, t: any) => sum + safeNum(t?.amount), 0);
              operatingExpenses += expenses;
              paymentsReceived += incomes;
            }
          }
        });
      } else if (entityType === 'subcontractor') {
        const sub = (subcontractorContracts || []).find(c => c?.subcontractorName === entityName);
        previousBalance += sub ? safeNum(sub.initialBalance) : 0;

        (subcontractorContracts || []).filter(c => c?.subcontractorName === entityName).forEach(contract => {
          (contract?.certificates || []).forEach(cert => {
            const certDate = new Date(cert?.date || 0);
            if (certDate < from) {
              previousBalance += safeNum(cert?.netAmount);
              previousBalance -= safeNum(cert?.payments?.reduce((sum: number, p: any) => sum + safeNum(p?.amount), 0));
            } else if (certDate >= from && certDate <= to) {
              operatingExpenses += safeNum(cert?.netAmount);
              paymentsReceived += safeNum(cert?.payments?.reduce((sum: number, p: any) => sum + safeNum(p?.amount), 0));
            }
          });
        });
      } else if (entityType === 'labor') {
        // ... (Skipping labor calculations if they are not defined in original, but let's just make it robust)
        (laborTimesheets || []).forEach(sheet => {
          // just an example of what might be there, we'll replace the full function cleanly
        });
      }
    } catch (err) {
      console.error("Error in calculateEntityData:", err);
    }

    return { previousBalance, operatingExpenses, paymentsReceived };
  };`;
  
// I'll just write a targeted script to do this safer.

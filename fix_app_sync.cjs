const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const searchStr = 'if (partialUpdate.pettyCashBoxDays !== undefined) body.pettyCashBoxDays = partialUpdate.pettyCashBoxDays;';
const replacement = `if (partialUpdate.pettyCashBoxDays !== undefined) {
        body.pettyCashBoxDays = partialUpdate.pettyCashBoxDays.map((day: any) => {
          if (day.transactions && day.transactions.length === 0 && day.startingBalanceOverride === 0) {
            return { ...day, updatedAt: new Date().toISOString() };
          }
          if (day.startingBalanceOverride === 0) {
            return { ...day, updatedAt: new Date().toISOString() };
          }
          return day;
        });
      }`;
content = content.replace(searchStr, replacement);
fs.writeFileSync('src/App.tsx', content);

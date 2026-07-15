const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// In syncFinancialsWithBackend, we need to ensure updatedAt is always current when we send pettyCashBoxDays
const oldSync = `      if (partialUpdate.pettyCashBoxDays !== undefined) {
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

const newSync = `      if (partialUpdate.pettyCashBoxDays !== undefined) {
        body.pettyCashBoxDays = partialUpdate.pettyCashBoxDays.map((day: any) => {
          // Always ensure the frontend marks its sent state as the newest state when modifying it.
          // Since partialUpdate only happens on user actions, we can safely bump updatedAt for all modified days.
          // Actually, just ensuring it has a recent updatedAt is fine.
          return { ...day, updatedAt: new Date().toISOString() };
        });
      }`;

if (content.includes(oldSync)) {
  content = content.replace(oldSync, newSync);
  console.log("App.tsx syncFinancialsWithBackend updated");
} else {
  console.log("Could not find the target code in App.tsx");
}
fs.writeFileSync('src/App.tsx', content);

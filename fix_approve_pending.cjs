const fs = require('fs');
let content = fs.readFileSync('src/components/DailyBoxMovement.tsx', 'utf-8');

// In handleApprovePending
content = content.replace(
  'transactions: [...updatedBoxDays[dayIdx].transactions, cleanTx],',
  'transactions: [...updatedBoxDays[dayIdx].transactions, cleanTx],\n        updatedAt: new Date().toISOString(),'
);

content = content.replace(
  'transactions: [cleanTx],',
  'transactions: [cleanTx],\n        updatedAt: new Date().toISOString(),'
);

// Also in handleUpdateStartingBalance (though it is already server-side, just to be safe if they ever change it)
// In handleResetLedger we don't modify elements, we delete them.

fs.writeFileSync('src/components/DailyBoxMovement.tsx', content);
console.log("handleApprovePending updated");

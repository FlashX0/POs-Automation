const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf-8');

// Fix mergeTwoItems
code = code.replace(/if \(colName === "pettyCashBoxDays"\) {[\s\S]*?if \(Array\.isArray/g, 'if (Array.isArray');

// Fix syncLedgersAndBoxes
code = code.replace(
/if \(ledgerDay\.startingBalanceOverride !== undefined && ledgerDay\.startingBalanceOverride !== null\) {\s*pDay\.startingBalanceOverride = ledgerDay\.startingBalanceOverride;\s*}/g,
'pDay.startingBalanceOverride = ledgerDay.startingBalanceOverride;'
);

code = code.replace(
/if \(pDay\.startingBalanceOverride !== undefined && pDay\.startingBalanceOverride !== null\) {\s*ledgerDay\.startingBalanceOverride = pDay\.startingBalanceOverride;\s*}/g,
'ledgerDay.startingBalanceOverride = pDay.startingBalanceOverride;'
);

fs.writeFileSync('api/app.ts', code);

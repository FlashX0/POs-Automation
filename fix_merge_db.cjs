const fs = require('fs');
let content = fs.readFileSync('api/app.ts', 'utf-8');

const oldMergeLogic = `      if (colName === "pettyCashBoxDays") {
        // Strictly respect updatedAt for pettyCashBoxDays
        // If Request (itemB) is newer and has 0, force it to 0
        if (dateB > dateA) {
            if (itemB.startingBalanceOverride === 0) {
                merged.startingBalanceOverride = 0;
            } else {
                merged.startingBalanceOverride = itemB.startingBalanceOverride !== undefined ? itemB.startingBalanceOverride : (itemA.startingBalanceOverride !== undefined ? itemA.startingBalanceOverride : undefined);
            }
        } else {
            // DB is newer
            if (itemA.startingBalanceOverride === 0) {
                merged.startingBalanceOverride = 0;
            } else {
                merged.startingBalanceOverride = itemA.startingBalanceOverride !== undefined ? itemA.startingBalanceOverride : (itemB.startingBalanceOverride !== undefined ? itemB.startingBalanceOverride : undefined);
            }
        }
      } else {
        if (olderItem.startingBalanceOverride !== undefined && olderItem.startingBalanceOverride !== null) {
          if (merged.startingBalanceOverride === undefined || merged.startingBalanceOverride === null) {
            merged.startingBalanceOverride = olderItem.startingBalanceOverride;
          }
        }
      }`;

const newMergeLogic = `      if (colName === "pettyCashBoxDays") {
        merged.startingBalanceOverride = newerItem.startingBalanceOverride;
      } else {
        if (olderItem.startingBalanceOverride !== undefined && olderItem.startingBalanceOverride !== null) {
          if (merged.startingBalanceOverride === undefined || merged.startingBalanceOverride === null) {
            merged.startingBalanceOverride = olderItem.startingBalanceOverride;
          }
        }
      }`;

if (content.includes(oldMergeLogic)) {
    content = content.replace(oldMergeLogic, newMergeLogic);
    console.log("mergeTwoItems logic updated successfully");
} else {
    console.log("Could not find the old merge logic");
}

fs.writeFileSync('api/app.ts', content);

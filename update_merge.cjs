const fs = require('fs');
let content = fs.readFileSync('api/app.ts', 'utf-8');

const searchStr = 'function mergeTwoItems(itemA: any, itemB: any) {';
const replacement = `function mergeTwoItems(itemA: any, itemB: any, colName: string = "") {
      if (!itemA) return itemB;
      if (!itemB) return itemA;

      const dateA = itemA.updatedAt ? new Date(itemA.updatedAt).getTime() : 0;
      const dateB = itemB.updatedAt ? new Date(itemB.updatedAt).getTime() : 0;

      const newerItem = dateB > dateA ? itemB : itemA;
      const olderItem = dateB > dateA ? itemA : itemB;

      const merged = { ...newerItem };

      if (colName === "pettyCashBoxDays") {
        if (dateB > dateA && itemB.startingBalanceOverride === 0) {
          merged.startingBalanceOverride = 0;
        } else if (dateA > dateB && itemA.startingBalanceOverride === 0) {
          merged.startingBalanceOverride = 0;
        } else {
          if (olderItem.startingBalanceOverride !== undefined && olderItem.startingBalanceOverride !== null) {
            if (merged.startingBalanceOverride === undefined || merged.startingBalanceOverride === null) {
              merged.startingBalanceOverride = olderItem.startingBalanceOverride;
            }
          }
        }
      } else {
        if (olderItem.startingBalanceOverride !== undefined && olderItem.startingBalanceOverride !== null) {
          if (merged.startingBalanceOverride === undefined || merged.startingBalanceOverride === null) {
            merged.startingBalanceOverride = olderItem.startingBalanceOverride;
          }
        }
      }`;

content = content.replace(searchStr, replacement);
content = content.replace('const resolved = mergeTwoItems(persItem, item);', 'const resolved = mergeTwoItems(persItem, item, collectionName);');

fs.writeFileSync('api/app.ts', content);

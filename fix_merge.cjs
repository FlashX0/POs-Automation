const fs = require('fs');
let lines = fs.readFileSync('api/app.ts', 'utf-8').split('\n');

let start = -1;
let end = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function mergeTwoItems(itemA: any, itemB: any, colName: string = "") {')) {
    start = i;
  }
  if (start !== -1 && i > start && lines[i].includes('if (olderItem.startingBalanceOverride !== undefined && olderItem.startingBalanceOverride !== null) {')) {
    // We found the duplicated logic. The new function ends at line 1243. We need to delete the original lines that were left behind.
    // Let's just find the first `// Ensure startingBalanceOverride is preserved from either` after start.
  }
}

// Actually, it's easier to find the exact block and replace it.
// Let's read the file again.
let content = fs.readFileSync('api/app.ts', 'utf-8');

const regex = /function mergeTwoItems\(itemA: any, itemB: any, colName: string = ""\) \{([\s\S]*?)function mergePrimitiveArray/m;
const match = content.match(regex);
if (match) {
  // Let's replace the whole mergeTwoItems and the old duplicated logic.
  let cleanFunction = `function mergeTwoItems(itemA: any, itemB: any, colName: string = "") {
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
      }

      if (Array.isArray(olderItem.transactions) || Array.isArray(newerItem.transactions)) {
        const mergedTx = [...(olderItem.transactions || [])];
        const newerTx = newerItem.transactions || [];
        for (const nTx of newerTx) {
          const eIdx = mergedTx.findIndex((e: any) => e.id === nTx.id);
          if (eIdx >= 0) {
            const date1 = nTx.updatedAt ? new Date(nTx.updatedAt).getTime() : 0;
            const date2 = mergedTx[eIdx].updatedAt ? new Date(mergedTx[eIdx].updatedAt).getTime() : 0;
            if (date1 >= date2) mergedTx[eIdx] = nTx;
          } else {
            mergedTx.push(nTx);
          }
        }
        merged.transactions = mergedTx;
      }
      return merged;
    }

    const mergedUpdated: any[] = [];
    for (const item of updated) {
      const id = getKey(item);
      const persItem = persMap.get(id);
      const origItem = origMap.get(id);
      if (persItem && JSON.stringify(persItem) !== JSON.stringify(origItem)) {
        const resolved = mergeTwoItems(persItem, item, collectionName);
        mergedUpdated.push(resolved);
      } else {
        mergedUpdated.push(item);
      }
    }

    const resultList = persList.filter((x: any) => !deleted.has(getKey(x)));
    for (const item of mergedUpdated) {
      const idx = resultList.findIndex((x: any) => getKey(x) === getKey(item));
      if (idx !== -1) {
        resultList[idx] = item;
      }
    }
    const filteredList = resultList.filter((x: any) => !deleted.has(getKey(x)));
    
    for (const item of added) {
      if (!filteredList.some((x: any) => getKey(x) === getKey(item))) {
        filteredList.push(item);
      }
    }

    merged[collectionName] = filteredList;
  }

  `;
  content = content.replace(regex, cleanFunction + 'function mergePrimitiveArray');
  fs.writeFileSync('api/app.ts', content);
}

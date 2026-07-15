function mergeTwoItems(itemA, itemB, colName = "pettyCashBoxDays") {
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
  }
  return merged;
}

// User 1 zeros the balance
const itemA = { updatedAt: "2026-07-15T00:00:00.000Z", startingBalanceOverride: 0 };
// User 2 (old state) adds a tx, still has old balance 500
const itemB = { updatedAt: "2026-07-14T00:00:00.000Z", startingBalanceOverride: 500 };

console.log("DB newer, Request older (0 vs 500):", mergeTwoItems(itemA, itemB));
console.log("DB newer, Request older (500 vs 0):", mergeTwoItems(itemB, itemA));

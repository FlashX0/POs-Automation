import fs from 'fs';
let code = fs.readFileSync('api/database.ts', 'utf8');

// Find the section where we upsert to petty_cash_box_days
const targetStr = `if (mappedPettyCash.length > 0) {`;
const replacement = `
          const idSet = new Set();
          let hasDuplicates = false;
          mappedPettyCash.forEach(p => {
             if (idSet.has(p.id)) {
                 console.error("[CRITICAL ERROR] Duplicate conflict key found for upsert payload: " + p.id);
                 hasDuplicates = true;
             }
             idSet.add(p.id);
          });
          if (hasDuplicates) {
             throw new Error("ABORT: duplicate conflict keys inside the same petty_cash_box_days UPSERT payload");
          }

          if (mappedPettyCash.length > 0) {`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('api/database.ts', code);
console.log("Abort logic injected.");

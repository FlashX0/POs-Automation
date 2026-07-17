import * as dotenv from 'dotenv';
dotenv.config();
import { fetchAndSyncDbFromSupabase, getDb, saveDb } from './api/database';

async function run() {
  await fetchAndSyncDbFromSupabase(true);
  const db = getDb();
  
  const engineerName = "عام";
  const date = "2024-05-05";
  const newTx = { id: "tx_123", description: "test", amount: 100 };
  
  let dayObj = db.pettyCashBoxDays.find((d: any) => d.date === date && (d.engineer || "عام") === (engineerName || "عام"));
  if (dayObj) {
    if (!dayObj.transactions) dayObj.transactions = [];
    dayObj.transactions.push(newTx);
  } else {
    db.pettyCashBoxDays.push({ date, engineer: engineerName, transactions: [newTx] });
  }
  
  if (!db.engineerLedgers[engineerName]) db.engineerLedgers[engineerName] = [];
  let ledgerDayObj = db.engineerLedgers[engineerName].find((d: any) => d.date === date);
  if (ledgerDayObj) {
    if (!ledgerDayObj.transactions) ledgerDayObj.transactions = [];
    ledgerDayObj.transactions.push(newTx);
  } else {
    db.engineerLedgers[engineerName].push({ date, transactions: [newTx] });
  }
  
  await saveDb(db);
  console.log("Done");
}
run().catch(console.error);

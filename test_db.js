import { fetchAndSyncDbFromSupabase, saveDb } from './api/database.js';
(async () => {
    try {
        console.log("Fetching DB...");
        const db = await fetchAndSyncDbFromSupabase(true);
        console.log("DB version:", db.version);
        console.log("Engineers count:", db.engineers?.length);
        
        db.engineers = db.engineers || [];
        db.engineers.push({id: "eng_test123", name: "Test Engineer", project: "Test Proj", initialBalance: 1000});
        
        console.log("Saving DB...");
        await saveDb(db);
        console.log("Done saving.");
    } catch (e) {
        console.error("Error:", e);
    }
})();

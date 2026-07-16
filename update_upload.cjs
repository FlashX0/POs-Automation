const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf-8');

code = code.replace(
  /app\.post\("\/api\/upload", upload\.single\("file"\), async \(req, res\) => \{[\s\S]*?extractedData = await extractDataFromDocument\(buffer, mimetype, originalname, userInstructions\);/,
  `app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم تحديد أي ملف للرفع." });
    }

    await fetchAndSyncDbFromSupabase(true);
    const { buffer, mimetype, originalname } = req.file;
    const userInstructions = req.body.instructions || req.body.notes || "";
    const selectedAIModel = req.body.selectedAIModel || "gemini-2.5-flash";
    const useAdvanced = req.body.useAdvanced === "true";
    
    let extractedData: any;
    let extractionFailed = false;
    try {
      extractedData = await extractDataFromDocument(buffer, mimetype, originalname, userInstructions, selectedAIModel, useAdvanced);`
);

fs.writeFileSync('api/app.ts', code);

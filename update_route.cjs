const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf-8');

code = code.replace(
  /app\.post\("\/api\/ai\/ocr", upload\.single\("file"\), async \(req, res\) => \{[\s\S]*?const extracted = await extractFinancialFile\(buffer, mimetype, originalname, type, userInstructions\);/,
  `app.post("/api/ai/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم تحديد أي ملف للرفع." });
    }

    const type = req.body.type || "petty_cash"; // 'labor' | 'petty_cash' | 'subcontractor'
    const userInstructions = req.body.instructions || req.body.userInstructions || "";
    const selectedAIModel = req.body.selectedAIModel || "gemini-2.5-flash";
    const useAdvanced = req.body.useAdvanced === "true";
    
    const { buffer, mimetype, originalname } = req.file;

    const extracted = await extractFinancialFile(buffer, mimetype, originalname, type, userInstructions, selectedAIModel, useAdvanced);`
);

fs.writeFileSync('api/app.ts', code);

const fs = require('fs');
let content = fs.readFileSync('api/app.ts', 'utf-8');
const searchStr = '/**\n * POST ROUTE FOR MULTI-SECTION AI OCR & EXTRACTION\n */\n\n    }';
const replacement = `/**
 * POST ROUTE FOR MULTI-SECTION AI OCR & EXTRACTION
 */
app.post("/api/ai/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم تحديد أي ملف للرفع." });
    }`;
content = content.replace(searchStr, replacement);
fs.writeFileSync('api/app.ts', content);

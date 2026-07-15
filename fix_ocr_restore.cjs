const fs = require('fs');
let content = fs.readFileSync('api/app.ts', 'utf-8');

function getBalancedBlock(startIndex) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    const prevChar = content[i-1];
    if ((char === '"' || char === "'" || char === '\`') && prevChar !== '\\') {
      if (inString && stringChar === char) {
        inString = false;
      } else if (!inString) {
        inString = true;
        stringChar = char;
      }
    }
    
    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i + 1;
        }
      }
    }
  }
  return -1;
}

const searchStart = 'app.post("/api/ai/ocr", upload.single("file"), async (req, res) => {';
let startIdx = content.indexOf(searchStart); // currently there is only one
if (startIdx !== -1) {
  const bodyStart = content.indexOf('{', startIdx);
  const blockEnd = getBalancedBlock(bodyStart);
  if (blockEnd !== -1) {
    let nextBracketSemi = content.indexOf('});', blockEnd - 2);
    if (nextBracketSemi !== -1 && nextBracketSemi <= blockEnd) {
      content = content.substring(0, startIdx) + content.substring(nextBracketSemi + 3);
    }
  }
}

// Now insert the correct one
const correctRoute = `
/**
 * POST ROUTE FOR MULTI-SECTION AI OCR & EXTRACTION
 */
app.post("/api/ai/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم تحديد أي ملف للرفع." });
    }
    const type = req.body.type || "petty_cash";
    const userInstructions = req.body.instructions || "";
    const { buffer, mimetype, originalname } = req.file;

    const extracted = await extractFinancialFile(buffer, mimetype, originalname, type, userInstructions);

    // Save temporary upload
    const sanitize = (name) => name.replace(/[\\/\\\\?%*:|"<>\s]/g, "_").trim();
    const tempFilename = \`temp_\${Date.now()}_\${sanitize(originalname)}\`;
    const tempDir = path.join(ORGANIZED_DIR, "temp_uploads");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempPath = path.join(tempDir, tempFilename);
    fs.writeFileSync(tempPath, buffer);

    const relativeTempPath = \`/data/organized/temp_uploads/\${tempFilename}\`;

    res.json({
      success: true,
      data: extracted,
      tempPath: relativeTempPath,
      originalFilename: originalname
    });
  } catch (err: any) {
    console.error("AI OCR error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
`;

// Insert it somewhere around the file upload endpoints
const insertTarget = 'app.post("/api/ai/organize-file", async (req, res) => {';
const insertIdx = content.indexOf(insertTarget);
if (insertIdx !== -1) {
  content = content.substring(0, insertIdx) + correctRoute + '\n' + content.substring(insertIdx);
  fs.writeFileSync('api/app.ts', content);
  console.log("RESTORED CORRECT OCR");
}

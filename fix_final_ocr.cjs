const fs = require('fs');
let content = fs.readFileSync('api/app.ts', 'utf-8');

const replacement = `/**
 * POST ROUTE FOR MULTI-SECTION AI OCR & EXTRACTION
 */
app.post("/api/ai/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم تحديد أي ملف للرفع." });
    }
    const type = req.body.type || "petty_cash"; // 'labor' | 'petty_cash' | 'subcontractor'
    const userInstructions = req.body.instructions || "";
    const { buffer, mimetype, originalname } = req.file;

    const extracted = await extractFinancialFile(buffer, mimetype, originalname, type, userInstructions);

    // Save temporary upload
    const sanitize = (name: string) => name.replace(/[\\/\\\\?%*:|"<>\s]/g, "_").trim();
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

/**
 * DYNAMIC FOLDER ARCHITECTURE MANAGER
 */
app.post("/api/ai/organize-file", async (req, res) => {
  try {
    const { tempPath, engineer, date, subcontractor, project, type, metadata } = req.body;
    if (!tempPath) {
      return res.json({ success: true, path: "" }); // Non-blocking if no attachment uploaded
    }

    const absTempPath = path.join(DATA_DIR, tempPath.replace(/^\\/data\\//, ""));
    if (!fs.existsSync(absTempPath)) {
      return res.status(404).json({ error: "الملف المؤقت غير موجود." });
    }

    const sanitize = (name: string) => name.replace(/[\\/\\\\?%*:|"<>\s]/g, "_").trim();
    const filename = path.basename(absTempPath).replace(/^temp_\\d+_/, "");
    
    // Resolve date, year, month
    const resolvedDate = date || (metadata && metadata.date) || new Date().toISOString().split("T")[0];
    const dateStr = resolvedDate;
    const yearStr = dateStr.split("-")[0] || "2026";
    const monthStr = dateStr.split("-")[1] || "06";

    // Resolve engineer name
    const resolvedEngineer = engineer || (metadata && metadata.engineer) || (metadata && metadata.supervisor) || subcontractor || "عام";
    const engName = sanitize(resolvedEngineer);

    // Dynamic folder structure: [اسم المهندس] / [السنة] / [الشهر]
    const targetDir = path.join(ORGANIZED_DIR, "engineers_folders", engName, yearStr, monthStr);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const finalPath = path.join(targetDir, filename);
    fs.renameSync(absTempPath, finalPath);

    const relativePath = \`/data/organized/engineers_folders/\${engName}/\${yearStr}/\${monthStr}/\${filename}\`;
    res.json({ success: true, path: relativePath });
  } catch (err: any) {
    console.error("Organize file error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * SAVE AND CLASSIFY FILE ON DISK
 */`;

content = content.replace('/**\n * POST ROUTE FOR MULTI-SECTION AI OCR & EXTRACTION\n */\n\n\n/**\n * SAVE AND CLASSIFY FILE ON DISK\n */', replacement);
fs.writeFileSync('api/app.ts', content);

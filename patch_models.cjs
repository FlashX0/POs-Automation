const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf8');

const newRoute = `
app.get("/api/ai/models", async (req, res) => {
  try {
    if (!process.env.NARAROUTER_API_KEY) {
      return res.status(500).json({ error: "يرجى إعداد مفتاح API الخاص بـ NaraRouter في متغيرات البيئة" });
    }
    const models = await aiClient.models.list();
    return res.json({ success: true, models: models.data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
`;

// Insert the new route before app.post("/api/custody/analyze-multimodal"
const anchor = 'app.post("/api/custody/analyze-multimodal"';
if (code.includes(anchor)) {
  code = code.replace(anchor, newRoute + anchor);
}
fs.writeFileSync('api/app.ts', code);

const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf8');

const newRoute = `
app.get("/api/ai/verify", async (req, res) => {
  try {
    const key = process.env.NARAROUTER_API_KEY;
    console.log(key ? "Key Found" : "Key Missing");
    
    if (!key) {
      return res.status(500).json({ success: false, error: "Missing NARAROUTER_API_KEY in environment variables." });
    }
    
    // Verify connection by fetching models
    await aiClient.models.list();
    return res.json({ status: "success", message: "NaraRouter API is connected!" });
  } catch (err: any) {
    console.error("NaraRouter Connection Error:", err.message);
    return res.status(500).json({ status: "error", error: err.message });
  }
});
`;

const anchor = 'app.get("/api/ai/models"';
if (code.includes(anchor)) {
  code = code.replace(anchor, newRoute + anchor);
}
fs.writeFileSync('api/app.ts', code);

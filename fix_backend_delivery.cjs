const fs = require('fs');
let content = fs.readFileSync('api/app.ts', 'utf-8');

const oldRouteStart = `app.post("/api/ai/analyze-delivery-receipt", upload.single("file"), async (req, res) => {`;
const oldRouteEnd = `});

app.post("/api/ai/ocr", upload.single("file"), async (req, res) => {`;

const oldBlockRegex = new RegExp(`app\\.post\\("/api/ai/analyze-delivery-receipt".*?\\}\\);\\s*app\\.post\\("/api/ai/ocr"`, 's');

const newRoute = `app.post("/api/ai/compare-delivery-receipt", upload.single("file"), async (req, res) => {
  try {
    const poId = req.body.poId || req.body.po_id;
    if (!req.file) {
      return res.status(400).json({ success: false, error: "الرجاء رفع صورة إذن الاستلام" });
    }
    if (!poId) {
      return res.status(400).json({ success: false, error: "معرف أمر الشراء مفقود" });
    }

    await fetchAndSyncDbFromMongo();
    const db = getDb();
    const poDoc = (db.documents || []).find((d: any) => d.id === poId);
    if (!poDoc) {
      return res.status(404).json({ success: false, error: "أمر الشراء غير موجود" });
    }

    const { buffer, mimetype } = req.file;
    const base64Data = buffer.toString("base64");

    const systemInstruction = \`You are a logistics and procurement expert. Analyze the attached Delivery Note image. Compare it with the provided Purchase Order (PO) items. For each item, determine how much was actually delivered based on the image. Return a JSON object with a comparisonResult array, and if any items are in the delivery note but NOT in the PO, put them in an unmatchedItems array.\`;

    const poContext = \`PO Items:
\${JSON.stringify(poDoc.items, null, 2)}\`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: systemInstruction },
            { text: poContext },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimetype
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comparisonResult: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  poItemDescription: { type: Type.STRING, description: "الصنف من أمر الشراء" },
                  orderedQty: { type: Type.NUMBER },
                  deliveredQty: { type: Type.NUMBER, description: "المستخرج من الصورة" },
                  missingQty: { type: Type.NUMBER, description: "المطلوب ناقص المستلم" },
                  status: { type: Type.STRING, description: "'received', 'partial', 'missing', 'over_received'" },
                  aiSuggestion: { type: Type.STRING, description: "اقتراح ذكي، مثل 'تواصل مع المورد لتوريد الباقي'" }
                }
              }
            },
            unmatchedItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  deliveredQty: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    const responseText = response.text || "{}";
    let parsed = {};
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      console.warn("Could not parse AI response", e);
    }

    return res.json({ success: true, result: parsed });
  } catch (err: any) {
    console.error("Delivery Note Compare Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/ai/ocr"`;

if (content.match(oldBlockRegex)) {
  content = content.replace(oldBlockRegex, newRoute);
  console.log("Backend route replaced successfully.");
} else {
  console.log("Regex did not match!");
}

fs.writeFileSync('api/app.ts', content);

const fs = require('fs');
let content = fs.readFileSync('api/app.ts', 'utf-8');

const analyzeDeliveryNoteRoute = `
app.post("/api/ai/analyze-delivery-receipt", upload.single("file"), async (req, res) => {
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

    const { buffer, mimetype, originalname } = req.file;
    const base64Data = buffer.toString("base64");

    const systemInstruction = \`أنت خبير لوجستي. قارن بين بنود أمر الشراء المرفقة وبين إذن الاستلام المرفق (الصورة).
قم بإرجاع JSON يحتوي على قائمتين:
1. receivedItems (العناصر التي تم استلامها فعلياً مع Quantities المستلمة).
2. missingItems (العناصر الناقصة أو التي لم يتم استلامها أو التي بها نقص في الكمية).

بنود أمر الشراء:
\${JSON.stringify(poDoc.items, null, 2)}

Do NOT hallucinate numbers. If unsure, output 0. Strictly match the JSON schema.\`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: systemInstruction },
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
            receivedItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: "اسم البند" },
                  expectedQuantity: { type: Type.NUMBER, description: "الكمية المطلوبة في أمر الشراء" },
                  receivedQuantity: { type: Type.NUMBER, description: "الكمية المستلمة في إذن الاستلام" }
                }
              }
            },
            missingItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING, description: "اسم البند" },
                  expectedQuantity: { type: Type.NUMBER, description: "الكمية المطلوبة في أمر الشراء" },
                  receivedQuantity: { type: Type.NUMBER, description: "الكمية المستلمة (صفر إذا لم يستلم)" },
                  difference: { type: Type.NUMBER, description: "الكمية الناقصة" }
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
    console.error("Delivery Note Analysis Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
`;

const insertIndex = content.indexOf('app.post("/api/ai/ocr"');
if (insertIndex !== -1) {
  content = content.slice(0, insertIndex) + analyzeDeliveryNoteRoute + '\n' + content.slice(insertIndex);
  fs.writeFileSync('api/app.ts', content);
}

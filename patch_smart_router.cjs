const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf-8');

// Inside extractDataFromDocument
code = code.replace(
  /response = await ai\.models\.generateContent\(\{[\s\S]*?\}\);/,
  `if (currentModel.includes('gemini')) {
          response = await ai.models.generateContent({
            model: currentModel,
            contents: { parts: [documentPart, textPart] },
            config: {
              systemInstruction: systemInstruction + "\\n\\nCRITICAL RULE: Do NOT hallucinate numbers. If unsure, output 0. Strictly match the JSON schema.",
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  clientName: { type: Type.STRING, description: "Clean name of the vendor, seller, or supplier company." },
                  projectName: { type: Type.STRING, description: "The name of the project or construction site. Default to 'عام' if not found or unclear." },
                  receiptDate: { type: Type.STRING, description: "The official document or issue date in YYYY-MM-DD standard format. Use today's date if missing." },
                  docType: { type: Type.STRING, description: "Must be exactly 'po'." },
                  docNumber: { type: Type.STRING, description: "The PO number, Quote ID, or invoice number. Use 'N/A' if not found." },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        description: { type: Type.STRING, description: "Item or service description" },
                        quantity: { type: Type.NUMBER, description: "Quantity of items" },
                        unitPrice: { type: Type.NUMBER, description: "Price per unit" },
                        total: { type: Type.NUMBER, description: "Total line item price (qty * unitPrice)" },
                        unit: { type: Type.STRING, description: "Unit of measurement (e.g. عدد, متر, كجم)" },
                        brand: { type: Type.STRING, description: "Brand name if mentioned" }
                      },
                      required: ["description", "quantity", "unitPrice"]
                    }
                  }
                },
                required: ["clientName", "items"]
              }
            }
          });
        } else {
           const openAiResponse = await aiClient.chat.completions.create({
             model: currentModel,
             messages: [
               { role: "system", content: systemInstruction + "\\n\\nCRITICAL RULE: Do NOT hallucinate numbers. If unsure, output 0. Strictly match the JSON schema. Return JSON object containing clientName, projectName, receiptDate, docType, docNumber, and items (array of objects with description, quantity, unitPrice, total, unit, brand)." },
               { role: "user", content: [
                 { type: "text", text: textPart.text },
                 { type: "image_url", image_url: { url: \`data:\${mimeType};base64,\${base64Data}\` } }
               ]}
             ],
             response_format: { type: "json_object" }
           });
           response = { text: openAiResponse.choices[0].message.content || "{}" };
        }`
);

// Inside extractFinancialFile
code = code.replace(
  /response = await ai\.models\.generateContent\(\{[\s\S]*?\}\);/,
  `if (currentModel.includes('gemini')) {
          response = await ai.models.generateContent({
            model: currentModel,
            contents: { parts: [documentPart, textPart] },
            config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: schemaProperties,
                required: requiredFields
              }
            }
          });
        } else {
           const openAiResponse = await aiClient.chat.completions.create({
             model: currentModel,
             messages: [
               { role: "system", content: systemInstruction + "\\n\\nOutput MUST be valid JSON matching the exact schema." },
               { role: "user", content: [
                 { type: "text", text: textPart.text },
                 { type: "image_url", image_url: { url: \`data:\${mimeType};base64,\${base64Data}\` } }
               ]}
             ],
             response_format: { type: "json_object" }
           });
           response = { text: openAiResponse.choices[0].message.content || "{}" };
        }`
);

fs.writeFileSync('api/app.ts', code);

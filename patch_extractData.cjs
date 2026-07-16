const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf-8');

const regex = /console\.log\(\`\\\[Attempt \$\{attempt\}\/\$\{maxRetries\}\\\] Processing extraction using model: \$\{currentModel\}\`\);\s+response = await ai\.models\.generateContent\(\{[\s\S]*?\}\);/;

const newImplementation = `console.log(\`[Attempt \${attempt}/\${maxRetries}] Processing extraction using model: \${currentModel}\`);
        if (currentModel.toLowerCase().includes('gemini')) {
          response = await ai.models.generateContent({
            model: currentModel,
            contents: { parts: [documentPart, textPart] },
            config: {
              systemInstruction: systemInstruction + "\\n\\nCRITICAL RULE: Do NOT hallucinate numbers. If unsure, output 0. Strictly match the JSON schema.",
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  clientName: {
                    type: Type.STRING,
                    description: "Clean name of the vendor, seller, or supplier company (اسم البائع أو المورد). Write in clean Arabic if written in Arabic. Format gracefully and prioritize exact matches from Known Client/Supplier names."
                  },
                  projectName: {
                    type: Type.STRING,
                    description: "The name of the project or construction site. Look for Project:, المشروع:, عملية:, بخصوص:. Default to 'عام' if not found or unclear."
                  },
                  receiptDate: {
                    type: Type.STRING,
                    description: "The official document or issue date in YYYY-MM-DD standard format. Use today's date if missing."
                  },
                  docType: {
                    type: Type.STRING,
                    description: "Must be exactly 'po'."
                  },
                  docNumber: {
                    type: Type.STRING,
                    description: "The PO number, Quote ID, or invoice number. Use 'N/A' if not found."
                  },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        description: { type: Type.STRING, description: "Item or service description" },
                        quantity: { type: Type.NUMBER, description: "Quantity of items" },
                        unitPrice: { type: Type.NUMBER, description: "Price per unit" },
                        total: { type: Type.NUMBER, description: "Total line item price (qty * unitPrice)" },
                        brand: { type: Type.STRING, description: "Brand / manufacturer of the item, default to empty string if not found" },
                        unit: { type: Type.STRING, description: "Unit of measurement (e.g., عدد, متر, طن, لتر, علبة, Pcs, Unit). Default to 'عدد' if not found." }
                      },
                      required: ["description", "quantity", "unitPrice", "total"]
                    },
                    description: "List of rows or line items inside."
                  },
                  totalAmount: {
                    type: Type.NUMBER,
                    description: "Final invoice or quotation total sum."
                  },
                  currency: {
                    type: Type.STRING,
                    description: "Currency sign or code. E.g., EGP, USD, SAR"
                  },
                  notes: {
                    type: Type.STRING,
                    description: "Optional notes, terms, validity conditions, or payment schedules."
                  },
                  summary: {
                    type: Type.STRING,
                    description: "A very brief 1-sentence Arabic summary of what this is (e.g., 'أمر شراء لتوريد مستلزمات مكتبية وتجهيزات'."
                  },
                  dueDate: {
                    type: Type.STRING,
                    description: "The due date or payment deadline of the document in YYYY-MM-DD. Leave as empty string if not found."
                  }
                },
                required: ["clientName", "projectName", "receiptDate", "docType", "docNumber", "items", "totalAmount", "currency", "summary"]
              }
            }
          });
        } else {
          // Use aiClient for OpenAI-compatible models (e.g., deepseek, qwen, claude, gpt)
          const openAiResponse = await aiClient.chat.completions.create({
            model: currentModel,
            messages: [
              { 
                role: "system", 
                content: systemInstruction + "\\n\\nOutput MUST be exactly a JSON object matching this schema:\\n{\\n  \\"clientName\\": \\"string\\",\\n  \\"projectName\\": \\"string\\",\\n  \\"receiptDate\\": \\"YYYY-MM-DD\\",\\n  \\"docType\\": \\"po\\",\\n  \\"docNumber\\": \\"string\\",\\n  \\"items\\": [{ \\"description\\": \\"string\\", \\"quantity\\": 0, \\"unitPrice\\": 0, \\"total\\": 0, \\"brand\\": \\"string\\", \\"unit\\": \\"string\\" }],\\n  \\"totalAmount\\": 0,\\n  \\"currency\\": \\"string\\",\\n  \\"notes\\": \\"string\\",\\n  \\"summary\\": \\"string\\",\\n  \\"dueDate\\": \\"YYYY-MM-DD\\"\\n}"
              },
              { 
                role: "user", 
                content: [
                  { type: "text", text: textPart.text },
                  { type: "image_url", image_url: { url: \`data:\${mimeType || 'image/jpeg'};base64,\${base64Data}\` } }
                ]
              }
            ],
            response_format: { type: "json_object" }
          });
          
          const rawText = openAiResponse.choices[0].message.content || "{}";
          // Mock the google genai response object format so the rest of the code works as is
          response = {
            text: () => rawText
          };
        }`;

code = code.replace(regex, newImplementation);

fs.writeFileSync('api/app.ts', code);

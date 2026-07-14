const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf8');

const search = `    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [documentPart, textPart] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            names: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "All person/company/labor names found in the document."
            },
            dates: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "All dates found in the document, formatted as YYYY-MM-DD."
            },
            amounts: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description: "All monetary values/amounts found."
            },
            description: {
              type: Type.STRING,
              description: "Concise summary statement (البيان)."
            },
            summary: {
              type: Type.STRING,
              description: "Detailed summary of the document."
            }
          },
          required: ["names", "dates", "amounts", "description", "summary"]
        }
      }
    });

    const resultText = response.text;
    const resultJson = JSON.parse(resultText || "{}");`;

const replace = `    const selectedAIModel = req.body.selectedAIModel || "gpt-5.6-luna";
    const useAdvanced = req.body.useAdvanced === "true";
    let resultText = "{}";

    if (useAdvanced) {
      const openAiResponse = await aiClient.chat.completions.create({
        model: selectedAIModel,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: [
            { type: "text", text: textPart.text },
            { type: "image_url", image_url: { url: \`data:\${documentPart.inlineData.mimeType};base64,\${documentPart.inlineData.data}\` } }
          ]}
        ],
        response_format: { type: "json_object" }
      });
      resultText = openAiResponse.choices[0].message.content || "{}";
    } else {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [documentPart, textPart] },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              names: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "All person/company/labor names found in the document."
              },
              dates: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "All dates found in the document, formatted as YYYY-MM-DD."
              },
              amounts: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                description: "All monetary values/amounts found."
              },
              description: {
                type: Type.STRING,
                description: "Concise summary statement (البيان)."
              },
              summary: {
                type: Type.STRING,
                description: "Detailed summary of the document."
              }
            },
            required: ["names", "dates", "amounts", "description", "summary"]
          }
        }
      });
      resultText = response.text || "{}";
    }

    const resultJson = JSON.parse(resultText.trim() || "{}");`;

code = code.replace(search, replace);
fs.writeFileSync('api/app.ts', code);

const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf8');
const search = `      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ text: textContent }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              extractedTransactions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING },
                    description: { type: Type.STRING },
                    inflow: { type: Type.NUMBER },
                    outflow: { type: Type.NUMBER },
                    project: { type: Type.STRING },
                    method: { type: Type.STRING }
                  },
                  required: ["date", "description", "inflow", "outflow", "project", "method"]
                }
              }
            },
            required: ["extractedTransactions"]
          }
        }
      });`;
const replace = `      const openAiResponse = await aiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: textContent }
        ],
        response_format: { type: "json_object" }
      });
      response = { text: () => openAiResponse.choices[0].message.content };`;
code = code.replace(search, replace);
fs.writeFileSync('api/app.ts', code);

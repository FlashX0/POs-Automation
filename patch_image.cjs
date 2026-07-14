const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf8');

const searchExcel = `      response = { text: () => openAiResponse.choices[0].message.content };`;
const replaceExcel = `      response = { text: openAiResponse.choices[0].message.content || "{}" };`;
code = code.replace(searchExcel, replaceExcel);

const searchImg = `      response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            imagePart,
            { text: promptText }
          ]
        },
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

const replaceImg = `      const openAiResponse = await aiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: [
            { type: "text", text: promptText },
            imagePart
          ]}
        ],
        response_format: { type: "json_object" }
      });
      response = { text: openAiResponse.choices[0].message.content || "{}" };`;
code = code.replace(searchImg, replaceImg);
fs.writeFileSync('api/app.ts', code);

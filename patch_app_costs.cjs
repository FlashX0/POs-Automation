const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf8');

// For /api/ai/aggregate-costs
const search1 = `    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: textContent }] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aggregatedEntries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  project: { type: Type.STRING },
                  category: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                },
                required: ["project", "category", "amount", "description"]
              }
            }
          },
          required: ["aggregatedEntries"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");`;

const replace1 = `    const selectedAIModel = req.body.selectedAIModel || "deepseek-v4-pro-bynara";
    const useAdvanced = req.body.useAdvanced !== false;
    let resultText = "{}";

    if (useAdvanced) {
      const openAiResponse = await aiClient.chat.completions.create({
        model: selectedAIModel,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: textContent }
        ],
        response_format: { type: "json_object" }
      });
      resultText = openAiResponse.choices[0].message.content || "{}";
    } else {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [{ text: textContent }] },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              aggregatedEntries: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    project: { type: Type.STRING },
                    category: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    description: { type: Type.STRING }
                  },
                  required: ["project", "category", "amount", "description"]
                }
              }
            },
            required: ["aggregatedEntries"]
          }
        }
      });
      resultText = response.text || "{}";
    }

    const parsedData = JSON.parse(resultText.trim() || "{}");`;

code = code.replace(search1, replace1);

// For /api/ai/excel-analysis
const search2 = `    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ text: textContent }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            entries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING },
                  project: { type: Type.STRING },
                  category: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  description: { type: Type.STRING },
                  engineer: { type: Type.STRING }
                },
                required: ["date", "project", "category", "amount", "description"]
              }
            }
          },
          required: ["entries"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");`;

const replace2 = `    const selectedAIModel = req.body.selectedAIModel || "deepseek-v4-pro-bynara";
    const useAdvanced = req.body.useAdvanced === "true";
    let resultText = "{}";

    if (useAdvanced) {
      const openAiResponse = await aiClient.chat.completions.create({
        model: selectedAIModel,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: textContent }
        ],
        response_format: { type: "json_object" }
      });
      resultText = openAiResponse.choices[0].message.content || "{}";
    } else {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ text: textContent }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              entries: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING },
                    project: { type: Type.STRING },
                    category: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    description: { type: Type.STRING },
                    engineer: { type: Type.STRING }
                  },
                  required: ["date", "project", "category", "amount", "description"]
                }
              }
            },
            required: ["entries"]
          }
        }
      });
      resultText = response.text || "{}";
    }

    const parsedData = JSON.parse(resultText.trim() || "{}");`;

code = code.replace(search2, replace2);

fs.writeFileSync('api/app.ts', code);

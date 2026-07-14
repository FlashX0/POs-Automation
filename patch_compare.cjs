const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf8');

const search = `    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are an elite procurement manager and financial analyst for a major construction company in the Middle East. Always reply in clean Arabic. Output strict JSON only.",
      }
    });

    const resultText = response.text || "{}";`;

const replace = `    const selectedAIModel = req.body.selectedAIModel || "gpt-5.6-luna";
    const useAdvanced = req.body.useAdvanced === "true";
    let resultText = "{}";

    if (useAdvanced) {
      // For OpenAI, parts must be mapped to the message content array format
      const openaiContent = parts.map(p => {
        if (p.text) return { type: "text", text: p.text };
        if (p.inlineData) return { type: "image_url", image_url: { url: \`data:\${p.inlineData.mimeType};base64,\${p.inlineData.data}\` } };
        return { type: "text", text: "" };
      });
      const openAiResponse = await aiClient.chat.completions.create({
        model: selectedAIModel,
        messages: [
          { role: "system", content: "You are an elite procurement manager and financial analyst for a major construction company in the Middle East. Always reply in clean Arabic. Output strict JSON only." },
          { role: "user", content: openaiContent }
        ],
        response_format: { type: "json_object" }
      });
      resultText = openAiResponse.choices[0].message.content || "{}";
    } else {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          systemInstruction: "You are an elite procurement manager and financial analyst for a major construction company in the Middle East. Always reply in clean Arabic. Output strict JSON only.",
        }
      });
      resultText = response.text || "{}";
    }`;

code = code.replace(search, replace);
fs.writeFileSync('api/app.ts', code);

const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf-8');

const regex = /console\.log\(\`\\\[AI Financial Extraction Attempt \$\{attempt\}\\\] Using model: \$\{currentModel\} for type: \$\{type\}\`\);\s+response = await ai\.models\.generateContent\(\{[\s\S]*?\}\);/;

const newImplementation = `console.log(\`[AI Financial Extraction Attempt \${attempt}] Using model: \${currentModel} for type: \${type}\`);
      if (currentModel.toLowerCase().includes('gemini')) {
        response = await ai.models.generateContent({
          model: currentModel,
          contents: { parts: [documentPart, textPart] },
          config: {
            systemInstruction: systemInstruction + "\\n\\nCRITICAL RULE: Do NOT hallucinate numbers. If unsure, output 0. Strictly match the JSON schema.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: schemaProperties,
              required: requiredFields
            }
          }
        });
      } else {
        const schemaString = JSON.stringify({ properties: schemaProperties, required: requiredFields }, null, 2);
        const openAiResponse = await aiClient.chat.completions.create({
          model: currentModel,
          messages: [
            { 
              role: "system", 
              content: systemInstruction + "\\n\\nCRITICAL RULE: Do NOT hallucinate numbers. If unsure, output 0. Output MUST be exactly a JSON object matching this schema properties:\\n" + schemaString
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
        response = { text: rawText };
      }`;

code = code.replace(regex, newImplementation);

// Also need to fix the response.text getter since we assign it differently in OpenAI vs Gemini
// In Gemini response.text is a function: response.text(). In my patch I did response = { text: rawText }. But wait, earlier I used `response = { text: () => rawText }` for `extractDataFromDocument`.
// Let's check how it's called.

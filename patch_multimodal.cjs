const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf8');

const search = `    let response;
    if (isExcel) {
      const textContent = \`Analyze and extract transactions from these raw Excel rows.
Target Month: \${selectedMonth}
Target Engineer/Person: \${engineerName}

Raw Excel Data:
\${JSON.stringify(excelData)}

Extract the valid transactions that match the constraints.\`;

      const openAiResponse = await aiClient.chat.completions.create({
        model: selectedAIModel,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: textContent }
        ],
        response_format: { type: "json_object" }
      });
      response = openAiResponse.choices[0].message.content || "{}";
    } else {
      const openAiResponse = await aiClient.chat.completions.create({
        model: selectedAIModel,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: [
            { type: "text", text: \`Extract transactions from this image for engineer \${engineerName} for the month \${selectedMonth}.\` },
            { type: "image_url", image_url: { url: \`data:\${mimetype};base64,\${base64Data}\` } }
          ]}
        ],
        response_format: { type: "json_object" }
      });
      response = openAiResponse.choices[0].message.content || "{}";
    }

    const parsedData = JSON.parse(response.trim());`;

const replace = `    const useAdvanced = req.body.useAdvanced !== "false";
    let responseText = "{}";

    if (isExcel) {
      const textContent = \`Analyze and extract transactions from these raw Excel rows.
Target Month: \${selectedMonth}
Target Engineer/Person: \${engineerName}

Raw Excel Data:
\${JSON.stringify(excelData)}

Extract the valid transactions that match the constraints.\`;

      if (useAdvanced) {
        const openAiResponse = await aiClient.chat.completions.create({
          model: selectedAIModel,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: textContent }
          ],
          response_format: { type: "json_object" }
        });
        responseText = openAiResponse.choices[0].message.content || "{}";
      } else {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: { parts: [{ text: textContent }] },
          config: {
            systemInstruction,
            responseMimeType: "application/json"
          }
        });
        responseText = response.text || "{}";
      }
    } else {
      if (useAdvanced) {
        const openAiResponse = await aiClient.chat.completions.create({
          model: selectedAIModel,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: [
              { type: "text", text: \`Extract transactions from this image for engineer \${engineerName} for the month \${selectedMonth}.\` },
              { type: "image_url", image_url: { url: \`data:\${mimetype};base64,\${base64Data}\` } }
            ]}
          ],
          response_format: { type: "json_object" }
        });
        responseText = openAiResponse.choices[0].message.content || "{}";
      } else {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: { parts: [
            { text: \`Extract transactions from this image for engineer \${engineerName} for the month \${selectedMonth}.\` },
            { inlineData: { mimeType: mimetype || "image/jpeg", data: base64Data } }
          ]},
          config: {
            systemInstruction,
            responseMimeType: "application/json"
          }
        });
        responseText = response.text || "{}";
      }
    }

    const parsedData = JSON.parse(responseText.trim());`;

code = code.replace(search, replace);
fs.writeFileSync('api/app.ts', code);

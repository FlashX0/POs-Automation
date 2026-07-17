const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf-8');

code = code.replace(/response = \{ text: \(\) => openAiResponse\.choices\[0\]\.message\.content \|\| "\{\}" \};/g, 'response = { text: openAiResponse.choices[0].message.content || "{}" };');

fs.writeFileSync('api/app.ts', code);

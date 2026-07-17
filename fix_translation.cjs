const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf-8');

const regex = /const if \(currentModel[\s\S]*?response = { text: openAiResponse\.choices\[0\]\.message\.content \|\| "\{\}" };\n        }/;

const fixed = `const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: \`Translate this Arabic project name or text to a very short, clean English slug (no spaces, use hyphens). Only output the slug, nothing else. Text: "\${trimmed}"\`
      });`;

code = code.replace(regex, fixed);
fs.writeFileSync('api/app.ts', code);

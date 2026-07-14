const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf8');

if (!code.includes("const geminiApiKey = process.env.GEMINI_API_KEY;")) {
    console.log("Fixing geminiKey...");
    code = code.replace(
        `const aiClient = new OpenAI({`,
        `const geminiApiKey = process.env.GEMINI_API_KEY;\nconst aiClient = new OpenAI({`
    );
    fs.writeFileSync('api/app.ts', code);
}

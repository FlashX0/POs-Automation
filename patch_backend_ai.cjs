const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf8');

// Update endpoint at 2598
code = code.replace(
  'const userInstructions = req.body.instructions || "";\n    const { buffer, mimetype, originalname } = req.file;\n    const extracted = await extractFinancialFile(buffer, mimetype, originalname, type, userInstructions);',
  'const userInstructions = req.body.instructions || "";\n    const selectedAIModel = req.body.selectedAIModel;\n    const useAdvanced = req.body.useAdvanced === "true";\n    const { buffer, mimetype, originalname } = req.file;\n    const extracted = await extractFinancialFile(buffer, mimetype, originalname, type, userInstructions, selectedAIModel, useAdvanced);'
);

// Update extractFinancialFile signature
code = code.replace(
  "async function extractFinancialFile(fileBuffer: Buffer, mimeType: string, filename: string, type: 'labor' | 'petty_cash' | 'subcontractor', userInstructions?: string): Promise<any> {",
  "async function extractFinancialFile(fileBuffer: Buffer, mimeType: string, filename: string, type: 'labor' | 'petty_cash' | 'subcontractor', userInstructions?: string, selectedAIModel?: string, useAdvanced?: boolean): Promise<any> {"
);

// Update modelsToTry in extractFinancialFile
code = code.replace(
  'const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];',
  'const modelsToTry = selectedAIModel && useAdvanced ? [selectedAIModel] : ["gemini-3.5-flash", "gemini-3.1-flash-lite"];'
);

// Same for extractDataFromDocument
code = code.replace(
  "async function extractDataFromDocument(fileBuffer: Buffer, mimeType: string, filename: string, userInstructions?: string): Promise<any> {",
  "async function extractDataFromDocument(fileBuffer: Buffer, mimeType: string, filename: string, userInstructions?: string, selectedAIModel?: string, useAdvanced?: boolean): Promise<any> {"
);

code = code.replace(
  'const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];',
  'const modelsToTry = selectedAIModel && useAdvanced ? [selectedAIModel] : ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];'
);

// Excel endpoint
code = code.replace(
  'const response = await ai.models.generateContent({\n      model: "gemini-3.5-flash",',
  'const selectedAIModel = req.body.selectedAIModel || "gemini-3.5-flash";\n    const response = await ai.models.generateContent({\n      model: req.body.useAdvanced === "true" ? selectedAIModel : "gemini-3.5-flash",'
);

fs.writeFileSync('api/app.ts', code);

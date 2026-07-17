const fs = require('fs');
let code = fs.readFileSync('src/components/AIModelSelector.tsx', 'utf-8');

const freeModels = `export const FREE_AI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash | ⚡ سريع ومجاني (للمهام البسيطة)' },
  { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro | 🧠 دقيق ومجاني (للفواتير العادية)' },
  { id: 'gemini-3.5-pro', label: 'gemini-3.5-pro | 🎓 تفكير موسع وحل المشاكل المعقدة' }
];`;

const paidModels = `export const PAID_AI_MODELS = [
  { id: 'gpt-5.6-luna', label: 'gpt-5.6-luna | 👁️ للصور والأسكرين شوت' },
  { id: 'claude-opus-4-8-bynara', label: 'claude-opus-4-8-bynara | 👑 للفواتير المتداخلة' },
  { id: 'deepseek-v4-flash-bynara', label: 'deepseek-v4-flash-bynara | ⚡ الأرخص والأسرع' }
];`;

code = code.replace(/export const FREE_AI_MODELS = \[[\s\S]*?\];/, freeModels);
code = code.replace(/export const PAID_AI_MODELS = \[[\s\S]*?\];/, paidModels);

fs.writeFileSync('src/components/AIModelSelector.tsx', code);

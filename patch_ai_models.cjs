const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

const importXlsxStr = "import * as XLSX from 'xlsx-js-style';";

const aiModelsStr = `
const AI_MODELS = [
  { id: 'gpt-5.5', label: 'gpt-5.5 | 👑 للصور المعقدة جداً | 🔴 استهلاك عالي جداً ($0.99/1M)' },
  { id: 'gpt-5.6-sol', label: 'gpt-5.6-sol | 👑 دقة بصرية فائقة | 🔴 استهلاك عالي ($0.96/1M)' },
  { id: 'claude-opus-4-8-bynara', label: 'claude-opus-4-8-bynara | 👑 للفواتير المتداخلة | 🟠 استهلاك مرتفع ($0.50/1M)' },
  { id: 'gpt-5.6-luna', label: 'gpt-5.6-luna | 👁️ للصور والأسكرين شوت | 🟡 استهلاك متوسط ($0.19/1M)' },
  { id: 'claude-sonnet-5-bynara', label: 'claude-sonnet-5-bynara | 👁️ للجداول المصورة | 🟡 استهلاك متوسط ($0.20/1M)' },
  { id: 'deepseek-v4-pro-bynara', label: 'deepseek-v4-pro-bynara | 📊 لشيتات الإكسيل الدقيقة | 🟢 استهلاك موفر ($0.22/1M)' },
  { id: 'deepseek-v4-flash-bynara', label: 'deepseek-v4-flash-bynara | ⚡ للملفات البسيطة والسريعة | 🔵 الأرخص إطلاقاً ($0.02/1M)' },
  { id: 'qwen3.7-max', label: 'qwen3.7-max | 📊 للنصوص المعقدة | 🟠 استهلاك مرتفع ($0.87/1M)' },
  { id: 'gemini-3.5-pro', label: 'gemini-3.5-pro | 🌟 الأقوى والأفضل للصور' },
  { id: 'gemini-3.5-flash', label: 'gemini-3.5-flash | ⚡ سريع واقتصادي للصور الواضحة' }
];
`;

code = code.replace(importXlsxStr, importXlsxStr + '\\n' + aiModelsStr);

code = code.replace(
  /const \[aiSelectedModel, setAiSelectedModel\] = useState<string>\('gemini-2\.5-pro'\);/,
  "const [aiSelectedModel, setAiSelectedModel] = useState<string>('gpt-5.6-luna');"
);

code = code.replace(
  /<select \n                  value=\{aiSelectedModel\}\n                  onChange=\{\(e\) => setAiSelectedModel\(e\.target\.value\)\}\n                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none cursor-pointer"\n                >[\s\S]*?<\/select>/,
  `<select 
                  value={aiSelectedModel}
                  onChange={(e) => setAiSelectedModel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none cursor-pointer"
                >
                  {AI_MODELS.map(model => (
                    <option key={model.id} value={model.id}>{model.label}</option>
                  ))}
                </select>`
);

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

const fs = require('fs');

const newArray = `export const AI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash | ⚡ سريع ومجاني (للمهام البسيطة)' },
  { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro | 🧠 دقيق ومجاني (للفواتير العادية)' },
  { id: 'gpt-5.6-luna', label: 'gpt-5.6-luna | 👁️ للصور والأسكرين شوت | 🟡 استهلاك متوسط' },
  { id: 'claude-opus-4-8-bynara', label: 'claude-opus-4-8-bynara | 👑 للفواتير المتداخلة | 🟠 استهلاك مرتفع' },
  { id: 'deepseek-v4-flash-bynara', label: 'deepseek-v4-flash-bynara | ⚡ رخيص وسريع | 🔵 الأرخص إطلاقاً' },
  { id: 'qwen3.7-max', label: 'qwen3.7-max | 📊 للنصوص المعقدة | 🟠 استهلاك مرتفع' }
];`;

let aimodel = fs.readFileSync('src/components/AIModelSelector.tsx', 'utf-8');
aimodel = aimodel.replace(/export const AI_MODELS = \[[\s\S]*?\];/m, newArray);
aimodel = aimodel.replace(/group\?\.options\?\.find/g, "AI_MODELS?.find");
aimodel = aimodel.replace(
  /for \(const group of AI_MODELS\) \{[\s\S]*?    \}/,
  `const opt = AI_MODELS?.find(o => o.id === selectedModel);
    if (opt) return opt.label;`
);

aimodel = aimodel.replace(
  /\{AI_MODELS\?\.map\(\(group, idx\) => \([\s\S]*?\}\)\}/,
  `{AI_MODELS?.map((opt, idx) => (
                  <div
                    key={opt?.id}
                    onClick={() => {
                      setSelectedModel(opt?.id);
                      setIsOpen(false);
                    }}
                    className={\`px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer transition-colors \${selectedModel === opt?.id ? 'bg-emerald-500/10 text-emerald-400 font-bold' : ''}\`}
                  >
                    {opt?.label}
                  </div>
                ))}`
);

fs.writeFileSync('src/components/AIModelSelector.tsx', aimodel);

let labor = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');
labor = labor.replace(/const AI_MODELS = \[[\s\S]*?\];/, newArray.replace('export const AI_MODELS', 'const AI_MODELS'));
labor = labor.replace(/const \[aiSelectedModel, setAiSelectedModel\] = useState<string>\('.*?'\);/, "const [aiSelectedModel, setAiSelectedModel] = useState<string>('gemini-2.5-flash');");
fs.writeFileSync('src/components/LaborTimesheet.tsx', labor);


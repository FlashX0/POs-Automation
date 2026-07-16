const fs = require('fs');
let code = fs.readFileSync('src/components/AIModelSelector.tsx', 'utf-8');

const startStr = "{AI_MODELS?.map((group, idx) => (";
const endStr = "  </div>\n            )}";
const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const newMap = `{AI_MODELS?.map((opt, idx) => (
                  <div
                    key={opt?.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedModel(opt?.id);
                      setIsOpen(false);
                    }}
                    className={\`px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer transition-colors \${selectedModel === opt?.id ? 'bg-emerald-500/10 text-emerald-400 font-bold' : ''}\`}
                  >
                    {opt?.label}
                  </div>
                ))}\n              </div>\n            )}`;
  
  code = code.substring(0, startIndex) + newMap + code.substring(endIndex + endStr.length);
  fs.writeFileSync('src/components/AIModelSelector.tsx', code);
}

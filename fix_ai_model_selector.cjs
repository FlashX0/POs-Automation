const fs = require('fs');
let content = fs.readFileSync('src/components/AIModelSelector.tsx', 'utf-8');

// The line is: <h4 className="text-sm font-bold text-white">إعدادات الذكاء الاصطناعي المتقدم (NaraRouter)</h4>
// We will replace it with:
// <h4 className={`text-sm font-bold ${useAdvanced ? 'text-black' : 'text-white'}`}>{useAdvanced ? 'تشغيل المعالج الذكى' : 'تصحيح كتابي'}</h4>

const oldLine = `<h4 className="text-sm font-bold text-white">إعدادات الذكاء الاصطناعي المتقدم (NaraRouter)</h4>`;
const newLine = `<h4 className={\`text-sm font-bold \${useAdvanced ? 'text-black' : 'text-white'}\`}>{useAdvanced ? 'تشغيل المعالج الذكى' : 'تصحيح كتابي'}</h4>`;

if (content.includes(oldLine)) {
  content = content.replace(oldLine, newLine);
  console.log("Replaced text successfully");
} else {
  console.log("Could not find line");
}

fs.writeFileSync('src/components/AIModelSelector.tsx', content);

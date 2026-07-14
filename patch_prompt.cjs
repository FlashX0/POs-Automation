const fs = require('fs');
let code = fs.readFileSync('api/app.ts', 'utf8');

const search = '    const systemInstruction = `أنت خبير محاسبة إنشائية متمرس ومحاسب قانوني محترف.\nقم باستخراج حركات العهدة (المبالغ الواردة/المدين والمبالغ الصادرة/الدائن) حصرياً لشهر ${selectedMonth}.\nالتزم بالقواعد والمسميات والمطابقات التي تدربت عليها في الأمثلة السابقة لحفظ الأخطاء وتجنب تكرارها:\n${JSON.stringify(trainingData.slice(0, 50))}\n\nيجب الالتزام بالقواعد التالية أثناء استخراج البيانات:';

const replace = '    let systemInstruction = `أنت خبير محاسبة إنشائية متمرس ومحاسب قانوني محترف.\\nقم باستخراج حركات العهدة (المبالغ الواردة/المدين والمبالغ الصادرة/الدائن) حصرياً لشهر ${selectedMonth}.\\n`;\n    if (useMemory && trainingData.length > 0) {\n      systemInstruction += `التزم بالقواعد والمسميات والمطابقات التي تدربت عليها في الأمثلة السابقة لحفظ الأخطاء وتجنب تكرارها:\\n${JSON.stringify(trainingData.slice(0, 50))}\\n\\n`;\n    }\n    systemInstruction += `يجب الالتزام بالقواعد التالية أثناء استخراج البيانات:';

code = code.replace(search, replace);

code = code.replace(
  'model: "gpt-4o",\n        messages: [\n          { role: "system"',
  'model: selectedAIModel,\n        messages: [\n          { role: "system"'
);
code = code.replace(
  'model: "gpt-4o",\n        messages: [\n          { role: "system"',
  'model: selectedAIModel,\n        messages: [\n          { role: "system"'
);

fs.writeFileSync('api/app.ts', code);

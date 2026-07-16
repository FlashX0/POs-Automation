const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

// 1. Remove the local AI_MODELS
code = code.replace(/const AI_MODELS = \[\s*\{ id: 'gemini[^\]]*\];/m, '');

// 2. Add useAdvanced state
if (!code.includes('const [aiUseAdvanced, setAiUseAdvanced]')) {
  code = code.replace(
    "const [aiSelectedModel, setAiSelectedModel] = useState<string>('gemini-2.5-flash');",
    "const [aiSelectedModel, setAiSelectedModel] = useState<string>('gemini-2.5-flash');\n  const [aiUseAdvanced, setAiUseAdvanced] = useState<boolean>(false);"
  );
}

// 3. Import AIModelSelector
if (!code.includes('AIModelSelector')) {
  code = code.replace(
    "import { Plus, Search, Trash2, CheckCircle2, AlertCircle, FileSpreadsheet, Activity, Building, X, Save, Clock, ChevronDown, CalendarDays, Calculator, ArrowRight, UserCircle, RefreshCcw, Upload, Download } from 'lucide-react';",
    "import { Plus, Search, Trash2, CheckCircle2, AlertCircle, FileSpreadsheet, Activity, Building, X, Save, Clock, ChevronDown, CalendarDays, Calculator, ArrowRight, UserCircle, RefreshCcw, Upload, Download } from 'lucide-react';\nimport { AIModelSelector } from './AIModelSelector';"
  );
}

// 4. Replace the select dropdown
const selectRegex = /<div>\s*<label className="text-xs font-bold text-slate-300 block mb-2">موديل الذكاء الاصطناعي<\/label>\s*<select[\s\S]*?<\/select>\s*<\/div>/;
const newSelector = `<AIModelSelector 
                useAdvanced={aiUseAdvanced}
                setUseAdvanced={setAiUseAdvanced}
                selectedModel={aiSelectedModel}
                setSelectedModel={setAiSelectedModel}
              />`;

code = code.replace(selectRegex, newSelector);

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

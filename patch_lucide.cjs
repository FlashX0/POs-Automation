const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

code = code.replace(
  /FileText, ArrowRight, Upload, Sparkles, AlertCircle, Printer/,
  'FileText, ArrowRight, Upload, Sparkles, AlertCircle, Printer, X, Zap'
);

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

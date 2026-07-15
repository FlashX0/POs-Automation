const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Import it at the top
const importStr = "import { DeliveryNoteAnalyzer } from './components/DeliveryNoteAnalyzer';";
if (!content.includes('DeliveryNoteAnalyzer')) {
  // Find last import
  const lastImportIdx = content.lastIndexOf('import ');
  const endOfLastImport = content.indexOf('\n', lastImportIdx);
  content = content.slice(0, endOfLastImport) + '\n' + importStr + content.slice(endOfLastImport);
}

// Find the target injection point
const targetStr = '<span className="text-xs font-bold text-sky-850 block mb-1">💡 ملخص الـ AI وتحليل محتوى الملف الأصلي:</span>';
if (content.includes(targetStr)) {
  const injection = `
                    {/* Delivery Note Analyzer */}
                    {selectedDoc.docType === 'po' && (
                      <DeliveryNoteAnalyzer poId={selectedDoc.id} />
                    )}
  `;
  content = content.replace(
    '<div className="p-4 bg-sky-50/15 border border-sky-100 rounded-2xl">',
    injection + '\n                    <div className="p-4 bg-sky-50/15 border border-sky-100 rounded-2xl">'
  );
  fs.writeFileSync('src/App.tsx', content);
} else {
  console.log("Could not find injection point");
}

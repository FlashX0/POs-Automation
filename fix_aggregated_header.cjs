const fs = require('fs');
let code = fs.readFileSync('src/components/AggregatedStatement.tsx', 'utf-8');

const regex = /<tr style=\{\{ backgroundColor: "#1e293b", color: "#cbd5e1" \}\}>[\s\S]*?<\/tr>/;

const replacement = `<tr className="bg-slate-800 text-white">
                <th className="p-4 font-bold text-center w-1/4">البيان</th>
                <th className="p-4 font-bold text-center">رصيد سابق</th>
                <th className="p-4 font-bold text-center">مصروفات تشغيل</th>
                <th className="p-4 font-bold text-center">الإجمالي المستحق</th>
                <th className="p-4 font-bold text-center">عهدة تشغيل/دفعات</th>
                <th className="p-4 font-bold text-center">الرصيد الفعلي المتبقي</th>
                <th className="p-4 font-semibold text-center w-16 print:hidden">إجراء</th>
              </tr>`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/AggregatedStatement.tsx', code);

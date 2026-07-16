const fs = require('fs');
let code = fs.readFileSync('src/components/UserManagement.tsx', 'utf-8');

const regex = /<td className="py-4 px-6 align-middle text-right">\s*<div className="flex flex-wrap gap-1 justify-end max-w-xs">[\s\S]*?<\/div>\s*<\/td>/;

const newTd = `<td className="py-4 px-6 align-middle text-right">
                          <span className="text-xs font-bold text-slate-300">
                            {(user.allowed_departments || []).map(dep => {
                              if (dep === "procurement") return "المشتريات";
                              if (dep === "petty_cash") return "العهد ومصروفات المشاريع";
                              if (dep === "subcontractors") return "مستخلصات المقاولين";
                              if (dep === "labor_timesheet") return "العمالة اليومية";
                              if (dep === "cost_analysis") return "تحليل بنود المصروفات";
                              if (dep === "engineers") return "إدارة المهندسين";
                              if (dep === "aggregated_statement") return "البيان المجمع";
                              return dep;
                            }).join(' - ')}
                          </span>
                        </td>`;

code = code.replace(regex, newTd);
fs.writeFileSync('src/components/UserManagement.tsx', code);

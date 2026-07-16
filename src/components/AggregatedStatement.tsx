import React, { useState, useEffect, useRef } from 'react';
import { Save, CheckCircle, Download, Printer, Plus, Trash2, Calendar } from 'lucide-react';
// @ts-ignore
import * as XLSX from 'xlsx-js-style';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { motion } from 'motion/react';

// Use a simple local parse if utility isn't available
const safeNum = (val: any) => {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
};

interface AggregatedStatementProps {
  engineers: any[];
  subcontractorContracts: any[];
  laborTimesheets: any[];
  pettyCashBoxDays: any[];
  draftAggregatedStatement: any[];
  archivedAggregatedStatements: any[];
  onSaveDraft: (draft: any[]) => void;
  onApprove: (archiveEntry: any) => void;
  currentUser: any;
}

const AggregatedStatement: React.FC<AggregatedStatementProps> = ({
  engineers,
  subcontractorContracts,
  laborTimesheets,
  pettyCashBoxDays,
  draftAggregatedStatement,
  archivedAggregatedStatements,
  onSaveDraft,
  onApprove,
  currentUser
}) => {
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [rows, setRows] = useState<any[]>(draftAggregatedStatement || []);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRows(draftAggregatedStatement || []);
  }, [draftAggregatedStatement]);

  // Derived options for dropdown
  const entityOptions = [
    { label: 'مهندسين', options: engineers.map(e => ({ value: `eng_${e.name}`, label: e.name, type: 'engineer' })) },
    { label: 'مقاولين', options: subcontractorContracts.map(c => ({ value: `sub_${c.subcontractorName}`, label: c.subcontractorName, type: 'subcontractor' })) },
    { label: 'عمالة', options: laborTimesheets.map(l => ({ value: `lab_${l.workerName}`, label: l.workerName, type: 'labor' })) }
  ];

  const handleAddRow = () => {
    setRows([...rows, { 
      id: Date.now().toString(), 
      entityId: '', 
      entityName: '', 
      entityType: '', 
      previousBalance: 0, 
      operatingExpenses: 0, 
      totalDue: 0, 
      paymentsReceived: 0, 
      actualRemainingBalance: 0 
    }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const calculateEntityData = (entityType: string, entityName: string) => {
    let previousBalance = 0;
    let operatingExpenses = 0;
    let paymentsReceived = 0;

    const from = fromDate ? new Date(fromDate) : new Date(0);
    const to = toDate ? new Date(toDate) : new Date();
    // Inclusive dates
    to.setHours(23, 59, 59, 999);

    if (entityType === 'engineer') {
      // Find the engineer for initial balance
      const eng = engineers.find(e => e.name === entityName);
      previousBalance += eng ? safeNum(eng.initialBalance) : 0;

      pettyCashBoxDays.forEach(day => {
        if (day.engineer === entityName) {
          const dayDate = new Date(day.date);
          if (dayDate < from) {
            // Include in previous balance
            const dayExpenses = (day.transactions || []).filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + safeNum(t.amount), 0);
            const dayIncomes = (day.transactions || []).filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + safeNum(t.amount), 0);
            previousBalance += dayIncomes - dayExpenses;
          } else if (dayDate >= from && dayDate <= to) {
            const expenses = (day.transactions || []).filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + safeNum(t.amount), 0);
            const incomes = (day.transactions || []).filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + safeNum(t.amount), 0);
            operatingExpenses += expenses;
            paymentsReceived += incomes;
          }
        }
      });
    } else if (entityType === 'subcontractor') {
      const contract = subcontractorContracts.find(c => c.subcontractorName === entityName);
      if (contract) {
        // We will consider previous balance based on dates
        (contract.certificates || []).forEach((cert: any) => {
          const certDate = new Date(cert.date);
          if (certDate < from) {
            previousBalance += safeNum(cert.currentNetValue);
          } else if (certDate >= from && certDate <= to) {
            operatingExpenses += safeNum(cert.currentNetValue);
          }
        });

        (contract.payments || []).forEach((pay: any) => {
          const payDate = new Date(pay.date);
          if (payDate < from) {
            previousBalance -= safeNum(pay.amount);
          } else if (payDate >= from && payDate <= to) {
            paymentsReceived += safeNum(pay.amount);
          }
        });
      }
    } else if (entityType === 'labor') {
      const timesheet = laborTimesheets.find(l => l.workerName === entityName);
      if (timesheet) {
        (timesheet.records || []).forEach((rec: any) => {
          const recDate = new Date(rec.date);
          const dailyCost = safeNum(timesheet.dailyRate) * safeNum(rec.daysCount || 0);
          if (recDate < from) {
            previousBalance += dailyCost;
            previousBalance -= safeNum(rec.amountPaid || 0);
          } else if (recDate >= from && recDate <= to) {
            operatingExpenses += dailyCost;
            paymentsReceived += safeNum(rec.amountPaid || 0);
          }
        });
      }
    }

    return { previousBalance, operatingExpenses, paymentsReceived };
  };

  const handleChangeRow = (id: string, field: string, value: any) => {
    setRows(rows.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value };
        
        if (field === 'entityId') {
          // Determine entity type and name
          let type = '';
          let name = '';
          for (const group of entityOptions) {
            const opt = group.options.find(o => o.value === value);
            if (opt) {
              type = opt.type;
              name = opt.label;
              break;
            }
          }
          updated.entityType = type;
          updated.entityName = name;

          // Recalculate if dates are set
          if (fromDate && toDate) {
            const calcs = calculateEntityData(type, name);
            updated.previousBalance = calcs.previousBalance;
            updated.operatingExpenses = calcs.operatingExpenses;
            updated.paymentsReceived = calcs.paymentsReceived;
          }
        }

        // Auto calculate totals if numeric fields changed
        if (['previousBalance', 'operatingExpenses', 'paymentsReceived', 'entityId'].includes(field)) {
          updated.totalDue = safeNum(updated.previousBalance) + safeNum(updated.operatingExpenses);
          updated.actualRemainingBalance = safeNum(updated.totalDue) - safeNum(updated.paymentsReceived);
        }

        return updated;
      }
      return r;
    }));
  };

  const handleRecalculateAll = () => {
    if (!fromDate || !toDate) {
      alert('الرجاء تحديد تاريخ البداية والنهاية أولاً.');
      return;
    }
    const updated = rows.map(r => {
      if (r.entityType && r.entityName) {
        const calcs = calculateEntityData(r.entityType, r.entityName);
        const totalDue = safeNum(calcs.previousBalance) + safeNum(calcs.operatingExpenses);
        const actualRemainingBalance = totalDue - safeNum(calcs.paymentsReceived);
        return {
          ...r,
          previousBalance: calcs.previousBalance,
          operatingExpenses: calcs.operatingExpenses,
          paymentsReceived: calcs.paymentsReceived,
          totalDue,
          actualRemainingBalance
        };
      }
      return r;
    });
    setRows(updated);
  };

  const handleSaveDraft = () => {
    onSaveDraft(rows);
  };

  const handleApprove = () => {
    if (rows.length === 0) {
      alert('لا توجد بيانات للاعتماد.');
      return;
    }
    if (!fromDate || !toDate) {
      alert('الرجاء تحديد تاريخ البداية والنهاية.');
      return;
    }
    if (window.confirm('هل أنت متأكد من اعتماد البيان المجمع وإغلاق الفترة؟ لا يمكن التعديل بعد الاعتماد.')) {
      const archiveEntry = {
        id: `agg_${Date.now()}`,
        dateRange: { from: fromDate, to: toDate },
        rows: [...rows],
        totals: {
          previousBalance: totals.previousBalance,
          operatingExpenses: totals.operatingExpenses,
          totalDue: totals.totalDue,
          paymentsReceived: totals.paymentsReceived,
          actualRemainingBalance: totals.actualRemainingBalance
        },
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || 'مستخدم النظام'
      };
      onApprove(archiveEntry);
    }
  };

  const handleExportExcel = () => {
    const wsData = [
      ['البيان', 'رصيد سابق', 'مصروفات تشغيل', 'الإجمالي المستحق', 'عهدة تشغيل/دفعات', 'الرصيد الفعلي المتبقي']
    ];
    rows.forEach(r => {
      wsData.push([
        r.entityName,
        r.previousBalance,
        r.operatingExpenses,
        r.totalDue,
        r.paymentsReceived,
        r.actualRemainingBalance
      ]);
    });
    wsData.push([
      'الإجمالي الكلي',
      totals.previousBalance,
      totals.operatingExpenses,
      totals.totalDue,
      totals.paymentsReceived,
      totals.actualRemainingBalance
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!dir'] = 'rtl';
    XLSX.utils.book_append_sheet(wb, ws, 'البيان المجمع');
    XLSX.writeFile(wb, `البيان_المجمع_${fromDate}_الي_${toDate}.xlsx`);
  };

  const handlePrintPDF = async () => {
    if (printRef.current) {
      try {
        const canvas = await html2canvas(printRef.current, { 
          scale: 2, 
          useCORS: true,
          onclone: (clonedDocument) => {
            const elements = clonedDocument.querySelectorAll('*');
            elements.forEach((el) => {
              const htmlEl = el as HTMLElement;
              const computedStyle = window.getComputedStyle(htmlEl);
              if (computedStyle.backgroundColor.includes('oklch')) {
                htmlEl.style.backgroundColor = '#ffffff'; // Fallback safe color
              }
              if (computedStyle.color.includes('oklch')) {
                htmlEl.style.color = '#000000'; // Fallback safe color
              }
              if (computedStyle.borderColor.includes('oklch')) {
                htmlEl.style.borderColor = '#e5e7eb'; // Safe gray border
              }
            });
          }
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
        pdf.save(`البيان_المجمع_${fromDate}_الي_${toDate}.pdf`);
      } catch (err) {
        console.error('PDF Export Error:', err);
        alert('حدث خطأ أثناء تصدير ملف الـ PDF.');
      }
    }
  };

  const totals = rows.reduce((acc, r) => {
    acc.previousBalance += safeNum(r.previousBalance);
    acc.operatingExpenses += safeNum(r.operatingExpenses);
    acc.totalDue += safeNum(r.totalDue);
    acc.paymentsReceived += safeNum(r.paymentsReceived);
    acc.actualRemainingBalance += safeNum(r.actualRemainingBalance);
    return acc;
  }, { previousBalance: 0, operatingExpenses: 0, totalDue: 0, paymentsReceived: 0, actualRemainingBalance: 0 });

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between shadow-xl">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
            <span className="bg-indigo-500/20 text-indigo-400 p-2 rounded-xl">
              <Calendar className="w-6 h-6" />
            </span>
            بيان مجمع - تشغيل مواقع
          </h1>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">من:</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">إلى:</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white" />
            </div>
            <button onClick={handleRecalculateAll} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors">
              إعادة الحساب للكل
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleAddRow} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
            <Plus className="w-4 h-4" />
            إضافة صف
          </button>
          <button onClick={handleSaveDraft} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg">
            <Save className="w-4 h-4" />
            حفظ كمسودة
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-emerald-500/20">
            <Download className="w-4 h-4" />
            تصدير Excel
          </button>
          <button onClick={handlePrintPDF} className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-rose-500/20">
            <Printer className="w-4 h-4" />
            طباعة PDF
          </button>
          <button onClick={handleApprove} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-amber-500/20">
            <CheckCircle className="w-4 h-4" />
            اعتماد وترحيل
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-2xl border overflow-hidden shadow-2xl" style={{ backgroundColor: "#0f172a", borderColor: "#1e293b" }} ref={printRef}>
        <div className="p-6 border-b flex justify-between items-center" style={{ backgroundColor: "#1e293b", borderColor: "#1e293b" }}>
          <h2 className="text-lg font-bold" style={{ color: "#ffffff" }}>تفاصيل البيان المجمع</h2>
          <div className="text-sm" style={{ color: "#94a3b8" }}>
            {fromDate && toDate ? `الفترة: ${fromDate} إلى ${toDate}` : 'يرجى تحديد فترة'}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead>
              <tr style={{ backgroundColor: "#1e293b", color: "#cbd5e1" }}>
                <th className="p-4 font-bold text-center w-1/4">البيان</th>
                <th className="p-4 font-bold text-center">رصيد سابق</th>
                <th className="p-4 font-bold text-center">مصروفات تشغيل</th>
                <th className="p-4 font-bold text-center" style={{ color: "#fbbf24" }}>الإجمالي المستحق</th>
                <th className="p-4 font-bold text-center">عهدة تشغيل/دفعات</th>
                <th className="p-4 font-bold text-center" style={{ color: "#34d399" }}>الرصيد الفعلي المتبقي</th>
                <th className="p-4 font-semibold text-center w-16 print:hidden">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "#1e293b" }}>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: "#64748b" }}>لا توجد سجلات. انقر على "إضافة صف" للبدء.</td>
                </tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="transition-colors group" style={{ borderBottomColor: "#1e293b" }}>
                  <td className="p-4">
                    <select 
                      value={row.entityId} 
                      onChange={(e) => handleChangeRow(row.id, 'entityId', e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500" style={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#ffffff" }}
                    >
                      <option value="">-- اختر --</option>
                      {entityOptions.map(group => (
                        <optgroup key={group.label} label={group.label} style={{ backgroundColor: "#1e293b", color: "#a5b4fc" }}>
                          {group.options.map(opt => (
                            <option key={opt.value} value={opt.value} style={{ color: "#e2e8f0" }}>{opt.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="p-4">
                    <input 
                      type="number" 
                      value={row.previousBalance} 
                      onChange={(e) => handleChangeRow(row.id, 'previousBalance', e.target.value)}
                      className="w-full rounded-lg px-3 py-1.5 text-sm text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" style={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#ffffff" }}
                      dir="ltr"
                    />
                  </td>
                  <td className="p-4">
                    <input 
                      type="number" 
                      value={row.operatingExpenses} 
                      onChange={(e) => handleChangeRow(row.id, 'operatingExpenses', e.target.value)}
                      className="w-full rounded-lg px-3 py-1.5 text-sm text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" style={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#ffffff" }}
                      dir="ltr"
                    />
                  </td>
                  <td className="p-4 font-bold">
                    <input 
                      type="number" 
                      value={row.totalDue} 
                      onChange={(e) => handleChangeRow(row.id, 'totalDue', e.target.value)}
                      className="w-full border-0 px-1 py-1.5 text-sm text-center font-bold focus:ring-0" style={{ backgroundColor: "transparent", color: "#fbbf24" }}
                      dir="ltr"
                    />
                  </td>
                  <td className="p-4">
                    <input 
                      type="number" 
                      value={row.paymentsReceived} 
                      onChange={(e) => handleChangeRow(row.id, 'paymentsReceived', e.target.value)}
                      className="w-full rounded-lg px-3 py-1.5 text-sm text-center focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" style={{ backgroundColor: "#0f172a", borderColor: "#334155", color: "#ffffff" }}
                      dir="ltr"
                    />
                  </td>
                  <td className="p-4 font-bold">
                    <input 
                      type="number" 
                      value={row.actualRemainingBalance} 
                      onChange={(e) => handleChangeRow(row.id, 'actualRemainingBalance', e.target.value)}
                      className="w-full border-0 px-1 py-1.5 text-sm text-center font-bold focus:ring-0" style={{ backgroundColor: "transparent", color: "#34d399" }}
                      dir="ltr"
                    />
                  </td>
                  <td className="p-4 text-center print:hidden">
                    <button 
                      onClick={() => handleRemoveRow(row.id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t" style={{ backgroundColor: "#1e293b", borderColor: "#334155" }}>
                <tr>
                  <td className="p-4 font-bold text-center" style={{ color: "#ffffff" }}>الإجمالي الكلي:</td>
                  <td className="p-4 font-bold text-center" dir="ltr" style={{ color: "#ffffff" }}>{totals.previousBalance.toLocaleString()}</td>
                  <td className="p-4 font-bold text-center" dir="ltr" style={{ color: "#ffffff" }}>{totals.operatingExpenses.toLocaleString()}</td>
                  <td className="p-4 font-bold text-center" dir="ltr" style={{ color: "#fbbf24" }}>{totals.totalDue.toLocaleString()}</td>
                  <td className="p-4 font-bold text-center" dir="ltr" style={{ color: "#ffffff" }}>{totals.paymentsReceived.toLocaleString()}</td>
                  <td className="p-4 font-bold text-center" dir="ltr" style={{ color: "#34d399" }}>{totals.actualRemainingBalance.toLocaleString()}</td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default AggregatedStatement;

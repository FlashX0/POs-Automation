import { AIModelSelector } from "./AIModelSelector";
import { AIUploadModal } from "./AIUploadModal";
import React, { useState, useMemo, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import { 
  Download, Plus, Trash2, Calendar, DollarSign, CheckCircle, 
  Layers, FileText, User, Folder, FolderOpen, FileSpreadsheet, 
  Upload, Sparkles, AlertCircle, Printer 
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

interface WorkItem {
  id: string;
  date: string;
  description: string; // البند
  unit: string; // الوحدة
  rate: number; // الفئة
  previousQty: number; // سابق
  currentQty: number; // حالي
  completionPercent: number; // نسبة المستحق
}

interface Payment {
  id: string;
  date: string;
  description: string; // البيان / ملاحظات
  amount: number; // قيمة الدفعة
}

interface SubcontractorContract {
  id: string;
  subcontractor: string;
  project: string;
  statementNo: string;
  items: WorkItem[];
  payments: Payment[];
  supervisor?: string;
  accountant?: string;
  previousBalance?: number; // الرصيد السابق المرحل
}

interface SubcontractorCertificatesProps {
  projectsList: string[];
  contracts: SubcontractorContract[];
  onSave: (updatedContracts: SubcontractorContract[]) => void;
  archives?: any[];
  onUpdateArchives?: (updatedArchives: any[]) => void;
  onNotify?: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  engineers?: any[];
  onRefresh?: () => void;
}

export const SubcontractorCertificates: React.FC<SubcontractorCertificatesProps> = ({
  projectsList,
  contracts,
  onSave,
  archives = [],
  onUpdateArchives,
  onNotify,
  engineers = [],
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'entry' | 'archive'>('entry');
  const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);
  const [selectedAIModel, setSelectedAIModel] = useState("gemini-2.5-flash");
  const [aiUseAdvanced, setAiUseAdvanced] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const handleSubcontractorOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingAI(true);
    if (onNotify) {
      onNotify('info', 'جاري قراءة مستخلص المقاول بالذكاء الاصطناعي 🤖', 'يتم رفع وتحليل المستخلص وتوزيع البنود والقيم بالكامل...');
    } else {
      alert('جاري قراءة مستخلص المقاول بالذكاء الاصطناعي...');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('selectedAIModel', selectedAIModel);
    formData.append('useAdvanced', aiUseAdvanced ? 'true' : 'false');
    formData.append('type', 'subcontractor');

    try {
      const res = await fetch('/api/ai/ocr', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setIsAIModalOpen(false);
          const ext = data.data;
          
          if (onNotify) {
            onNotify('success', 'تم استخراج بيانات مستخلص المقاول بنجاح 🎉', 'تم ملء بيانات المقاول وبنود الأعمال المنجزة تلقائياً بالكامل.');
          } else {
            alert('تم استخراج بيانات مستخلص المقاول بنجاح 🎉');
          }

          if (ext.subcontractor) {
            setNewSub(ext.subcontractor);
          } else if (ext.names && ext.names.length > 0) {
            setNewSub(ext.names[0]);
          }

          if (ext.project) {
            setNewProj(ext.project);
          } else {
            setNewProj("عام");
          }

          if (ext.statementNo) setNewStatementNo(ext.statementNo);
          
          if (ext.supervisor) {
            setNewSupervisor(ext.supervisor);
          } else if (ext.names && ext.names.length > 1) {
            setNewSupervisor(ext.names[1]);
          }

          if (ext.accountant) {
            setNewAccountant(ext.accountant);
          } else if (ext.names && ext.names.length > 2) {
            setNewAccountant(ext.names[2]);
          }

          if (ext.previousBalance) {
            setNewPrevBalance(ext.previousBalance.toString());
          } else if (ext.amounts && ext.amounts.length > 0) {
            setNewPrevBalance(ext.amounts[0].toString());
          }
        } else {
          if (onNotify) {
            onNotify('error', 'فشل تحليل المستند', data.error || 'حدث خطأ في قراءة المستخلص بالذكاء الاصطناعي.');
          } else {
            alert(data.error || 'حدث خطأ في قراءة المستخلص بالذكاء الاصطناعي.');
          }
        }
      } else {
        if (onNotify) {
          onNotify('error', 'خطأ في الاتصال بالخادم', 'فشل إرسال الملف إلى معالج الذكاء الاصطناعي.');
        } else {
          console.error('خطأ في الاتصال بالخادم');
        }
      }
    } catch (err: any) {
      if (onNotify) {
        onNotify('error', 'فشل معالجة المستخلص', err.message || 'خطأ في الشبكة.');
      } else {
        console.error(err.message || 'خطأ في الشبكة.');
      }
    } finally {
      setIsProcessingAI(false);
      e.target.value = '';
      
    }
  };

  const [selectedContractId, setSelectedContractId] = useState<string>(
    contracts[0]?.id || ''
  );

  const [certificateType, setCertificateType] = useState<'periodic' | 'cumulative'>('cumulative');

  // Selected contract details
  const selectedContract = useMemo(() => {
    return contracts.find((c) => c.id === selectedContractId);
  }, [contracts, selectedContractId]);

  // Preceding contracts matching subcontractor, project and with a lower statement number
  const precedingContracts = useMemo(() => {
    if (!selectedContract) return [];
    const currentSub = selectedContract.subcontractor.trim().toLowerCase();
    const currentProj = selectedContract.project;
    const currentNo = parseFloat(selectedContract.statementNo) || 0;

    return contracts.filter((c) => {
      if (c.id === selectedContract.id) return false;
      const sameSub = c.subcontractor.trim().toLowerCase() === currentSub;
      const sameProj = c.project === currentProj;
      const otherNo = parseFloat(c.statementNo) || 0;
      return sameSub && sameProj && otherNo < currentNo;
    });
  }, [selectedContract, contracts]);

  // Contract creation form states
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [newSub, setNewSub] = useState<string>('');
  const [newProj, setNewProj] = useState<string>('');
  const [newStatementNo, setNewStatementNo] = useState<string>('01');
  const [newSupervisor, setNewSupervisor] = useState<string>('');
  const [newAccountant, setNewAccountant] = useState<string>('أ. محمد إبراهيم');
  const [newPrevBalance, setNewPrevBalance] = useState<string>('0');

  // Trigger automatic previous remaining carry-over for subcontractor
  useEffect(() => {
    if (!newSub.trim()) return;
    const subContracts = contracts.filter(
      (c) => c.subcontractor.trim().toLowerCase() === newSub.trim().toLowerCase()
    );
    if (subContracts.length > 0) {
      // Find the latest one. Sort descending by statementNo
      const sorted = [...subContracts].sort((a, b) => {
        const aNo = parseFloat(a.statementNo) || 0;
        const bNo = parseFloat(b.statementNo) || 0;
        return bNo - aNo;
      });
      const latestContract = sorted[0];
      
      // Compute the net remaining of the latest contract
      const itemsVal = latestContract.items.reduce((sum, item) => {
        const totQty = item.previousQty + item.currentQty;
        const totVal = totQty * item.rate;
        const dueVal = totVal * (item.completionPercent / 100);
        return sum + dueVal;
      }, 0);
      const payVal = latestContract.payments.reduce((sum, pay) => sum + pay.amount, 0);
      const prevBal = latestContract.previousBalance || 0;
      const remaining = prevBal + itemsVal - payVal;
      
      setNewPrevBalance(remaining.toString());
    } else {
      setNewPrevBalance('0');
    }
  }, [newSub, contracts]);

  // Work item form states
  const [itemDesc, setItemDesc] = useState<string>('');
  const [itemUnit, setItemUnit] = useState<string>('يومية');
  const [itemRate, setItemRate] = useState<string>('');
  const [itemPrevQty, setItemPrevQty] = useState<string>('0');
  const [itemCurrQty, setItemCurrQty] = useState<string>('');
  const [itemCompPercent, setItemCompPercent] = useState<string>('100');

  // Auto-fetch subcontractor previous quantity for matched work item description
  useEffect(() => {
    if (!selectedContract || !itemDesc.trim()) return;

    if (certificateType === 'periodic') {
      setItemPrevQty('0');
      return;
    }

    const subName = selectedContract.subcontractor.trim().toLowerCase();
    
    // Find all contracts for this subcontractor except the selected one
    const siblingContracts = contracts.filter(
      (c) => c.subcontractor.trim().toLowerCase() === subName && c.id !== selectedContract.id
    );

    if (siblingContracts.length === 0) {
      setItemPrevQty('0');
      return;
    }

    // Sort sibling contracts by statementNo descending to find the closest previous one
    siblingContracts.sort((a, b) => {
      const aNo = parseFloat(a.statementNo) || 0;
      const bNo = parseFloat(b.statementNo) || 0;
      return bNo - aNo;
    });

    // Check sibling contracts in order for an item matching this description
    let foundPrevQty = 0;
    let foundRate = '';
    let foundUnit = '';
    
    for (const c of siblingContracts) {
      const matchedItem = c.items.find(
        (it) => it.description.trim().toLowerCase() === itemDesc.trim().toLowerCase()
      );
      if (matchedItem) {
        foundPrevQty = matchedItem.previousQty + matchedItem.currentQty;
        foundRate = matchedItem.rate.toString();
        foundUnit = matchedItem.unit;
        break;
      }
    }

    setItemPrevQty(foundPrevQty.toString());
    if (foundRate) setItemRate(foundRate);
    if (foundUnit) setItemUnit(foundUnit);
  }, [itemDesc, selectedContract, contracts]);

  // Payment form states
  const [paymentDesc, setPaymentDesc] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Archive Explorer States
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Compute sums for grid UI
  const { 
    totalItemsValue, // Net current due of items
    cumulativeItemsValue, 
    previousItemsValue, 
    previousPaidAmount, 
    totalPayments, // Current payments
    totalCumulativePayments, 
    netRemaining 
  } = useMemo(() => {
    if (!selectedContract) {
      return { 
        totalItemsValue: 0, 
        cumulativeItemsValue: 0, 
        previousItemsValue: 0, 
        previousPaidAmount: 0, 
        totalPayments: 0, 
        totalCumulativePayments: 0, 
        netRemaining: 0 
      };
    }

    // Preceding contracts matching subcontractor & project & lower statement number
    const currentSub = selectedContract.subcontractor.trim().toLowerCase();
    const currentProj = selectedContract.project;
    const currentNo = parseFloat(selectedContract.statementNo) || 0;

    const preceding = contracts.filter((c) => {
      if (c.id === selectedContract.id) return false;
      const sameSub = c.subcontractor.trim().toLowerCase() === currentSub;
      const sameProj = c.project === currentProj;
      const otherNo = parseFloat(c.statementNo) || 0;
      return sameSub && sameProj && otherNo < currentNo;
    });

    // 1. Calculate dynamic previous quantities & values of items
    let cumDueSum = 0;
    let prevDueSum = 0;
    let currDueSum = 0;

    selectedContract.items.forEach((item) => {
      // Find previous quantities of this item in preceding contracts
      const prevQty = certificateType === 'cumulative' 
        ? preceding.reduce((sum, c) => {
            const matchedItem = c.items.find(
              (it) => it.description.trim().toLowerCase() === item.description.trim().toLowerCase()
            );
            return sum + (matchedItem ? matchedItem.currentQty : 0);
          }, 0)
        : 0;

      const cumQty = prevQty + item.currentQty;
      const cumVal = cumQty * item.rate;
      const cumDue = cumVal * (item.completionPercent / 100);

      const prevDue = prevQty * item.rate * (item.completionPercent / 100);
      const currDue = cumDue - prevDue;

      cumDueSum += cumDue;
      prevDueSum += prevDue;
      currDueSum += currDue;
    });

    // 2. Payments Calculations
    const currentPaymentsSum = selectedContract.payments.reduce((sum, pay) => sum + pay.amount, 0);
    const prevPaymentsSum = certificateType === 'cumulative'
      ? preceding.reduce((sum, c) => {
          const pSum = c.payments.reduce((pAcc, p) => pAcc + p.amount, 0);
          return sum + pSum;
        }, 0)
      : 0;

    const totalCumPaymentsSum = prevPaymentsSum + currentPaymentsSum;
    const prevBal = selectedContract.previousBalance || 0;

    // Net remaining accounts
    // For cumulative mode: Net remaining = previous balance + cumulative items value - total cumulative payments
    // For periodic mode: Net remaining = previous balance + current items value - current payments
    const net = certificateType === 'cumulative'
      ? prevBal + cumDueSum - totalCumPaymentsSum
      : prevBal + currDueSum - currentPaymentsSum;

    return {
      totalItemsValue: currDueSum,
      cumulativeItemsValue: cumDueSum,
      previousItemsValue: prevDueSum,
      previousPaidAmount: prevPaymentsSum,
      totalPayments: currentPaymentsSum,
      totalCumulativePayments: totalCumPaymentsSum,
      netRemaining: net
    };
  }, [selectedContract, contracts, certificateType]);

  const handleCreateContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSub.trim() || !newProj) {
      alert('الرجاء إدخال اسم المقاول واختيار المشروع!');
      return;
    }

    const newC: SubcontractorContract = {
      id: `contract-${Date.now()}`,
      subcontractor: newSub.trim(),
      project: newProj,
      statementNo: newStatementNo.trim(),
      items: [],
      payments: [],
      supervisor: newSupervisor.trim(),
      accountant: newAccountant.trim(),
      previousBalance: parseFloat(newPrevBalance) || 0
    };

    const updated = [newC, ...contracts];
    onSave(updated);
    setSelectedContractId(newC.id);
    setShowCreateForm(false);
    setNewSub('');
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract || !itemDesc.trim() || !itemRate || !itemCurrQty) return;

    const newItem: WorkItem = {
      id: `item-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      description: itemDesc.trim(),
      unit: itemUnit,
      rate: parseFloat(itemRate) || 0,
      previousQty: parseFloat(itemPrevQty) || 0,
      currentQty: parseFloat(itemCurrQty) || 0,
      completionPercent: parseFloat(itemCompPercent) || 100
    };

    const updated = contracts.map((c) => {
      if (c.id === selectedContractId) {
        return {
          ...c,
          items: [...c.items, newItem]
        };
      }
      return c;
    });

    onSave(updated);
    setItemDesc('');
    setItemRate('');
    setItemCurrQty('');
  };

  const handleDeleteItem = (itemId: string) => {
    const updated = contracts.map((c) => {
      if (c.id === selectedContractId) {
        return {
          ...c,
          items: c.items.filter((item) => item.id !== itemId)
        };
      }
      return c;
    });
    onSave(updated);
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContract || !paymentAmount || !paymentDesc.trim()) return;

    const newPay: Payment = {
      id: `pay-${Date.now()}`,
      date: paymentDate,
      description: paymentDesc.trim(),
      amount: parseFloat(paymentAmount) || 0
    };

    const updated = contracts.map((c) => {
      if (c.id === selectedContractId) {
        return {
          ...c,
          payments: [...c.payments, newPay]
        };
      }
      return c;
    });

    onSave(updated);
    setPaymentDesc('');
    setPaymentAmount('');
  };

  const handleDeletePayment = (payId: string) => {
    const updated = contracts.map((c) => {
      if (c.id === selectedContractId) {
        return {
          ...c,
          payments: c.payments.filter((p) => p.id !== payId)
        };
      }
      return c;
    });
    onSave(updated);
  };

  const handleDeleteContractDirect = async () => {
    if (!selectedContractId) return;
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا المستخلص بالكامل؟')) {
      setIsDeleting(true);
      try {
        const res = await fetch('/api/state/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            subcontractorContracts: contracts.filter((c) => c.id !== selectedContractId),
            deletedSubcontractorIds: [selectedContractId]
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            // Update local state immediately
            const updated = contracts.filter((c) => c.id !== selectedContractId);
            onSave(updated);
            setSelectedContractId(updated[0]?.id || '');
            if (onRefresh) {
              onRefresh();
            }
          } else {
            alert(`فشل حذف المستخلص: ${data.error || 'خطأ غير معروف'}`);
          }
        } else {
          console.error('فشل الاتصال بالسيرفر لحذف المستخلص.');
        }
      } catch (err) {
        console.error('Error deleting subcontractor contract:', err);
        console.error('حدث خطأ أثناء الاتصال بالسيرفر لحذف المستخلص.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Build subcontractor Excel workbook object (clean styled output)
  const generateSubcontractorWorkbook = (contract: SubcontractorContract) => {
    const rows: any[][] = [];

    // Preceding contracts matching subcontractor, project and with a lower statement number
    const preceding = contracts.filter((c) => {
      if (c.id === contract.id) return false;
      const sameSub = c.subcontractor.trim().toLowerCase() === contract.subcontractor.trim().toLowerCase();
      const sameProj = c.project === contract.project;
      const otherNo = parseFloat(c.statementNo) || 0;
      return sameSub && sameProj && otherNo < (parseFloat(contract.statementNo) || 0);
    });

    const getPrevQty = (desc: string) => {
      if (certificateType === 'periodic') return 0;
      return preceding.reduce((sum, c) => {
        const matchedItem = c.items.find(
          (it) => it.description.trim().toLowerCase() === desc.trim().toLowerCase()
        );
        return sum + (matchedItem ? matchedItem.currentQty : 0);
      }, 0);
    };

    // Title Row
    rows.push(["كشف مستخلص مقاول الباطن (Subcontractor Progress Certificate)", "", "", "", "", "", "", "", "", "", "", "", ""]);
    rows.push(["", "", "", "", "", "", "", "", "", "", "", "", ""]); // divider

    // Contract Meta Row 1
    rows.push([
      "مقاول الباطن", contract.subcontractor,
      "المشروع", contract.project,
      "رقم المستخلص", contract.statementNo,
      "المهندس المشرف", contract.supervisor || "-",
      "المحاسب المسؤول", contract.accountant || "-"
    ]);
    rows.push(["", "", "", "", "", "", "", "", "", "", "", "", ""]); // empty divider

    // Column Headers
    rows.push([
      "التاريخ (Date)",
      "البند (Item description)",
      "وحدة (Unit)",
      "الفئة (Rate)",
      "سابق (Prev Qty)",
      "حالي (Curr Qty)",
      "إجمالي كمية (Total Qty)",
      "القيمة الإجمالية (Total Value)",
      "نسبة المستحق % (Comp %)",
      "صافي قيمة المستحق (Due Value)",
      "دفعات المقاول (تاريخ)",
      "دفعات المقاول (ملاحظات)",
      "قيمة الدفعة (Amount)"
    ]);

    const maxItems = Math.max(contract.items.length, contract.payments.length);

    for (let i = 0; i < maxItems; i++) {
      const item = contract.items[i];
      const pay = contract.payments[i];
      const rIdx = 6 + i; // 1-indexed Excel row is rIdx + 1

      const prevQtyVal = item ? getPrevQty(item.description) : 0;

      const rData = [
        item ? item.date : "",
        item ? item.description : "",
        item ? item.unit : "",
        item ? item.rate : "",
        item ? prevQtyVal : "",
        item ? item.currentQty : "",
        item ? { f: `E${rIdx + 1}+F${rIdx + 1}` } : "", // Total Qty
        item ? { f: `G${rIdx + 1}*D${rIdx + 1}` } : "", // Total Value
        item ? item.completionPercent : "",
        item ? { f: `F${rIdx + 1}*D${rIdx + 1}*(I${rIdx + 1}/100)` } : "", // Net current due value
        pay ? pay.date : "",
        pay ? pay.description : "",
        pay ? pay.amount : ""
      ];
      rows.push(rData);
    }

    const summaryRowIdx = 6 + maxItems;
    rows.push(["", "", "", "", "", "", "", "", "", "", "", "", ""]); // Empty row separator

    // Totals Row
    rows.push([
      "الإجمالي المستحق للمقاول (Total Due Value):",
      { f: `SUM(J6:J${summaryRowIdx})` },
      "", "", "", "", "", "", "",
      "إجمالي الدفعات والمسحوبات (Total Payments):",
      "", "",
      { f: `SUM(M6:M${summaryRowIdx})` }
    ]);

    // Previous Balance Row
    rows.push([
      "الرصيد السابق المرحل (Previous Carried Balance):",
      contract.previousBalance || 0,
      "", "", "", "", "", "", "", "", "", "", ""
    ]);

    // Net Remaining Row
    rows.push([
      "صافي حساب المقاول المتبقي للعمل (Net Contractor Balance):",
      { f: `B${summaryRowIdx + 2}+B${summaryRowIdx + 3}-M${summaryRowIdx + 2}` },
      "", "", "", "", "", "", "", "", "", "", ""
    ]);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Apply merges
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }, // Title
      { s: { r: 2, c: 0 }, e: { r: 2, c: 0 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 1 } },
      { s: { r: 2, c: 2 }, e: { r: 2, c: 2 } },
      { s: { r: 2, c: 3 }, e: { r: 2, c: 3 } },
      { s: { r: 2, c: 4 }, e: { r: 2, c: 4 } },
      { s: { r: 2, c: 5 }, e: { r: 2, c: 5 } },
      { s: { r: 2, c: 6 }, e: { r: 2, c: 6 } },
      { s: { r: 2, c: 7 }, e: { r: 2, c: 7 } },
      { s: { r: 2, c: 8 }, e: { r: 2, c: 8 } },
      { s: { r: 2, c: 9 }, e: { r: 2, c: 9 } },
      
      // Totals row labels and merges
      { s: { r: summaryRowIdx + 1, c: 9 }, e: { r: summaryRowIdx + 1, c: 11 } },
      // Previous Balance row merge
      { s: { r: summaryRowIdx + 2, c: 2 }, e: { r: summaryRowIdx + 2, c: 12 } },
      // Net remaining row merge
      { s: { r: summaryRowIdx + 3, c: 2 }, e: { r: summaryRowIdx + 3, c: 12 } }
    ];
    ws['!merges'] = merges;

    // RTL orientation for Arabic sheet
    ws['!views'] = [{ RTL: true }];

    // Set row heights
    const rowHeights = [];
    rowHeights[0] = { hpt: 45 }; // Title row (Row 1)
    rowHeights[1] = { hpt: 15 }; // Empty row (Row 2)
    rowHeights[2] = { hpt: 35 }; // Orange Meta Row (Row 3)
    rowHeights[3] = { hpt: 15 }; // Empty row (Row 4)
    rowHeights[4] = { hpt: 40 }; // Column Headers Row (Row 5)
    for (let r = 5; r < rows.length; r++) {
      rowHeights[r] = { hpt: 25 }; // Min height 25 for all other rows
    }
    ws['!rows'] = rowHeights;

    // Apply exact styling
    const borderDashedBlue = {
      top: { style: "dashed", color: { rgb: "4F81BD" } },
      bottom: { style: "dashed", color: { rgb: "4F81BD" } },
      left: { style: "dashed", color: { rgb: "4F81BD" } },
      right: { style: "dashed", color: { rgb: "4F81BD" } }
    };

    const accountingFormat = '_(* #,##0.00_);_(* (#,##0.00);_(* "-"??_);_(@_)';
    const totalCols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];

    // Default cell styling (Arial 11pt, Centered/Middle, Blue Dashed Borders)
    const totalRowsCount = rows.length;
    for (let r = 0; r < totalRowsCount; r++) {
      totalCols.forEach((col) => {
        const cellRef = `${col}${r + 1}`;
        if (!ws[cellRef]) {
          ws[cellRef] = { v: "" };
        }
        
        ws[cellRef].s = {
          font: { name: "Arial", sz: 11 },
          border: borderDashedBlue,
          alignment: { horizontal: "center", vertical: "center", wrapText: true }
        };

        // Number formats for numerical columns in data section
        if (['D', 'E', 'F', 'G', 'H', 'J', 'M'].includes(col) && r >= 5 && r < summaryRowIdx) {
          ws[cellRef].s.numFmt = accountingFormat;
          ws[cellRef].s.alignment = { horizontal: "left", vertical: "center" };
        }
      });
    }

    // A1 Title specific style
    ws['A1'].s = {
      font: { name: "Arial", sz: 14, bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "D97706" } }, // Amber-600
      alignment: { horizontal: "center", vertical: "center" },
      border: borderDashedBlue
    };

    // Meta Header row 3 specific styling (Orange/Amber)
    totalCols.forEach(col => {
      const cellRef = `${col}3`;
      if (ws[cellRef]) {
        ws[cellRef].s.font = { name: "Arial", sz: 11, bold: true, color: { rgb: "1F4E78" } };
        ws[cellRef].s.fill = { fgColor: { rgb: "FEF3C7" } }; // light amber
        ws[cellRef].s.border = borderDashedBlue;
      }
    });

    // Column Headers row 5 specific styling (Slate grey)
    totalCols.forEach(col => {
      const cellRef = `${col}5`;
      if (ws[cellRef]) {
        ws[cellRef].s.font = { name: "Arial", sz: 11, bold: true, color: { rgb: "FFFFFF" } };
        ws[cellRef].s.fill = { fgColor: { rgb: "4B5563" } }; // Slate grey
        ws[cellRef].s.border = borderDashedBlue;
      }
    });

    // Totals Row specific styling (Row index summaryRowIdx + 1, Excel row summaryRowIdx + 2)
    const rTot = summaryRowIdx + 2;
    totalCols.forEach(col => {
      const cellRef = `${col}${rTot}`;
      if (ws[cellRef]) {
        ws[cellRef].s.font = { name: "Arial", sz: 11, bold: true };
        ws[cellRef].s.fill = { fgColor: { rgb: "F1F5F9" } };
      }
    });
    if (ws[`B${rTot}`]) {
      ws[`B${rTot}`].s.numFmt = accountingFormat;
      ws[`B${rTot}`].s.font.color = { rgb: "1F4E78" };
      ws[`B${rTot}`].s.alignment = { horizontal: "left", vertical: "center" };
    }
    if (ws[`M${rTot}`]) {
      ws[`M${rTot}`].s.numFmt = accountingFormat;
      ws[`M${rTot}`].s.font.color = { rgb: "1F4E78" };
      ws[`M${rTot}`].s.alignment = { horizontal: "left", vertical: "center" };
    }

    // Previous Balance Row specific styling (Row index summaryRowIdx + 2, Excel row summaryRowIdx + 3)
    const rPrev = summaryRowIdx + 3;
    totalCols.forEach(col => {
      const cellRef = `${col}${rPrev}`;
      if (ws[cellRef]) {
        ws[cellRef].s.font = { name: "Arial", sz: 11, bold: true };
        ws[cellRef].s.fill = { fgColor: { rgb: "FEF3C7" } };
      }
    });
    if (ws[`B${rPrev}`]) {
      ws[`B${rPrev}`].s.numFmt = accountingFormat;
      ws[`B${rPrev}`].s.font.color = { rgb: "D97706" };
      ws[`B${rPrev}`].s.alignment = { horizontal: "left", vertical: "center" };
    }

    // Net Remaining Row specific styling (Row index summaryRowIdx + 3, Excel row summaryRowIdx + 4)
    const rNet = summaryRowIdx + 4;
    totalCols.forEach(col => {
      const cellRef = `${col}${rNet}`;
      if (ws[cellRef]) {
        ws[cellRef].s.font = { name: "Arial", sz: 12, bold: true };
        ws[cellRef].s.fill = { fgColor: { rgb: "E2EFDA" } }; // soft green
      }
    });
    if (ws[`B${rNet}`]) {
      ws[`B${rNet}`].s.numFmt = accountingFormat;
      ws[`B${rNet}`].s.font = { name: "Arial", sz: 12, bold: true, color: { rgb: "375623" } };
      ws[`B${rNet}`].s.alignment = { horizontal: "left", vertical: "center" };
    }

    // Apply auto-fit column widths to prevent text cutoffs
    ws['!cols'] = [
      { wch: 15 }, // Date
      { wch: 30 }, // Item description
      { wch: 10 }, // Unit
      { wch: 12 }, // Rate
      { wch: 10 }, // Prev Qty
      { wch: 10 }, // Curr Qty
      { wch: 12 }, // Total Qty
      { wch: 16 }, // Total Value
      { wch: 14 }, // Completion %
      { wch: 16 }, // Due Value
      { wch: 15 }, // Payment Date
      { wch: 25 }, // Payment description
      { wch: 16 }  // Payment Amount
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "مستخلص مقاول باطن");
    return wb;
  };

  const handleExportExcel = () => {
    if (!selectedContract) return;
    const wb = generateSubcontractorWorkbook(selectedContract);
    XLSX.writeFile(wb, `مستخلص_${selectedContract.subcontractor}_${selectedContract.statementNo}.xlsx`);
  };

  // Approve & Archive current subcontractor certificate
  const handleApproveAndArchive = () => {
    if (!selectedContract) return;

    if (!window.confirm(`هل أنت متأكد من اعتماد مستخلص المقاول (${selectedContract.subcontractor})؟ سيتم توليد وحفظ الكشف في أرشيف المقاولين بصفة رسمية ومؤمنة.`)) {
      return;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `Certificate_Statement_${selectedContract.statementNo}_${selectedContract.subcontractor}_${dateStr}.xlsx`;

    try {
      const wb = generateSubcontractorWorkbook(selectedContract);
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

      const newArchive = {
        id: `archive-sub-${Date.now()}`,
        name: fileName,
        type: 'subcontractor',
        ownerName: selectedContract.subcontractor,
        date: dateStr,
        statementNo: selectedContract.statementNo,
        size: `${Math.round((wbout.length * 0.75) / 1024)} KB`,
        url: wbout
      };

      const updatedArchives = [newArchive, ...archives];
      if (onUpdateArchives) {
        onUpdateArchives(updatedArchives);
        alert(`تم اعتماد المستخلص وأرشفته تلقائياً بنجاح في مجلد: (${selectedContract.subcontractor}) 🚀`);
      }
    } catch (e: any) {
      alert(`حدث خطأ أثناء أرشفة المستخلص: ${e.message}`);
    }
  };

  // Download Base64 archived spreadsheet
  const handleDownloadArchiveFile = (file: any) => {
    if (!file.url) return;
    try {
      const byteCharacters = atob(file.url);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (e: any) {
      alert(`فشل تحميل الملف: ${e.message}`);
    }
  };

  // Manual uploads directly to subcontractor directories
  const handleManualArchiveUpload = (e: React.ChangeEvent<HTMLInputElement>, folderName: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Content = result.split(',')[1];
      const dateStr = new Date().toISOString().split('T')[0];

      const newArchive = {
        id: `archive-sub-manual-${Date.now()}`,
        name: file.name,
        type: 'subcontractor',
        ownerName: folderName,
        date: dateStr,
        size: `${Math.round(file.size / 1024)} KB`,
        url: base64Content
      };

      const updated = [newArchive, ...archives];
      if (onUpdateArchives) {
        onUpdateArchives(updated);
        alert(`تم رفع المستند بنجاح داخل مجلد المقاول: ${folderName}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteArchiveFile = (id: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا المستند المؤرشف نهائياً؟')) {
      const updated = archives.filter(item => item.id !== id);
      if (onUpdateArchives) {
        onUpdateArchives(updated);
      }
    }
  };

  // Group Subcontractor Archives into folders
  const subcontractorFolders = useMemo(() => {
    const subDocs = archives.filter(f => f.type === 'subcontractor');
    const foldersMap: { [contractorName: string]: any[] } = {};

    contracts.forEach(c => {
      if (!foldersMap[c.subcontractor]) {
        foldersMap[c.subcontractor] = [];
      }
    });

    subDocs.forEach(doc => {
      const owner = doc.ownerName || 'عام';
      if (!foldersMap[owner]) foldersMap[owner] = [];
      foldersMap[owner].push(doc);
    });

    return Object.entries(foldersMap).map(([name, files]) => ({
      name,
      files
    }));
  }, [archives, contracts]);

  return (
    <div className="space-y-6">
      {/* Scoped style block to force portrait print specifically for this certificate */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: portrait !important;
            margin: 8mm 10mm 8mm 10mm !important;
          }
          /* Custom styles to force solid dark gridlines for all tables */
          .portrait-print table {
            border: 2px solid #000000 !important;
            border-collapse: collapse !important;
            width: 100% !important;
          }
          .portrait-print th, .portrait-print td {
            border: 1px solid #000000 !important;
            border-style: solid !important;
            border-width: 1px !important;
            border-color: #000000 !important;
            padding: 6px 4px !important;
          }
          /* Override background colors for headers to look elegant on gray scales */
          .portrait-print thead tr {
            background-color: #F2F2F2 !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .portrait-print thead th {
            color: #000000 !important;
            font-weight: 900 !important;
          }
          /* Remove outer blue dashed border and padding completely in print */
          .portrait-print .outer-print-container {
            border: none !important;
            padding: 0 !important;
          }
        }
      `}} />

      <div className="no-print space-y-6">
        {/* Department Top Tab Switches */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('entry')}
          className={`px-5 py-3 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'entry'
              ? 'text-amber-400 border-b-2 border-amber-500 bg-amber-500/5'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
          } rounded-t-xl`}
        >
          <Layers className="w-4 h-4" />
          <span>إدخال وتسجيل مستخلصات المقاولين 📝</span>
        </button>
        <button
          onClick={() => setActiveTab('archive')}
          className={`px-5 py-3 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'archive'
              ? 'text-amber-400 border-b-2 border-amber-500 bg-amber-500/5'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
          } rounded-t-xl`}
        >
          <FolderOpen className="w-4 h-4" />
          <span>أرشيف مجلدات ومستخلصات المقاولين 📁</span>
        </button>
      </div>

      {activeTab === 'entry' && (
        <>
          {/* Selector & Actions */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <User className="text-amber-400 w-5 h-5" />
              <span className="text-sm font-bold text-slate-300">اختر المقاول / العقد:</span>
              <select
                value={selectedContractId}
                onChange={(e) => setSelectedContractId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-amber-500 transition-all cursor-pointer min-w-[200px]"
              >
                <option value="">-- اختر مستخلص --</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.subcontractor} ({c.project}) - مستخلص {c.statementNo}
                  </option>
                ))}
              </select>

              {/* Options Toggle for Accountant */}
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl no-print">
                <span className="text-[10px] font-bold text-slate-400 px-2">نمط الحساب:</span>
                <button
                  type="button"
                  onClick={() => setCertificateType('periodic')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                    certificateType === 'periodic'
                      ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
                >
                  دوري (Periodic) 📅
                </button>
                <button
                  type="button"
                  onClick={() => setCertificateType('cumulative')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                    certificateType === 'cumulative'
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
                >
                  تراكمي نهائي (Cumulative) 📈
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/30 text-amber-400 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء مستخلص عقد جديد 📅</span>
              </button>
            </div>

            {selectedContract && (
              <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleApproveAndArchive}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md"
                  title="اعتماد كشف المقاول وأرشفته تلقائياً"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>اعتماد المستخلص وأرشفته 🔒</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md no-print"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير المستخلص كـ Excel 📥</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md no-print"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة المستخلص 🖨️</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteContractDirect}
                  disabled={isDeleting}
                  className={`border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="حذف هذا العقد بالكامل"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Create Contract Form Box */}
          {showCreateForm && (
            <form onSubmit={handleCreateContract} className="bg-[#111827] border border-amber-500/20 rounded-2xl p-6 shadow-md grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="md:col-span-4 border-b border-slate-800 pb-2 mb-1">
                <h4 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider">إنشاء مستخلص عقد باطن جديد</h4>
              </div>

              <div className="md:col-span-4 bg-slate-900/40 border border-amber-500/10 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 mb-2">
                <div className="text-right">
                  <span className="text-xs font-bold text-amber-400 block mb-0.5">🚀 هل تريد ملء بيانات المستخلص تلقائياً بالذكاء الاصطناعي؟</span>
                  <p className="text-[10px] text-slate-400">ارفع مستخلص مقاول الباطن الورقي أو الرقمي وسيقوم Gemini OCR بقراءته وتعبئة الحقول فوراً.</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <AIModelSelector
                    useAdvanced={aiUseAdvanced}
                    setUseAdvanced={setAiUseAdvanced}
                    selectedModel={selectedAIModel}
                    setSelectedModel={setSelectedAIModel}
                  />
                  <label className={`bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0 ${isProcessingAI ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Upload className="w-4 h-4" />
                    <span>{isProcessingAI ? 'جاري معالجة المستند... ⏳' : 'رفع وتحليل بالذكاء الاصطناعي 🤖'}</span>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleSubcontractorOCR} disabled={isProcessingAI} />
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">اسم مقاول الباطن *</label>
                <input
                  type="text"
                  placeholder="مثال: شركة النور للخرسانات"
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">المشروع المرتبط بالعقد *</label>
                <select
                  value={newProj}
                  onChange={(e) => setNewProj(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500 cursor-pointer font-bold"
                >
                  <option value="">-- اختر المشروع --</option>
                  {projectsList.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">رقم المستخلص الحالي *</label>
                <input
                  type="text"
                  placeholder="مثال: 01"
                  value={newStatementNo}
                  onChange={(e) => setNewStatementNo(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">المهندس المشرف</label>
                <select
                  value={newSupervisor}
                  onChange={(e) => setNewSupervisor(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500 cursor-pointer font-bold"
                >
                  <option value="">-- اختر المهندس المشرف --</option>
                  {engineers.map(eng => (
                    <option key={eng.id} value={eng.name}>{eng.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">المحاسب المسؤول</label>
                <input
                  type="text"
                  value={newAccountant}
                  onChange={(e) => setNewAccountant(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-amber-400 font-bold block mb-1">الرصيد السابق المرحل تلقائياً (EGP)</label>
                <input
                  type="number"
                  value={newPrevBalance}
                  onChange={(e) => setNewPrevBalance(e.target.value)}
                  className="w-full bg-slate-900 border border-amber-500/40 text-amber-400 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-400 block mt-1">يتم جلبه آلياً من آخر مستخلص معتمد للمقاول</span>
              </div>

              <div className="md:col-span-4 flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  حفظ وتأسيس المستخلص
                </button>
              </div>
            </form>
          )}

          {selectedContract ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Form Entry Sideboards */}
              <div className="space-y-6">
                
                {/* 1. Add Work Item Form */}
                <form onSubmit={handleAddItem} className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4">
                  <h4 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800/60 pb-2">
                    <Plus className="w-4 h-4 text-amber-500" />
                    <span>إدخال بند عمل جديد (Work Item)</span>
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">بيان البند والعملية *</label>
                      <input
                        type="text"
                        placeholder="مثال: حفر وصب خرسانة عادية للأساسات"
                        value={itemDesc}
                        onChange={(e) => setItemDesc(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">الوحدة *</label>
                        <select
                          value={itemUnit}
                          onChange={(e) => setItemUnit(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-2 py-2 text-xs outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="متر مكعب">متر مكعب ㎥</option>
                          <option value="متر مربع">متر مربع ㎡</option>
                          <option value="متر طولي">متر طولي m</option>
                          <option value="طن">طن t</option>
                          <option value="مقطوعية">مقطوعية Lot</option>
                          <option value="يومية">يومية Day</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">الفئة المستحقة (EGP) *</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={itemRate}
                          onChange={(e) => setItemRate(e.target.value)}
                          required
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">كمية سابقة:</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={itemPrevQty}
                          onChange={(e) => setItemPrevQty(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-mono outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">كمية حالية *:</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={itemCurrQty}
                          onChange={(e) => setItemCurrQty(e.target.value)}
                          required
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-mono font-bold outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">المستحق (%):</label>
                        <input
                          type="number"
                          placeholder="100"
                          value={itemCompPercent}
                          onChange={(e) => setItemCompPercent(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-mono outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة البند لجدول المستخلص ➕</span>
                    </button>
                  </div>
                </form>

                {/* 2. Add Payment Form */}
                <form onSubmit={handleAddPayment} className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4">
                  <h4 className="text-xs font-extrabold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800/60 pb-2">
                    <DollarSign className="w-4 h-4 text-rose-500" />
                    <span>تسجيل دفعة مسحوبة للمقاول (Payment)</span>
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">البيان والسبب / رقم شيك الدفع *</label>
                      <input
                        type="text"
                        placeholder="مثال: دفعة تحت الحساب بشيك رقم 482910"
                        value={paymentDesc}
                        onChange={(e) => setPaymentDesc(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-rose-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">تاريخ صرف الدفعة:</label>
                        <input
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-rose-500 cursor-pointer font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">قيمة الدفعة (EGP) *</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          required
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-rose-600 hover:bg-rose-700 text-white py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>صرف وإدراج الدفعة المالية للمقاول 💸</span>
                    </button>
                  </div>
                </form>

              </div>

              {/* Main Subcontractor Certificate Work Sheet table layout */}
              <div className="lg:col-span-2 space-y-6">
                
                <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4">
                  <div className="border-b border-slate-850 pb-3 flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-white">كشف وجرد كميات مستخلص الباطن</h3>
                      <p className="text-[10px] text-slate-400 mt-1">مشروع: {selectedContract.project} | المهندس: {selectedContract.supervisor}</p>
                    </div>
                    <span className="bg-amber-950 text-amber-400 border border-amber-900/60 font-bold font-mono px-3 py-1 rounded-full text-xs">
                      مستخلص رقم: {selectedContract.statementNo}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse text-xs select-none">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-900/40">
                          <th className="py-2.5 px-2 text-right">بيان الأعمال (البند)</th>
                          <th className="py-2.5 px-1">وحدة</th>
                          <th className="py-2.5 px-1">الفئة</th>
                          <th className="py-2.5 px-1">سابق</th>
                          <th className="py-2.5 px-1">حالي</th>
                          <th className="py-2.5 px-1">إجمالي</th>
                          <th className="py-2.5 px-1">القيمة الإجمالية</th>
                          <th className="py-2.5 px-1">% المستحق</th>
                          <th className="py-2.5 px-1">قيمة المستحق</th>
                          <th className="py-2.5 px-1">إجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedContract.items.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-slate-500 font-bold">
                              لم يتم إدراج بنود جرد كميات في هذا المستخلص بعد.
                            </td>
                          </tr>
                        ) : (
                          selectedContract.items.map((item) => {
                            const prevQty = certificateType === 'cumulative'
                              ? precedingContracts.reduce((sum, c) => {
                                  const matchedItem = c.items.find(
                                    (it) => it.description.trim().toLowerCase() === item.description.trim().toLowerCase()
                                  );
                                  return sum + (matchedItem ? matchedItem.currentQty : 0);
                                }, 0)
                              : 0;
                            const totalQty = prevQty + item.currentQty;
                            const totalValue = totalQty * item.rate;
                            
                            const cumDue = totalValue * (item.completionPercent / 100);
                            const prevDue = prevQty * item.rate * (item.completionPercent / 100);
                            const dueValue = cumDue - prevDue;

                            return (
                              <tr key={item.id} className="border-b border-slate-850 hover:bg-slate-900/30 transition-colors font-medium">
                                <td className="py-3 px-2 text-right font-bold text-white max-w-[150px] truncate" title={item.description}>
                                  {item.description}
                                </td>
                                <td className="py-3 px-1 text-slate-400">{item.unit}</td>
                                <td className="py-3 px-1 font-mono text-slate-300">{item.rate.toLocaleString()}</td>
                                <td className="py-3 px-1 font-mono text-slate-400">{prevQty}</td>
                                <td className="py-3 px-1 font-mono text-white font-bold">{item.currentQty}</td>
                                <td className="py-3 px-1 font-mono text-amber-400 font-bold">{totalQty}</td>
                                <td className="py-3 px-1 font-mono text-slate-300">{totalValue.toLocaleString()}</td>
                                <td className="py-3 px-1 font-mono text-amber-500 font-bold">{item.completionPercent}%</td>
                                <td className="py-3 px-1 font-mono text-emerald-400 font-bold">{dueValue.toLocaleString()}</td>
                                <td className="py-3 px-1">
                                  <button
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="text-rose-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center bg-[#065f46]/10 border border-emerald-950/40 p-3 rounded-xl">
                    <span className="text-xs font-bold text-emerald-400">إجمالي قيمة المستحق من بنود الأعمال:</span>
                    <span className="text-base font-black text-emerald-400 font-mono">
                      {totalItemsValue.toLocaleString()} EGP
                    </span>
                  </div>
                </div>

                {/* Subcontractor Payments Subledger Statement table */}
                <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4">
                  <h3 className="text-sm font-bold text-white border-b border-slate-850 pb-3 flex justify-between items-center">
                    <span>دفتر الدفعات والمسحوبات المالية المسددة للمقاول</span>
                    <span className="text-[11px] text-slate-400 font-normal">المجموع التراكمي للعهد</span>
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse text-xs select-none">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-900/40">
                          <th className="py-2 px-2 text-right">تاريخ الدفعة</th>
                          <th className="py-2 px-2 text-right">البيان والملاحظات</th>
                          <th className="py-2 px-2">قيمة الدفعة (صرف)</th>
                          <th className="py-2 px-2">إجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedContract.payments.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-500 font-bold">
                              لم يتم تسجيل دفعات مسحوبة للمقاول بعد.
                            </td>
                          </tr>
                        ) : (
                          selectedContract.payments.map((p) => (
                            <tr key={p.id} className="border-b border-slate-850 hover:bg-slate-900/30 transition-colors font-medium">
                              <td className="py-2.5 px-2 text-right font-mono text-slate-400">{p.date}</td>
                              <td className="py-2.5 px-2 text-right text-slate-300 font-semibold">{p.description}</td>
                              <td className="py-2.5 px-2 font-mono text-rose-400 font-bold">{p.amount.toLocaleString()} EGP</td>
                              <td className="py-2.5 px-2">
                                <button
                                  onClick={() => handleDeletePayment(p.id)}
                                  className="text-rose-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-[#111827] border border-slate-800/80 p-4 rounded-2xl shadow-sm space-y-2.5">
                    {certificateType === 'cumulative' ? (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">إجمالي مستحق الأعمال التراكمي (Cumulative):</span>
                          <span className="font-mono text-cyan-400 font-bold">+{cumulativeItemsValue.toLocaleString()} EGP</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">قيمة الأعمال السابقة المعتمدة (Previous):</span>
                          <span className="font-mono text-slate-400">-{previousItemsValue.toLocaleString()} EGP</span>
                        </div>
                        <div className="flex justify-between items-center text-xs border-b border-slate-850 pb-1.5">
                          <span className="text-slate-300 font-bold">صافي مستحق مستخلص الأعمال الحالي (Net Current):</span>
                          <span className="font-mono text-emerald-400 font-extrabold">+{totalItemsValue.toLocaleString()} EGP</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">إجمالي دفعات المقاول التراكمية (Prev + Curr Paid):</span>
                          <span className="font-mono text-rose-500">-{totalCumulativePayments.toLocaleString()} EGP</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">منها مبالغ سابق صرفها (Previous Paid):</span>
                          <span className="font-mono text-slate-400">-{previousPaidAmount.toLocaleString()} EGP</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">العهد والدفعات الجديدة بهذا الكشف:</span>
                          <span className="font-mono text-rose-400 font-bold">-{totalPayments.toLocaleString()} EGP</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">إجمالي مستحق أعمال المقاول الباطن:</span>
                          <span className="font-mono text-emerald-400 font-bold">+{totalItemsValue.toLocaleString()} EGP</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">إجمالي الدفعات والمسحوبات الجديدة:</span>
                          <span className="font-mono text-rose-400 font-bold">-{totalPayments.toLocaleString()} EGP</span>
                        </div>
                      </>
                    )}
                    {selectedContract.previousBalance !== undefined && selectedContract.previousBalance !== 0 && (
                      <div className="flex justify-between items-center text-xs border-t border-slate-850 pt-1.5">
                        <span className="text-slate-400">الرصيد السابق المرحل (من الكشف السابق):</span>
                        <span className={`font-mono font-bold ${selectedContract.previousBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {selectedContract.previousBalance >= 0 ? '+' : ''}{selectedContract.previousBalance.toLocaleString()} EGP
                        </span>
                      </div>
                    )}
                    <div className="border-t-2 border-dashed border-slate-800 my-2 pt-2 flex justify-between items-center text-sm">
                      <span className="font-black text-white">الصافي النهائي المستحق للمقاول (Net Remaining Balance):</span>
                      <span className={`font-mono font-black text-base ${netRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {netRemaining.toLocaleString()} EGP
                      </span>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          ) : (
            <div className="bg-[#111827] border border-slate-800 p-12 rounded-2xl shadow-md text-center">
              <span className="text-xs text-slate-500 font-bold block mb-4">
                لا توجد مستخلصات مقاولي باطن مسجلة حالياً في النظام.
              </span>
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 rounded-xl text-xs font-bold cursor-pointer"
              >
                قم بإنشاء أول مستخلص للمقاولين الآن 📑
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'archive' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Subcontractor Directory Explorer */}
          <div className="bg-[#111827] border border-slate-800 p-5 rounded-2xl shadow-md space-y-4">
            <h3 className="text-xs font-extrabold text-amber-500 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <Folder className="w-4 h-4 text-amber-500" />
              <span>مجلد مستخلصات المقاولين (Subcontractor Archive)</span>
            </h3>

            <div className="space-y-1.5">
              <button
                onClick={() => setSelectedFolder(null)}
                className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  selectedFolder === null
                    ? 'bg-amber-600/10 text-amber-400 border border-amber-500/20'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <span>عرض الكل (All Folders)</span>
              </button>

              {subcontractorFolders.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setSelectedFolder(f.name)}
                  className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                    selectedFolder === f.name
                      ? 'bg-amber-600/10 text-amber-400 border border-amber-500/20'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedFolder === f.name ? (
                      <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span className="truncate">{f.name}</span>
                  </div>
                  <span className="bg-slate-800 text-slate-400 font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                    {f.files.length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Files hub & file dynamic manual upload */}
          <div className="lg:col-span-3 space-y-6">
            
            <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md">
              <div className="border-b border-slate-850 pb-4 mb-4 flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FolderOpen className="text-amber-500 w-4 h-4" />
                    <span>تصفح مستندات مجلد المقاول:</span>
                    <span className="text-amber-400 font-black">{selectedFolder || 'الكل (All Folders)'}</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    المستخلصات المعتمدة ودفاتر الأعمال والاتفاقيات المحفوظة بنظام الأرشفة
                  </p>
                </div>

                {/* File Upload Zone */}
                {selectedFolder && (
                  <label className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع مستند يدوي للمجلد 📤</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleManualArchiveUpload(e, selectedFolder)}
                      accept="image/*,application/pdf,.pdf,.xlsx,.xls"
                    />
                  </label>
                )}
              </div>

              {/* Subcontractor Files Directory */}
              {subcontractorFolders.length === 0 || (selectedFolder && subcontractorFolders.find(f => f.name === selectedFolder)?.files.length === 0) ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-bold">لا توجد ملفات مؤرشفة في هذا المجلد بعد</p>
                  <p className="text-[10px] text-slate-400">قم باعتماد مستخلص المقاول أو ارفع المستندات يدوياً ليتم أرشفتها وحفظها هنا بشكل آمن</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {subcontractorFolders
                    .filter(f => selectedFolder === null || f.name === selectedFolder)
                    .flatMap(f => f.files)
                    .map((file) => (
                      <div 
                        key={file.id} 
                        className="bg-[#0b0f19]/40 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-4 hover:border-slate-700 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 bg-amber-950/40 text-amber-500 rounded-lg shrink-0">
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-white block truncate" title={file.name}>
                              {file.name}
                            </span>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                              <span>{file.date}</span>
                              <span>•</span>
                              <span>{file.size}</span>
                              {file.statementNo && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-500 font-bold">مستخلص {file.statementNo}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDownloadArchiveFile(file)}
                            className="bg-amber-600/10 hover:bg-amber-600/25 text-amber-400 p-2 rounded-lg transition-colors cursor-pointer"
                            title="تحميل الملف المؤرشف"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteArchiveFile(file.id)}
                            className="text-rose-500 hover:bg-rose-500/10 p-2 rounded-lg transition-colors cursor-pointer"
                            title="حذف الملف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

            </div>

          </div>

        </div>
      )}
      </div>

      {/* Subcontractor Certificate Portrait Print Layout */}
      {selectedContract && (
        <div className="hidden print:block w-full text-black font-sans portrait-print animate-in fade-in duration-300" dir="rtl" style={{ fontFamily: 'Arial' }}>
          <div className="border-4 border-dashed border-[#4F81BD] p-6 bg-white space-y-6 outer-print-container">
            
            {/* Header / Title Banner */}
            <div className="text-center pb-4 border-b-2 border-dashed border-[#4F81BD]">
              <h2 className="text-2xl font-black text-[#1F4E78]">كشف مستخلص مقاول الباطن (دفعة جاري الأعمال)</h2>
            </div>

            {/* Contract Meta Block */}
            <div className="grid grid-cols-2 gap-4 text-xs font-bold border-2 border-dashed border-[#4F81BD] p-4 bg-[#F2F6FA] text-[#1F4E78]">
              <div>
                <span className="text-slate-500 block">اسم مقاول الباطن:</span>
                <span className="text-sm font-black text-slate-900">{selectedContract.subcontractor}</span>
              </div>
              <div>
                <span className="text-slate-500 block">المشروع المرتبط:</span>
                <span className="text-sm font-black text-slate-900">{selectedContract.project}</span>
              </div>
              <div>
                <span className="text-slate-500 block">رقم المستخلص:</span>
                <span className="text-sm font-black text-slate-900">مستخلص رقم {selectedContract.statementNo}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 block">المهندس المشرف:</span>
                  <span className="text-slate-900">{selectedContract.supervisor || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">المحاسب المسؤول:</span>
                  <span className="text-slate-900">{selectedContract.accountant || '-'}</span>
                </div>
              </div>
            </div>

            {/* Work Items Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-[#1F4E78]">أولاً: كشف جرد وكميات الأعمال المعتمدة</h4>
              <table className="w-full text-center border-2 border-dashed border-[#4F81BD] border-collapse text-[10px]">
                <thead>
                  <tr className="border-b-2 border-dashed border-[#4F81BD] text-[#1F4E78] bg-[#D9E1F2] font-black">
                    <th className="py-2 border-e-2 border-dashed border-[#4F81BD]">بيان الأعمال (البند)</th>
                    <th className="py-2 border-e-2 border-dashed border-[#4F81BD]">وحدة</th>
                    <th className="py-2 border-e-2 border-dashed border-[#4F81BD]">الفئة</th>
                    <th className="py-2 border-e-2 border-dashed border-[#4F81BD]">سابق</th>
                    <th className="py-2 border-e-2 border-dashed border-[#4F81BD]">حالي</th>
                    <th className="py-2 border-e-2 border-dashed border-[#4F81BD]">إجمالي</th>
                    <th className="py-2 border-e-2 border-dashed border-[#4F81BD]">القيمة الإجمالية</th>
                    <th className="py-2 border-e-2 border-dashed border-[#4F81BD]">% المستحق</th>
                    <th className="py-2">قيمة المستحق</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedContract.items.length === 0 ? (
                    <tr className="border-b-2 border-dashed border-[#4F81BD]">
                      <td colSpan={9} className="py-4 text-center text-slate-500 font-bold">لم يتم إدراج بنود جرد بعد.</td>
                    </tr>
                  ) : (
                    selectedContract.items.map((item) => {
                      const prevQty = certificateType === 'cumulative'
                        ? precedingContracts.reduce((sum, c) => {
                            const matchedItem = c.items.find(
                              (it) => it.description.trim().toLowerCase() === item.description.trim().toLowerCase()
                            );
                            return sum + (matchedItem ? matchedItem.currentQty : 0);
                          }, 0)
                        : 0;
                      const totalQty = prevQty + item.currentQty;
                      const totalValue = totalQty * item.rate;
                      
                      const cumDue = totalValue * (item.completionPercent / 100);
                      const prevDue = prevQty * item.rate * (item.completionPercent / 100);
                      const dueValue = cumDue - prevDue;

                      return (
                        <tr key={item.id} className="border-b-2 border-dashed border-[#4F81BD] font-medium text-slate-800">
                          <td className="py-2 px-1 text-right border-e-2 border-dashed border-[#4F81BD] font-bold">{item.description}</td>
                          <td className="py-2 border-e-2 border-dashed border-[#4F81BD]">{item.unit}</td>
                          <td className="py-2 border-e-2 border-dashed border-[#4F81BD] font-mono">{item.rate.toLocaleString()} EGP</td>
                          <td className="py-2 border-e-2 border-dashed border-[#4F81BD] font-mono">{prevQty}</td>
                          <td className="py-2 border-e-2 border-dashed border-[#4F81BD] font-mono font-bold text-slate-900">{item.currentQty}</td>
                          <td className="py-2 border-e-2 border-dashed border-[#4F81BD] font-mono font-bold text-amber-600">{totalQty}</td>
                          <td className="py-2 border-e-2 border-dashed border-[#4F81BD] font-mono">{totalValue.toLocaleString()} EGP</td>
                          <td className="py-2 border-e-2 border-dashed border-[#4F81BD] font-mono font-bold text-amber-600">{item.completionPercent}%</td>
                          <td className="py-2 font-mono font-bold text-emerald-600 text-left px-2">{dueValue.toLocaleString()} EGP</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Payments Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-rose-700">ثانياً: دفتر الدفعات والمسحوبات المالية المصروفة</h4>
              <table className="w-full text-center border-2 border-dashed border-[#4F81BD] border-collapse text-[10px]">
                <thead>
                  <tr className="border-b-2 border-dashed border-[#4F81BD] text-rose-700 bg-rose-50 font-black">
                    <th className="py-2 border-e-2 border-dashed border-[#4F81BD] text-right px-2">تاريخ الدفعة</th>
                    <th className="py-2 border-e-2 border-dashed border-[#4F81BD] text-right px-2">البيان والملاحظات</th>
                    <th className="py-2 text-left px-2">قيمة الدفعة (صرف)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedContract.payments.length === 0 ? (
                    <tr className="border-b-2 border-dashed border-[#4F81BD]">
                      <td colSpan={3} className="py-4 text-center text-slate-500 font-bold">لم يتم تسجيل دفعات مسحوبة بعد.</td>
                    </tr>
                  ) : (
                    selectedContract.payments.map((p) => (
                      <tr key={p.id} className="border-b-2 border-dashed border-[#4F81BD] font-medium text-slate-800">
                        <td className="py-2 px-2 text-right border-e-2 border-dashed border-[#4F81BD] font-mono">{p.date}</td>
                        <td className="py-2 px-2 text-right border-e-2 border-dashed border-[#4F81BD] font-bold text-slate-700">{p.description}</td>
                        <td className="py-2 font-mono font-bold text-rose-600 text-left px-2">{p.amount.toLocaleString()} EGP</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary Box */}
            <div className="border-2 border-dashed border-[#4F81BD] p-4 rounded-xl bg-[#F2F6FA] text-xs font-bold space-y-2">
              {certificateType === 'cumulative' ? (
                <>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>إجمالي قيمة الأعمال التراكمية (Cumulative Value):</span>
                    <span className="font-mono text-[#1F4E78] text-sm">+{cumulativeItemsValue.toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>قيمة الأعمال السابقة المعتمدة (Previous Approved):</span>
                    <span className="font-mono text-slate-500 text-sm">-{previousItemsValue.toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700 border-b border-dashed border-[#4F81BD] pb-1.5">
                    <span>صافي قيمة بنود الأعمال الحالية (Net Current Value):</span>
                    <span className="font-mono text-emerald-600 text-sm font-black">+{totalItemsValue.toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>إجمالي دفعات المقاول التراكمية (Total Cumulative Paid):</span>
                    <span className="font-mono text-rose-600 text-sm">-{totalCumulativePayments.toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>منها دفعات سابق صرفها (Previous Paid):</span>
                    <span className="font-mono text-slate-500 text-sm">-{previousPaidAmount.toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>العهد والدفعات الجديدة بهذا الكشف (Current Paid):</span>
                    <span className="font-mono text-rose-600 text-sm">-{totalPayments.toLocaleString()} EGP</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>إجمالي قيمة بنود الأعمال المعتمدة:</span>
                    <span className="font-mono text-emerald-600 text-sm">+{totalItemsValue.toLocaleString()} EGP</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700">
                    <span>إجمالي الدفعات والخصومات الجديدة:</span>
                    <span className="font-mono text-rose-600 text-sm">-{totalPayments.toLocaleString()} EGP</span>
                  </div>
                </>
              )}
              {selectedContract.previousBalance !== undefined && selectedContract.previousBalance !== 0 && (
                <div className="flex justify-between items-center text-slate-700 border-t border-dashed border-[#4F81BD] pt-1.5">
                  <span>الرصيد السابق المرحل (من المستخلص السابق):</span>
                  <span className={`font-mono text-sm ${selectedContract.previousBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {selectedContract.previousBalance >= 0 ? '+' : ''}{selectedContract.previousBalance.toLocaleString()} EGP
                  </span>
                </div>
              )}
              <div className="border-t-2 border-dashed border-[#4F81BD] pt-2 flex justify-between items-center text-sm font-black text-[#1F4E78] bg-[#D9E1F2]/50 px-2 py-1 rounded">
                <span>الصافي المتبقي للمقاول (الرصيد النهائي):</span>
                <span className={`font-mono text-base ${netRemaining >= 0 ? 'text-[#375623]' : 'text-rose-700'}`}>
                  {netRemaining.toLocaleString()} EGP
                </span>
              </div>
            </div>

            {/* Signature Blocks */}
            <div className="grid grid-cols-3 gap-4 text-center text-xs font-bold pt-8">
              <div className="space-y-6">
                <span>المهندس المشرف</span>
                <div className="border-b-2 border-dotted border-[#4F81BD] mx-auto w-32"></div>
                <span className="text-[10px] text-slate-500">{selectedContract.supervisor || '-'}</span>
              </div>
              <div className="space-y-6">
                <span>المحاسب المسؤول</span>
                <div className="border-b-2 border-dotted border-[#4F81BD] mx-auto w-32"></div>
                <span className="text-[10px] text-slate-500">{selectedContract.accountant || '-'}</span>
              </div>
              <div className="space-y-6">
                <span>اعتماد إدارة الشركة</span>
                <div className="border-b-2 border-dotted border-[#4F81BD] mx-auto w-32"></div>
                <span className="text-[10px] text-slate-500">مكتب المراجعة والتدقيق</span>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

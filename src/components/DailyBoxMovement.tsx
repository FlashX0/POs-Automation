import { AIModelSelector } from "./AIModelSelector";
import { SafeInput } from "./SafeInput";
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Download, Plus, Trash2, Calendar, DollarSign, CheckCircle, RefreshCw, Layers, TrendingUp, TrendingDown, Upload, AlertCircle, Printer, User, FileText, Eye, ChevronDown, Settings, Check, X, Edit } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { calculateLedgerBalances, calculateInflow, calculateOutflow } from '../utils/ledgerUtils';

interface Transaction {
  id: string;
  inflow: number;
  outflow: number;
  description: string;
  method: string;
  project: string;
  attachment?: string;
  attachmentName?: string;
  status?: 'unapproved' | 'approved' | 'draft';
  linkedSubcontractorName?: string;
}

interface BoxDay {
  date: string;
  transactions: Transaction[];
  startingBalanceOverride?: number;
  engineer?: string;
}

interface PendingTransaction {
  id: string;
  inflow: number;
  outflow: number;
  description: string;
  method: string;
  project: string;
  status: string;
  date: string;
}

interface DailyBoxMovementProps {
  projectsList: string[];
  boxDays: BoxDay[];
  onSave: (updatedBoxDays: BoxDay[]) => void;
  pendingTransactions?: PendingTransaction[];
  onSavePending?: (updatedPending: PendingTransaction[]) => void;
  onNotify?: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  engineers?: { id: string; name: string; project: string; initialBalance?: number }[];
  currentUser?: any;
  subcontractorContracts?: any[];
  onResetSuccess?: () => void;
}

export const DailyBoxMovement: React.FC<DailyBoxMovementProps> = ({
  projectsList,
  boxDays,
  onSave,
  pendingTransactions = [],
  onSavePending = (updatedPending) => {},
  onNotify = (type, title, message) => {},
  engineers = [],
  currentUser,
  subcontractorContracts = [],
  onResetSuccess,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [useAdvancedAI, setUseAdvancedAI] = useState(false);
  const formatCurrency = (val: number): string => {
    if (val < 0) {
      const positiveVal = Math.abs(val);
      return `(${positiveVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPrintCurrency = (val: number): string => {
    const absVal = Math.abs(val);
    const formatted = absVal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    if (val < 0) {
      return `${formatted}-`;
    }
    return formatted;
  };

  const [selectedEngineer, setSelectedEngineer] = useState<string>(
    engineers.length > 0 ? engineers[0].name : ''
  );
  const [printStyle, setPrintStyle] = useState<'solid' | 'modern' | 'minimal'>('solid');
  const [pendingAttachmentPath, setPendingAttachmentPath] = useState<string>('');
  const [pendingAttachmentName, setPendingAttachmentName] = useState<string>('');

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  // --- Unified AI Multimodal Parser Modal States ---
  const [showAIModal, setShowAIModal] = useState<boolean>(false);
  const [selectedAIModel, setSelectedAIModel] = useState<string>('gpt-5.6-luna');
  const [useMemory, setUseMemory] = useState<boolean>(false);
  const [selectedAIFile, setSelectedAIFile] = useState<File | null>(null);
  const [aiFilePreview, setAiFilePreview] = useState<string | null>(null);
  const [isProcessingAIUnified, setIsProcessingAIUnified] = useState<boolean>(false);
  const [aiModalMonth, setAiModalMonth] = useState<string>('');

  // --- Inline Edit States for Unapproved Transactions ---
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingTxDate, setEditingTxDate] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editProject, setEditProject] = useState<string>('');
  const [editMethod, setEditMethod] = useState<string>('');
  const [editInflow, setEditInflow] = useState<string>('');
  const [editOutflow, setEditOutflow] = useState<string>('');

  // Clipboard paste listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!showAIModal) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            setSelectedAIFile(file);
            setAiFilePreview(URL.createObjectURL(file));
            onNotify('info', 'تم التقاط الصورة من الحافظة 📋', `تم التعرف على لقطة الشاشة المنسوخة: ${file.name || 'screenshot.png'}`);
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [showAIModal]);

  const handleFileSelection = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const allowed = ['xlsx', 'xls', 'csv', 'png', 'jpg', 'jpeg'];
    if (!ext || !allowed.includes(ext)) {
      onNotify('error', 'صيغة ملف غير صالحة', 'يُرجى رفع ملف إكسيل (.xlsx, .xls) أو ملف CSV، أو صورة (.png, .jpg, .jpeg) فقط.');
      return;
    }
    setSelectedAIFile(file);
    if (file.type.startsWith('image/')) {
      setAiFilePreview(URL.createObjectURL(file));
    } else {
      setAiFilePreview(null);
    }
  };

  const handleAIUnifiedProcess = async () => {
    if (!aiModalMonth) {
      onNotify('warning', 'تنبيه', 'الرجاء اختيار الشهر والسن المستهدفة أولاً!');
      return;
    }
    if (!selectedAIFile) {
      onNotify('warning', 'تنبيه', 'الرجاء رفع ملف إكسيل أو صورة عهدة أولاً!');
      return;
    }

    setIsProcessingAIUnified(true);
    onNotify('info', 'جاري تشغيل المعالج الذكي الشامل ⚡', 'يتم استخراج وتحليل حركات العهدة باستخدام قوالب التعلم الذاتي والذكاء الاصطناعي...');
    
    const formData = new FormData();
    formData.append('file', selectedAIFile);
    formData.append('selected_month', aiModalMonth);
    formData.append('engineerName', selectedEngineer || 'عام');
    formData.append('selectedAIModel', selectedAIModel);
    formData.append('useMemory', useMemory ? 'true' : 'false');
    formData.append("useAdvanced", useAdvancedAI ? "true" : "false");

    try {
      const res = await fetch('/api/custody/analyze-multimodal', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          onNotify('success', 'نجاح المعالج الذكي الشامل ⚡', 'تم استخراج الحركات بنجاح وعرضها كمسودات غير معتمدة!');
          onSave(data.pettyCashBoxDays);
          setShowAIModal(false);
          setSelectedAIFile(null);
          setAiFilePreview(null);
        } else {
          onNotify('error', 'فشل المعالجة بالذكاء الاصطناعي', data.error || 'حدث خطأ ما.');
        }
      } else {
        onNotify('error', 'خطأ في الاتصال', 'فشل الاتصال بالخادم لمعالجة العهدة بالذكاء الاصطناعي.');
      }
    } catch (err: any) {
      onNotify('error', 'خطأ', err.message || 'حدث خطأ أثناء معالجة المستند.');
    } finally {
      setIsProcessingAIUnified(false);
    }
  };

  const handleSaveEditedTransaction = async () => {
    if (!editingTxId) return;

    try {
      const res = await fetch('/api/engineers/ledger/update-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerName: selectedEngineer || 'عام',
          date: editingTxDate,
          txId: editingTxId,
          description: editDescription,
          project: editProject,
          method: editMethod,
          inflow: parseFloat(editInflow) || 0,
          outflow: parseFloat(editOutflow) || 0
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          onSave(data.pettyCashBoxDays);
          onNotify('success', 'تم تعديل الحركة بنجاح 🎉', data.autoTrained ? 'تم حفظ التعديل وتدريب محرك الذكاء الاصطناعي بنجاح!' : 'تم التحديث بنجاح.');
          setEditingTxId(null);
        } else {
          onNotify('error', 'فشل تعديل الحركة', data.error || 'حدث خطأ ما.');
        }
      } else {
        onNotify('error', 'خطأ في الاتصال', 'فشل الاتصال بالخادم لتعديل الحركة.');
      }
    } catch (err: any) {
      onNotify('error', 'خطأ', err.message || 'حدث خطأ غير متوقع.');
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Form states
  const [inflow, setInflow] = useState<string>('');
  const [outflow, setOutflow] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [method, setMethod] = useState<string>('انستاباي');
  const [project, setProject] = useState<string>('');
  const [editingStartingBalance, setEditingStartingBalance] = useState<boolean>(false);
  const [linkedSubcontractor, setLinkedSubcontractor] = useState<string>('');
  const [startingBalanceInput, setStartingBalanceInput] = useState<string>('0');

  // Date Range Approval Modal States & Helper
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [approvalStartDate, setApprovalStartDate] = useState<string>('');
  const [approvalEndDate, setApprovalEndDate] = useState<string>('');

  const getWeekRange = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        const todayStr = new Date().toISOString().split('T')[0];
        return { start: todayStr, end: todayStr };
      }
      const day = date.getDay(); // 0 is Sunday, 1 is Monday... 6 is Saturday
      // Saturday is the start of the week in construction/local projects. Distance from Saturday:
      const diffToSaturday = day === 6 ? 0 : (day + 1);
      const start = new Date(date);
      start.setDate(date.getDate() - diffToSaturday);
      
      const end = new Date(start);
      end.setDate(start.getDate() + 6); // End of week is Friday
      
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      };
    } catch (e) {
      const todayStr = new Date().toISOString().split('T')[0];
      return { start: todayStr, end: todayStr };
    }
  };

  // Sort box days chronologically to compute cumulative balances
  const sortedDays = useMemo(() => {
    return [...boxDays]
      .filter((d) => !selectedEngineer || d.engineer === selectedEngineer)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [boxDays, selectedEngineer]);

  const defaultInitialBalance = useMemo(() => {
    const engObj = engineers?.find(e => e.name === selectedEngineer);
    return engObj?.initialBalance !== undefined ? engObj.initialBalance : -177656;
  }, [engineers, selectedEngineer]);

  // Unified helper to compute starting/ending balances for all days
  const computedDaysWithBalances = useMemo(() => {
    const formattedDays = sortedDays.map(d => ({
      date: d.date,
      engineer: d.engineer,
      startingBalanceOverride: d.startingBalanceOverride,
      transactions: (d.transactions || []).map(t => ({
        id: t.id,
        inflow: Number(t.inflow) || 0,
        outflow: Number(t.outflow) || 0,
        description: t.description,
        method: t.method,
        project: t.project,
        status: (t.status === 'approved' ? 'approved' : 'unapproved') as 'approved' | 'unapproved',
        attachment: t.attachment,
        attachmentName: t.attachmentName
      }))
    }));
    return calculateLedgerBalances(formattedDays, defaultInitialBalance);
  }, [sortedDays, defaultInitialBalance]);

  // Find index of selected date
  const selectedDayIndex = useMemo(() => {
    return sortedDays.findIndex((d) => d.date === selectedDate);
  }, [sortedDays, selectedDate]);

  // Calculate starting balance of the selected date
  const computedStartingBalance = useMemo(() => {
    const matchedDay = computedDaysWithBalances.find(d => d.date === selectedDate);
    if (matchedDay) {
      return matchedDay.computedStartingBalance;
    }
    if (sortedDays.length === 0) {
      return defaultInitialBalance;
    }
    const daysBefore = computedDaysWithBalances.filter(d => d.date < selectedDate);
    if (daysBefore.length > 0) {
      return daysBefore[daysBefore.length - 1].computedEndingBalance;
    }
    return defaultInitialBalance;
  }, [computedDaysWithBalances, selectedDate, defaultInitialBalance]);

  // Current day data
  const currentDay = useMemo(() => {
    return boxDays.find((d) => d.date === selectedDate && (!selectedEngineer || d.engineer === selectedEngineer)) || {
      date: selectedDate,
      engineer: selectedEngineer || "عام",
      transactions: [],
    };
  }, [boxDays, selectedDate, selectedEngineer]);

  const transactions = currentDay.transactions;

  const totalInflow = useMemo(() => {
    return calculateInflow(transactions as any);
  }, [transactions]);

  const totalOutflow = useMemo(() => {
    return calculateOutflow(transactions as any);
  }, [transactions]);

  const endingBalance = useMemo(() => {
    return computedStartingBalance + totalInflow - totalOutflow;
  }, [computedStartingBalance, totalInflow, totalOutflow]);

  // Handlers
  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert('الرجاء إدخال البيان!');
      return;
    }

    // Process the pending attachment path if present
    let finalAttachmentPath = '';
    if (pendingAttachmentPath) {
      try {
        const orgRes = await fetch('/api/ai/organize-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tempPath: pendingAttachmentPath,
            originalName: pendingAttachmentName,
            type: 'petty_cash',
            metadata: {
              engineer: selectedEngineer || 'عام',
              project: project || 'عام',
              date: selectedDate
            }
          })
        });
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          if (orgData.success) {
            finalAttachmentPath = orgData.organizedPath;
          }
        }
      } catch (err) {
        console.error("Failed to organize uploaded file:", err);
      }
    }

    try {
      const res = await fetch('/api/engineers/ledger/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerName: selectedEngineer || 'عام',
          date: selectedDate,
          inflow: parseFloat(inflow) || 0,
          outflow: parseFloat(outflow) || 0,
          description: description.trim(),
          method: method.trim() || 'نقدي',
          project: project,
          attachment: finalAttachmentPath || undefined,
          attachmentName: pendingAttachmentName || undefined,
          linkedSubcontractorName: linkedSubcontractor || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.pettyCashBoxDays) {
          onSave(data.pettyCashBoxDays);
          onNotify("success", "تم الحفظ", "تم تسجيل الحركة بنجاح في قاعدة البيانات!");
        }
      }
    } catch (err) {
      console.error("Failed to insert transaction to DB:", err);
      onNotify("error", "خطأ", "فشل في تسجيل الحركة في قاعدة البيانات");
    }

    setInflow('');
    setOutflow('');
    setDescription('');
    setPendingAttachmentPath('');
    setPendingAttachmentName('');
  };

  const handleDeleteTransaction = async (txId: string) => {
    try {
      const res = await fetch('/api/engineers/ledger/delete-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerName: selectedEngineer || 'عام',
          date: selectedDate,
          txId: txId
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.pettyCashBoxDays) {
          onSave(data.pettyCashBoxDays);
          onNotify("success", "تم الحذف", "تم حذف الحركة بنجاح من قاعدة البيانات!");
        }
      }
    } catch (err) {
      console.error("Failed to delete transaction from DB:", err);
      onNotify("error", "خطأ", "حدث خطأ أثناء محاولة حذف الحركة");
    }
  };

    const handleUpdateStartingBalance = async (e?: any) => {
    const rawVal = e && e.target ? e.target.value : startingBalanceInput;
    const val = parseFloat(rawVal) || 0;
    if (e && e.target) setStartingBalanceInput(rawVal);
    const engineerName = selectedEngineer || 'عام';
    const nowStr = new Date().toISOString();
    
    // Optimistically update local state with timestamp
    let updatedDays = [...boxDays];
    let dayIndex = updatedDays.findIndex(d => d.date === selectedDate && (d.engineer || 'عام') === engineerName);
    if (dayIndex >= 0) {
      updatedDays[dayIndex] = { ...updatedDays[dayIndex], startingBalanceOverride: val, updatedAt: nowStr };
    } else {
      updatedDays.push({
        date: selectedDate,
        engineer: engineerName,
        startingBalanceOverride: val,
        transactions: [],
        updatedAt: nowStr
      });
    }
    onSave(updatedDays);

    try {
      const res = await fetch('/api/engineers/ledger/update-starting-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerName,
          date: selectedDate,
          startingBalanceOverride: val
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.pettyCashBoxDays) {
          // Explicitly save the newly returned petty cash box days from the server to local state
          onSave(data.pettyCashBoxDays);
          onNotify("success", "تم التحديث", "تم تحديث الرصيد الافتتاحي في قاعدة البيانات!");
          if (onResetSuccess) {
            onResetSuccess();
          }
        }
      }
    } catch (err) {
      console.error("Failed to update starting balance in DB:", err);
      onNotify("error", "خطأ", "فشل في تحديث الرصيد الافتتاحي");
    }
    setEditingStartingBalance(false);
  };

  const [isSavingLedger, setIsSavingLedger] = useState(false);

  const syncAndLoadFromDb = async () => {
    // Prevent automated sync if the user is currently editing the starting balance
    if (editingStartingBalance) {
      console.log("[Sync Guard] Bypassing automatic DB synchronization because starting balance edit is active.");
      return;
    }
    try {
      // Fetch latest global financial data
      const finRes = await fetch('/api/financial-data');
      if (finRes.ok) {
        const finData = await finRes.json();
        if (finData.success && finData.pettyCashBoxDays) {
          onSave(finData.pettyCashBoxDays);
        }
      }
    } catch (err) {
      console.error("Failed to sync daily box movement with DB on change:", err);
    }
  };

  useEffect(() => {
    if (!editingStartingBalance) {
      syncAndLoadFromDb();
    }
  }, [selectedEngineer, selectedDate, editingStartingBalance]);

  const handleConfirmLedgerRange = async () => {
    if (!selectedEngineer) {
      alert("الرجاء اختيار المهندس أولاً!");
      return;
    }
    if (!approvalStartDate || !approvalEndDate) {
      alert("الرجاء تحديد الفترة الزمنية بالكامل!");
      return;
    }

    const confirmMsg = `هل أنت متأكد من إغلاق واعتماد كافة حركات العهدة من تاريخ [${approvalStartDate}] إلى تاريخ [${approvalEndDate}]؟ لا يمكن التعديل عليها بعد الاعتماد.`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsSavingLedger(true);
    try {
      const res = await fetch("/api/engineers/ledger/approve-range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engineerName: selectedEngineer,
          startDate: approvalStartDate,
          endDate: approvalEndDate
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          onSave(data.pettyCashBoxDays);
          onNotify("success", "تم الاعتماد بالفترة بنجاح ✅", data.message);
          setShowApprovalModal(false);
        } else {
          onNotify("error", "فشل الاعتماد", data.error || "حدث خطأ");
        }
      } else {
        onNotify("error", "فشل الاتصال", "فشل الاتصال بالسيرفر لاعتماد العهدة");
      }
    } catch (err) {
      console.error(err);
      onNotify("error", "خطأ", "حدث خطأ غير متوقع أثناء اعتماد العهدة");
    } finally {
      setIsSavingLedger(false);
    }
  };

  const handleConfirmLedger = async () => {
    // Legacy fallback, opens the modal now
    const range = getWeekRange(selectedDate);
    setApprovalStartDate(range.start);
    setApprovalEndDate(range.end);
    setShowApprovalModal(true);
  };

  const handleResetLedger = async () => {
    if (!selectedEngineer) {
      alert("الرجاء اختيار المهندس أولاً!");
      return;
    }
    if (!window.confirm(`هل أنت متأكد من تصفير وإعادة تعيين حركة الحسابات بالكامل للمهندس (${selectedEngineer})؟ سيتم حذف جميع الحركات الحالية والبدء على مياه بيضاء ونظيفة.`)) {
      return;
    }
    try {
      const res = await fetch("/api/engineers/ledger/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engineerName: selectedEngineer
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          onNotify("success", "تم التصفير والبدء على مياه بيضاء", "تم تصفير وإعادة تعيين الحركات للمهندس بنجاح!");
          // Update local state immediately before doing any refetching
          const updated = boxDays.filter(d => d.engineer !== selectedEngineer);
          onSave(updated);
          if (onResetSuccess) {
            onResetSuccess();
          }
        } else {
          onNotify("error", "فشل التصفير", data.error || "حدث خطأ");
        }
      }
    } catch (err) {
      console.error(err);
      onNotify("error", "خطأ", "حدث خطأ أثناء تصفير العهدة");
    }
  };

  // Excel Export with formulas - Custom format matching image_282819.png with blue dashed borders
  const handleExportExcel = () => {
    const rows: any[][] = [];
    const merges: any[] = [];
    
    // Title Row
    rows.push(["كشف حركة الصندوق اليومية وعهد المهندسين", "", "", ""]);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
    rows.push(["", "", "", ""]); // empty divider
    
    let currentExcelRow = 2; // 0-indexed in rows (Excel row 3)
    let prevEndingBalanceRowIdx: number | null = null;
    
    // Stacking all logged days to match the format of image_282819.png
    computedDaysWithBalances.forEach((day, dayIdx) => {
      // Calculate starting balance for this day
      const startingBal = day.computedStartingBalance;
      
      const dayTransactions = day.transactions;
      
      // Row 1: Header Row for Day
      // Col A: Date formatted as DD - MM - YY
      // Col B, C, D merged: كشف حركة الصندوق ليوم
      const dateParts = day.date.split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]} - ${dateParts[1]} - ${dateParts[0].slice(2)}` : day.date;
      
      rows.push([formattedDate, "كشف حركة الصندوق ليوم", "", ""]);
      merges.push({ s: { r: currentExcelRow, c: 1 }, e: { r: currentExcelRow, c: 3 } });
      const headerRowIdx = currentExcelRow + 1; // 1-indexed
      currentExcelRow++;
      
      // Row 2: Opening Balance Row
      // Col A: Value. Formula if dayIdx > 0 and prevEndingBalanceRowIdx is available: `=A${prevEndingBalanceRowIdx}`
      // Col B, C, D merged: رصيد اول اليوم
      const openingCell = dayIdx > 0 && prevEndingBalanceRowIdx !== null 
        ? { f: `A${prevEndingBalanceRowIdx}` } 
        : startingBal;
      rows.push([openingCell, "رصيد اول اليوم", "", ""]);
      merges.push({ s: { r: currentExcelRow, c: 1 }, e: { r: currentExcelRow, c: 3 } });
      const openingRowIdx = currentExcelRow + 1; // 1-indexed
      currentExcelRow++;
      
      // Transaction rows
      const transStartRowIdx = currentExcelRow + 1; // 1-indexed
      if (dayTransactions.length === 0) {
        rows.push(["", 0, "لا توجد حركات لهذا اليوم", ""]);
        currentExcelRow++;
      } else {
        dayTransactions.forEach((tx) => {
          const amount = tx.inflow > 0 ? tx.inflow : tx.outflow;
          const projOrMethod = tx.outflow > 0 ? tx.project : tx.method;
          rows.push(["", amount, tx.description, projOrMethod]);
          currentExcelRow++;
        });
      }
      const transEndRowIdx = currentExcelRow; // 1-indexed
      
      // Total Row ("الاجمالي")
      // Col A: Opening balance + sum of inflows
      const inflowRows: number[] = [];
      dayTransactions.forEach((tx, idx) => {
        if (tx.inflow > 0) {
          inflowRows.push(transStartRowIdx + idx);
        }
      });
      let totalAFormula = `A${openingRowIdx}`;
      if (inflowRows.length > 0) {
        totalAFormula += `+` + inflowRows.map(r => `B${r}`).join('+');
      }
      
      // Col B: Sum of outflows
      const outflowRows: number[] = [];
      dayTransactions.forEach((tx, idx) => {
        if (tx.outflow > 0) {
          outflowRows.push(transStartRowIdx + idx);
        }
      });
      let totalBFormula = "0";
      if (outflowRows.length > 0) {
        totalBFormula = outflowRows.map(r => `B${r}`).join('+');
      }
      
      rows.push([
        { f: totalAFormula },
        { f: totalBFormula },
        "الاجمالي",
        ""
      ]);
      const totalRowIdx = currentExcelRow + 1; // 1-indexed
      currentExcelRow++;
      
      // Ending Balance Row ("رصيد اخر اليوم")
      // Col A: `=A{totalRowIdx}-B{totalRowIdx}`
      rows.push([
        { f: `A${totalRowIdx}-B${totalRowIdx}` },
        "رصيد اخر اليوم",
        "",
        ""
      ]);
      merges.push({ s: { r: currentExcelRow, c: 1 }, e: { r: currentExcelRow, c: 3 } });
      const endingRowIdx = currentExcelRow + 1; // 1-indexed
      
      prevEndingBalanceRowIdx = endingRowIdx; // Store for next day's opening balance
      currentExcelRow++;
      
      // Separator Empty Row
      rows.push(["", "", "", ""]);
      currentExcelRow++;
    });
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = merges;
    
    // Set view to Right-To-Left to match Arabic layout exactly
    ws['!views'] = [{ RTL: true }];
    
    // Columns widths
    ws['!cols'] = [
      { wch: 18 }, // Col A: Running Balances
      { wch: 15 }, // Col B: Amounts
      { wch: 35 }, // Col C: Descriptions
      { wch: 22 }, // Col D: Projects / Methods
    ];
    
    // Blue dashed borders style
    const borderDashedBlue = {
      top: { style: "dashed", color: { rgb: "4F81BD" } },
      bottom: { style: "dashed", color: { rgb: "4F81BD" } },
      left: { style: "dashed", color: { rgb: "4F81BD" } },
      right: { style: "dashed", color: { rgb: "4F81BD" } }
    };
    
    const fontMain = { name: "Arial", sz: 11 };
    const fontBold = { name: "Arial", sz: 11, bold: true };
    const fontTitle = { name: "Arial", sz: 14, bold: true, color: { rgb: "1F4E78" } };
    
    // Style Title Row (A1)
    if (ws['A1']) {
      ws['A1'].s = {
        font: fontTitle,
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "F2F6FA" } },
        border: borderDashedBlue
      };
    }
    
    // Styling all standard cells with blue dashed borders and proper alignment
    for (let r = 2; r < currentExcelRow; r++) {
      ['A', 'B', 'C', 'D'].forEach(col => {
        const ref = `${col}${r+1}`;
        if (!ws[ref]) {
          ws[ref] = { v: "" };
        }
        ws[ref].s = {
          font: fontMain,
          border: borderDashedBlue,
          alignment: { horizontal: "center", vertical: "center" }
        };
        
        if (col === 'A' || col === 'B') {
          ws[ref].s.numFmt = '#,##0.00';
          ws[ref].s.alignment = { horizontal: "left", vertical: "center" };
        }
      });
    }
    
    // Apply specific backgrounds and bold fonts to headers and totals
    let curRow = 2; // start from row 3 (0-indexed 2)
    sortedDays.forEach((day, dayIdx) => {
      // Header row style
      const rHeader = curRow + 1;
      ['A', 'B', 'C', 'D'].forEach(col => {
        const ref = `${col}${rHeader}`;
        if (ws[ref]) {
          ws[ref].s.font = fontBold;
          ws[ref].s.fill = { fgColor: { rgb: "D9E1F2" } }; // Soft blue header
        }
      });
      curRow++; // move to opening balance row
      
      // Opening balance row style
      const rOpening = curRow + 1;
      ['A', 'B', 'C', 'D'].forEach(col => {
        const ref = `${col}${rOpening}`;
        if (ws[ref]) {
          ws[ref].s.font = fontBold;
          if (col === 'A') ws[ref].s.font.color = { rgb: "1F4E78" };
        }
      });
      curRow++; // move to transactions
      
      const dayTransactions = day.transactions;
      const transCount = dayTransactions.length === 0 ? 1 : dayTransactions.length;
      for (let t = 0; t < transCount; t++) {
        const rTrans = curRow + 1;
        if (ws[`C${rTrans}`]) {
          ws[`C${rTrans}`].s.alignment = { horizontal: "center", vertical: "center" };
        }
        if (ws[`D${rTrans}`]) {
          ws[`D${rTrans}`].s.alignment = { horizontal: "right", vertical: "center" };
        }
        curRow++;
      }
      
      // Total Row ("الاجمالي")
      const rTotal = curRow + 1;
      ['A', 'B', 'C', 'D'].forEach(col => {
        const ref = `${col}${rTotal}`;
        if (ws[ref]) {
          ws[ref].s.font = fontBold;
          ws[ref].s.fill = { fgColor: { rgb: "F2F2F2" } };
        }
      });
      curRow++;
      
      // Ending balance row style
      const rEnding = curRow + 1;
      ['A', 'B', 'C', 'D'].forEach(col => {
        const ref = `${col}${rEnding}`;
        if (ws[ref]) {
          ws[ref].s.font = fontBold;
          ws[ref].s.fill = { fgColor: { rgb: "E2EFDA" } }; // Soft green ending balance
          if (col === 'A') ws[ref].s.font.color = { rgb: "375623" };
        }
      });
      curRow++;
      
      // Empty separator row - clean borders
      ['A', 'B', 'C', 'D'].forEach(col => {
        const ref = `${col}${curRow + 1}`;
        if (ws[ref]) {
          ws[ref].s = { border: {} }; // no borders for separator
        }
      });
      curRow++;
    });
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "حركة الصندوق");
    XLSX.writeFile(wb, `كشف_حركة_الصندوق_عهد_المهندسين.xlsx`);
  };

  const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);

  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [isProcessingCustodyExcel, setIsProcessingCustodyExcel] = useState<boolean>(false);
  const custodyExcelInputRef = useRef<HTMLInputElement>(null);

  const generateMonthsList = () => {
    const list = [];
    const currentDate = new Date();
    for (let i = -12; i <= 6; i++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const formatter = new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' });
      const label = formatter.format(d);
      list.push({ value, label });
    }
    return list;
  };

  const handleCustodyExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedMonth) {
      onNotify('error', 'خطأ', 'الرجاء تحديد الشهر المستهدف أولاً!');
      return;
    }

    setIsProcessingCustodyExcel(true);
    onNotify('info', 'جاري معالجة الإكسيل 🤖', 'يتم قراءة ملف الإكسيل واستخراج حركات العهد وتصنيفها كمسودات بالذكاء الاصطناعي...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('selected_month', selectedMonth);
    formData.append('engineerName', selectedEngineer);

    try {
      const res = await fetch('/api/custody/analyze-excel', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          onSave(data.pettyCashBoxDays);
          onNotify('success', 'نجاح الاستيراد 🎉', data.message || 'تم استيراد وحفظ حركات شيت العهدة بنجاح كمسودات!');
        } else {
          onNotify('error', 'فشل الاستيراد', data.error || 'حدث خطأ أثناء معالجة ملف الإكسيل.');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        onNotify('error', 'فشل الاستيراد', data?.error || 'فشل الاتصال بالخادم لاستيراد شيت العهدة.');
      }
    } catch (err: any) {
      console.error("[Custody Excel AI] Error during upload:", err);
      onNotify('error', 'خطأ', 'حدث خطأ غير متوقع أثناء معالجة ملف الإكسيل.');
    } finally {
      setIsProcessingCustodyExcel(false);
      if (custodyExcelInputRef.current) custodyExcelInputRef.current.value = '';
    }
  };

  const refreshFinancialsFromServer = async () => {
    try {
      const res = await fetch('/api/financial-data');
      if (res.ok) {
        const finData = await res.json();
        if (finData.success) {
          if (finData.pettyCashBoxDays) onSave(finData.pettyCashBoxDays);
          if (finData.pendingTransactions) onSavePending(finData.pendingTransactions);
        }
      }
    } catch (e) {
      console.error("Error refreshing financials:", e);
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingAI(true);
    onNotify('info', 'جاري تحليل المستند بالذكاء الاصطناعي 🤖', 'يتم رفع وقراءة الفاتورة/الإيصال واستخراج البيانات المالية باستخدام Gemini OCR...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'petty_cash');

    try {
      const res = await fetch('/api/ai/ocr', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const ext = data.data;
          onNotify('success', 'تم استخراج البيانات بنجاح 🎉', 'تم ملء حقول الفاتورة تلقائياً. يرجى مراجعتها وتعديلها إذا لزم الأمر قبل الإضافة.');
          
          if (ext.date) {
            setSelectedDate(ext.date);
          } else if (ext.dates && ext.dates.length > 0) {
            setSelectedDate(ext.dates[0]);
          }

          if (ext.inflow) {
            setInflow(ext.inflow.toString());
          }

          if (ext.outflow) {
            setOutflow(ext.outflow.toString());
          } else if (ext.amounts && ext.amounts.length > 0) {
            setOutflow(ext.amounts[0].toString());
          }

          if (ext.description) {
            setDescription(ext.description);
          }

          if (ext.method) setMethod(ext.method);
          if (ext.project) setProject(ext.project);
          
          if (ext.engineer) {
            const matched = engineers?.find(eng => eng.name.includes(ext.engineer) || ext.engineer.includes(eng.name));
            if (matched) setSelectedEngineer(matched.name);
          } else if (ext.names && ext.names.length > 0) {
            const matchedName = ext.names[0];
            const matched = engineers?.find(eng => eng.name.includes(matchedName) || matchedName.includes(eng.name));
            if (matched) setSelectedEngineer(matched.name);
          }
          
          if (data.tempPath) {
            setPendingAttachmentPath(data.tempPath);
            setPendingAttachmentName(file.name);
          }
        } else {
          onNotify('error', 'فشل تحليل المستند', data.error || 'حدث خطأ في قراءة المستند بالذكاء الاصطناعي.');
        }
      } else {
        onNotify('error', 'خطأ في الاتصال بالخادم', 'فشل إرسال المستند إلى معالج الذكاء الاصطناعي.');
      }
    } catch (err: any) {
      onNotify('error', 'فشل معالجة المستند بالذكاء الاصطناعي', err.message || 'خطأ في الشبكة.');
    } finally {
      setIsProcessingAI(false);
      e.target.value = '';
    }
  };

  const handleApprovePending = (pendingTx: PendingTransaction) => {
    if (!pendingTx.date) {
      alert('يرجى تحديد تاريخ الحركة أولاً لاعتمادها وترحيلها إلى هذا التاريخ!');
      return;
    }

    const updatedPending = pendingTransactions.filter((pt) => pt.id !== pendingTx.id);

    const cleanTx = {
      id: pendingTx.id,
      inflow: pendingTx.inflow,
      outflow: pendingTx.outflow,
      description: pendingTx.description,
      method: pendingTx.method,
      project: pendingTx.project
    };

    let updatedBoxDays = [...boxDays];
    const dayIdx = updatedBoxDays.findIndex((d) => d.date === pendingTx.date && (d.engineer || "عام") === (pendingTx.engineer || "عام"));

    if (dayIdx > -1) {
      updatedBoxDays[dayIdx] = {
        ...updatedBoxDays[dayIdx],
        transactions: [...updatedBoxDays[dayIdx].transactions, cleanTx],
        updatedAt: new Date().toISOString(),
      };
    } else {
      updatedBoxDays.push({
        date: pendingTx.date,
        engineer: pendingTx.engineer || "عام",
        transactions: [cleanTx],
        updatedAt: new Date().toISOString(),
      });
    }

    onSave(updatedBoxDays);
    onSavePending(updatedPending);
    onNotify('success', 'تم اعتماد الحركة بنجاح 🚀', `تم ترحيل الحركة وتثبيتها في يوم ${pendingTx.date}.`);
  };

  const handleDeletePending = (pendingId: string) => {
    if (confirm('هل أنت متأكد من رغبتك في حذف وإلغاء هذه الحركة المعلقة؟')) {
      const updatedPending = pendingTransactions.filter((pt) => pt.id !== pendingId);
      onSavePending(updatedPending);
      onNotify('info', 'تم حذف الحركة المعلقة', 'تمت إزالة القيد المعلق بنجاح.');
    }
  };

  const handlePendingDateChange = (pendingId: string, dateVal: string) => {
    const updatedPending = pendingTransactions.map((pt) => {
      if (pt.id === pendingId) {
        return { ...pt, date: dateVal };
      }
      return pt;
    });
    onSavePending(updatedPending);
  };

  return (
    <div className="space-y-6">
      {/* Scoped style block to force portrait print specifically for this box movement report */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: portrait !important;
            margin: 8mm 10mm 8mm 10mm !important;
          }
          /* Custom print rules for clean ledger table with solid borders */
          .print-ledger-table {
            border-collapse: collapse !important;
            width: 100% !important;
            border-spacing: 0 !important;
            margin-bottom: 25px !important;
            page-break-inside: avoid !important;
          }
          .print-ledger-table, .print-ledger-table th, .print-ledger-table td {
            border: 1.5px solid ${
              printStyle === 'solid' ? '#000000' :
              printStyle === 'modern' ? '#4F81BD' :
              '#94A3B8'
            } !important;
            border-collapse: collapse !important;
            padding: 8px 10px !important;
            font-size: 11px !important;
            font-weight: bold !important;
            color: #000000 !important;
            background-clip: padding-box !important;
          }
          .print-ledger-title-cell {
            font-size: 14px !important;
            font-weight: 900 !important;
            background-color: ${
              printStyle === 'solid' ? '#E5E7EB' :
              printStyle === 'modern' ? '#D9E1F2' :
              '#F1F5F9'
            } !important;
            color: ${
              printStyle === 'solid' ? '#000000' :
              printStyle === 'modern' ? '#1F4E78' :
              '#334155'
            } !important;
            border-bottom: 2px solid ${
              printStyle === 'solid' ? '#000000' :
              printStyle === 'modern' ? '#4F81BD' :
              '#94A3B8'
            } !important;
          }
        }
      `}} />

      {/* Date & Starting Balance Panel */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-center gap-4 no-print">
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <User className="text-indigo-400 w-5 h-5" />
            <span className="text-sm font-bold text-slate-300">عُهدة المهندس:</span>
            <select
              value={selectedEngineer}
              onChange={(e) => setSelectedEngineer(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="">-- كشف الصندوق العام --</option>
              {engineers.map((eng) => (
                <option key={eng.id} value={eng.name}>
                  {eng.name} ({eng.project})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <Calendar className="text-emerald-400 w-5 h-5" />
            <span className="text-sm font-bold text-slate-300">اختر تاريخ كشف الحركة:</span>
            <SafeInput
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-emerald-500 transition-all cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="text-right">
            <span className="text-xs text-slate-400 block font-bold">رصيد أول اليوم:</span>
            {editingStartingBalance ? (
              <div className="flex gap-2 items-center mt-1">
                <SafeInput
                  type="number"
                  value={startingBalanceInput}
                  onChange={(e: any) => setStartingBalanceInput(e.target.value)}
                  onBlur={handleUpdateStartingBalance}
                  className="w-28 bg-slate-900 border border-emerald-500 text-white text-xs rounded-lg px-2 py-1 outline-none text-left"
                />
                <button
                  onClick={handleUpdateStartingBalance}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-2.5 py-1 rounded-lg font-bold cursor-pointer"
                >
                  حفظ
                </button>
                <button
                  onClick={() => setEditingStartingBalance(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] px-2 py-1 rounded-lg cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-black text-white">
                  {computedStartingBalance.toLocaleString()} <span className="text-xs text-slate-400">EGP</span>
                </span>
                <button
                  onClick={() => {
                    setStartingBalanceInput(computedStartingBalance.toString());
                    setEditingStartingBalance(true);
                  }}
                  className="text-slate-400 hover:text-white text-[10px] border border-slate-700 hover:border-slate-500 px-1.5 py-0.5 rounded cursor-pointer"
                >
                  تعديل
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl no-print">
              <span className="text-[10px] text-slate-400 font-bold">نمط تنسيق الطباعة:</span>
              <select
                value={printStyle}
                onChange={(e) => setPrintStyle(e.target.value as any)}
                className="bg-slate-900 text-white text-xs font-bold rounded-lg border-0 focus:ring-1 focus:ring-indigo-500 py-1 px-2.5 outline-none cursor-pointer"
              >
                <option value="solid">شبكة مصمتة داكنة 🖤</option>
                <option value="modern">تنسيق كحلي حديث 💙</option>
                <option value="minimal">تنسيق رمادي هادئ 🩶</option>
              </select>
            </div>

            <div className="relative no-print" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span>إجراءات العهدة الحالية</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 py-1 divide-y divide-slate-800 animate-in fade-in duration-200" dir="rtl">
                  {/* Group 1: Primary Actions */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        window.print();
                      }}
                      className="w-full text-right px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-all flex items-center gap-2.5"
                    >
                      <Printer className="w-4 h-4 text-indigo-400" />
                      <span>طباعة الكشف اليومي 🖨️</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setAiModalMonth(selectedMonth || '');
                        setShowAIModal(true);
                      }}
                      className="w-full text-right px-4 py-2 text-xs text-slate-200 hover:bg-emerald-950/40 hover:text-emerald-400 font-extrabold transition-all flex items-center gap-2.5"
                    >
                      <Upload className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span>⚡ معالجة واستيراد بالذكاء الاصطناعي</span>
                    </button>
                  </div>

                  {/* Group 2: Data & Export */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleExportExcel();
                      }}
                      className="w-full text-right px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition-all flex items-center gap-2.5"
                    >
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>تصدير إلى Excel (بالمعادلات) 📊</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        handleConfirmLedger();
                      }}
                      disabled={isSavingLedger}
                      className="w-full text-right px-4 py-2 text-xs text-amber-500 hover:bg-slate-800 hover:text-amber-400 transition-all flex items-center gap-2.5 font-semibold"
                    >
                      <CheckCircle className="w-4 h-4 text-amber-500" />
                      <span>{isSavingLedger ? "جاري الحفظ..." : "تأكيد واعتماد ترحيل العهدة ✅"}</span>
                    </button>
                  </div>

                  {/* Group 3: Danger Zone */}
                  {currentUser?.role === 'admin' && (
                    <div className="py-1 bg-red-950/20">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          handleResetLedger();
                        }}
                        className="w-full text-right px-4 py-2 text-xs text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-all flex items-center gap-2.5 font-bold"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                        <span>تصفير وإعادة تعيين 🗑️</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Hidden input to handle the AI file selection */}
            <input
              type="file"
              ref={aiFileInputRef}
              accept="image/*"
              onChange={handleScreenshotUpload}
              className="hidden"
              disabled={isProcessingAI}
            />
          </div>
        </div>
      </div>

      {/* Portrait print-only layout matching image_282819.png */}
      <div className="hidden print:block w-full max-w-none mx-auto text-black font-sans portrait-print animate-in fade-in duration-300" dir="rtl" style={{ fontFamily: 'Arial' }}>
        <div className="border-0 p-0 bg-white space-y-6">
          <div className="text-center pb-4 border-b-2 border-[#4F81BD]">
            <h2 className="text-2xl font-black text-[#1F4E78]">حركة صندوق {selectedEngineer ? selectedEngineer : "العام"}</h2>
          </div>

          <div className="space-y-8">
            {computedDaysWithBalances.map((day, dayIdx) => {
              // Calculate day starting balance
              const startingBal = day.computedStartingBalance;

              const dayTransactions = day.transactions;
              const totalInflow = day.totalInflow;
              const totalOutflow = day.totalOutflow;
              const dayEndingBal = day.computedEndingBalance;

              const dateParts = day.date.split('-');
              const formattedDate = dateParts.length === 3 ? `${dateParts[2]} - ${dateParts[1]} - ${dateParts[0].slice(2)}` : day.date;

              return (
                <div key={day.date + '-' + dayIdx} className="break-inside-avoid text-black bg-white p-0 overflow-hidden print-ledger-box">
                  <table className="print-ledger-table w-full text-center border-collapse text-xs sm:text-sm font-sans" style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr className="bg-[#D9E1F2]">
                        <th colSpan={5} className="py-3 px-4 font-black text-[#1F4E78] text-base text-center print-ledger-title-cell">
                          كشف حركة الصندوق ليوم {formattedDate}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Opening Balance Row */}
                      <tr className="bg-slate-50 text-[#1F4E78] font-bold print-ledger-row">
                        <td className="py-2.5 px-3 font-mono font-black text-center print-ledger-cell">
                          {formatPrintCurrency(startingBal)}
                        </td>
                        <td className="py-2.5 px-3 print-ledger-cell"></td>
                        <td className="py-2.5 px-3 font-extrabold text-slate-700 text-center print-ledger-cell">
                          رصيد أول اليوم
                        </td>
                        <td className="py-2.5 px-3 print-ledger-cell"></td>
                        <td className="py-2.5 px-3 print-ledger-cell"></td>
                      </tr>

                      {/* Transactions */}
                      {dayTransactions.length === 0 ? (
                        <tr className="bg-white print-ledger-row">
                          <td colSpan={5} className="py-4 text-center text-slate-500 font-bold print-ledger-cell">
                            لا توجد حركات مسجلة لهذا اليوم
                          </td>
                        </tr>
                      ) : (
                        dayTransactions.map((tx) => (
                          <tr key={tx.id} className="bg-white text-black print-ledger-row">
                            <td className="py-2.5 px-3 font-mono font-black text-emerald-700 text-center print-ledger-cell">
                              {tx.inflow > 0 ? formatPrintCurrency(tx.inflow) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-800 text-center font-semibold print-ledger-cell">
                              {tx.inflow > 0 ? tx.method : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-900 text-center font-bold px-1.5 leading-relaxed print-ledger-cell">
                              {tx.description}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-black text-rose-700 text-center print-ledger-cell">
                              {tx.outflow > 0 ? formatPrintCurrency(tx.outflow) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 text-center font-semibold print-ledger-cell">
                              {tx.project || '-'}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Totals Row */}
                      <tr className="bg-[#F2F2F2] font-black print-ledger-row">
                        <td className="py-2.5 px-3 text-emerald-700 font-mono text-center print-ledger-cell">
                          {formatPrintCurrency(totalInflow)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-center print-ledger-cell">-</td>
                        <td className="py-2.5 px-3 text-[#1f4e78] font-black text-center text-sm print-ledger-cell">
                          الاجـــــــمـــــــالــــــــــــــــــــــــى
                        </td>
                        <td className="py-2.5 px-3 text-rose-700 font-mono text-center print-ledger-cell">
                          {formatPrintCurrency(totalOutflow)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-center print-ledger-cell">-</td>
                      </tr>

                      {/* Ending Balance Row */}
                      <tr className="bg-[#E2EFDA] font-black text-[#375623] print-ledger-row">
                        <td className="py-2.5 px-3 font-mono font-black text-center print-ledger-cell">
                          {formatPrintCurrency(dayEndingBal)}
                        </td>
                        <td className="py-2.5 px-3 print-ledger-cell"></td>
                        <td className="py-2.5 px-3 text-center font-extrabold text-[#375623] print-ledger-cell">
                          رصيد آخر اليوم
                        </td>
                        <td className="py-2.5 px-3 print-ledger-cell"></td>
                        <td className="py-2.5 px-3 print-ledger-cell"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <div className="bg-[#111827] border border-slate-800 p-5 rounded-2xl shadow-md flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-bold">رصيد أول اليوم</span>
            <span className="text-lg font-black text-white">
              {formatCurrency(computedStartingBalance)} <span className="text-xs text-slate-400">EGP</span>
            </span>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-5 rounded-2xl shadow-md flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-bold">إجمالي المقبوضات (المدين)</span>
            <span className="text-lg font-black text-emerald-400">
              +{formatCurrency(totalInflow)} <span className="text-xs text-emerald-500">EGP</span>
            </span>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-5 rounded-2xl shadow-md flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-bold">إجمالي المصروفات (الدائن)</span>
            <span className="text-lg font-black text-rose-400">
              -{formatCurrency(totalOutflow)} <span className="text-xs text-rose-500">EGP</span>
            </span>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-5 rounded-2xl shadow-md flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 block font-bold">رصيد آخر اليوم المتوقع</span>
            <span className="text-lg font-black text-emerald-400">
              {formatCurrency(endingBalance)} <span className="text-xs text-emerald-400">EGP</span>
            </span>
          </div>
        </div>
      </div>

      {/* Pending Transactions Section */}
      {pendingTransactions.length > 0 && (
        <div className="bg-[#111827] border-2 border-amber-500/30 rounded-2xl p-6 shadow-md space-y-4 no-print">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-3 gap-2">
            <div>
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 animate-pulse" />
                <span>مصروفات عهدة معلقة بانتظار تحديد التاريخ ({pendingTransactions.length}) ⏳</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                تم استخراج هذه الحركات بالذكاء الاصطناعي من لقطة تصفية العهدة ولكن بدون تاريخ محدد بجانبها. حدد تاريخ كل حركة يدويًا واضغط "اعتماد وترحيل" لحفظها وتثبيتها.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold">
                  <th className="pb-3 text-left">المدين (+)</th >
                  <th className="pb-3 text-left">الدائن (-)</th >
                  <th className="pb-3 pr-2">البيان / الشرح</th >
                  <th className="pb-3 pr-2">المشروع المستنتج</th >
                  <th className="pb-3 pr-2">طريقة الدفع</th >
                  <th className="pb-3 text-center">تاريخ الحركة (Date Picker)</th >
                  <th className="pb-3 text-center">إجراءات الاعتماد</th >
                </tr>
              </thead>
              <tbody>
                {pendingTransactions.map((pt) => (
                  <tr key={pt.id} className="border-b border-slate-850 text-slate-300 text-xs hover:bg-slate-900/30 transition-all">
                    <td className="py-3.5 text-left font-mono font-bold text-emerald-400">
                      {pt.inflow > 0 ? `+${pt.inflow.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3.5 text-left font-mono font-bold text-rose-400">
                      {pt.outflow > 0 ? `-${pt.outflow.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3.5 pr-2 font-bold max-w-xs truncate" title={pt.description}>
                      {pt.description}
                    </td>
                    <td className="py-3.5 pr-2">
                      <select
                        value={pt.project}
                        onChange={(e) => {
                          const updated = pendingTransactions.map(item => item.id === pt.id ? { ...item, project: e.target.value } : item);
                          onSavePending(updated);
                        }}
                        className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 text-[11px] outline-none cursor-pointer"
                      >
                        {projectsList.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3.5 pr-2">
                      <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                        {pt.method}
                      </span>
                    </td>
                    <td className="py-3.5 text-center">
                      <SafeInput
    type="date"
    defaultValue={pt.date || ''}
    onBlur={(e) => handlePendingDateChange(pt.id, e.target.value)}
                        className="bg-slate-900 border border-amber-500/50 text-white rounded-lg px-2.5 py-1 text-xs font-bold outline-none cursor-pointer"
                      />
                    </td>
                    <td className="py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApprovePending(pt)}
                          disabled={!pt.date}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                            pt.date 
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm' 
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          }`}
                          title={pt.date ? "اعتماد وترحيل الحركة إلى اليوم المحدد" : "يرجى تحديد التاريخ أولاً"}
                        >
                          اعتماد وترحيل 🚀
                        </button>
                        <button
                          onClick={() => handleDeletePending(pt.id)}
                          className="text-rose-500 hover:text-rose-400 p-1.5 rounded hover:bg-rose-500/10 cursor-pointer"
                          title="حذف الحركة المعلقة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* Input Form Card */}
        <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md h-fit space-y-4">
          <h3 className="text-sm font-bold text-white border-b border-slate-850 pb-3 flex items-center gap-2">
            <Plus className="text-emerald-400 w-4 h-4" />
            <span>تسجيل حركة صندوق جديدة</span>
          </h3>

          <form onSubmit={handleAddTransaction} className="space-y-4 text-right">
            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1.5">المشروع الحالي (اختياري)</label>
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="">-- اختر المشروع (عام / لا يوجد) --</option>
                {projectsList.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1.5">المبالغ المستلمة (المدين)</label>
                <SafeInput
                  type="number"
                  placeholder="0.00"
                  value={inflow}
                  onChange={(e) => setInflow(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs text-left outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1.5">المصروفات المدفوعة (الدائن)</label>
                <SafeInput
                  type="number"
                  placeholder="0.00"
                  value={outflow}
                  onChange={(e) => setOutflow(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs text-left outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1.5">البيان / الشرح *</label>
              <SafeInput
                type="text"
                placeholder="مثال: دفعة عمال شاهر، تحويل من إنستاباي"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1.5">طريقة الدفع / التمويل</label>
              <SafeInput
                type="text"
                placeholder="انستاباي، نقدي، شيك، إلخ"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1.5">ربط بمقاول (تسميع في المستخلصات) اختياري</label>
              <select
                value={linkedSubcontractor}
                onChange={(e) => setLinkedSubcontractor(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="">-- بدون ربط --</option>
                {subcontractorContracts.map((sub, i) => (
                  <option key={sub.id || i} value={sub.subcontractor}>{sub.subcontractor}</option>
                ))}
              </select>
            </div>

            {pendingAttachmentName && (
              <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-400">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-bold truncate max-w-[180px]">{pendingAttachmentName}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => {
                    setPendingAttachmentPath('');
                    setPendingAttachmentName('');
                  }}
                  className="text-rose-500 hover:text-rose-400 font-bold"
                >
                  حذف
                </button>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة الحركة الحالية 📌</span>
            </button>
          </form>
        </div>

        {/* Transactions Table Card */}
        <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-850 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="text-emerald-400 w-4 h-4" />
              <span>كشف حركة الصندوق ليوم {(() => { const parts = selectedDate.split('-'); return parts.length === 3 ? `${parts[2]} - ${parts[1]} - ${parts[0].slice(2)}` : selectedDate; })()}</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">تاريخ اليومية: {selectedDate}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold">
                  <th className="pb-3 text-center">مدين (+)</th>
                  <th className="pb-3 pr-2">طريقة الإيداع</th>
                  <th className="pb-3 pr-2">الوصف / البيان</th>
                  <th className="pb-3 text-center">دائن (-)</th>
                  <th className="pb-3 pr-2">المشروع</th>
                  <th className="pb-3 pr-2">المرفق</th>
                  <th className="pb-3 text-center">الحالة</th>
                  <th className="pb-3 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-xs text-slate-500 font-bold">
                      لا توجد حركات مسجلة لهذا اليوم. يرجى إضافة حركة جديدة من النموذج الجانبي.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-850 text-slate-300 text-xs hover:bg-slate-900/30 transition-all">
                      <td className="py-3.5 text-center font-mono font-bold text-emerald-400">
                        {editingTxId === tx.id ? (
                          <SafeInput
                            type="number"
                            value={editInflow}
                            onChange={(e) => setEditInflow(e.target.value)}
                            className="bg-slate-950 text-emerald-400 text-xs rounded border border-slate-750 px-2 py-1 w-24 text-center font-mono outline-none focus:border-emerald-500 font-bold"
                          />
                        ) : (
                          tx.inflow > 0 ? formatCurrency(tx.inflow) : '-'
                        )}
                      </td>
                      <td className="py-3.5 pr-2">
                        {editingTxId === tx.id ? (
                          <select
                            value={editMethod}
                            onChange={(e) => setEditMethod(e.target.value)}
                            className="bg-slate-950 text-slate-300 text-xs font-bold rounded border border-slate-750 px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="نقدي">نقدي</option>
                            <option value="انستاباي">انستاباي</option>
                            <option value="شيك">شيك</option>
                          </select>
                        ) : (
                          tx.inflow > 0 || tx.outflow > 0 ? (
                            <span className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                              {tx.method}
                            </span>
                          ) : '-'
                        )}
                      </td>
                      <td className="py-3.5 pr-2 font-bold max-w-xs truncate text-right" title={tx.description}>
                        {editingTxId === tx.id ? (
                          <SafeInput
                            type="text"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="bg-slate-950 text-slate-100 text-xs rounded border border-slate-750 px-3 py-1 w-full outline-none focus:border-indigo-500 text-right font-bold"
                          />
                        ) : (
                          tx.description
                        )}
                      </td>
                      <td className="py-3.5 text-center font-mono font-bold text-rose-400">
                        {editingTxId === tx.id ? (
                          <SafeInput
                            type="number"
                            value={editOutflow}
                            onChange={(e) => setEditOutflow(e.target.value)}
                            className="bg-slate-950 text-rose-400 text-xs rounded border border-slate-750 px-2 py-1 w-24 text-center font-mono outline-none focus:border-rose-500 font-bold"
                          />
                        ) : (
                          tx.outflow > 0 ? formatCurrency(tx.outflow) : '-'
                        )}
                      </td>
                      <td className="py-3.5 pr-2 font-medium text-slate-400">
                        {editingTxId === tx.id ? (
                          <select
                            value={editProject}
                            onChange={(e) => setEditProject(e.target.value)}
                            className="bg-slate-950 text-slate-300 text-xs rounded border border-slate-750 px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer font-bold"
                          >
                            <option value="عام">عام</option>
                            {projectsList.map((proj) => (
                              <option key={proj} value={proj}>{proj}</option>
                            ))}
                          </select>
                        ) : (
                          tx.project
                        )}
                      </td>
                      <td className="py-3.5 pr-2">
                        {tx.attachment ? (
                          <a 
                            href={`/api/documents/download?path=${encodeURIComponent(tx.attachment)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-400 border border-indigo-900/50 px-2 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>عرض المستند 📄</span>
                          </a>
                        ) : (
                          <span className="text-slate-600 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="py-3.5 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          tx.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {tx.status === 'approved' ? 'معتمد ✅' : 'مسودة ⏳'}
                        </span>
                      </td>
                      <td className="py-3.5 text-center">
                        {tx.status === 'approved' ? (
                          <span className="text-slate-500 font-bold" title="لا يمكن تعديل أو حذف الحركات المعتمدة">🔒</span>
                        ) : (
                          <div className="flex justify-center items-center gap-1.5">
                            {editingTxId === tx.id ? (
                              <>
                                <button
                                  onClick={handleSaveEditedTransaction}
                                  className="text-emerald-400 hover:text-emerald-300 p-1 rounded hover:bg-emerald-500/10 cursor-pointer"
                                  title="حفظ التعديل"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingTxId(null)}
                                  className="text-slate-400 hover:text-slate-300 p-1 rounded hover:bg-slate-500/10 cursor-pointer"
                                  title="إلغاء"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingTxId(tx.id);
                                    setEditingTxDate(currentDay.date);
                                    setEditDescription(tx.description);
                                    setEditProject(tx.project || 'عام');
                                    setEditMethod(tx.method || 'نقدي');
                                    setEditInflow(tx.inflow > 0 ? tx.inflow.toString() : '0');
                                    setEditOutflow(tx.outflow > 0 ? tx.outflow.toString() : '0');
                                  }}
                                  className="text-indigo-400 hover:text-indigo-300 p-1 rounded hover:bg-indigo-500/10 cursor-pointer"
                                  title="تعديل الحركة"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTransaction(tx.id)}
                                  className="text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                                  title="حذف الحركة"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Totals Summary bar */}
          <div className="bg-slate-900/50 border border-slate-850 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center text-xs gap-3">
            <div className="flex gap-4">
              <div>
                <span className="text-slate-400 font-bold block">إجمالي المدين (+)</span>
                <span className="text-sm font-black text-emerald-400 mt-1 block">
                  +{totalInflow.toLocaleString()} EGP
                </span>
              </div>
              <div className="border-l border-slate-800 mx-2"></div>
              <div>
                <span className="text-slate-400 font-bold block">إجمالي الدائن (-)</span>
                <span className="text-sm font-black text-rose-400 mt-1 block">
                  -{totalOutflow.toLocaleString()} EGP
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-slate-400 font-bold block">رصيد آخر اليوم:</span>
              <span className="text-sm font-black text-emerald-400 mt-1 block">
                {endingBalance.toLocaleString()} EGP
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2️⃣ Date Range Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 no-print animate-in fade-in duration-200">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-right" dir="rtl">
            {/* Modal Header */}
            <div className="bg-slate-900/60 px-6 py-4 border-b border-slate-800 flex justify-between items-center flex-row-reverse">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="text-slate-400 hover:text-white transition-colors text-base font-bold"
              >
                ✕
              </button>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle className="text-amber-500 w-5 h-5" />
                <span>اعتماد وترحيل العهدة بفترة زمنية 📆</span>
              </h3>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-right">
                <AlertCircle className="text-amber-400 w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-400">تنبيه هام وتأكيد صارم</h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    سيتم إغلاق واعتماد كافة حركات العهدة للمهندس <span className="font-bold text-white">({selectedEngineer || 'عام'})</span> في الفترة المحددة أدناه. لا يمكن تعديل أو حذف أي حركة بعد اعتمادها وتأكيد ترحيلها النهائي.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 block">من تاريخ:</label>
                  <SafeInput
                    type="date"
                    value={approvalStartDate}
                    onChange={(e) => setApprovalStartDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-all cursor-pointer"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 block">إلى تاريخ:</label>
                  <SafeInput
                    type="date"
                    value={approvalEndDate}
                    onChange={(e) => setApprovalEndDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-all cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-900/60 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                إلغاء ✕
              </button>
              <button
                onClick={handleConfirmLedgerRange}
                disabled={isSavingLedger}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                {isSavingLedger ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الترحيل...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>تأكيد الترحيل النهائي 🚀</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* ⚡ Unified AI Multimodal Parser Modal ⚡ */}
      {/* ================================================== */}
      {showAIModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150 no-print">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-150" dir="rtl">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-850/50 border-b border-slate-850 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                  <Upload className="w-5 h-5 text-emerald-400 animate-pulse" />
                </div>
                <div className="text-right">
                  <h3 className="text-sm font-black text-white">المعالج الذكي الشامل (AI Multimodal Parser)</h3>
                  <p className="text-[10px] text-slate-400 font-medium">استخرج حركات العهدة فورياً من الصور والملفات بمساعدة الذكاء الاصطناعي</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAIModal(false);
                  setSelectedAIFile(null);
                  setAiFilePreview(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-all"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] text-right">
              {/* 1. Model Selection */}
              <AIModelSelector
                useAdvanced={useAdvancedAI}
                setUseAdvanced={setUseAdvancedAI}
                selectedModel={selectedAIModel}
                setSelectedModel={setSelectedAIModel}
              />

              {/* 2. Month Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-emerald-400 block">اختر شهر الاستيراد والتحليل المستهدف:</label>
                <select
                  value={aiModalMonth}
                  onChange={(e) => setAiModalMonth(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">-- اختر الشهر المستهدف --</option>
                  {generateMonthsList().map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">سيتم استيراد كافة حركات العهدة وتثبيتها في هذا الشهر حصرياً.</p>
              </div>

              {/* 3. Memory Toggle */}
              <div className="space-y-1.5 flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                <div className="text-right">
                  <label className="text-xs font-bold text-emerald-400 block">تفعيل الذاكرة والتعلم الذاتي</label>
                  <p className="text-[10px] text-slate-500">يستخدم سياق التعلم السابق (يستهلك توكنز إضافية)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={useMemory} onChange={(e) => setUseMemory(e.target.checked)} />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* 4. File Dropzone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 block">ارفع شيت الإكسيل أو الصورة / لقطة الشاشة للتحليل:</label>
                
                <div
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileSelection(file);
                  }}
                  onClick={() => custodyExcelInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950/40 hover:bg-slate-950/80 rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer text-center relative group min-h-[160px]"
                >
                  {aiFilePreview ? (
                    <div className="relative w-full max-h-48 overflow-hidden rounded-lg border border-slate-800">
                      <img src={aiFilePreview} alt="Screenshot preview" className="w-full h-auto object-contain mx-auto" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <span className="text-[10px] text-white font-bold bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-700">تغيير الصورة أو الملف 📂</span>
                      </div>
                    </div>
                  ) : selectedAIFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-10 h-10 text-emerald-400" />
                      <span className="text-xs font-bold text-slate-200">{selectedAIFile.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({(selectedAIFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-800 p-3 rounded-full border border-slate-700 group-hover:border-emerald-500/30 transition-all">
                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-400" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-300">اسحب وأسقط الملف أو الصورة هنا، أو اضغط للتصفح</p>
                        <p className="text-[10px] text-slate-500">يدعم صيغ Excel (.xlsx, .xls) و CSV والصور (.png, .jpg, .jpeg)</p>
                      </div>
                      <div className="mt-1 bg-slate-900 text-slate-400 text-[9px] px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1 font-mono justify-center">
                        <span className="bg-slate-800 text-slate-300 px-1 py-0.5 rounded text-[8px]">Ctrl + V</span>
                        <span>يدعم لصق سكرين شوت مباشرة من حافظة جهازك!</span>
                      </div>
                    </>
                  )}
                </div>

                <input
                  type="file"
                  ref={custodyExcelInputRef}
                  accept=".xlsx, .xls, .csv, image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelection(file);
                  }}
                  className="hidden"
                />
              </div>

              {/* Notice Box */}
              <div className="bg-indigo-950/20 border border-indigo-900/30 p-4 rounded-xl flex gap-2.5 items-start">
                <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-right">
                  <h4 className="text-[11px] font-bold text-indigo-300">محرك التعليم المستمر والتعلم الذاتي نشط 🧠</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    سيقوم المعالج بمطابقة مسميات المشاريع والبنود وتصنيفها بدقة تامة. أي تعديلات تجريها على المسودات لاحقاً ستُحفظ تلقائياً في قوالب التدريب ليتعلم منها السيستم ويمنع تكرار الخطأ مستقبلاً.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-850/50 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAIModal(false);
                  setSelectedAIFile(null);
                  setAiFilePreview(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                إلغاء ✕
              </button>
              <button
                onClick={handleAIUnifiedProcess}
                disabled={isProcessingAIUnified || !aiModalMonth || !selectedAIFile}
                className="px-5 py-2 bg-slate-200 hover:bg-white disabled:bg-slate-850 disabled:text-slate-500 text-black text-xs font-black rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
              >
                {isProcessingAIUnified ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري المعالجة والتحليل بالـ AI...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>تشغيل المعالج الذكي واستيراد العهدة ⚡</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

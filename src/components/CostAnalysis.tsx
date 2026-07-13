import React, { useState, useMemo, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import { 
  Plus, 
  Trash2, 
  Download, 
  TrendingUp, 
  Folder, 
  Tag, 
  Calendar, 
  DollarSign, 
  FileText, 
  Filter, 
  PieChart as PieIcon, 
  Grid,
  Sparkles,
  Printer,
  Upload,
  Check,
  X,
  AlertCircle,
  Settings,
  ChevronDown,
  Database,
  History
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Legend, 
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import * as XLSX from 'xlsx-js-style';

interface CostEntry {
  id: string;
  project: string;
  category: string;
  amount: number;
  date: string;
  description: string;
  engineer?: string;
}

interface CostAnalysisProps {
  projectsList: string[];
  entries: CostEntry[];
  categories: string[];
  onSave: (updatedEntries: CostEntry[], updatedCategories: string[]) => void;
  engineers?: { id: string; name: string; project: string }[];
  boxDays?: any[];
  onNotify?: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  onRefresh?: () => void;
}

export const CostAnalysis: React.FC<CostAnalysisProps> = ({
  projectsList,
  entries,
  categories,
  onSave,
  engineers = [],
  boxDays = [],
  onNotify,
  onRefresh
}) => {
  // Input Form States
  const [selectedProject, setSelectedProject] = useState<string>(projectsList[0] || 'الساحل');
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0] || 'مواد تشغيل');
  const [amountInput, setAmountInput] = useState<string>('');
  const [dateInput, setDateInput] = useState<string>(new Date().toISOString().split('T')[0]);
  const [descriptionInput, setDescriptionInput] = useState<string>('');
  const [selectedEngineer, setSelectedEngineer] = useState<string>('');

  // Add Custom Category State
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);

  // Filter States
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterEngineer, setFilterEngineer] = useState<string>('all');
  const [filterMonthYear, setFilterMonthYear] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showSignaturesInPrint, setShowSignaturesInPrint] = useState<boolean>(true);
  const [isPrintLandscape, setIsPrintLandscape] = useState<boolean>(true);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // AI aggregation state
  const [isAggregating, setIsAggregating] = useState<boolean>(false);

  // --- New AI Monthly Engineer Cost Aggregation states ---
  const [targetEngineer, setTargetEngineer] = useState<string>('');
  const [targetMonth, setTargetMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [isEngineerAggregating, setIsEngineerAggregating] = useState<boolean>(false);
  const [archiveUrl, setArchiveUrl] = useState<string>('');

  // --- Saved Analyses states ---
  const [savedAnalyses, setSavedAnalyses] = useState<any[]>([]);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [showRecallModal, setShowRecallModal] = useState<boolean>(false);
  const [saveEngineerName, setSaveEngineerName] = useState<string>('');
  const [saveProjectName, setSaveProjectName] = useState<string>('');
  const [saveNotes, setSaveNotes] = useState<string>('');
  const [isSavingAnalysis, setIsSavingAnalysis] = useState<boolean>(false);
  const [isFetchingSaved, setIsFetchingSaved] = useState<boolean>(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState<boolean>(false);

  const fetchSavedAnalyses = async () => {
    setIsFetchingSaved(true);
    try {
      const res = await fetch('/api/cost-analysis/saved-analyses');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSavedAnalyses(data.savedAnalyses || []);
        }
      }
    } catch (err) {
      console.error('Error fetching saved analyses:', err);
    } finally {
      setIsFetchingSaved(false);
    }
  };

  useEffect(() => {
    fetchSavedAnalyses();
  }, []);

  // Excel Parse states
  const [isParsingExcel, setIsParsingExcel] = useState<boolean>(false);
  const [excelPreviewEntries, setExcelPreviewEntries] = useState<CostEntry[]>([]);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processExcelFile(file);
    }
  };

  const processExcelFile = async (file: File) => {
    setIsParsingExcel(true);
    setExcelPreviewEntries([]);
    if (onNotify) {
      onNotify('info', 'جاري فحص وتصنيف بيانات Excel بالذكاء الاصطناعي... 🤖', 'يتم فحص شيت المصروفات، وتحديد المبالغ، وتصنيف كل معاملة للبند الأنسب تلقائياً...');
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/ai/excel-analysis', {
        method: 'POST',
        body: formData
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        setExcelPreviewEntries(resData.entries);
        if (onNotify) {
          onNotify('success', 'نجح تصنيف البيانات بالـ AI 🎉', `تم استخراج وتصنيف عدد ${resData.entries.length} مصروف بنجاح مذهل! يرجى مراجعتها وتأكيد حفظها بالأسفل.`);
        }
      } else {
        throw new Error(resData.error || "فشل تصنيف البيانات بالذكاء الاصطناعي.");
      }
    } catch (err: any) {
      console.error("Excel parse AI error:", err);
      if (onNotify) {
        onNotify('error', 'فشل معالجة شيت Excel', err.message || 'حدث خطأ أثناء معالجة أو تصنيف البيانات.');
      } else {
        alert("فشل تحليل وتصنيف البيانات: " + err.message);
      }
    } finally {
      setIsParsingExcel(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        processExcelFile(file);
      } else {
        alert("الرجاء اختيار ملف Excel صالح (.xlsx, .xls) فقط!");
      }
    }
  };

  const handleSavePreviewEntries = () => {
    if (excelPreviewEntries.length === 0) return;
    onSave([...excelPreviewEntries, ...entries], categories);
    setExcelPreviewEntries([]);
    if (onNotify) {
      onNotify('success', 'تم حفظ القيود بنجاح 💾', `تم اعتماد وحفظ عدد ${excelPreviewEntries.length} قيد مالي مصنف في سجل التكاليف بنجاح!`);
    } else {
      alert("تم حفظ البنود بنجاح!");
    }
  };

  const handleDiscardPreview = () => {
    if (window.confirm("هل أنت متأكد من إلغاء وتجاهل هذه البنود المستخرجة؟")) {
      setExcelPreviewEntries([]);
    }
  };

  const handleUpdatePreviewEntry = (id: string, field: keyof CostEntry, value: any) => {
    setExcelPreviewEntries(prev => prev.map(entry => {
      if (entry.id === id) {
        return { ...entry, [field]: value };
      }
      return entry;
    }));
  };

  const handleDeletePreviewEntry = (id: string) => {
    setExcelPreviewEntries(prev => prev.filter(entry => entry.id !== id));
  };

  useEffect(() => {
    if (engineers.length > 0 && !targetEngineer) {
      setTargetEngineer(engineers[0].name);
    }
  }, [engineers, targetEngineer]);

  const handleEngineerAiAggregate = async () => {
    if (!targetEngineer) {
      alert('الرجاء اختيار المهندس المستهدف أولاً.');
      return;
    }
    if (!targetMonth) {
      alert('الرجاء اختيار الشهر المستهدف للتحليل.');
      return;
    }

    const confirmAgg = window.confirm(
      `هل ترغب في تشغيل التحليل المالي الذكي لعهد ومصروفات المهندس (${targetEngineer}) لشهر (${targetMonth})؟ سيقوم النظام بتجميع البنود وحفظ التقرير تلقائياً بالأرشيف في مجلده.`
    );
    if (!confirmAgg) return;

    setIsEngineerAggregating(true);
    setArchiveUrl('');
    if (onNotify) {
      onNotify('info', 'جاري تحليل عهدة المهندس بالذكاء الاصطناعي 🤖', `يتم فحص وتجميع كافة المصروفات اليومية للمهندس ${targetEngineer} لشهر ${targetMonth}...`);
    }

    try {
      const res = await fetch('/api/ai/aggregate-engineer-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engineerName: targetEngineer, month: targetMonth })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.noData) {
          if (onNotify) {
            onNotify('warning', 'تنبيه', data.message);
          } else {
            alert(data.message);
          }
          return;
        }

        if (onNotify) {
          onNotify('success', 'اكتمل التحليل الذكي وحفظ الأرشيف بنجاح 🎉', data.message);
        } else {
          alert(data.message);
        }

        if (data.archivePath) {
          setArchiveUrl(data.archivePath);
        }

        if (data.addedEntries && data.addedEntries.length > 0) {
          // Replace any previous entries of this engineer and month with the new ones, then save
          const filtered = entries.filter(
            (entry) => !(entry.engineer && entry.engineer.trim().toLowerCase() === targetEngineer.trim().toLowerCase() && entry.date && entry.date.startsWith(targetMonth))
          );
          onSave([...data.addedEntries, ...filtered], categories);
        }
      } else {
        if (onNotify) {
          onNotify('error', 'فشل تحليل عهدة المهندس', data.error || 'حدث خطأ غير متوقع أثناء المعالجة.');
        } else {
          alert(data.error || 'حدث خطأ في التحليل.');
        }
      }
    } catch (err: any) {
      console.error('Engineer AI cost aggregation error:', err);
      if (onNotify) {
        onNotify('error', 'فشل الاتصال بالخادم', err.message || 'خطأ في الشبكة.');
      } else {
        alert('فشل الاتصال بالخادم: ' + err.message);
      }
    } finally {
      setIsEngineerAggregating(false);
    }
  };

  // Generate dynamic months list for the select dropdown (last 24 months)
  const availableMonthsForAnalysis = useMemo(() => {
    const months = [];
    const currentDate = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthStrVal = String(d.getMonth() + 1).padStart(2, '0');
      const value = `${year}-${monthStrVal}`;
      const label = d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
      months.push({ value, label });
    }
    return months;
  }, []);

  // Extract unique months (YYYY-MM) from entries for filter
  const uniqueMonths = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(item => {
      if (item.date) {
        const ym = item.date.substring(0, 7); // YYYY-MM
        if (ym && ym.length === 7) {
          set.add(ym);
        }
      }
    });
    return Array.from(set).sort().reverse();
  }, [entries]);

  // Handle AI Aggregate from petty cash Box Days
  const handleAiAggregate = async () => {
    const confirmAgg = window.confirm(
      'هل ترغب في تشغيل التجميع التراكمي الذكي بالذكاء الاصطناعي؟ سيقوم النظام بتحليل كافة عهد ومصروفات المهندسين غير المجمعة مسبقاً وتصنيفها وإضافتها لبنود التكاليف تراكمياً بشكل فوري.'
    );
    if (!confirmAgg) return;

    setIsAggregating(true);
    if (onNotify) {
      onNotify('info', 'جاري تشغيل التجميع التراكمي الذكي بالـ AI 🤖', 'يتم تحليل وتصنيف كافة المصروفات اليومية للعهد ودمجها تراكمياً...');
    }

    try {
      const res = await fetch('/api/ai/aggregate-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onNotify) {
          onNotify('success', 'نجح التجميع التراكمي بالذكاء الاصطناعي 🎉', data.message);
        } else {
          alert(data.message);
        }
        if (data.addedEntries && data.addedEntries.length > 0) {
          onSave([...data.addedEntries, ...entries], categories);
        } else {
          onSave(entries, categories);
        }
      } else {
        if (onNotify) {
          onNotify('error', 'فشل تجميع المصروفات', data.error || 'حدث خطأ غير متوقع أثناء معالجة البيانات.');
        } else {
          alert(data.error || 'حدث خطأ في التجميع.');
        }
      }
    } catch (err: any) {
      console.error('AI Cost aggregation error:', err);
      if (onNotify) {
        onNotify('error', 'فشل الاتصال بالخادم', err.message || 'خطأ في الشبكة.');
      } else {
        alert('فشل الاتصال بالخادم: ' + err.message);
      }
    } finally {
      setIsAggregating(false);
    }
  };

  // Handle addition of a new category
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCategoryName.trim();
    if (!cleanName) return;

    if (categories.includes(cleanName)) {
      alert('هذا البند موجود بالفعل!');
      return;
    }

    const updatedCategories = [...categories, cleanName];
    onSave(entries, updatedCategories);
    setSelectedCategory(cleanName);
    setNewCategoryName('');
    setShowAddCategoryModal(false);
  };

  // Handle deletion of a custom category
  const handleDeleteCategory = (catToDelete: string) => {
    if (window.confirm(`هل أنت متأكد من حذف بند التصنيف "${catToDelete}"؟ لن يتم حذف المصروفات السابقة المقيدة به.`)) {
      const updatedCategories = categories.filter(c => c !== catToDelete);
      onSave(entries, updatedCategories);
      if (selectedCategory === catToDelete) {
        setSelectedCategory(updatedCategories[0] || '');
      }
    }
  };

  // Handle addition or modification of cost entry
  const handleSubmitEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('الرجاء إدخال قيمة صحيحة للمبلغ');
      return;
    }
    if (!selectedProject) {
      alert('الرجاء اختيار أو إضافة مشروع أولاً في النظام');
      return;
    }

    if (editingId) {
      // Edit mode
      const updated = entries.map(item => {
        if (item.id === editingId) {
          return {
            ...item,
            project: selectedProject,
            category: selectedCategory,
            amount: parsedAmount,
            date: dateInput,
            description: descriptionInput.trim(),
            engineer: selectedEngineer || undefined
          };
        }
        return item;
      });
      onSave(updated, categories);
      setEditingId(null);
    } else {
      // Add mode
      const newEntry: CostEntry = {
        id: 'cost_' + Date.now(),
        project: selectedProject,
        category: selectedCategory,
        amount: parsedAmount,
        date: dateInput,
        description: descriptionInput.trim(),
        engineer: selectedEngineer || undefined
      };
      onSave([newEntry, ...entries], categories);
    }

    // Reset inputs
    setAmountInput('');
    setDescriptionInput('');
    setSelectedEngineer('');
  };

  // Start editing an entry
  const handleStartEdit = (entry: CostEntry) => {
    setEditingId(entry.id);
    setSelectedProject(entry.project);
    setSelectedCategory(entry.category);
    setAmountInput(entry.amount.toString());
    setDateInput(entry.date);
    setDescriptionInput(entry.description);
    setSelectedEngineer(entry.engineer || '');
    // Scroll smoothly to form
    const formElement = document.getElementById('cost-entry-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Cancel edit mode
  const handleCancelEdit = () => {
    setEditingId(null);
    setAmountInput('');
    setDescriptionInput('');
    setSelectedEngineer('');
  };

  // Delete cost entry
  const handleDeleteEntry = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا القيد التحليلي؟')) {
      setIsDeleting(true);
      try {
        // Direct Supabase Hard Delete
        const supabase = await getSupabaseClient();
        if (supabase) {
          const { error: sbErr } = await supabase.from('cost_analysis_entries').delete().eq('id', id);
          if (sbErr) console.error('خطأ في حذف القيد التحليلي من السيرفر:', sbErr.message);
        }

        const res = await fetch('/api/cost-analysis/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const updated = entries.filter(item => item.id !== id);
            onSave(updated, categories);
            if (onRefresh) {
              onRefresh();
            }
          } else {
            alert(`فشل حذف القيد التحليلي: ${data.error || 'خطأ غير معروف'}`);
          }
        } else {
          alert('فشل الاتصال بالسيرفر لحذف القيد التحليلي.');
        }
      } catch (err) {
        console.error('Error deleting cost analysis entry:', err);
        alert('حدث خطأ أثناء الاتصال بالسيرفر لحذف القيد التحليلي.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Save current analysis snapshot to database
  const handleSaveAnalysisSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveEngineerName.trim()) {
      alert('الرجاء إدخال اسم المهندس القائم بالحفظ');
      return;
    }
    setIsSavingAnalysis(true);
    try {
      const res = await fetch('/api/cost-analysis/save-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerName: saveEngineerName.trim(),
          projectName: saveProjectName || 'عام',
          notes: saveNotes.trim(),
          entries: entries, // Save snapshot of entries
          categories: categories // Save snapshot of categories
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (onNotify) {
            onNotify('success', 'تم حفظ التحليل المالي بنجاح 💾', `تم تسجيل وحفظ الحالة الحالية باسم المهندس ${saveEngineerName} للرجوع إليها لاحقاً.`);
          } else {
            alert('تم الحفظ بنجاح!');
          }
          setShowSaveModal(false);
          setSaveNotes('');
          fetchSavedAnalyses();
        } else {
          alert('فشل حفظ التحليل: ' + (data.error || 'خطأ غير معروف'));
        }
      } else {
        alert('فشل الاتصال بالسيرفر لحفظ التحليل.');
      }
    } catch (err: any) {
      console.error('Error saving analysis:', err);
      alert('حدث خطأ أثناء الحفظ: ' + err.message);
    } finally {
      setIsSavingAnalysis(false);
    }
  };

  // Restore a saved analysis snapshot
  const handleRecallAnalysis = (analysis: any) => {
    if (window.confirm(`هل أنت متأكد من استدعاء التحليل المحفوظ بتاريخ ${new Date(analysis.date).toLocaleString('ar-EG')}؟ سيؤدي ذلك إلى استبدال بنود التكاليف الحالية بالكامل بالنسخة المسترجعة.`)) {
      onSave(analysis.entries, analysis.categories);
      if (onNotify) {
        onNotify('success', 'تم استدعاء التحليل بنجاح 📂', `تم استرجاع عدد ${analysis.entries.length} بند مصنف وحالة بنود التحليل لحظياً بنجاح!`);
      } else {
        alert('تم استدعاء التحليل بنجاح!');
      }
      setShowRecallModal(false);
    }
  };

  // Delete a saved analysis from list
  const handleDeleteSavedAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('هل أنت متأكد من حذف هذا التحليل المحفوظ نهائياً؟')) {
      try {
        const res = await fetch('/api/cost-analysis/delete-saved-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setSavedAnalyses(prev => prev.filter(item => item.id !== id));
            if (onNotify) {
              onNotify('success', 'تم حذف التحليل المحفوظ 🗑️', 'تم إزالة سجل التحليل المحفوظ نهائياً.');
            }
          }
        }
      } catch (err) {
        console.error('Error deleting saved analysis:', err);
      }
    }
  };

  // Danger Zone - Clear all entries
  const handleClearAllItems = async () => {
    if (window.confirm('⚠️ تحذير شديد الخطورة: هل أنت متأكد تماماً من رغبتك في حذف وتصفير كافة بنود التحليل التكاليف الحالي بالكامل؟ سيتم مسح جدول التكاليف الحالي نهائياً والبدء على مياه بيضاء 100% ولا يمكن التراجع عن هذا الإجراء.')) {
      if (window.confirm('تأكيد أخير: هل أنت متأكد؟')) {
        try {
          const res = await fetch('/api/cost-analysis/clear-current', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              onSave([], categories);
              if (onNotify) {
                onNotify('success', 'تم تصفير الجدول بنجاح 🧹', 'تم مسح وتصفير كافة بنود التكاليف الحالية بنجاح، وبدء صفحة جديدة.');
              } else {
                alert('تم تصفير كافة البنود بنجاح!');
              }
              if (onRefresh) {
                onRefresh();
              }
            } else {
              alert('فشل تصفير التكاليف الحالية: ' + (data.error || 'خطأ غير معروف'));
            }
          }
        } catch (err: any) {
          console.error('Error clearing cost entries:', err);
          alert('حدث خطأ أثناء الاتصال بالخادم لتصفير البيانات: ' + err.message);
        }
      }
    }
  };

  // Memoized mapping of petty cash daily box transactions into CostEntry list
  const mappedPettyCashEntries = useMemo(() => {
    if (!boxDays || boxDays.length === 0) return [];
    if (filterEngineer === 'all' || filterMonthYear === 'all') return [];

    const result: CostEntry[] = [];
    
    // helper to map description to category based on keywords
    const mapDescriptionToCategory = (desc: string, availableCategories: string[]): string => {
      const normalized = desc.toLowerCase();
      const mappings: { keywords: string[]; category: string }[] = [
        { keywords: ['حديد', 'أسمنت', 'طوب', 'رمل', 'خرسانة', 'خامات', 'مواد', 'سيراميك', 'جبس', 'دهان'], category: 'مواد تشغيل' },
        { keywords: ['يومية', 'عامل', 'صنايعي', 'أجرة', 'مصنعية', 'عمال', 'عمالة', 'راتب', 'رواتب', 'مهندسين'], category: 'يوميات وعمالة' },
        { keywords: ['نقل', 'مشوار', 'توصيل', 'تاكسي', 'شحن', 'مواصلات', 'سفر', 'بنزين', 'سولار'], category: 'انتقالات ومواصلات' },
        { keywords: ['غداء', 'عشاء', 'فطور', 'أكل', 'شاي', 'قهوة', 'ضيافة', 'مياه', 'وجبة'], category: 'ضيافة وإقامة' },
        { keywords: ['تأجير', 'إيجار', 'لودر', 'حفار', 'ونش', 'معدة', 'مولد', 'سقالة'], category: 'إيجار معدات' },
        { keywords: ['فاتورة', 'كهرباء', 'رخصة', 'رصيد', 'شحن', 'تصاريح', 'غرامة', 'دمغة'], category: 'مصروفات إدارية ورخص' },
      ];

      for (const map of mappings) {
        if (map.keywords.some(keyword => normalized.includes(keyword))) {
          const matched = availableCategories.find(c => c.includes(map.category) || map.category.includes(c));
          if (matched) return matched;
        }
      }

      // Default category fallback
      const defaultCat = availableCategories.find(c => c.includes('عهد') || c.includes('مصروفات') || c.includes('تشغيل')) || availableCategories[0] || 'مواد تشغيل';
      return defaultCat;
    };

    boxDays.forEach((day: any) => {
      if (!day || !day.date || !day.date.startsWith(filterMonthYear)) return;
      
      if (day.engineer && day.engineer.trim().toLowerCase() === filterEngineer.trim().toLowerCase()) {
        const txs = day.transactions || [];
        txs.forEach((tx: any) => {
          if (tx.outflow && tx.outflow > 0) {
            result.push({
              id: `petty-${day.date}-${tx.id}-${tx.outflow}`,
              project: tx.project || 'عام / إدارة',
              category: mapDescriptionToCategory(tx.description || '', categories),
              amount: tx.outflow,
              date: day.date,
              description: `[حركة الصندوق والعهد] ${tx.description || ''} (${tx.method || 'نقدي'})`,
              engineer: day.engineer
            });
          }
        });
      }
    });

    return result;
  }, [boxDays, filterEngineer, filterMonthYear, categories]);

  // Filtered cost entries for display
  const filteredEntries = useMemo(() => {
    const baseFiltered = entries.filter(item => {
      const matchProject = filterProject === 'all' || item.project === filterProject;
      const matchCategory = filterCategory === 'all' || item.category === filterCategory;
      const matchEngineer = filterEngineer === 'all' || item.engineer === filterEngineer;
      
      let matchMonthYear = true;
      if (filterMonthYear !== 'all') {
        const itemYM = item.date ? item.date.substring(0, 7) : '';
        matchMonthYear = itemYM === filterMonthYear;
      }

      const matchSearch = !searchTerm.trim() || 
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.engineer && item.engineer.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchProject && matchCategory && matchEngineer && matchMonthYear && matchSearch;
    });

    const filteredMapped = mappedPettyCashEntries.filter(item => {
      const matchProject = filterProject === 'all' || item.project === filterProject;
      const matchCategory = filterCategory === 'all' || item.category === filterCategory;
      const matchSearch = !searchTerm.trim() || 
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.project.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchProject && matchCategory && matchSearch;
    });

    return [...filteredMapped, ...baseFiltered];
  }, [entries, mappedPettyCashEntries, filterProject, filterCategory, filterEngineer, filterMonthYear, searchTerm]);

  // Total cost computed from active filtered list
  const totalFilteredAmount = useMemo(() => {
    return filteredEntries.reduce((sum, item) => sum + item.amount, 0);
  }, [filteredEntries]);

  // Grouped by Category for chart
  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {};
    // Initialize with 0 for active categories to represent empty ones if desired, or just dynamically fill
    categories.forEach(cat => {
      map[cat] = 0;
    });

    entries.forEach(entry => {
      if (filterProject === 'all' || entry.project === filterProject) {
        map[entry.category] = (map[entry.category] || 0) + entry.amount;
      }
    });

    const totalAll = Object.values(map).reduce((a, b) => a + b, 0);

    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        percentage: totalAll > 0 ? ((value / totalAll) * 100).toFixed(1) : '0'
      }))
      .filter(item => item.value > 0); // Only show categories with spending
  }, [entries, categories, filterProject]);

  // Grouped by Project for bar chart
  const projectChartData = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(entry => {
      if (filterCategory === 'all' || entry.category === filterCategory) {
        map[entry.project] = (map[entry.project] || 0) + entry.amount;
      }
    });

    return Object.entries(map).map(([name, value]) => ({
      name,
      value
    }));
  }, [entries, filterCategory]);

  // Color Palette for Pie Chart
  const COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#3b82f6'  // Blue
  ];

  // Excel Export
  const handleExportExcel = () => {
    if (filteredEntries.length === 0) {
      alert('لا توجد بيانات لتصديرها!');
      return;
    }

    const wsData = [
      ["تقرير تحليل وتصنيف بنود مصروفات المشاريع", "", "", "", ""],
      ["تاريخ التصدير:", new Date().toLocaleDateString('ar-EG'), "", "", ""],
      ["إجمالي المصروفات المصنفة:", `${totalFilteredAmount.toLocaleString()} EGP`, "", "", ""],
      [], // Spacer
      ["المشروع", "بند التصنيف / التكلفة", "المبلغ (EGP)", "التاريخ", "البيان والوصف التفصيلي"]
    ];

    filteredEntries.forEach(item => {
      wsData.push([
        item.project,
        item.category,
        item.amount,
        item.date,
        item.description
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Styling the sheet
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Merge title row
    ];

    // Styles
    const titleStyle = {
      font: { name: 'Segoe UI', size: 14, bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "312E81" } }, // Deep Indigo
      alignment: { horizontal: "center", vertical: "center" }
    };

    const headerStyle = {
      font: { name: 'Segoe UI', size: 11, bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "4F46E5" } }, // Indigo
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "818CF8" } },
        bottom: { style: "medium", color: { rgb: "111827" } },
        left: { style: "thin", color: { rgb: "818CF8" } },
        right: { style: "thin", color: { rgb: "818CF8" } }
      }
    };

    const cellStyle = {
      font: { name: 'Segoe UI', size: 10 },
      alignment: { horizontal: "right", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "E5E7EB" } },
        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
        left: { style: "thin", color: { rgb: "E5E7EB" } },
        right: { style: "thin", color: { rgb: "E5E7EB" } }
      }
    };

    const amountCellStyle = {
      ...cellStyle,
      numFmt: '#,##0" EGP"',
      font: { name: 'Segoe UI', size: 10, bold: true, color: { rgb: "10B981" } }
    };

    // Apply Styles to cell range
    ws['A1'].s = titleStyle;
    
    // Header Row is index 4 (0-based)
    const cols = ['A', 'B', 'C', 'D', 'E'];
    cols.forEach(col => {
      ws[`${col}5`].s = headerStyle;
    });

    // Body Cells
    for (let r = 5; r < wsData.length; r++) {
      cols.forEach((col, cIdx) => {
        const cellRef = `${col}${r + 1}`;
        if (!ws[cellRef]) return;
        
        if (cIdx === 2) {
          ws[cellRef].s = amountCellStyle;
        } else {
          ws[cellRef].s = cellStyle;
        }
      });
    }

    // Columns widths
    ws['!cols'] = [
      { wch: 20 }, // Project
      { wch: 22 }, // Category
      { wch: 18 }, // Amount
      { wch: 15 }, // Date
      { wch: 45 }  // Description
    ];

    // Create workbook & write
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تحليل بنود التكلفة");
    XLSX.writeFile(wb, `تحليل_وتصنيف_المصروفات_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Scoped style block to force landscape/portrait print specifically for this financial report */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: ${isPrintLandscape ? 'landscape' : 'portrait'} !important;
            margin: 8mm 10mm 8mm 10mm !important;
          }
        }
      `}} />

      {/* Print-only beautifully styled header */}
      <div className="hidden print:block w-full text-right mb-6 font-sans text-black" dir="rtl">
        <div className="border-4 border-dashed border-[#4F81BD] p-5 bg-white space-y-4">
          <div className="text-center pb-3 border-b-2 border-dashed border-[#4F81BD]">
            <h2 className="text-xl font-black text-[#1F4E78]">كشف تحليل وتصنيف بنود مصروفات المشاريع</h2>
            <p className="text-xs font-bold text-slate-700 mt-1">التقرير التحليلي المالي المستخرج من النظام الذكي</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-800">
            <div>المشروع المستهدف: <span className="font-black text-[#1F4E78]">{filterProject === 'all' ? 'كافة المشاريع' : filterProject}</span></div>
            <div>بند التكلفة: <span className="font-black text-[#1F4E78]">{filterCategory === 'all' ? 'كافة البنود' : filterCategory}</span></div>
            <div>المهندس المسؤول: <span className="font-black text-[#1F4E78]">{filterEngineer === 'all' ? 'كافة المهندسين' : filterEngineer}</span></div>
            <div>الفترة الزمنية: <span className="font-black text-[#1F4E78]">{filterMonthYear === 'all' ? 'كافة التواريخ والأشهر' : filterMonthYear}</span></div>
          </div>
          <div className="text-[10px] text-slate-500 font-bold border-t border-dashed border-slate-300 pt-2 text-left">
            تاريخ استخراج التقرير: {new Date().toLocaleDateString('ar-EG')} | عدد البنود المدرجة: {filteredEntries.length} | إجمالي المصروفات: {totalFilteredAmount.toLocaleString()} EGP
          </div>
        </div>
      </div>
      {/* AI Monthly Engineer Cost Aggregation Action Panel */}
      <div className="bg-[#111827] border border-amber-500/20 p-6 rounded-2xl shadow-lg relative overflow-hidden no-print">
        <div className="absolute right-0 top-0 h-full w-1.5 bg-gradient-to-b from-indigo-500 to-amber-500" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>تجميع وتحليل عهدة مهندس شهرية بالذكاء الاصطناعي 🤖</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              اختر المهندس والشهر المستهدف، وسيقوم نظام الذكاء الاصطناعي بجلب كافة مصروفات العهدة المعتمدة وتصنيفها آلياً إلى بنود التكلفة (بوفيه، مواد بناء، عمالة...)، مع حفظ ملف Excel منظم ومطابق لمعايير الطباعة تلقائياً في الأرشيف التاريخي لمجلد المهندس على السيرفر.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 w-full lg:w-auto shrink-0">
            <div className="min-w-[160px]">
              <label className="text-[10px] text-slate-400 font-bold block mb-1">اختر المهندس:</label>
              <select
                value={targetEngineer}
                onChange={(e) => setTargetEngineer(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 cursor-pointer font-bold"
              >
                <option value="">-- اختر المهندس --</option>
                {engineers.map((eng) => (
                  <option key={eng.id} value={eng.name}>
                    {eng.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[160px]">
              <label className="text-[10px] text-slate-400 font-bold block mb-1">اختر الشهر والسنة:</label>
              <select
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 cursor-pointer font-bold"
              >
                {availableMonthsForAnalysis.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleEngineerAiAggregate}
              disabled={isEngineerAggregating}
              className="px-5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{isEngineerAggregating ? "جاري تجميع وتحليل البيانات..." : "تحليل المصروفات 🤖"}</span>
            </button>
          </div>
        </div>

        {archiveUrl && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">تم حفظ شيت Excel بنجاح بمجلد المهندس! يمكنك تحميله للطباعة الفورية:</span>
            </div>
            <a
              href={`/api/documents/download?path=${encodeURIComponent(archiveUrl)}`}
              className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-950/40"
              download
            >
              <Download className="w-3.5 h-3.5" />
              <span>تحميل شيت الأرشيف المعتمد 📊</span>
            </a>
          </div>
        )}
      </div>

      {/* --- AI-Powered Excel Upload & Classification Section --- */}
      <div className="bg-[#111827] border border-indigo-500/20 p-6 rounded-2xl shadow-lg relative overflow-hidden no-print space-y-6">
        <div className="absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-indigo-500 to-purple-600" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>استيراد وتصنيف مصروفات الموقع الذكي من Excel 📊🤖</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              قم برفع شيت Excel يحتوي على بنود ومصروفات عهدة الموقع، وسيقوم الذكاء الاصطناعي باستخراج القيم وتصنيفها آلياً إلى البنود المعتمدة في النظام.
            </p>
          </div>
          
          <div className="text-right text-[10px] text-slate-400 font-bold bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800">
            البنود المتاحة للتصنيف: {categories.join(' | ')}
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('excel-file-upload-input')?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragOver 
              ? 'border-indigo-400 bg-indigo-500/10 shadow-lg shadow-indigo-950/20 scale-[1.01]' 
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
          }`}
        >
          <input
            id="excel-file-upload-input"
            type="file"
            accept=".xlsx, .xls"
            onChange={handleExcelFileSelect}
            className="hidden"
          />
          
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className={`p-4 rounded-2xl transition-all ${isDragOver ? 'bg-indigo-500/20 text-indigo-400 scale-110' : 'bg-slate-900/60 text-slate-400'}`}>
              <Grid className="w-8 h-8" />
            </div>
            
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-200">
                {isDragOver ? 'أفلت الملف الآن للبدء! 🚀' : 'اسحب وأفلت ملف الـ Excel الخاص بالمصروفات هنا'}
              </p>
              <p className="text-[10px] text-slate-500">
                أو انقر لتصفح الملفات من جهازك (يدعم صيغ .xlsx أو .xls)
              </p>
            </div>
          </div>
        </div>

        {/* Loading / Processing State */}
        {isParsingExcel && (
          <div className="p-6 bg-indigo-500/5 border border-indigo-500/15 rounded-xl flex flex-col items-center justify-center space-y-4 text-center animate-pulse">
            <div className="relative">
              <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <Sparkles className="w-4 h-4 text-amber-400 absolute inset-0 m-auto" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-extrabold text-white">جاري تحليل شيت المصروفات وتصنيف البنود بالـ AI... 🤖</p>
              <p className="text-[10px] text-slate-400">يقوم نموذج جيمي فلاش الآن بفحص محتويات الملف ومطابقة الأوصاف والمبالغ مع بنود السجلات المعتمدة.</p>
            </div>
          </div>
        )}

        {/* Classified Excel Preview Table */}
        {excelPreviewEntries.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl">
              <div className="flex items-center gap-2 text-right">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-amber-400">مراجعة البنود المستخرجة والمصنفة بالذكاء الاصطناعي</h4>
                  <p className="text-[10px] text-slate-400">تم استخراج {excelPreviewEntries.length} قيد مالي بنجاح. يمكنك تعديل المشروع أو بند تصنيف التكلفة من الجدول مباشرة قبل الحفظ.</p>
                </div>
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button
                  onClick={handleDiscardPreview}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>تجاهل الكل</span>
                </button>
                <button
                  onClick={handleSavePreviewEntries}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-indigo-950/55"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>اعتماد وحفظ القيود في السجلات</span>
                </button>
              </div>
            </div>

            {/* Preview Editable Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/20 max-h-[400px]">
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-900/60 sticky top-0 z-10 select-none">
                    <th className="py-2.5 px-3">المشروع</th>
                    <th className="py-2.5 px-3">بند تصنيف المصروف</th>
                    <th className="py-2.5 px-3 text-left">المبلغ (EGP)</th>
                    <th className="py-2.5 px-3">التاريخ</th>
                    <th className="py-2.5 px-3">الوصف والبيان التفصيلي للعهدة</th>
                    <th className="py-2.5 px-3 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {excelPreviewEntries.map(item => (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.project}
                          onChange={(e) => handleUpdatePreviewEntry(item.id, 'project', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 text-xs outline-none focus:border-indigo-500 font-bold"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={item.category}
                          onChange={(e) => handleUpdatePreviewEntry(item.id, 'category', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 text-xs outline-none focus:border-indigo-500 cursor-pointer font-bold"
                        >
                          {categories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 text-left">
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => handleUpdatePreviewEntry(item.id, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-24 bg-slate-900 border border-slate-700 text-emerald-400 text-left rounded px-2 py-1 text-xs font-mono font-bold outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="date"
                          value={item.date}
                          onChange={(e) => handleUpdatePreviewEntry(item.id, 'date', e.target.value)}
                          className="w-32 bg-slate-900 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs font-mono outline-none focus:border-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleUpdatePreviewEntry(item.id, 'description', e.target.value)}
                          className="w-full min-w-[200px] bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeletePreviewEntry(item.id)}
                          className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Overview stats panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#111827] border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1.5 bg-indigo-500" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">إجمالي المصروفات المحللة</span>
              <span className="text-2xl font-black text-white block font-mono">
                {totalFilteredAmount.toLocaleString('en-US')} <span className="text-xs text-indigo-400">EGP</span>
              </span>
            </div>
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/15">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-3.5 flex items-center gap-1.5">
            <span>نشط لعدد {filteredEntries.length} قيد مستهدف بالتصفية</span>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1.5 bg-emerald-500" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">بنود التصنيف المعتمدة</span>
              <span className="text-2xl font-black text-white block font-mono">
                {categories.length} <span className="text-xs text-emerald-400">بند</span>
              </span>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/15">
              <Tag className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-3.5 flex justify-between items-center">
            <span>توزيع تصنيف مرن حسب البند المخصص</span>
            <button 
              onClick={() => setShowAddCategoryModal(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-extrabold cursor-pointer flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> بند جديد
            </button>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 p-5 rounded-2xl shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 h-full w-1.5 bg-amber-500" />
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">أعلى بند صرف حالياً</span>
              <span className="text-xl font-bold text-white block truncate max-w-[200px]">
                {categoryChartData[0]?.name || 'لا يوجد'}
              </span>
            </div>
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/15">
              <PieIcon className="w-5 h-5" />
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-3.5 flex items-center gap-1">
            <span>يمثل قيمة صرف تبلغ {(categoryChartData[0]?.value || 0).toLocaleString()} EGP ({categoryChartData[0]?.percentage || 0}%)</span>
          </div>
        </div>
      </div>

      {/* Save Current Analysis Modal Container */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleSaveAnalysisSubmit}
            className="bg-[#111827] border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 text-right"
            dir="rtl"
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Database className="text-indigo-400 w-4 h-4" />
              <span>حفظ حالة التحليل الحالي 💾</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              سيتم حفظ لقطة (Snapshot) متكاملة لكافة بنود التكاليف المصنفة المسجلة حالياً وتوزيعاتها للرجوع إليها أو استدعائها في أي وقت.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">اسم المهندس القائم بالحفظ:</label>
                <select
                  required
                  value={saveEngineerName}
                  onChange={(e) => setSaveEngineerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- اختر المهندس --</option>
                  {engineers.map((eng) => (
                    <option key={eng.id} value={eng.name}>{eng.name}</option>
                  ))}
                  <option value="المهندس المسؤول">المهندس المسؤول</option>
                  <option value="الإدارة المالية">الإدارة المالية</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">اسم المشروع المرتبط (اختياري):</label>
                <select
                  value={saveProjectName}
                  onChange={(e) => setSaveProjectName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="عام">عام / كل المشاريع</option>
                  {projectsList.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">ملاحظات توضيحية إضافية:</label>
                <textarea
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  placeholder="أدخل أي ملاحظات تفصيلية حول هذا التحليل المالي..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSavingAnalysis}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isSavingAnalysis ? 'جاري الحفظ...' : 'حفظ السجل المحفوظ'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recall Saved Analysis Modal Container */}
      {showRecallModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl max-w-2xl w-full space-y-4 text-right" dir="rtl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="text-amber-400 w-4 h-4" />
                <span>استدعاء تحليل مالي سابق 📂</span>
              </h3>
              <button 
                onClick={() => setShowRecallModal(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              تصفح قائمة التحليلات التي تم حفظها مسبقاً. بمجرد استدعاء أحد السجلات، سيتم استبدال جدول بنود مصروفات التكاليف بالكامل بنسخة السجل المسترجعة.
            </p>

            <div className="max-h-[350px] overflow-y-auto space-y-3 pr-1">
              {isFetchingSaved ? (
                <div className="text-center py-10 text-slate-500 text-xs font-bold">جاري تحميل السجلات المحفوظة...</div>
              ) : savedAnalyses.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs font-bold border border-dashed border-slate-800 rounded-xl bg-slate-900/10">
                  لا توجد تحليلات محفوظة حالياً في قاعدة البيانات.
                </div>
              ) : (
                savedAnalyses.map((analysis) => (
                  <div 
                    key={analysis.id}
                    onClick={() => handleRecallAnalysis(analysis)}
                    className="p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
                  >
                    <div className="space-y-1.5 text-right">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-white">المهندس القائم بالحفظ: {analysis.engineerName}</span>
                        <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded text-[9px] font-bold">
                          {analysis.projectName || 'عام'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        تاريخ الحفظ: {new Date(analysis.date).toLocaleString('ar-EG')}
                      </div>
                      {analysis.notes && (
                        <p className="text-[11px] text-slate-400 bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-850 max-w-md leading-relaxed">
                          {analysis.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-center">
                      <div className="text-left font-mono">
                        <div className="text-xs font-extrabold text-emerald-400">
                          {analysis.entries?.length || 0} بنود
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold">
                          {analysis.categories?.length || 0} تصنيفات
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSavedAnalysis(analysis.id, e)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer opacity-80 sm:opacity-0 group-hover:opacity-100"
                        title="حذف السجل المحفوظ نهائياً"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowRecallModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Form & Custom Category Modal Container */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleAddCategory}
            className="bg-[#111827] border border-slate-800 p-6 rounded-2xl max-w-md w-full space-y-4 text-right"
            dir="rtl"
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Tag className="text-indigo-400 w-4 h-4" />
              <span>إضافة بند تحليل ومصروف مخصص</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              تتيح لك هذه الميزة إدخال بنود تحليلية جديدة تماماً غير البنود الافتراضية (مثل مواد تشغيل، بوفيه، إلخ) لمواءمة طبيعة الصرف مستقبلاً.
            </p>

            <div>
              <label className="text-xs text-slate-400 font-bold block mb-1">اسم بند المصروف والتحليل الجديد:</label>
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="مثال: انتقالات ومواصلات، أجور حفر..."
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة بند التصنيف</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Input Entry Form */}
      <div id="cost-entry-form" className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4 no-print">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span>{editingId ? 'تعديل قيد تصنيف وتحليل المصروفات' : 'قيد وتصنيف مصروف جديد من عهدة المهندس'}</span>
        </h3>

        <form onSubmit={handleSubmitEntry} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="text-xs text-slate-400 font-bold block mb-1">المشروع المستهدف</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 cursor-pointer font-bold"
            >
              {projectsList.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs text-slate-400 font-bold block">بند تصنيف التكلفة</label>
              <button 
                type="button" 
                onClick={() => setShowAddCategoryModal(true)} 
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
              >
                + بند جديد
              </button>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 cursor-pointer font-bold"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-bold block mb-1">المبلغ المصروف (EGP)</label>
            <input
              type="number"
              required
              step="any"
              placeholder="مثال: 4500"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-bold block mb-1">تاريخ الصرف</label>
            <input
              type="date"
              required
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 cursor-pointer font-bold"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-bold block mb-1">المهندس المسؤول</label>
            <select
              value={selectedEngineer}
              onChange={(e) => setSelectedEngineer(e.target.value)}
              className="w-full bg-[#1e293b] border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 cursor-pointer font-bold"
            >
              <option value="">-- غير محدد / عام --</option>
              {engineers.map(eng => (
                <option key={eng.id} value={eng.name}>{eng.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5">
            <label className="text-xs text-slate-400 font-bold block mb-1">الوصف التفصيلي والبيان (شرح الصرف والعهد)</label>
            <textarea
              required
              placeholder="اكتب شرحاً وافياً لبند المصروف والجهة التي صرف لها..."
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-5 flex justify-end gap-2 pt-2 border-t border-slate-800/60">
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إلغاء التعديل
              </button>
            )}
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{editingId ? 'حفظ تعديلات البند' : 'إضافة بند التحليل إلى السجل'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Charts & Interactive Dashboards */}
      {entries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 charts-print-container">
          {/* Category spending distribution chart */}
          <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md flex flex-col space-y-4 chart-card">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800/60 pb-3">
              <PieIcon className="text-indigo-400 w-4 h-4" />
              <span>توزيع نسب بنود التكلفة (مخطط دائري)</span>
            </h3>

            {categoryChartData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-10">
                <span className="text-xs">لا توجد بيانات كافية للرسم البياني</span>
              </div>
            ) : (
              <div className="flex-1 min-h-[280px] grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={75}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => [`${parseFloat(value).toLocaleString()} EGP`, 'القيمة']}
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#334155', borderRadius: '12px', color: '#fff', textAlign: 'right' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 text-right">
                  <h4 className="text-[11px] font-extrabold text-slate-400 border-b border-slate-850 pb-1">النسب المئوية لكل بند:</h4>
                  <div className="max-h-[180px] overflow-y-auto space-y-2.5 pr-1">
                    {categoryChartData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                          />
                          <span className="text-slate-300 font-bold truncate max-w-[110px]">{item.name}</span>
                        </div>
                        <span className="font-mono font-bold text-white">
                          {item.percentage}% <span className="text-[9px] text-slate-500">({item.value.toLocaleString()} EGP)</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Project spending bar chart */}
          <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md flex flex-col space-y-4 chart-card">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800/60 pb-3">
              <Folder className="text-indigo-400 w-4 h-4" />
              <span>تحليل مصروفات بنود التكلفة حسب المشاريع</span>
            </h3>

            {projectChartData.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-10">
                <span className="text-xs">لا توجد بيانات مصروفات حسب المشاريع</span>
              </div>
            ) : (
              <div className="flex-1 min-h-[280px] flex flex-col justify-center">
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={projectChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip 
                        formatter={(value: any) => [`${parseFloat(value).toLocaleString()} EGP`, 'إجمالي الصرف']}
                        contentStyle={{ backgroundColor: '#111827', borderColor: '#334155', borderRadius: '12px', color: '#fff', textAlign: 'right' }}
                      />
                      <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                        {projectChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filtering & Table Panel */}
      <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4 no-print">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/60 pb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Grid className="text-indigo-400 w-4 h-4" />
            <span>سجل بنود المصروفات المحللة والمصنفة</span>
          </h3>

          <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
            <label className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 cursor-pointer hover:bg-slate-850 hover:border-slate-700 transition-all no-print select-none">
              <input
                type="checkbox"
                checked={showSignaturesInPrint}
                onChange={(e) => setShowSignaturesInPrint(e.target.checked)}
                className="rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span>توقيعات الطباعة</span>
            </label>
            <label className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 cursor-pointer hover:bg-slate-850 hover:border-slate-700 transition-all no-print select-none">
              <input
                type="checkbox"
                checked={isPrintLandscape}
                onChange={(e) => setIsPrintLandscape(e.target.checked)}
                className="rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
              />
              <span>طباعة عرضية (Landscape)</span>
            </label>

            {/* Elegant Analysis Actions Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold border border-indigo-500/30 transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-950/40"
              >
                <Settings className="w-3.5 h-3.5 text-indigo-200" />
                <span>إجراءات التحليل ⚙️</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showActionsDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showActionsDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowActionsDropdown(false)} 
                  />
                  <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-20 py-1.5 divide-y divide-slate-800 animate-in fade-in slide-in-from-top-2 duration-200" dir="rtl">
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionsDropdown(false);
                          setShowSaveModal(true);
                        }}
                        className="w-full text-right px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Database className="w-3.5 h-3.5 text-indigo-400" />
                        <span>حفظ التحليل الحالي 💾</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionsDropdown(false);
                          setShowRecallModal(true);
                          fetchSavedAnalyses();
                        }}
                        className="w-full text-right px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5 text-amber-400" />
                        <span>استدعاء تحليل سابق 📂</span>
                      </button>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionsDropdown(false);
                          handleAiAggregate();
                        }}
                        disabled={isAggregating}
                        className="w-full text-right px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{isAggregating ? 'جاري التجميع...' : 'تجميع المصروفات بالذكاء الاصطناعي 🤖'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionsDropdown(false);
                          handleExportExcel();
                        }}
                        className="w-full text-right px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        <span>تصدير لشيت Excel المنسق 📊</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionsDropdown(false);
                          window.print();
                        }}
                        className="w-full text-right px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#4F81BD]" />
                        <span>طباعة كشف التحليل المالي 🖨️</span>
                      </button>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowActionsDropdown(false);
                          handleClearAllItems();
                        }}
                        className="w-full text-right px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        <span>تصفير وحذف كافة البنود ⚠️</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800/60">
          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1">تصفية حسب المشروع:</label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 cursor-pointer font-bold"
            >
              <option value="all">كل المشاريع</option>
              {projectsList.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1">تصفية حسب بند التكلفة:</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 cursor-pointer font-bold"
            >
              <option value="all">كل بنود التكلفة</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1">المهندس المسؤول:</label>
            <select
              value={filterEngineer}
              onChange={(e) => setFilterEngineer(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 cursor-pointer font-bold"
            >
              <option value="all">كل المهندسين</option>
              {engineers.map(eng => (
                <option key={eng.id} value={eng.name}>{eng.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1">الشهر / السنة:</label>
            <select
              value={filterMonthYear}
              onChange={(e) => setFilterMonthYear(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 cursor-pointer font-bold"
            >
              <option value="all">كل التواريخ</option>
              {uniqueMonths.map(ym => {
                const [year, month] = ym.split('-');
                return (
                  <option key={ym} value={ym}>{month} / {year}</option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1">بحث في البيان / المهندس:</label>
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث هنا..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg pl-3 pr-8 py-1.5 text-xs outline-none focus:border-indigo-500"
              />
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {/* Dynamic Petty Cash aggregation status alert banner */}
        {filterEngineer !== 'all' && filterMonthYear !== 'all' && (
          <div className="bg-slate-900/60 border border-indigo-500/10 p-4 rounded-xl flex items-center gap-3 no-print">
            <AlertCircle className="text-indigo-400 w-5 h-5 flex-shrink-0" />
            <div className="text-xs font-bold text-slate-300">
              {mappedPettyCashEntries.length > 0 ? (
                <span>
                  تم دمج وتوزيع تلقائي لـ <span className="text-indigo-400 font-extrabold font-mono text-sm">{mappedPettyCashEntries.length}</span> مصروفات لعهدة المهندس <span className="text-indigo-400 font-extrabold">({filterEngineer})</span> لشهر <span className="text-indigo-400 font-extrabold font-mono">({filterMonthYear})</span> من حركة الصندوق والعهد.
                </span>
              ) : (
                <span className="text-amber-400">
                  تنبيه لطيف: لم يتم العثور على أي مصروفات عهدة مسجلة للمهندس <span className="font-extrabold">({filterEngineer})</span> في حركة الصندوق لشهر <span className="font-extrabold font-mono">({filterMonthYear})</span>.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Categories management quick rails */}
        <div className="flex flex-wrap gap-2 items-center text-xs">
          <span className="text-slate-400 font-bold">إدارة بنود التحليل المستهدفة:</span>
          {categories.map(cat => (
            <div 
              key={cat} 
              className="px-2 py-1 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg flex items-center gap-1.5 group transition-all"
            >
              <span>{cat}</span>
              {/* Do not allow deleting system default categories easily or allow it with a click */}
              {categories.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat)}
                  className="text-slate-500 hover:text-red-400 rounded-md p-0.5 group-hover:opacity-100 cursor-pointer"
                  title="حذف هذا البند"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
          <button 
            onClick={() => setShowAddCategoryModal(true)}
            className="px-2 py-1 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 rounded-lg flex items-center gap-1 cursor-pointer font-bold"
          >
            <Plus className="w-3 h-3" /> إضافة بند جديد
          </button>
        </div>

        {/* Data table */}
        <div className="overflow-x-auto border border-slate-850 rounded-xl bg-slate-900/10">
          <table id="cost-analysis-table" className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-900/40 select-none">
                <th className="py-3 px-4">المشروع</th>
                <th className="py-3 px-4">بند تصنيف المصروف</th>
                <th className="py-3 px-4">المهندس المسؤول</th>
                <th className="py-3 px-4 text-left">المبلغ المصروف</th>
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">شرح والبيان التفصيلي للعهدة والمشروع</th>
                <th className="py-3 px-4 text-center no-print">خيارات التحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-bold">
                    لا توجد بنود مصروفات مقيدة مطابقة لخيارات التصفية الحالية.
                  </td>
                </tr>
              ) : (
                filteredEntries.map(item => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-bold text-white">{item.project}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-[10px] font-extrabold">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-indigo-300">{item.engineer || 'عام / إدارة'}</td>
                    <td className="py-3 px-4 font-mono font-extrabold text-emerald-400 text-left">
                      {item.amount.toLocaleString()} <span className="text-[9px] text-slate-500">EGP</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{item.date}</td>
                    <td className="py-3 px-4 text-slate-300 leading-relaxed max-w-xs truncate" title={item.description}>
                      {item.description}
                    </td>
                    <td className="py-3 px-4 text-center no-print">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="px-2.5 py-1 text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-750 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(item.id)}
                          disabled={isDeleting}
                          className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          title="حذف بند التحليل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredEntries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900/50 border-t border-slate-800 text-white font-extrabold">
                  <td className="py-3.5 px-4" colSpan={3}>إجمالي المصروفات المحللة المعروضة:</td>
                  <td className="py-3.5 px-4 text-left font-mono text-emerald-400 text-sm">
                    {totalFilteredAmount.toLocaleString()} <span className="text-xs">EGP</span>
                  </td>
                  <td className="py-3.5 px-4 no-print" colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Print-only Category spending distribution table (Simple Landscape Sheet) */}
      <div className="hidden print:block w-full mt-6 text-black" dir="rtl">
        <table className="w-full border-collapse border-2 border-[#4F81BD] text-center font-sans">
          <thead>
            <tr className="bg-[#D9E1F2] text-[#1F4E78] font-black text-sm border-b-2 border-[#4F81BD]">
              <th className="py-3 px-4 border border-[#4F81BD] w-[10%] text-center">م</th>
              <th className="py-3 px-4 border border-[#4F81BD] text-right pr-6 w-[60%]">بند التكلفة والمصروف (Category)</th>
              <th className="py-3 px-4 border border-[#4F81BD] text-left pl-6 w-[30%]">إجمالي قيمة المنصرف (EGP)</th>
            </tr>
          </thead>
          <tbody>
            {categoryChartData.map((item, index) => (
              <tr key={item.name} className="border-b border-dashed border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-800">
                <td className="py-3 px-4 border border-[#4F81BD] font-mono text-center">{index + 1}</td>
                <td className="py-3 px-4 border border-[#4F81BD] text-right pr-6 font-black text-[#1F4E78]">{item.name}</td>
                <td className="py-3 px-4 border border-[#4F81BD] text-left pl-6 font-mono text-slate-900">{item.value.toLocaleString()} EGP</td>
              </tr>
            ))}
            {/* Total Row */}
            <tr className="bg-[#E2EFDA] text-[#375623] font-black text-sm">
              <td className="py-3 px-4 border border-[#4F81BD] text-center" colSpan={2}>إجمالي المصروفات المصنفة والمحللة كلياً</td>
              <td className="py-3 px-4 border border-[#4F81BD] text-left pl-6 font-mono">
                {totalFilteredAmount.toLocaleString()} EGP
              </td>
            </tr>
          </tbody>
        </table>

        {/* Dynamic official signatures block */}
        {showSignaturesInPrint && (
          <div className="grid grid-cols-3 gap-6 text-center mt-12 pt-6 border-t border-dashed border-[#4F81BD] text-xs font-bold text-slate-700">
            <div className="space-y-6">
              <span>توقيع مهندس الموقع المسؤول</span>
              <div className="border-b border-dotted border-slate-400 mx-auto w-36"></div>
            </div>
            <div className="space-y-6">
              <span>توقيع مراجع التكاليف المعتمد</span>
              <div className="border-b border-dotted border-slate-400 mx-auto w-36"></div>
            </div>
            <div className="space-y-6">
              <span>اعتماد إدارة الشركة والختم الرسمي</span>
              <div className="border-b border-dotted border-slate-400 mx-auto w-36"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

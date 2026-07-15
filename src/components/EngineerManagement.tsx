import { AIModelSelector } from "./AIModelSelector";
import React, { useState, useEffect, useMemo } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Phone, Briefcase, Hash, Plus, Edit2, Trash2, Check, X, Search, 
  Folder, FolderOpen, FileText, ChevronLeft, Calendar, DollarSign, 
  Activity, FileSpreadsheet, Upload, AlertCircle, Brain, CheckCircle, 
  RefreshCw, BarChart3, ArrowLeft, Download, Info, TrendingUp, TrendingDown
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

interface Engineer {
  id: string;
  name: string;
  phone: string;
  project: string;
  code: string;
  initialBalance?: number;
}

interface FileItem {
  name: string;
  path: string;
  size: number;
  mtime: string;
  folder: string;
  parentFolder?: string;
}

interface EngineerManagementProps {
  engineers: Engineer[];
  projectsList: string[];
  boxDays?: any[];
  onSave: (updatedEngineers: Engineer[]) => void;
  onRefresh?: () => void;
}

export default function EngineerManagement({ engineers, projectsList, boxDays = [], onSave, onRefresh }: EngineerManagementProps) {
  const [useAdvancedAI, setUseAdvancedAI] = useState(false);
  const [selectedAIModel, setSelectedAIModel] = useState("gpt-5.6-luna");
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'folders' | 'crud'>('folders');
  const [selectedEngineerFolder, setSelectedEngineerFolder] = useState<Engineer | null>(null);
  const [innerTab, setInnerTab] = useState<'files' | 'transactions' | 'ai'>('files');

  // Search queries
  const [searchQuery, setSearchQuery] = useState('');
  const [folderSearchQuery, setFolderSearchQuery] = useState('');

  // CRUD Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [project, setProject] = useState('');
  const [code, setCode] = useState('');
  const [initialBalance, setInitialBalance] = useState<string>('0');
  const [isDeleting, setIsDeleting] = useState(false);

  // Files in folder states
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // AI Cost Analysis states
  const [monthToAnalyze, setMonthToAnalyze] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState('');

  // Trigger loading files when engineer folder is selected
  useEffect(() => {
    if (selectedEngineerFolder) {
      fetchEngineerFiles(selectedEngineerFolder.name);
      setAnalysisResult(null);
      setAnalysisError('');
    }
  }, [selectedEngineerFolder]);

  const fetchEngineerFiles = async (engName: string) => {
    setLoadingFiles(true);
    try {
      const res = await fetch(`/api/engineers/folders-and-files?engineerName=${encodeURIComponent(engName)}`);
      const data = await res.json();
      if (data.success) {
        setFiles(data.files || []);
      }
    } catch (e) {
      console.error("Error fetching engineer files:", e);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedEngineerFolder || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('engineerName', selectedEngineerFolder.name);
      formData.append('date', new Date().toISOString().split('T')[0]);

      const res = await fetch('/api/engineers/upload-file', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        fetchEngineerFiles(selectedEngineerFolder.name);
      } else {
        setUploadError(data.error || 'فشل رفع المستند.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'حدث خطأ غير متوقع أثناء الرفع.');
    } finally {
      setUploading(false);
    }
  };

  const handleRunAIAnalysis = async () => {
    if (!selectedEngineerFolder) return;
    setAnalyzing(true);
    setAnalysisError('');
    setAnalysisResult(null);
    try {
      const res = await fetch('/api/ai/aggregate-engineer-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          engineerName: selectedEngineerFolder.name,
          month: monthToAnalyze,
          useAdvanced: useAdvancedAI,
          selectedAIModel: selectedAIModel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAnalysisResult(data.data);
        fetchEngineerFiles(selectedEngineerFolder.name);
      } else {
        setAnalysisError(data.error || 'فشل تشغيل التحليل المالي بالذكاء الاصطناعي.');
      }
    } catch (err: any) {
      setAnalysisError(err.message || 'خطأ أثناء الاتصال بالخادم لتشغيل التحليل.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Compute live petty cash transactions for selected engineer
  const engineerTransactions = useMemo(() => {
    if (!selectedEngineerFolder || !boxDays) return [];
    const list: any[] = [];
    boxDays.forEach((day: any) => {
      if (day.engineer === selectedEngineerFolder.name) {
        day.transactions.forEach((tx: any) => {
          list.push({
            ...tx,
            date: day.date,
          });
        });
      }
    });
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedEngineerFolder, boxDays]);

  // Compute live balance stats
  const liveStats = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    engineerTransactions.forEach((tx) => {
      totalInflow += tx.inflow || 0;
      totalOutflow += tx.outflow || 0;
    });
    return {
      totalInflow,
      totalOutflow,
      balance: totalInflow - totalOutflow
    };
  }, [engineerTransactions]);

  // CRUD Handlers
  const handleResetForm = () => {
    setName('');
    setPhone('');
    setProject('');
    setCode('');
    setInitialBalance('0');
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleStartEdit = (eng: Engineer) => {
    setEditingId(eng.id);
    setName(eng.name);
    setPhone(eng.phone);
    setProject(eng.project);
    setCode(eng.code);
    setInitialBalance(String(eng.initialBalance || 0));
    setShowAddForm(true);
    setActiveTab('crud');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !project) {
      alert('الرجاء تعبئة اسم المهندس واختيار المشروع!');
      return;
    }

    if (editingId) {
      const updated = engineers.map(eng => 
        eng.id === editingId 
          ? { 
              ...eng, 
              name: name.trim(), 
              phone: phone.trim(), 
              project, 
              code: code.trim(), 
              initialBalance: parseFloat(initialBalance) || 0 
            } 
          : eng
      );
      onSave(updated);
    } else {
      const newEngineer: Engineer = {
        id: `eng-${Date.now()}`,
        name: name.trim(),
        phone: phone.trim(),
        project,
        code: code.trim() || `ENG-${Math.floor(100 + Math.random() * 900)}`,
        initialBalance: parseFloat(initialBalance) || 0
      };
      onSave([newEngineer, ...engineers]);
    }
    handleResetForm();
    setActiveTab('folders');
  };

  const handleDelete = async (id: string, engName: string) => {
    if (window.confirm(`هل أنت متأكد من حذف المهندس "${engName}" وكل سجلاته؟`)) {
      setIsDeleting(true);
      try {
        const res = await fetch('/api/engineers/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, name: engName })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            // Update local state immediately before doing any refetching
            const updated = engineers.filter(eng => eng.id !== id);
            onSave(updated);
            if (onRefresh) {
              onRefresh();
            }
          } else {
            alert(`فشل حذف المهندس: ${data.error || 'خطأ غير معروف'}`);
          }
        } else {
          alert('فشل الاتصال بالسيرفر لحذف المهندس.');
        }
      } catch (err) {
        console.error('Error deleting engineer:', err);
        alert('حدث خطأ أثناء الاتصال بالسيرفر لحذف المهندس.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const filteredEngineers = engineers.filter(eng => 
    eng.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    eng.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
    eng.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFolders = engineers.filter(eng => 
    eng.name.toLowerCase().includes(folderSearchQuery.toLowerCase()) ||
    eng.project.toLowerCase().includes(folderSearchQuery.toLowerCase())
  );

  // Chart configuration colors
  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* 1. Main View (Grid of Folders) */}
      {!selectedEngineerFolder && (
        <div className="space-y-6">
          {/* Main Top Header */}
          <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-3 justify-end">
                <span>لوحة إدارة وأرشيف المهندسين</span>
                <Folder className="text-indigo-400 w-6 h-6" />
              </h2>
              <p className="text-slate-400 text-xs mt-1">تصفح ملفات المهندسين، عهدهم النقدية، حركات المشاريع، والتحليلات الشهرية المؤرشفة تلقائياً بالذكاء الاصطناعي.</p>
            </div>
            
            <div className="flex gap-2.5">
              <button
                onClick={() => setActiveTab('folders')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  activeTab === 'folders' 
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/10' 
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                📂 مجلدات المهندسين
              </button>
              <button
                onClick={() => setActiveTab('crud')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  activeTab === 'crud' 
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/10' 
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                ⚙️ إعدادات الحسابات والربط
              </button>
            </div>
          </div>

          {/* Tab 1: Mapped Folders Grid */}
          {activeTab === 'folders' && (
            <div className="space-y-6">
              {/* Folder Search Tool */}
              <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-xs text-slate-400 font-bold">
                  تصفح المجلد المنظم لكل مهندس للوصول الفوري للتقارير والتحليلات:
                </div>
                <div className="relative w-full md:max-w-xs">
                  <input
                    type="text"
                    placeholder="ابحث عن مهندس أو مشروع..."
                    value={folderSearchQuery}
                    onChange={(e) => setFolderSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pr-10 pl-3.5 py-2 text-xs outline-none focus:border-indigo-500 text-right"
                  />
                  <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                </div>
              </div>

              {/* Folders Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Add new folder quick card */}
                <div 
                  onClick={() => {
                    handleResetForm();
                    setActiveTab('crud');
                    setShowAddForm(true);
                  }}
                  className="bg-slate-900/30 border-2 border-dashed border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-3 cursor-pointer hover:border-indigo-500/50 hover:bg-slate-900/50 transition-all group min-h-[180px]"
                >
                  <div className="p-3 bg-slate-800/40 rounded-full text-slate-500 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-all block">إنشاء ملف مهندس جديد</span>
                    <span className="text-[10px] text-slate-500 mt-1 block">لربطه بعهد ومستخلصات المشاريع</span>
                  </div>
                </div>

                {filteredFolders.map((eng) => {
                  // Compute petty cash transaction count
                  let txCount = 0;
                  boxDays.forEach((day: any) => {
                    if (day.engineer === eng.name) {
                      txCount += day.transactions?.length || 0;
                    }
                  });

                  return (
                    <motion.div
                      whileHover={{ y: -4, scale: 1.01 }}
                      transition={{ duration: 0.15 }}
                      key={eng.id}
                      onClick={() => setSelectedEngineerFolder(eng)}
                      className="bg-[#111827] border border-slate-800 p-5 rounded-2xl cursor-pointer hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-950/10 transition-all flex flex-col justify-between group text-right"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/15 px-2.5 py-1 rounded-lg font-bold">
                          {eng.code}
                        </span>
                        <div className="p-2.5 bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-slate-950 rounded-xl transition-all">
                          <Folder className="w-5 h-5 fill-current" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-all">
                          {eng.name}
                        </h3>
                        <p className="text-slate-400 text-xs flex items-center gap-1.5 justify-end">
                          <span>{eng.project}</span>
                          <Briefcase className="w-3 h-3 text-slate-500 shrink-0" />
                        </p>
                        {eng.phone && (
                          <p className="text-slate-500 text-[11px] font-mono flex items-center gap-1.5 justify-end">
                            <span>{eng.phone}</span>
                            <Phone className="w-3 h-3 shrink-0" />
                          </p>
                        )}
                      </div>

                      <div className="mt-4 pt-3.5 border-t border-slate-850 flex justify-between items-center text-[10px] text-slate-400">
                        <div className="flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{txCount} حركات عهدة</span>
                        </div>
                        <span className="text-indigo-400 font-bold group-hover:translate-x-1 transition-all flex items-center gap-1">
                          فتح المجلد <ChevronLeft className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: CRUD Management */}
          {activeTab === 'crud' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* CRUD Add/Edit Form */}
              <AnimatePresence>
                {showAddForm && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 text-right"
                  >
                    <h3 className="text-sm font-bold text-white border-b border-slate-850 pb-3 flex items-center justify-end gap-2">
                      <span>{editingId ? 'تعديل بيانات مهندس' : 'تسجيل مهندس جديد'}</span>
                      <User className="text-indigo-400 w-4 h-4" />
                    </h3>

                    <form onSubmit={handleSubmit} className="space-y-4 text-right">
                      <div>
                        <label className="text-xs text-slate-400 font-bold block mb-1.5">اسم المهندس الثلاثي *</label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="مثال: م. محمد أحمد علي"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pr-10 pl-3.5 py-2.5 text-xs font-medium outline-none focus:border-indigo-500 text-right"
                          />
                          <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 font-bold block mb-1.5">رقم الهاتف</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="مثال: 01012345678"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pr-10 pl-3.5 py-2.5 text-xs text-left outline-none focus:border-indigo-500"
                          />
                          <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 font-bold block mb-1.5">المشروع المسؤول عنه حالياً *</label>
                        <div className="relative">
                          <select
                            value={project}
                            onChange={(e) => setProject(e.target.value)}
                            required
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pr-10 pl-3.5 py-2.5 text-xs font-bold outline-none focus:border-indigo-500 cursor-pointer text-right appearance-none"
                          >
                            <option value="">-- اختر المشروع --</option>
                            {projectsList.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                            <option value="عام">عام / كافة المواقع</option>
                          </select>
                          <Briefcase className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 font-bold block mb-1.5">الرقم الوظيفي / الكود</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="مثال: ENG-250"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pr-10 pl-3.5 py-2.5 text-xs text-left outline-none focus:border-indigo-500"
                          />
                          <Hash className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-slate-400 font-bold block mb-1.5">الرصيد الافتتاحي للعهدة (EGP)</label>
                        <div className="relative">
                          <input
                            type="number"
                            placeholder="مثال: 50000"
                            value={initialBalance}
                            onChange={(e) => setInitialBalance(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pr-10 pl-3.5 py-2.5 text-xs text-left outline-none focus:border-indigo-500 font-mono"
                          />
                          <DollarSign className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        </div>
                      </div>

                      <div className="flex gap-2.5 pt-2">
                        <button
                          type="submit"
                          disabled={isDeleting}
                          className={`flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Check className="w-4 h-4" />
                          <span>{isDeleting ? 'جاري الحذف...' : 'حفظ البيانات'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleResetForm}
                          disabled={isDeleting}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          إلغاء
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Table List of Engineers */}
              <div className={`bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4 ${showAddForm ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-850 pb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 shrink-0">
                    <User className="text-indigo-400 w-4 h-4" />
                    <span>جدول تعديل وإدارة المهندسين المعتمدين</span>
                  </h3>
                  
                  <div className="flex gap-2.5 w-full md:max-w-md justify-end">
                    <div className="relative w-full md:max-w-xs">
                      <input
                        type="text"
                        placeholder="ابحث بالاسم، المشروع، أو الكود..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pr-10 pl-3.5 py-2 text-xs outline-none focus:border-indigo-500 text-right"
                      />
                      <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    </div>
                    {!showAddForm && (
                      <button
                        onClick={() => setShowAddForm(true)}
                        className="bg-indigo-600/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>تسجيل جديد</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold">
                        <th className="pb-3 text-right">كود المهندس</th>
                        <th className="pb-3 text-right">الاسم الثلاثي</th>
                        <th className="pb-3 text-right">رقم الهاتف</th>
                        <th className="pb-3 text-right">المشروع الحالي</th>
                        <th className="pb-3 text-left">الرصيد الافتتاحي</th>
                        <th className="pb-3 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEngineers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-xs text-slate-500 font-bold">
                            لا يوجد مهندسين يطابقون البحث.
                          </td>
                        </tr>
                      ) : (
                        filteredEngineers.map((eng) => (
                          <tr key={eng.id} className="border-b border-slate-850 text-slate-300 text-xs hover:bg-slate-900/30 transition-all">
                            <td className="py-3.5 font-mono text-indigo-400 font-bold">
                              {eng.code}
                            </td>
                            <td className="py-3.5 font-bold text-white">
                              {eng.name}
                            </td>
                            <td className="py-3.5 font-mono text-slate-400">
                              {eng.phone || '-'}
                            </td>
                            <td className="py-3.5">
                              <span className="bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                                {eng.project}
                              </span>
                            </td>
                            <td className="py-3.5 font-mono text-left text-slate-400 font-bold">
                              {(eng.initialBalance || 0).toLocaleString()} EGP
                            </td>
                            <td className="py-3.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleStartEdit(eng)}
                                  disabled={isDeleting}
                                  className="text-indigo-400 hover:text-indigo-300 p-1.5 rounded hover:bg-indigo-500/10 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="تعديل البيانات"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(eng.id, eng.name)}
                                  disabled={isDeleting}
                                  className="text-rose-500 hover:text-rose-400 p-1.5 rounded hover:bg-rose-500/10 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="حذف المهندس"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Detail Engineer Folder Opened View */}
      {selectedEngineerFolder && (
        <div className="space-y-6">
          {/* Header Card with Back Button */}
          <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4 text-right">
              <button
                onClick={() => setSelectedEngineerFolder(null)}
                className="bg-slate-900 hover:bg-slate-800 border border-slate-800 p-3 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
                title="العودة لقائمة المجلدات"
              >
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
              
              <div>
                <div className="flex items-center gap-2.5 justify-end">
                  <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 rounded font-bold">
                    {selectedEngineerFolder.code}
                  </span>
                  <h2 className="text-xl font-extrabold text-white">
                    {selectedEngineerFolder.name}
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 justify-end">
                  <span>المشروع الحالي: {selectedEngineerFolder.project}</span>
                  <span className="text-slate-650">•</span>
                  <span>رقم الهاتف: {selectedEngineerFolder.phone || '-'}</span>
                </p>
              </div>
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-800 w-full md:w-auto overflow-x-auto justify-end">
              <button
                onClick={() => setInnerTab('files')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  innerTab === 'files' 
                    ? 'bg-indigo-600 text-white shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📁 أرشيف التقارير والمستندات
              </button>
              <button
                onClick={() => setInnerTab('transactions')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  innerTab === 'transactions' 
                    ? 'bg-indigo-600 text-white shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                💰 سجل حركات العهدة
              </button>
              <button
                onClick={() => setInnerTab('ai')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  innerTab === 'ai' 
                    ? 'bg-indigo-600 text-white shadow' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🧠 تقرير تحليل العهدة AI
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl shadow-md flex items-center justify-between text-right">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">إجمالي التمويل المستلم</span>
                <span className="text-sm font-black text-emerald-400 font-mono mt-1 block">
                  {liveStats.totalInflow.toLocaleString()} EGP
                </span>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl shadow-md flex items-center justify-between text-right">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">إجمالي المنصرف من العهدة</span>
                <span className="text-sm font-black text-rose-400 font-mono mt-1 block">
                  {liveStats.totalOutflow.toLocaleString()} EGP
                </span>
              </div>
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
                <TrendingDown className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl shadow-md flex items-center justify-between text-right">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">الرصيد النقدي المتبقي</span>
                <span className={`text-sm font-black font-mono mt-1 block ${liveStats.balance >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                  {liveStats.balance.toLocaleString()} EGP
                </span>
              </div>
              <div className={`p-3 rounded-xl ${liveStats.balance >= 0 ? 'bg-indigo-500/10 text-indigo-400' : 'bg-rose-500/10 text-rose-400'}`}>
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl shadow-md flex items-center justify-between text-right">
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">إجمالي المستندات المؤرشفة</span>
                <span className="text-sm font-black text-indigo-400 font-mono mt-1 block">
                  {files.length} ملفات
                </span>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Sub-tab 1: Archived Documents & Analyses */}
          {innerTab === 'files' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* File Uploader */}
              <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4 text-right">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 justify-end border-b border-slate-850 pb-3">
                  <span>رفع مستند جديد لمجلد المهندس</span>
                  <Upload className="text-indigo-400 w-4 h-4" />
                </h3>
                
                <p className="text-slate-400 text-xs leading-relaxed">
                  يمكنك أرشفة الفواتير، صور التحويلات البنكية، أو ملفات Excel الخارجية يدويًا بداخل مجلد هذا المهندس لتنظيمها وتسهيل مراجعتها:
                </p>

                <div className="pt-2">
                  <label className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-900/30 hover:bg-slate-900/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all group">
                    <input 
                      type="file" 
                      onChange={handleFileUpload} 
                      disabled={uploading}
                      className="hidden" 
                    />
                    {uploading ? (
                      <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                    ) : (
                      <Upload className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 transition-all" />
                    )}
                    <div>
                      <span className="text-xs font-bold text-slate-300 block">انقر لاختيار ملف</span>
                      <span className="text-[10px] text-slate-500 mt-1 block">أو اسحب وأفلت الملف هنا مباشرة (PDF, Excel, Images)</span>
                    </div>
                  </label>
                </div>

                {uploadError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>

              {/* Files list */}
              <div className="lg:col-span-2 bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4 text-right">
                <div className="flex justify-between items-center border-b border-slate-850 pb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FolderOpen className="text-indigo-400 w-4 h-4" />
                    <span>محتويات الأرشيف المجلد الرقمي لـ {selectedEngineerFolder.name}</span>
                  </h3>
                  <button 
                    onClick={() => fetchEngineerFiles(selectedEngineerFolder.name)}
                    disabled={loadingFiles}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingFiles ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {loadingFiles ? (
                  <div className="text-center py-16 space-y-2">
                    <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                    <p className="text-slate-500 text-xs font-bold">جاري فحص محتويات المجلد الرقمي...</p>
                  </div>
                ) : files.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <Folder className="w-12 h-12 text-slate-650 mx-auto" />
                    <div>
                      <p className="text-slate-400 text-xs font-black">المجلد فارغ حالياً.</p>
                      <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">لم يتم إرفاق أي فواتير معالجة أو تحليلات AI لهذا المهندس بعد.<br />قم بتشغيل التحليل المالي AI أو ارفع مستنداً يدوياً.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {files.map((file, idx) => {
                      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
                      const fileUrl = `/api/documents/download?path=${encodeURIComponent(file.path)}`;
                      
                      return (
                        <div 
                          key={idx}
                          className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center gap-3.5 hover:border-slate-700 transition-all text-right"
                        >
                          <div className={`p-2.5 rounded-xl shrink-0 ${isExcel ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                            {isExcel ? <FileSpreadsheet className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-white truncate" title={file.name}>
                              {file.name}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              {file.folder} / {file.parentFolder || ''}
                            </p>
                            <p className="text-[9px] text-slate-500 mt-1">
                              المساحة: {(file.size / 1024).toFixed(1)} KB • {new Date(file.mtime).toLocaleDateString('ar-SA')}
                            </p>
                          </div>

                          <a 
                            href={fileUrl}
                            download
                            className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-slate-300 hover:text-white transition-all shrink-0 border border-slate-700"
                            title="تحميل الملف"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sub-tab 2: Detailed Petty Cash History */}
          {innerTab === 'transactions' && (
            <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4 text-right">
              <div className="border-b border-slate-850 pb-4 flex justify-between items-center">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <DollarSign className="text-indigo-400 w-4 h-4" />
                  <span>كشف الحركات المالية وعمليات العهدة بالتفصيل لـ {selectedEngineerFolder.name}</span>
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold">
                      <th className="pb-3 text-right">التاريخ</th>
                      <th className="pb-3 text-right">الوصف والحركة المعتمدة</th>
                      <th className="pb-3 text-right">المشروع</th>
                      <th className="pb-3 text-left">الوارد (Inflow)</th>
                      <th className="pb-3 text-left">المنصرف (Outflow)</th>
                      <th className="pb-3 text-center">طريقة الدفع</th>
                      <th className="pb-3 text-center">مرفقات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engineerTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-xs text-slate-500 font-bold">
                          لا توجد عمليات مسجلة باسم هذا المهندس في سجلات العهدة اليومية.
                        </td>
                      </tr>
                    ) : (
                      engineerTransactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-slate-850 text-slate-300 text-xs hover:bg-slate-900/30 transition-all">
                          <td className="py-3.5 font-mono text-slate-400 whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="py-3.5 font-bold text-white">
                            {tx.description}
                          </td>
                          <td className="py-3.5">
                            <span className="bg-indigo-950/40 text-indigo-400 border border-indigo-900/40 px-2 rounded text-[10px] font-bold">
                              {tx.project}
                            </span>
                          </td>
                          <td className="py-3.5 font-mono text-left font-bold text-emerald-400">
                            {tx.inflow > 0 ? `+${tx.inflow.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-3.5 font-mono text-left font-bold text-rose-400">
                            {tx.outflow > 0 ? `-${tx.outflow.toLocaleString()}` : '-'}
                          </td>
                          <td className="py-3.5 text-center whitespace-nowrap text-slate-400">
                            {tx.method || 'انستاباي'}
                          </td>
                          <td className="py-3.5 text-center">
                            {tx.attachment ? (
                              <a 
                                href={`/api/documents/download?path=${encodeURIComponent(tx.attachment)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-400 hover:underline text-[10px] font-bold"
                              >
                                عرض المرفق
                              </a>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-tab 3: AI Monthly Cost Analysis & Reporting */}
          {innerTab === 'ai' && (
            <div className="space-y-6">
              <AIModelSelector
                useAdvanced={useAdvancedAI}
                setUseAdvanced={setUseAdvancedAI}
                selectedModel={selectedAIModel}
                setSelectedModel={setSelectedAIModel}
              />
              {/* Aggregation Control Panel */}
              <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md text-right space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 justify-end">
                      <span>إدارة التقرير المالي الشهري المؤرشف بالذكاء الاصطناعي</span>
                      <Brain className="text-indigo-400 w-4.5 h-4.5 animate-pulse" />
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      قم بدمج وتصنيف كافة مصروفات وعهد المهندس لشهر معين تلقائياً، ليقوم الـ AI بإنشاء تقرير Excel رسمي وتوصيات ذكية وحفظها بداخل مجلده الرقمي.
                    </p>
                  </div>

                  {/* Selector & Action button */}
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative">
                      <input 
                        type="month"
                        value={monthToAnalyze}
                        onChange={(e) => setMonthToAnalyze(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none cursor-pointer focus:border-indigo-500"
                      />
                    </div>
                    <button
                      onClick={handleRunAIAnalysis}
                      disabled={analyzing}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 text-white font-bold text-xs px-5 py-3 rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer whitespace-nowrap"
                    >
                      {analyzing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جاري التحليل...</span>
                        </>
                      ) : (
                        <>
                          <Brain className="w-4 h-4" />
                          <span>تشغيل تحليل الـ AI 🧠</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {analysisError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-xs font-bold flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{analysisError}</span>
                  </div>
                )}
              </div>

              {/* Loader */}
              {analyzing && (
                <div className="bg-[#111827] border border-slate-800 p-12 rounded-2xl shadow-md text-center space-y-4">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <Brain className="absolute inset-0 m-auto w-6 h-6 text-indigo-400 animate-pulse" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1">
                    <h4 className="text-sm font-bold text-white">جاري استرجاع الحركات المعتمدة وتصنيف البنود بالذكاء الاصطناعي</h4>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      يتم تجميع كافة فواتير {selectedEngineerFolder.name}، تحليل بنود المواد، أجور العمالة، النقل والمحروقات، ومقارنتها بالذكاء الاصطناعي لتأكيد صحة الصرف وحساب التقرير النهائي...
                    </p>
                  </div>
                </div>
              )}

              {/* Analysis Result Display */}
              {analysisResult && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Category Aggregation Table and Chart */}
                  <div className="lg:col-span-2 bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-6 text-right">
                    <div className="border-b border-slate-850 pb-4 flex justify-between items-center">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <BarChart3 className="text-indigo-400 w-4.5 h-4.5" />
                        <span>تحليل وتوزيع تكاليف العهدة حسب بنود الصرف</span>
                      </h4>
                      {analysisResult.excelRelativePath && (
                        <a 
                          href={`/api/documents/download?path=${encodeURIComponent(analysisResult.excelRelativePath)}`}
                          download
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تحميل تقرير Excel 📊</span>
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      {/* Breakdown Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 text-[11px] font-bold">
                              <th className="pb-2.5 text-right">البند والمادة</th>
                              <th className="pb-2.5 text-left">التكلفة الإجمالية</th>
                              <th className="pb-2.5 text-center">النسبة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysisResult.aggregates?.map((agg: any, idx: number) => (
                              <tr key={idx} className="border-b border-slate-850 text-slate-300 text-xs hover:bg-slate-900/20 transition-all">
                                <td className="py-2.5 flex items-center gap-2 justify-start text-right">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                                  <span className="font-bold text-white">{agg.category}</span>
                                </td>
                                <td className="py-2.5 font-mono text-left text-slate-200 font-bold">
                                  {agg.total.toLocaleString()} EGP
                                </td>
                                <td className="py-2.5 text-center font-mono text-slate-400 text-[11px]">
                                  {agg.percentage}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        
                        <div className="mt-4 pt-4 border-t border-slate-850 flex justify-between items-center text-xs font-bold text-white">
                          <span>إجمالي منصرف التقرير:</span>
                          <span className="font-mono text-rose-400 font-black">
                            {(analysisResult.aggregates?.reduce((sum: number, agg: any) => sum + agg.total, 0) || 0).toLocaleString()} EGP
                          </span>
                        </div>
                      </div>

                      {/* Pie Chart Representation */}
                      <div className="h-60 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analysisResult.aggregates || []}
                              dataKey="total"
                              nameKey="category"
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={3}
                            >
                              {analysisResult.aggregates?.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#111827', borderColor: '#1e293b', borderRadius: '12px', color: '#fff' }}
                              itemStyle={{ color: '#fff' }}
                              formatter={(value: any) => [`${parseFloat(value).toLocaleString()} EGP`, 'التكلفة']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* AI Recommendations and Smart Audit */}
                  <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md text-right space-y-4">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2 justify-end border-b border-slate-850 pb-3">
                      <span>تدقيق وتوصيات الذكاء الاصطناعي 🧠</span>
                      <Brain className="text-indigo-400 w-4 h-4" />
                    </h4>

                    {analysisResult.recommendations && analysisResult.recommendations.length > 0 ? (
                      <div className="space-y-4">
                        {analysisResult.recommendations.map((rec: string, idx: number) => (
                          <div 
                            key={idx}
                            className="bg-slate-900/40 border border-slate-800 p-3.5 rounded-xl text-xs text-slate-300 leading-relaxed flex items-start gap-2.5 text-right"
                          >
                            <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs font-bold flex items-center gap-2.5">
                        <CheckCircle className="w-4.5 h-4.5 shrink-0" />
                        <span>عملية التدقيق الذكية اكتملت بنجاح: لم يتم رصد أي تضارب أو بنود صرف غير طبيعية في عهدة المهندس لشهر {monthToAnalyze}. المصروفات متطابقة مع نطاق العمل للمشروع.</span>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* Default Welcome Tab for AI */}
              {!analysisResult && !analyzing && (
                <div className="bg-[#111827] border border-slate-800 p-8 rounded-2xl shadow-md text-center space-y-3">
                  <Brain className="w-12 h-12 text-slate-700 mx-auto animate-pulse" />
                  <div className="max-w-md mx-auto space-y-1">
                    <h4 className="text-xs font-bold text-white">تقرير المراجعة والتسوية الشهرية بالذكاء الاصطناعي</h4>
                    <p className="text-slate-500 text-[10px] leading-relaxed">
                      اختر الشهر المطلوب أعلاه ثم انقر على "تشغيل تحليل الـ AI" ليتم فحص كافة حركات عهدة المهندس {selectedEngineerFolder.name} وتوليد شيت Excel وتدقيق تلقائي للمصروفات.
                    </p>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      )}

    </div>
  );
}

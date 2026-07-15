import React, { useState, useRef } from 'react';
import { 
  FileUp, 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  Info, 
  XCircle, 
  ChevronDown, 
  PackageOpen, 
  Sparkles, 
  BookOpen, 
  Upload,
  ArrowLeft,
  Trash2,
  FileText
} from 'lucide-react';

interface DeliveryNoteMatcherProps {
  documents: any[];
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) => void;
}

interface MatchedItem {
  poItemDescription: string;
  orderedQty: number;
  deliveredQty: number;
  matchType: 'exact' | 'catalog_match' | 'synonym_match';
  note?: string;
}

interface MissingItem {
  poItemDescription: string;
  orderedQty: number;
  missingQty: number;
}

interface OverReceivedItem {
  poItemDescription: string;
  orderedQty: number;
  deliveredQty: number;
}

interface UnmatchedItem {
  deliveredItemDescription: string;
  deliveredQty: number;
  note?: string;
}

interface ComparisonResult {
  matchedItems?: MatchedItem[];
  missingItems?: MissingItem[];
  overReceivedItems?: OverReceivedItem[];
  unmatchedItems?: UnmatchedItem[];
}

export const DeliveryNoteMatcher: React.FC<DeliveryNoteMatcherProps> = ({ documents = [], onNotify }) => {
  const [selectedPoId, setSelectedPoId] = useState<string>('');
  const [deliveryNoteFile, setDeliveryNoteFile] = useState<File | null>(null);
  const [catalogFile, setCatalogFile] = useState<File | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const deliveryNoteInputRef = useRef<HTMLInputElement>(null);
  const catalogInputRef = useRef<HTMLInputElement>(null);

  // Filter documents of type PO to link them
  const poDocuments = documents.filter(d => 
    d.type?.toLowerCase() === 'po' || 
    d.type === 'أمر شراء' || 
    d.category === 'purchase_order'
  );

  const handleDeliveryNoteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDeliveryNoteFile(file);
    }
  };

  const handleCatalogChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCatalogFile(file);
    }
  };

  const handleStartMatching = async () => {
    if (!selectedPoId) {
      onNotify('warning', 'حقل مطلوب', 'الرجاء اختيار أمر الشراء المرجعي للمطابقة.');
      return;
    }
    if (!deliveryNoteFile) {
      onNotify('warning', 'حقل مطلوب', 'الرجاء رفع مستند إذن الاستلام (Delivery Note).');
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    setErrorMsg(null);
    onNotify('info', 'بدء المطابقة الذكية', 'جاري قراءة إذن الاستلام ومطابقته مع بنود أمر الشراء عبر الذكاء الاصطناعي...');

    const formData = new FormData();
    formData.append('deliveryNote', deliveryNoteFile);
    if (catalogFile) {
      formData.append('catalog', catalogFile);
    }
    formData.append('poId', selectedPoId);

    try {
      const res = await fetch('/api/ai/compare-delivery-note', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.result) {
        setResult(data.result);
        onNotify('success', 'اكتملت المطابقة', 'نجح الذكاء الاصطناعي في مطابقة بنود إذن الاستلام مع أمر الشراء بنجاح.');
      } else {
        setErrorMsg(data.error || 'فشلت عملية المطابقة والتدقيق بالذكاء الاصطناعي.');
        onNotify('error', 'فشل في المطابقة', data.error || 'حدث خطأ غير متوقع أثناء معالجة المستند.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('حدث خطأ أثناء الاتصال بالخادم لمطابقة المستند.');
      onNotify('error', 'خطأ اتصال', 'فشل الاتصال بالخادم.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getMatchTypeBadge = (type: string) => {
    switch (type) {
      case 'exact':
        return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">تطابق تام</span>;
      case 'catalog_match':
        return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">تطابق الكتالوج</span>;
      case 'synonym_match':
        return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">مترادفات ذكية</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">{type}</span>;
    }
  };

  // Find selected PO details
  const selectedPO = poDocuments.find(p => p.id === selectedPoId);

  return (
    <div className="flex flex-col gap-8">
      {/* INPUT FORM SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 1 Column: Select PO */}
        <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-xl p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
              <PackageOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">1. اختيار أمر الشراء</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">اختر أمر الشراء (PO) المراد المطابقة عليه</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-2">
            <label className="text-xs font-bold text-slate-400">أمر الشراء المرجعي</label>
            <div className="relative">
              <select
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                className="w-full bg-[#1e293b] text-slate-200 border border-slate-700/80 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="">-- اختر أمر شراء --</option>
                {poDocuments.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.docNumber || po.filename || po.projectName || `أمر شراء ${po.id.slice(0, 5)}`} - {(po.supplierName || po.projectName || 'غير محدد')}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {selectedPO && (
            <div className="mt-2 bg-[#1e293b]/40 p-4 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="font-bold text-sky-400">بيانات أمر الشراء</span>
                <span className="text-[10px] text-slate-400 font-mono">ID: {selectedPO.id.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">رقم المستند:</span>
                <span className="font-bold text-slate-200">{selectedPO.docNumber || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المشروع:</span>
                <span className="font-bold text-slate-200 text-left max-w-[150px] truncate">{selectedPO.projectName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المورد:</span>
                <span className="font-bold text-slate-200 text-left max-w-[150px] truncate">{selectedPO.supplierName || '-'}</span>
              </div>
              {selectedPO.items && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-400 block mb-1">بنود الطلب ({selectedPO.items.length}):</span>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-[11px] custom-scrollbar">
                    {selectedPO.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-slate-400 hover:text-slate-200">
                        <span className="truncate max-w-[150px]">• {item.description}</span>
                        <span className="font-mono text-slate-200">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 2 Columns: Dropzones & Start button */}
        <div className="lg:col-span-2 bg-[#111827] rounded-2xl border border-slate-800 shadow-xl p-6 flex flex-col gap-6">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">2. رفع مستندات الاستلام والكتالوج</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">ارفع إذن الاستلام ومستندات تدعيم المطابقة الذكية</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Delivery Note Dropzone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <span>إذن الاستلام (Delivery Note)</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              
              <div 
                onClick={() => deliveryNoteInputRef.current?.click()}
                className={`cursor-pointer group relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 text-center transition-all min-h-[160px] ${
                  deliveryNoteFile 
                    ? 'border-emerald-500/50 bg-emerald-500/5' 
                    : 'border-slate-800 bg-[#1e293b]/20 hover:border-indigo-500/50 hover:bg-[#1e293b]/40'
                }`}
              >
                <input 
                  type="file" 
                  ref={deliveryNoteInputRef} 
                  className="hidden" 
                  accept="image/*,application/pdf"
                  onChange={handleDeliveryNoteChange}
                />
                
                {deliveryNoteFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400">
                      <FileText className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-bold text-emerald-300 max-w-[200px] truncate">{deliveryNoteFile.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{(deliveryNoteFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeliveryNoteFile(null);
                        if (deliveryNoteInputRef.current) deliveryNoteInputRef.current.value = '';
                      }}
                      className="mt-2 text-[10px] bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 px-2 py-1 rounded-md font-bold transition-all"
                    >
                      حذف الملف
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-slate-800/60 rounded-full text-slate-400 group-hover:scale-105 transition-transform">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-300">انقر لرفع إذن الاستلام</span>
                    <p className="text-[10px] text-slate-500 max-w-[180px] leading-relaxed">يدعم الصور (PNG, JPG) وملفات PDF ومسح الكاميرا</p>
                  </div>
                )}
              </div>
            </div>

            {/* Optional Catalog Dropzone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <span>كتالوج الشركة أو المورد</span>
                <span className="text-slate-500 text-[10px] font-normal">(اختياري)</span>
              </label>

              <div 
                onClick={() => catalogInputRef.current?.click()}
                className={`cursor-pointer group relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 text-center transition-all min-h-[160px] ${
                  catalogFile 
                    ? 'border-purple-500/50 bg-purple-500/5' 
                    : 'border-slate-800 bg-[#1e293b]/20 hover:border-purple-500/50 hover:bg-[#1e293b]/40'
                }`}
              >
                <input 
                  type="file" 
                  ref={catalogInputRef} 
                  className="hidden" 
                  accept="image/*,application/pdf"
                  onChange={handleCatalogChange}
                />

                {catalogFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-purple-500/10 rounded-full text-purple-400">
                      <BookOpen className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-bold text-purple-300 max-w-[200px] truncate">{catalogFile.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{(catalogFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCatalogFile(null);
                        if (catalogInputRef.current) catalogInputRef.current.value = '';
                      }}
                      className="mt-2 text-[10px] bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 px-2 py-1 rounded-md font-bold transition-all"
                    >
                      حذف الملف
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-slate-800/60 rounded-full text-slate-400 group-hover:scale-105 transition-transform">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-300">انقر لرفع كتالوج المورد</span>
                    <p className="text-[10px] text-slate-500 max-w-[180px] leading-relaxed">للاستعانة به في مطابقة المترادفات والبدائل الذكية</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end mt-2 pt-4 border-t border-slate-800/80">
            <button
              onClick={handleStartMatching}
              disabled={isAnalyzing}
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm py-3.5 px-8 rounded-xl shadow-lg shadow-sky-950/40 transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>جاري المطابقة الذكية...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                  <span>بدء المطابقة الذكية (AI Matching)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* ERROR MSG BANNER */}
      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-2.5 text-xs">
          <XCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <div className="flex flex-col">
            <span className="font-bold">فشل التحليل والمطابقة</span>
            <span className="text-[11px] text-rose-400/80 mt-0.5">{errorMsg}</span>
          </div>
        </div>
      )}

      {/* MATCHING RESULTS TABLES */}
      {result && (
        <div className="flex flex-col gap-8">
          
          <div className="flex items-center gap-2 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">تقرير المطابقة الذكية والتدقيق للبضاعة المستلمة</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">تمت مقارنة المستند المرفوع بنجاح وتصنيف البنود تلقائياً</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">

            {/* SECTION 1: MATCHED & RECEIVED ITEMS */}
            <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
              <div className="bg-emerald-500/10 border-b border-slate-800 p-4 px-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/20 rounded text-emerald-400">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-emerald-400">تم استلامه (مطابق)</h4>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full">
                  {(result.matchedItems || []).length} بنود
                </span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5 font-bold w-5/12">الصنف في الـ PO</th>
                      <th className="px-4 py-3.5 font-bold text-center w-2/12">الكمية المطلوبة</th>
                      <th className="px-4 py-3.5 font-bold text-center w-2/12">الكمية المستلمة</th>
                      <th className="px-4 py-3.5 font-bold text-center w-1.5/12">نوع المطابقة</th>
                      <th className="px-6 py-3.5 font-bold text-right w-1.5/12">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-[#111827] text-slate-300">
                    {(!result.matchedItems || result.matchedItems.length === 0) ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-xs">لا توجد بنود مطابقة تامة مستلمة في الإذن.</td>
                      </tr>
                    ) : (
                      result.matchedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-slate-200">{item.poItemDescription}</td>
                          <td className="px-4 py-3.5 text-center text-slate-400 font-mono text-xs">{item.orderedQty}</td>
                          <td className="px-4 py-3.5 text-center text-emerald-400 font-bold font-mono text-xs">{item.deliveredQty}</td>
                          <td className="px-4 py-3.5 text-center">{getMatchTypeBadge(item.matchType)}</td>
                          <td className="px-6 py-3.5 text-right text-slate-400 text-[11px] leading-relaxed max-w-[200px] truncate" title={item.note}>{item.note || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 2: MISSING & PARTIAL ITEMS */}
            <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
              <div className="bg-rose-500/10 border-b border-slate-800 p-4 px-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-500/20 rounded text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-rose-400">ناقص (لم يتم توريده / استلام جزئي)</h4>
                </div>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 font-bold px-2.5 py-0.5 rounded-full">
                  {(result.missingItems || []).length} بنود
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5 font-bold w-7/12">الصنف</th>
                      <th className="px-4 py-3.5 font-bold text-center w-2/12">الكمية المطلوبة</th>
                      <th className="px-4 py-3.5 font-bold text-center w-3/12">الكمية الناقصة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-[#111827] text-slate-300">
                    {(!result.missingItems || result.missingItems.length === 0) ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-slate-500 text-xs">لا توجد بنود ناقصة؛ تم استلام كافة كميات البنود بنجاح.</td>
                      </tr>
                    ) : (
                      result.missingItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-rose-500/5 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-slate-200">{item.poItemDescription}</td>
                          <td className="px-4 py-3.5 text-center text-slate-400 font-mono text-xs">{item.orderedQty}</td>
                          <td className="px-4 py-3.5 text-center text-rose-400 font-black font-mono text-xs">-{item.missingQty}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 3: OVER RECEIVED ITEMS */}
            <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
              <div className="bg-amber-500/10 border-b border-slate-800 p-4 px-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/20 rounded text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-amber-400">استلام زائد (أعلى من الكمية المطلوبة)</h4>
                </div>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-full">
                  {(result.overReceivedItems || []).length} بنود
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5 font-bold w-6/12">الصنف</th>
                      <th className="px-4 py-3.5 font-bold text-center w-2/12">الكمية المطلوبة</th>
                      <th className="px-4 py-3.5 font-bold text-center w-2/12">الكمية المستلمة</th>
                      <th className="px-4 py-3.5 font-bold text-center w-2/12">الكمية الزائدة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-[#111827] text-slate-300">
                    {(!result.overReceivedItems || result.overReceivedItems.length === 0) ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-xs">لا توجد كميات زائدة مستلمة.</td>
                      </tr>
                    ) : (
                      result.overReceivedItems.map((item, idx) => {
                        const excess = item.deliveredQty - item.orderedQty;
                        return (
                          <tr key={idx} className="hover:bg-amber-500/5 transition-colors">
                            <td className="px-6 py-3.5 font-bold text-slate-200">{item.poItemDescription}</td>
                            <td className="px-4 py-3.5 text-center text-slate-400 font-mono text-xs">{item.orderedQty}</td>
                            <td className="px-4 py-3.5 text-center text-slate-200 font-mono text-xs">{item.deliveredQty}</td>
                            <td className="px-4 py-3.5 text-center text-amber-400 font-black font-mono text-xs">+{excess > 0 ? excess : 0}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 4: UNMATCHED ITEMS */}
            <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
              <div className="bg-indigo-500/10 border-b border-slate-800 p-4 px-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-500/20 rounded text-indigo-400">
                    <Info className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-indigo-400">أصناف غير معروفة (في الإذن وليست في الـ PO)</h4>
                </div>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2.5 py-0.5 rounded-full">
                  {(result.unmatchedItems || []).length} بنود
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-right text-xs">
                  <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5 font-bold w-6/12">اسم الصنف كما ورد في إذن الاستلام</th>
                      <th className="px-4 py-3.5 font-bold text-center w-3/12">الكمية المستلمة</th>
                      <th className="px-6 py-3.5 font-bold text-right w-3/12">ملاحظة الذكاء الاصطناعي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-[#111827] text-slate-300">
                    {(!result.unmatchedItems || result.unmatchedItems.length === 0) ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-slate-500 text-xs">لا توجد بنود غير معروفة أو خارج نطاق أمر الشراء.</td>
                      </tr>
                    ) : (
                      result.unmatchedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#1e1b4b]/20 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-slate-200">{item.deliveredItemDescription}</td>
                          <td className="px-4 py-3.5 text-center text-indigo-300 font-bold font-mono text-xs">{item.deliveredQty}</td>
                          <td className="px-6 py-3.5 text-right text-slate-400 text-[11px] leading-relaxed">{item.note || 'موجود في إذن الاستلام وليس في أمر الشراء المعتمد'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};

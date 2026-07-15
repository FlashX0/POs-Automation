import React, { useState, useRef } from 'react';
import { FileUp, CheckCircle, AlertTriangle, Loader2, Info, XCircle, ChevronDown, PackageOpen } from 'lucide-react';

interface DeliveryNoteAnalyzerProps {
  poId: string;
}

interface MatchedItem {
  description: string;
  orderedQty: number;
  deliveredQty: number;
  status: string;
}

interface MissingItem {
  description: string;
  orderedQty: number;
}

interface OverReceivedItem {
  description: string;
  orderedQty: number;
  deliveredQty: number;
  excessQty: number;
}

interface UnmatchedItem {
  description: string;
  deliveredQty: number;
}

interface ComparisonResult {
  matchedItems: MatchedItem[];
  missingItems: MissingItem[];
  overReceived: OverReceivedItem[];
  unmatchedItems: UnmatchedItem[];
}

export const DeliveryNoteAnalyzer: React.FC<DeliveryNoteAnalyzerProps> = ({ poId }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setResult(null);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('poId', poId);

    try {
      const res = await fetch('/api/ai/compare-delivery-note', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.result) {
        setResult(data.result);
      } else {
        setErrorMsg(data.error || 'حدث خطأ أثناء مقارنة إذن الاستلام');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('فشل الاتصال بالخادم لمقارنة المستند.');
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'received': return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
      case 'partial': return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border border-slate-500/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'received': return 'مكتمل الاستلام';
      case 'partial': return 'استلام جزئي';
      default: return status;
    }
  };

  return (
    <div className="mt-6 border-t border-slate-800 pt-6 no-print">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <PackageOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">تدقيق إذن الاستلام بالذكاء الاصطناعي (Delivery Note AI)</h3>
              <p className="text-xs text-slate-400 mt-0.5">طابق صورة إذن الاستلام مع بنود أمر الشراء وتحقق من الكميات فوراً</p>
            </div>
          </div>
          
          <button
            onClick={() => {
              setIsModalOpen(true);
              setResult(null);
              setErrorMsg(null);
            }}
            className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/10"
          >
            <FileUp className="w-4 h-4" />
            <span>مقارنة وتدقيق الإذن</span>
          </button>
        </div>

        {/* Upload Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                  <FileUp className="w-5 h-5 text-indigo-400" />
                  مقارنة ومطابقة إذن استلام بضاعة بالذكاء الاصطناعي
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-200 font-bold px-3 py-1 text-sm rounded-lg hover:bg-slate-800 transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-900/20 text-slate-300">
                {errorMsg && (
                  <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-2 text-xs">
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {!result && !isAnalyzing && (
                  <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/40 hover:bg-slate-900/60 transition-colors">
                    <FileUp className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-slate-300 mb-1">قم برفع إذن الاستلام هنا</h3>
                    <p className="text-xs text-slate-500 mb-6">صورة إذن الاستلام أو مستند PDF ليتم مطابقته مع بنود أمر الشراء والتحقق من الكميات</p>
                    <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all inline-block shadow-lg shadow-indigo-600/20">
                      اختيار ملف
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden" 
                        accept="image/*,application/pdf" 
                        onChange={handleFileUpload} 
                      />
                    </label>
                  </div>
                )}

                {isAnalyzing && (
                  <div className="text-center py-20">
                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto mb-4" />
                    <h3 className="text-sm font-bold text-slate-200">جاري تشغيل محرك الذكاء الاصطناعي وتحليل الإذن...</h3>
                    <p className="text-xs text-slate-500 mt-2">يتم الآن قراءة النص وتحليل الكميات ومطابقة البنود تلقائياً</p>
                  </div>
                )}

                {result && !isAnalyzing && (
                  <div className="space-y-6">
                    {/* 1. Matched Items */}
                    {result.matchedItems && result.matchedItems.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2 mb-3 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10 w-fit">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span>بنود متطابقة وتم استلامها</span>
                        </h4>
                        <div className="overflow-x-auto border border-slate-800 rounded-xl shadow-lg">
                          <table className="min-w-full text-right text-xs">
                            <thead className="bg-slate-850 text-slate-300 border-b border-slate-800">
                              <tr>
                                <th className="px-4 py-3 font-bold w-1/2">الصنف في أمر الشراء (PO)</th>
                                <th className="px-3 py-3 font-bold text-center">الكمية المطلوبة</th>
                                <th className="px-3 py-3 font-bold text-center">المستلمة فعلياً</th>
                                <th className="px-3 py-3 font-bold text-center">الحالة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50 bg-slate-900/20 text-slate-300">
                              {result.matchedItems.map((item, i) => (
                                <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                  <td className="px-4 py-3 font-medium text-slate-200">{item.description}</td>
                                  <td className="px-3 py-3 text-center text-slate-400 font-mono">{item.orderedQty}</td>
                                  <td className="px-3 py-3 text-center font-bold text-slate-200 font-mono">{item.deliveredQty}</td>
                                  <td className="px-3 py-3 text-center">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${getStatusStyle(item.status)}`}>
                                      {getStatusText(item.status)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 2. Over Received Items */}
                    {result.overReceived && result.overReceived.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-amber-400 flex items-center gap-2 mb-3 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 w-fit">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <span>بنود تم استلامها بكميات زائدة عن أمر الشراء</span>
                        </h4>
                        <div className="overflow-x-auto border border-slate-800 rounded-xl shadow-lg">
                          <table className="min-w-full text-right text-xs">
                            <thead className="bg-slate-850 text-slate-300 border-b border-slate-800">
                              <tr>
                                <th className="px-4 py-3 font-bold w-1/2">الصنف</th>
                                <th className="px-3 py-3 font-bold text-center">الكمية المطلوبة</th>
                                <th className="px-3 py-3 font-bold text-center">الكمية المستلمة</th>
                                <th className="px-3 py-3 font-bold text-center">الزيادة المستلمة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50 bg-slate-900/20 text-slate-300">
                              {result.overReceived.map((item, i) => (
                                <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                  <td className="px-4 py-3 font-medium text-slate-200">{item.description}</td>
                                  <td className="px-3 py-3 text-center text-slate-400 font-mono">{item.orderedQty}</td>
                                  <td className="px-3 py-3 text-center text-slate-200 font-mono">{item.deliveredQty}</td>
                                  <td className="px-3 py-3 text-center text-amber-400 font-mono font-bold">+{item.excessQty}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 3. Missing Items */}
                    {result.missingItems && result.missingItems.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-rose-400 flex items-center gap-2 mb-3 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10 w-fit">
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          <span>بنود مطلوبة مفقودة تماماً من إذن الاستلام</span>
                        </h4>
                        <div className="overflow-x-auto border border-slate-800 rounded-xl shadow-lg">
                          <table className="min-w-full text-right text-xs">
                            <thead className="bg-slate-850 text-slate-300 border-b border-slate-800">
                              <tr>
                                <th className="px-4 py-3 font-bold w-3/4">الصنف في أمر الشراء (PO)</th>
                                <th className="px-4 py-3 font-bold text-center">الكمية المطلوبة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50 bg-slate-900/20 text-slate-300">
                              {result.missingItems.map((item, i) => (
                                <tr key={i} className="hover:bg-rose-500/5 transition-colors">
                                  <td className="px-4 py-3 font-medium text-slate-200">{item.description}</td>
                                  <td className="px-4 py-3 text-center text-rose-400 font-mono font-bold">{item.orderedQty}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 4. Unmatched Items */}
                    {result.unmatchedItems && result.unmatchedItems.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-2 mb-3 bg-indigo-500/5 p-2 rounded-lg border border-indigo-500/10 w-fit">
                          <Info className="w-4 h-4 text-indigo-400" />
                          <span>أصناف مستلمة غير موجودة أصلاً في أمر الشراء</span>
                        </h4>
                        <div className="overflow-x-auto border border-slate-800 rounded-xl shadow-lg">
                          <table className="min-w-full text-right text-xs">
                            <thead className="bg-slate-850 text-slate-300 border-b border-slate-800">
                              <tr>
                                <th className="px-4 py-3 font-bold w-3/4">الصنف المستلم في الإذن</th>
                                <th className="px-4 py-3 font-bold text-center">الكمية المستلمة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50 bg-slate-900/20 text-slate-300">
                              {result.unmatchedItems.map((item, i) => (
                                <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                  <td className="px-4 py-3 font-medium text-slate-200">{item.description}</td>
                                  <td className="px-4 py-3 text-center text-slate-200 font-mono font-bold">{item.deliveredQty}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50 rounded-b-2xl">
                {result && !isAnalyzing && (
                  <label className="cursor-pointer px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors">
                    رفع إذن استلام آخر
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      accept="image/*,application/pdf" 
                      onChange={handleFileUpload} 
                    />
                  </label>
                )}
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import { FileUp, CheckCircle, AlertTriangle, Loader2, Info } from 'lucide-react';

interface DeliveryNoteAnalyzerProps {
  poId: string;
}

export const DeliveryNoteAnalyzer: React.FC<DeliveryNoteAnalyzerProps> = ({ poId }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<{ comparisonResult?: any[], unmatchedItems?: any[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('poId', poId);

    try {
      const res = await fetch('/api/ai/compare-delivery-receipt', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.result) {
        setResult(data.result);
      } else {
        console.error(data.error || 'حدث خطأ أثناء تحليل إذن الاستلام');
      }
    } catch (err) {
      console.error(err);
      console.error('حدث خطأ في الاتصال', err);
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'received': return 'text-emerald-600 bg-emerald-50';
      case 'partial':
      case 'missing': return 'text-red-600 bg-red-50';
      case 'over_received': return 'text-amber-600 bg-amber-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'received': return 'تم الاستلام';
      case 'partial': return 'استلام جزئي';
      case 'missing': return 'ناقص';
      case 'over_received': return 'استلام زائد';
      default: return status;
    }
  };

  return (
    <div className="mt-6 border-t border-slate-200 pt-6 no-print">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800">تحليل ومطابقة إذن استلام البضاعة (Delivery Note)</h3>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="cursor-pointer bg-sky-100 hover:bg-sky-200 text-sky-800 px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
          >
            <FileUp className="w-4 h-4" />
            <span>مقارنة مع إذن استلام بضاعة</span>
          </button>
        </div>

        {/* Upload Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full flex flex-col max-h-[90vh]">
              <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FileUp className="w-5 h-5 text-sky-600" />
                  مقارنة مع إذن استلام بضاعة
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold px-3 py-1"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar">
                {!result && !isAnalyzing && (
                  <div className="text-center py-10 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                    <FileUp className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-slate-700 mb-1">قم برفع إذن الاستلام هنا</h3>
                    <p className="text-xs text-slate-500 mb-4">صورة أو PDF ليتم مطابقته مع أمر الشراء بالذكاء الاصطناعي</p>
                    <label className="cursor-pointer bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all inline-block shadow-sm">
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
                  <div className="text-center py-16">
                    <Loader2 className="w-10 h-10 text-sky-500 animate-spin mx-auto mb-4" />
                    <h3 className="text-base font-bold text-slate-700">جاري تحليل الإذن ومطابقته...</h3>
                    <p className="text-xs text-slate-500 mt-2">يتم الآن استخدام الذكاء الاصطناعي لاستخراج البيانات والمقارنة</p>
                  </div>
                )}

                {result && !isAnalyzing && (
                  <div className="space-y-6">
                    {result.comparisonResult && result.comparisonResult.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span>نتيجة المطابقة</span>
                        </h4>
                        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                          <table className="min-w-full text-right text-xs">
                            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                              <tr>
                                <th className="px-4 py-3 font-bold w-1/3">الصنف المطلوب (PO)</th>
                                <th className="px-3 py-3 font-bold text-center">الكمية المطلوبة</th>
                                <th className="px-3 py-3 font-bold text-center">المستلمة فعلياً</th>
                                <th className="px-3 py-3 font-bold text-center">الناقصة</th>
                                <th className="px-3 py-3 font-bold text-center">حالة الاستلام</th>
                                <th className="px-4 py-3 font-bold">اقتراح ذكي (AI)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                              {result.comparisonResult.map((item, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-4 py-3 font-medium text-slate-900">{item.poItemDescription}</td>
                                  <td className="px-3 py-3 text-center">{item.orderedQty}</td>
                                  <td className="px-3 py-3 text-center font-bold text-slate-800">{item.deliveredQty}</td>
                                  <td className="px-3 py-3 text-center font-bold" dir="ltr">
                                    {item.missingQty > 0 ? <span className="text-red-500">-{item.missingQty}</span> : item.missingQty}
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black ${getStatusStyle(item.status)}`}>
                                      {getStatusText(item.status)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-[10px] leading-relaxed text-slate-500">
                                    {item.aiSuggestion}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {result.unmatchedItems && result.unmatchedItems.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-amber-700 flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-4 h-4" />
                          <span>أصناف مستلمة غير موجودة في أمر الشراء</span>
                        </h4>
                        <div className="overflow-hidden border border-amber-200 rounded-xl shadow-sm">
                          <table className="min-w-full text-right text-xs">
                            <thead className="bg-amber-50 text-amber-900 border-b border-amber-200">
                              <tr>
                                <th className="px-4 py-3 font-bold">الوصف في إذن الاستلام</th>
                                <th className="px-4 py-3 font-bold text-center">الكمية المستلمة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100 bg-white text-slate-700">
                              {result.unmatchedItems.map((item, i) => (
                                <tr key={i} className="hover:bg-amber-50/50">
                                  <td className="px-4 py-3 font-medium text-slate-900">{item.description}</td>
                                  <td className="px-4 py-3 text-center font-bold">{item.deliveredQty}</td>
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
              <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
                 {result && !isAnalyzing && (
                   <label className="cursor-pointer px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors">
                     رفع إذن آخر
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
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
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

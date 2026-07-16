const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

const modalJSX = `
      {/* AI Extraction Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0B1120] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="font-bold text-white flex items-center gap-2">
                <span>⚡ تفريغ شيت بالذكاء الاصطناعي</span>
              </h3>
              <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-5 overflow-y-auto max-h-[80vh]">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">اختر الصورة أو الملف (WhatsApp/PDF) *</label>
                <div className="border-2 border-dashed border-slate-700 bg-slate-800/30 rounded-xl p-6 text-center hover:bg-slate-800/50 hover:border-indigo-500 transition-all cursor-pointer relative">
                  <input 
                    type="file" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    accept="image/*,application/pdf"
                    onChange={(e) => setAiFile(e.target.files?.[0] || null)}
                  />
                  <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-300 font-bold mb-1">
                    {aiFile ? aiFile.name : "اضغط لاختيار ملف أو اسحب الملف هنا"}
                  </p>
                  <p className="text-xs text-slate-500">يدعم JPG, PNG, PDF</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">تعليمات إضافية (اختياري)</label>
                <textarea 
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                  placeholder="مثال: هذا الشيت خاص بالعامل شاهر، الإضافي بـ 150 والسهرة بـ 50..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none min-h-[80px]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">موديل الذكاء الاصطناعي</label>
                <select 
                  value={aiSelectedModel}
                  onChange={(e) => setAiSelectedModel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-indigo-500 outline-none cursor-pointer"
                >
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (الأدق والمُفضّل)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (سريع)</option>
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
              <button 
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 border border-slate-700 rounded-xl text-sm font-bold text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button 
                onClick={handleAiSubmit}
                disabled={isAiLoading || !aiFile}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-white transition-colors flex items-center gap-2 cursor-pointer shadow-md"
              >
                {isAiLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>جاري التحليل...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>بدء التحليل واستخراج البيانات</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
`;

code = code.replace(
  /<div className="space-y-6">/,
  '<div className="space-y-6">\n' + modalJSX
);

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

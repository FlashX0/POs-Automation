import React, { useState, useRef, useEffect } from 'react';
import { Bot, ChevronDown, Check } from 'lucide-react';

export const FREE_AI_MODELS = [
  { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash | ⚡ سريع ومجاني (للمهام البسيطة)' },
  { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro | 🧠 دقيق ومجاني (للفواتير العادية)' },
  { id: 'gemini-3.5-flash', label: 'gemini-3.5-flash | 🚀 سريع ومجاني (للمهام السريعة)' },
  { id: 'gemini-3.5-pro', label: 'gemini-3.5-pro | 🎓 دقيق جداً ومجاني' }
];

export const PAID_AI_MODELS = [
  { id: 'gpt-5.6-luna', label: 'gpt-5.6-luna | 👁️ للصور والأسكرين شوت | 🟡 استهلاك متوسط' },
  { id: 'claude-opus-4-8-bynara', label: 'claude-opus-4-8-bynara | 👑 للفواتير المتداخلة | 🟠 استهلاك مرتفع' },
  { id: 'deepseek-v4-flash-bynara', label: 'deepseek-v4-flash-bynara | ⚡ رخيص وسريع | 🔵 الأرخص إطلاقاً' },
  { id: 'qwen3.7-max', label: 'qwen3.7-max | 📊 للنصوص المعقدة | 🟠 استهلاك مرتفع' }
];

interface AIModelSelectorProps {
  useAdvanced: boolean;
  setUseAdvanced: (val: boolean) => void;
  selectedModel: string;
  setSelectedModel: (val: string) => void;
}

export function AIModelSelector({ useAdvanced, setUseAdvanced, selectedModel, setSelectedModel }: AIModelSelectorProps) {
  const [activeTab, setActiveTab] = useState<'free' | 'paid'>('free');

  useEffect(() => {
    // If turning ON advanced, ensure a valid model is selected
    if (useAdvanced) {
       const isFree = FREE_AI_MODELS.find(m => m.id === selectedModel);
       const isPaid = PAID_AI_MODELS.find(m => m.id === selectedModel);
       if (!isFree && !isPaid) {
          setSelectedModel(FREE_AI_MODELS[0].id);
          setActiveTab('free');
       } else if (isPaid) {
          setActiveTab('paid');
       } else {
          setActiveTab('free');
       }
    }
  }, [useAdvanced]);

  const currentModels = activeTab === 'free' ? FREE_AI_MODELS : PAID_AI_MODELS;

  return (
    <div className="flex flex-col gap-4 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60 mt-2 mb-4 shadow-sm" dir="rtl" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-row-reverse items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-emerald-400" />
          <div className="text-right">
            <h4 className={`text-sm font-bold text-white`}>تشغيل المعالج الذكي</h4>
            <p className="text-[10px] text-slate-400">تفعيل واستخدام الذكاء الاصطناعي</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={useAdvanced} 
            onChange={(e) => setUseAdvanced(e.target.checked)} 
          />
          <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-slate-200 after:border-slate-200 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
        </label>
      </div>

      {useAdvanced && (
        <div className="space-y-4 pt-4 border-t border-slate-700/50 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="flex bg-slate-900/50 rounded-xl p-1 w-full border border-slate-700/50">
            <button
              type="button"
              onClick={() => setActiveTab('free')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'free' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              المجاني (الافتراضي)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paid')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'paid' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              المدفوع (Nara)
            </button>
          </div>
          
          <div className="grid grid-cols-1 gap-2 mt-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {currentModels.map((opt) => (
              <div
                key={opt.id}
                onClick={() => setSelectedModel(opt.id)}
                className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                  selectedModel === opt.id
                    ? activeTab === 'free' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-rose-500/10 border-rose-500 text-rose-400'
                    : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <span className="text-xs font-semibold">{opt.label}</span>
                {selectedModel === opt.id && <Check className="w-4 h-4" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

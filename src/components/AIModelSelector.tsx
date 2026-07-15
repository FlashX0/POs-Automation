import React, { useState, useRef, useEffect } from 'react';
import { Bot, ChevronDown } from 'lucide-react';

export const AI_MODELS = [
  { group: "👑 الدقة القصوى (للملفات المعقدة جداً)", options: [
    { value: "gpt-5.5", label: "gpt-5.5 | 👑 للصور المعقدة جداً | 🔴 استهلاك عالي جداً ($0.99/1M)" },
    { value: "gpt-5.6-sol", label: "gpt-5.6-sol | 👑 دقة بصرية فائقة | 🔴 استهلاك عالي ($0.96/1M)" },
    { value: "claude-opus-4-8-bynara", label: "claude-opus-4-8-bynara | 👑 لتحليل الفواتير المتداخلة | 🟠 استهلاك مرتفع ($0.50/1M)" }
  ]},
  { group: "👁️ الذكاء البصري المتقدم (استهلاك متوسط - متوازن)", options: [
    { value: "gpt-5.6-luna", label: "gpt-5.6-luna | 👁️ للصور والأسكرين شوت | 🟡 استهلاك متوسط ($0.19/1M)" },
    { value: "claude-sonnet-5-bynara", label: "claude-sonnet-5-bynara | 👁️ للجداول المصورة | 🟡 استهلاك متوسط ($0.20/1M)" }
  ]},
  { group: "📊 موديلات الإكسيل والنصوص (استهلاك موفر)", options: [
    { value: "deepseek-v4-pro-bynara", label: "deepseek-v4-pro-bynara | 📊 لشيتات الإكسيل الدقيقة | 🟢 استهلاك موفر ($0.22/1M)" },
    { value: "deepseek-v4-flash-bynara", label: "deepseek-v4-flash-bynara | ⚡ للملفات البسيطة والسريعة | 🔵 الأرخص إطلاقاً ($0.02/1M)" },
    { value: "qwen3.7-max", label: "qwen3.7-max | 📊 للنصوص المعقدة | 🟠 استهلاك مرتفع ($0.87/1M)" }
  ]}
];

interface AIModelSelectorProps {
  useAdvanced: boolean;
  setUseAdvanced: (val: boolean) => void;
  selectedModel: string;
  setSelectedModel: (val: string) => void;
}

export function AIModelSelector({ useAdvanced, setUseAdvanced, selectedModel, setSelectedModel }: AIModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getSelectedLabel = () => {
    if (!AI_MODELS || !Array.isArray(AI_MODELS)) return selectedModel;
    for (const group of AI_MODELS) {
      const opt = group?.options?.find(o => o.value === selectedModel);
      if (opt) return opt.label;
    }
    return selectedModel;
  };

  return (
    <div className="flex flex-col gap-4 bg-slate-800/80 p-5 rounded-2xl border border-slate-700/60 mt-2 mb-4 shadow-sm" dir="rtl" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-row-reverse items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-emerald-400" />
          <div className="text-right">
            <h4 className={`text-sm font-bold ${useAdvanced ? 'text-black' : 'text-white'}`}>{useAdvanced ? 'تشغيل المعالج الذكى' : 'تصحيح كتابه'}</h4>
            <p className="text-[10px] text-slate-400">تحكم في دقة وتكلفة التحليل</p>
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
        <div className="space-y-3 pt-4 border-t border-slate-700/50 animate-in fade-in zoom-in-95 duration-200" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
          <label className="text-xs font-bold text-slate-300 block text-right">الموديل المتقدم:</label>
          
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
              className="w-full bg-slate-950/80 border border-slate-600 text-white text-xs font-bold rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer flex justify-between items-center text-right hover:border-slate-500 transition-colors"
            >
              <span className="truncate">{getSelectedLabel()}</span>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
            
            {isOpen && (
              <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
                {AI_MODELS?.map((group, idx) => (
                  <div key={idx}>
                    <div className="bg-slate-900/80 px-3 py-2 text-[10px] font-black text-slate-400 sticky top-0 z-10 border-y border-slate-700/50">
                      {group?.group}
                    </div>
                    <div className="py-1">
                      {group?.options?.map(opt => (
                        <div
                          key={opt?.value}
                          onClick={() => {
                            setSelectedModel(opt?.value);
                            setIsOpen(false);
                          }}
                          className={`px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer transition-colors ${selectedModel === opt?.value ? 'bg-emerald-500/10 text-emerald-400 font-bold' : ''}`}
                        >
                          {opt?.label}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useRef, useState } from 'react';
import { Upload, X, RefreshCw, FileText } from 'lucide-react';
import { AIModelSelector } from './AIModelSelector';

interface AIUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (file: File, model: string, useAdvanced: boolean) => void;
  isProcessing: boolean;
  title?: string;
  description?: string;
  acceptedTypes?: string;
}

export function AIUploadModal({
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
  title = "التحليل بالذكاء الاصطناعي",
  description = "ارفع الملف أو الصورة لتحليلها واستخراج البيانات تلقائياً.",
  acceptedTypes = ".xlsx, .xls, .csv, image/*, application/pdf"
}: AIUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [useAdvanced, setUseAdvanced] = useState(true);
  const [selectedModel, setSelectedModel] = useState("gpt-5.6-luna");

  if (!isOpen) return null;

  const handleFileSelection = (file: File) => {
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onConfirm(selectedFile, selectedModel, useAdvanced);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-750 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-150" dir="rtl">
        <div className="px-6 py-4 bg-slate-850/50 border-b border-slate-850 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
              <Upload className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div className="text-right">
              <h3 className="text-sm font-black text-white">{title}</h3>
              <p className="text-[10px] text-slate-400 font-medium">{description}</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (!isProcessing) {
                onClose();
                setSelectedFile(null);
                setFilePreview(null);
              }
            }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] text-right">
          <AIModelSelector
            useAdvanced={useAdvanced}
            setUseAdvanced={setUseAdvanced}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">ارفع الملف هنا:</label>
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileSelection(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 bg-slate-950/40 hover:bg-slate-950/80 rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer text-center relative group min-h-[160px]"
            >
              {filePreview ? (
                <div className="relative w-full max-h-48 overflow-hidden rounded-lg border border-slate-800">
                  <img src={filePreview} alt="Preview" className="w-full h-auto object-contain mx-auto" referrerPolicy="no-referrer" />
                </div>
              ) : selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-10 h-10 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">{selectedFile.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                </div>
              ) : (
                <>
                  <div className="bg-slate-800 p-3 rounded-full border border-slate-700 group-hover:border-emerald-500/30 transition-all">
                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-300">اسحب وأسقط الملف أو الصورة هنا، أو اضغط للتصفح</p>
                  </div>
                </>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept={acceptedTypes}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelection(file);
              }}
              className="hidden"
            />
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-850/50 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={() => {
              if (!isProcessing) {
                onClose();
                setSelectedFile(null);
                setFilePreview(null);
              }
            }}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            إلغاء ✕
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing || !selectedFile}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-850 disabled:text-slate-500 text-white text-xs font-black rounded-xl transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري المعالجة...</span>
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                <span>بدء المعالجة ⚡</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

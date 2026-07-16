const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

const oldFuncStart = code.indexOf('  const handleLaborOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {');
const oldFuncEnd = code.indexOf('  const [selectedSheetId, setSelectedSheetId] = useState<string>(');

const newFunc = `  const handleAiSubmit = async () => {
    if (!aiFile) {
      alert('الرجاء اختيار ملف أو صورة أولاً.');
      return;
    }
    setIsAiLoading(true);
    if (onNotify) {
      onNotify('info', 'جاري تحليل المستند بالذكاء الاصطناعي 🤖', 'يتم استخراج البيانات وتوزيع اليوميات...');
    }

    const formData = new FormData();
    formData.append('file', aiFile);
    formData.append('selectedAIModel', aiSelectedModel);
    formData.append('type', 'labor');
    if (aiInstructions) {
      formData.append('userInstructions', aiInstructions);
    }

    try {
      const res = await fetch('/api/ai/ocr', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const ext = data.data;
          
          if (ext.workerName) setNewWorker(ext.workerName);
          else if (ext.names && ext.names.length > 0) setNewWorker(ext.names[0]);
          
          if (ext.weekStartDate || ext.startDate) setNewStart(ext.weekStartDate || ext.startDate);
          if (ext.endDate) setNewEnd(ext.endDate);
          
          if (ext.dailyRate) setNewDailyRate(ext.dailyRate.toString());
          if (ext.overtimeRate) setNewOvertimeRate(ext.overtimeRate.toString());
          if (ext.sohraRate) setNewSohraRate(ext.sohraRate.toString());
          
          if (ext.previousTotal) setNewPrevTotal(ext.previousTotal.toString());
          if (ext.previousPaid) setNewPrevPaid(ext.previousPaid.toString());

          if (ext.days && ext.days.length > 0) {
            setAiExtractedDays(ext.days);
          }
          
          setShowAiModal(false);
          setShowCreateForm(true);
          setAiFile(null);
          
          if (onNotify) {
            onNotify('success', 'تم استخراج بيانات كشف العمالة بنجاح 🎉', 'يرجى مراجعة البيانات ثم الضغط على توليد الكشف.');
          }
        } else {
          if (onNotify) onNotify('error', 'فشل تحليل المستند', data.error || 'حدث خطأ.');
        }
      } else {
        if (onNotify) onNotify('error', 'خطأ اتصال', 'فشل الإرسال للخادم.');
      }
    } catch (err: any) {
      if (onNotify) onNotify('error', 'خطأ في المعالجة', err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

`;

code = code.substring(0, oldFuncStart) + newFunc + code.substring(oldFuncEnd);

fs.writeFileSync('src/components/LaborTimesheet.tsx', code);

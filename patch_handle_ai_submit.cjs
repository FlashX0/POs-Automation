const fs = require('fs');
let code = fs.readFileSync('src/components/LaborTimesheet.tsx', 'utf-8');

const oldFuncStart = code.indexOf('  const handleAiSubmit = async () => {');
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
    formData.append('useAdvanced', 'true');
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
          
          setNewWorker(ext.workerName || (ext.names && ext.names.length > 0 ? ext.names[0] : "عامل جديد"));
          
          if (ext.weekStartDate || ext.startDate) setNewStart(ext.weekStartDate || ext.startDate);
          if (ext.endDate) setNewEnd(ext.endDate);
          
          setNewDailyRate(ext.dailyRate ? Number(ext.dailyRate).toString() : '300');
          setNewOvertimeRate(ext.overtimeRate ? Number(ext.overtimeRate).toString() : '300');
          setNewSohraRate(ext.sohraRate ? Number(ext.sohraRate).toString() : '45');
          
          setNewPrevTotal(ext.previousTotal ? Number(ext.previousTotal).toString() : '0');
          setNewPrevPaid(ext.previousPaid ? Number(ext.previousPaid).toString() : '0');

          if (ext.days && Array.isArray(ext.days) && ext.days.length > 0) {
            setAiExtractedDays(ext.days.map((day: any) => ({
              dayName: day.dayName || "",
              date: day.date || "",
              attendance: Number(day.attendance || day.daily) || 0,
              overtime: Number(day.overtime) || 0,
              sohra: Number(day.sohra) || 0,
              project: day.project || "عام"
            })));
          } else {
            setAiExtractedDays([]);
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

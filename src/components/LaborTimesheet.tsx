import React, { useState, useMemo } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import { 
  Download, Plus, Trash2, Calendar, DollarSign, CheckCircle, 
  Clock, Users, User, Folder, FolderOpen, FileSpreadsheet, 
  FileText, ArrowRight, Upload, Sparkles, AlertCircle, Printer 
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

interface DayEntry {
  dayName: string;
  date: string;
  // Legacy fields
  dailySahel?: number;
  dailyBurouj?: number;
  dailyHyde?: number;
  overtimeSahel?: number;
  overtimeBurouj?: number;
  overtimeHyde?: number;
  sohraSahel?: number;
  sohraBurouj?: number;
  sohraHyde?: number;
  // Dynamic fields
  projectValues?: {
    [projectName: string]: {
      daily: number;
      overtime: number;
      sohra: number;
    }
  }
}

interface LaborTimesheetData {
  id: string;
  workerName: string;
  startDate: string;
  endDate: string;
  previousTotal: number;
  previousPaid: number;
  previousRemaining: number;
  currentPaid: number;
  dailyRate: number;
  overtimeRate: number;
  sohraRate: number;
  days: DayEntry[];
  project1?: string;
  project2?: string;
  project3?: string;
  projects?: string[]; // Dynamic list of project names
}

interface LaborTimesheetProps {
  projectsList: string[];
  timesheets: LaborTimesheetData[];
  onSave: (updatedTimesheets: LaborTimesheetData[]) => void;
  archives?: any[];
  onUpdateArchives?: (updatedArchives: any[]) => void;
  onNotify?: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  onRefresh?: () => void;
}

// Utility to convert column index to Excel letter (A, B, C... AA, AB...)
function colIndexToLabel(index: number): string {
  let label = '';
  let temp = index;
  while (temp >= 0) {
    label = String.fromCharCode((temp % 26) + 65) + label;
    temp = Math.floor(temp / 26) - 1;
  }
  return label;
}

// Normalize helper to read either dynamic projectValues or legacy hardcoded project fields
const getNormalizedDayValues = (day: DayEntry, projects: string[], sheet: LaborTimesheetData) => {
  const p1 = sheet.project1 || 'الساحل';
  const p2 = sheet.project2 || 'البروج';
  const p3 = sheet.project3 || 'هايد بارك';

  const values: { [proj: string]: { daily: number; overtime: number; sohra: number } } = {};

  if (day.projectValues) {
    projects.forEach(p => {
      values[p] = day.projectValues?.[p] || { daily: 0, overtime: 0, sohra: 0 };
    });
  } else {
    projects.forEach(p => {
      let d = 0, o = 0, s = 0;
      if (p === p1) {
        d = day.dailySahel || 0;
        o = day.overtimeSahel || 0;
        s = day.sohraSahel || 0;
      } else if (p === p2) {
        d = day.dailyBurouj || 0;
        o = day.overtimeBurouj || 0;
        s = day.sohraBurouj || 0;
      } else if (p === p3) {
        d = day.dailyHyde || 0;
        o = day.overtimeHyde || 0;
        s = day.sohraHyde || 0;
      }
      values[p] = { daily: d, overtime: o, sohra: s };
    });
  }
  return values;
};

export const LaborTimesheet: React.FC<LaborTimesheetProps> = ({
  projectsList,
  timesheets,
  onSave,
  archives = [],
  onUpdateArchives,
  onNotify,
  onRefresh,
}) => {
  const formatCurrency = (val: number): string => {
    if (val < 0) {
      const positiveVal = Math.abs(val);
      return `(${positiveVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
    }
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Navigation tabs state
  const [activeTab, setActiveTab] = useState<'entry' | 'archive'>('entry');
  const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [printBorderThickness, setPrintBorderThickness] = useState<'light' | 'sharp'>('sharp');
  const [printFixPageBreak, setPrintFixPageBreak] = useState<boolean>(true);

  const handleLaborOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingAI(true);
    if (onNotify) {
      onNotify('info', 'جاري قراءة كشف الحضور بالذكاء الاصطناعي 🤖', 'يتم رفع وتحليل كشف العمالة والأسماء وتوزيع اليوميات بالكامل...');
    } else {
      alert('جاري قراءة كشف الحضور بالذكاء الاصطناعي...');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('selectedAIModel', 'gemini-2.5-pro');
    formData.append('useAdvanced', 'false');
    formData.append('type', 'labor');

    try {
      const res = await fetch('/api/ai/ocr', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setIsAIModalOpen(false);
          const ext = data.data;
          
          if (onNotify) {
            onNotify('success', 'تم استخراج بيانات كشف العمالة بنجاح 🎉', 'تم ملء بيانات العامل ويوميات الحضور تلقائياً بالكامل.');
          } else {
            alert('تم استخراج بيانات كشف العمالة بنجاح 🎉');
          }

          
          // Parse AI extraction and directly create the timesheet for user review
          if (ext.workerName) {
            setNewWorker(ext.workerName);
          } else if (ext.names && ext.names.length > 0) {
            setNewWorker(ext.names[0]);
          }

          let extractedDays = ext.days || [];

          // Create new timesheet directly so user can review the days in the main grid
          const prevTotalVal = parseFloat(ext.previousTotal || ext.previous_total) || 0;
          const prevPaidVal = parseFloat(ext.previousPaid || ext.previous_paid) || 0;
          
          let stDate = ext.weekStartDate || ext.startDate || (ext.dates && ext.dates.length > 0 ? ext.dates[0] : null);
          let enDate = ext.endDate || null;
          
          if (!stDate && extractedDays.length > 0) {
            stDate = extractedDays[0].date;
          }
          if (stDate && !enDate) {
            try {
              const d = new Date(stDate);
              d.setDate(d.getDate() + 6);
              enDate = d.toISOString().split('T')[0];
            } catch(e) {}
          }
          
          if (!stDate) stDate = newStart;
          if (!enDate) enDate = newEnd;

          // Process the days array from AI
          const processedDays = [];
          if (extractedDays.length > 0) {
            extractedDays.forEach((dDay: any) => {
              const pName = dDay.project || 'الساحل';
              const pVals = {};
              projectsList.forEach(p => { pVals[p] = { daily: 0, overtime: 0, sohra: 0 }; });
              if (!pVals[pName]) pVals[pName] = { daily: 0, overtime: 0, sohra: 0 };
              pVals[pName] = {
                daily: parseFloat(dDay.attendance || dDay.daily || 0),
                overtime: parseFloat(dDay.overtime || 0),
                sohra: parseFloat(dDay.sohra || 0)
              };
              processedDays.push({
                dayName: dDay.dayName || 'يوم',
                date: dDay.date || stDate,
                projectValues: pVals
              });
            });
          }

          const newSheet = {
            id: `timesheet-${Date.now()}`,
            workerName: ext.workerName || ext.names?.[0] || 'عامل جديد',
            startDate: stDate,
            endDate: enDate,
            previousTotal: prevTotalVal,
            previousPaid: prevPaidVal,
            dailyRate: parseFloat(ext.dailyRate || ext.amounts?.[0]) || 300,
            overtimeRate: parseFloat(ext.overtimeRate) || 300,
            sohraRate: parseFloat(ext.sohraRate) || 45,
            days: processedDays,
            projects: projectsList,
            currentPaid: 0,
            status: 'draft'
          };
          
          if (processedDays.length > 0) {
            onSave([newSheet, ...timesheets]);
            setSelectedSheetId(newSheet.id);
            if (onNotify) onNotify('success', 'تم إنشاء الكشف بنجاح', 'يمكنك الآن مراجعة اليوميات في الجدول.');
          }

        } else {
          if (onNotify) {
            onNotify('error', 'فشل تحليل المستند', data.error || 'حدث خطأ في قراءة الكشف بالذكاء الاصطناعي.');
          } else {
            alert(data.error || 'حدث خطأ في قراءة الكشف بالذكاء الاصطناعي.');
          }
        }
      } else {
        if (onNotify) {
          onNotify('error', 'خطأ في الاتصال بالخادم', 'فشل إرسال الملف إلى معالج الذكاء الاصطناعي.');
        } else {
          alert('خطأ في الاتصال بالخادم');
        }
      }
    } catch (err: any) {
      if (onNotify) {
        onNotify('error', 'فشل معالجة الكشف', err.message || 'خطأ في الشبكة.');
      } else {
        alert(err.message || 'خطأ في الشبكة.');
      }
    } finally {
      setIsProcessingAI(false);
      e.target.value = '';
      
    }
  };

  const [selectedSheetId, setSelectedSheetId] = useState<string>(
    timesheets[0]?.id || ''
  );

  // New Timesheet Form States
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiInstructions, setAiInstructions] = useState<string>('');
  const [newWorker, setNewWorker] = useState<string>('');
  const [newStart, setNewStart] = useState<string>('2026-06-24');
  const [newEnd, setNewEnd] = useState<string>('2026-06-30');
  const [newPrevTotal, setNewPrevTotal] = useState<string>('19030');
  const [newPrevPaid, setNewPrevPaid] = useState<string>('0');
  const [newDailyRate, setNewDailyRate] = useState<string>('300');
  const [newOvertimeRate, setNewOvertimeRate] = useState<string>('300');
  const [newSohraRate, setNewSohraRate] = useState<string>('45');
  const [selectedProjectToAdd, setSelectedProjectToAdd] = useState<string>('');

  // Helper to calculate the exact remaining balance of a timesheet
  const calculateTimesheetRemaining = (sheet: LaborTimesheetData): number => {
    const projects = sheet.projects || [
      sheet.project1 || 'الساحل',
      sheet.project2 || 'البروج',
      sheet.project3 || 'هايد بارك'
    ].filter(Boolean);

    let weeklyTotal = 0;
    projects.forEach(p => {
      let sumDaily = 0;
      let sumOvertime = 0;
      let sumSohra = 0;

      sheet.days.forEach(day => {
        const p1 = sheet.project1 || 'الساحل';
        const p2 = sheet.project2 || 'البروج';
        const p3 = sheet.project3 || 'هايد بارك';

        let d = 0, o = 0, s = 0;
        if (day.projectValues) {
          const pVal = day.projectValues[p] || { daily: 0, overtime: 0, sohra: 0 };
          d = pVal.daily;
          o = pVal.overtime;
          s = pVal.sohra;
        } else {
          if (p === p1) {
            d = day.dailySahel || 0;
            o = day.overtimeSahel || 0;
            s = day.sohraSahel || 0;
          } else if (p === p2) {
            d = day.dailyBurouj || 0;
            o = day.overtimeBurouj || 0;
            s = day.sohraBurouj || 0;
          } else if (p === p3) {
            d = day.dailyHyde || 0;
            o = day.overtimeHyde || 0;
            s = day.sohraHyde || 0;
          }
        }
        sumDaily += d;
        sumOvertime += o;
        sumSohra += s;
      });

      const totalDailyVal = sumDaily * sheet.dailyRate;
      const totalOvertimeVal = sumOvertime * sheet.overtimeRate;
      const totalSohraVal = sumSohra * sheet.sohraRate;
      weeklyTotal += (totalDailyVal + totalOvertimeVal + totalSohraVal);
    });

    const previousRemaining = sheet.previousTotal - sheet.previousPaid;
    const overallTotal = previousRemaining + weeklyTotal;
    return overallTotal - sheet.currentPaid;
  };

  // Automated Rolling Balance effect for Labor
  React.useEffect(() => {
    if (!newWorker.trim()) return;

    const workerSheets = timesheets.filter(
      (ts) => ts.workerName.trim().toLowerCase() === newWorker.trim().toLowerCase()
    );

    if (workerSheets.length === 0) {
      setNewPrevTotal('0');
      setNewPrevPaid('0');
      return;
    }

    const previousSheets = workerSheets.filter((ts) => ts.endDate < newStart);
    previousSheets.sort((a, b) => b.endDate.localeCompare(a.endDate));

    const lastSheet = previousSheets[0];
    if (lastSheet) {
      const remaining = calculateTimesheetRemaining(lastSheet);
      setNewPrevTotal(remaining.toString());
      setNewPrevPaid('0');
    } else {
      setNewPrevTotal('0');
      setNewPrevPaid('0');
    }
  }, [newWorker, newStart, timesheets]);

  // Archive Explorer States
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Currently selected timesheet
  const selectedSheet = useMemo(() => {
    return timesheets.find((ts) => ts.id === selectedSheetId);
  }, [timesheets, selectedSheetId]);

  // Compute summary values dynamically for any number of projects
  const computedSums = useMemo(() => {
    if (!selectedSheet) return null;
    const days = selectedSheet.days;

    // Resolve list of active projects for this sheet
    const projects = selectedSheet.projects || [
      selectedSheet.project1 || 'الساحل',
      selectedSheet.project2 || 'البروج',
      selectedSheet.project3 || 'هايد بارك'
    ].filter(Boolean);

    // Group sum objects for each project dynamically
    const projectSums: {
      [projectName: string]: {
        sumDaily: number;
        sumOvertime: number;
        sumSohra: number;
        totalDailyVal: number;
        totalOvertimeVal: number;
        totalSohraVal: number;
        projectTotal: number;
      }
    } = {};

    let weeklyTotal = 0;

    projects.forEach(p => {
      let sumDaily = 0;
      let sumOvertime = 0;
      let sumSohra = 0;

      days.forEach(day => {
        const valMap = getNormalizedDayValues(day, projects, selectedSheet);
        const pVal = valMap[p] || { daily: 0, overtime: 0, sohra: 0 };
        sumDaily += pVal.daily;
        sumOvertime += pVal.overtime;
        sumSohra += pVal.sohra;
      });

      const totalDailyVal = sumDaily * selectedSheet.dailyRate;
      const totalOvertimeVal = sumOvertime * selectedSheet.overtimeRate;
      const totalSohraVal = sumSohra * selectedSheet.sohraRate;
      const projectTotal = totalDailyVal + totalOvertimeVal + totalSohraVal;

      weeklyTotal += projectTotal;

      projectSums[p] = {
        sumDaily,
        sumOvertime,
        sumSohra,
        totalDailyVal,
        totalOvertimeVal,
        totalSohraVal,
        projectTotal
      };
    });

    const overallTotal = selectedSheet.previousRemaining + weeklyTotal;
    const remainingBalance = overallTotal - selectedSheet.currentPaid;

    return {
      projects,
      projectSums,
      weeklyTotal,
      overallTotal,
      remainingBalance,
    };
  }, [selectedSheet]);

  // Handle cell edit in dynamic projectValues structure
  const handleCellChange = (
    dayIndex: number,
    projectName: string,
    subField: 'daily' | 'overtime' | 'sohra',
    valStr: string
  ) => {
    if (!selectedSheet || !computedSums) return;
    const val = parseFloat(valStr) || 0;
    const { projects } = computedSums;

    const updatedDays = selectedSheet.days.map((day, idx) => {
      if (idx === dayIndex) {
        const projectValues = day.projectValues ? { ...day.projectValues } : {};
        
        projects.forEach(p => {
          if (!projectValues[p]) {
            const vals = getNormalizedDayValues(day, projects, selectedSheet);
            projectValues[p] = vals[p] || { daily: 0, overtime: 0, sohra: 0 };
          }
        });

        projectValues[projectName] = {
          ...projectValues[projectName],
          [subField]: val
        };

        return {
          ...day,
          projectValues
        };
      }
      return day;
    });

    const updatedSheets = timesheets.map((ts) => {
      if (ts.id === selectedSheetId) {
        return {
          ...ts,
          days: updatedDays,
          projects
        };
      }
      return ts;
    });

    onSave(updatedSheets);
  };

  const handleMetaFieldChange = (
    field: keyof LaborTimesheetData,
    valStr: string
  ) => {
    if (!selectedSheet) return;
    const val = parseFloat(valStr) || 0;

    const updatedSheets = timesheets.map((ts) => {
      if (ts.id === selectedSheetId) {
        let updated: any = {
          ...ts,
          [field]: valStr,
        };
        if (typeof ts[field] === 'number') {
          updated[field] = val;
        }
        if (field === 'previousTotal' || field === 'previousPaid') {
          const tot = field === 'previousTotal' ? val : ts.previousTotal;
          const paid = field === 'previousPaid' ? val : ts.previousPaid;
          updated.previousRemaining = tot - paid;
        }
        return updated;
      }
      return ts;
    });
    onSave(updatedSheets);
  };

  // Add project dynamically to the current sheet
  const handleAddProjectToSheet = (projectName: string) => {
    if (!selectedSheet || !projectName || !computedSums) return;
    const { projects } = computedSums;

    if (projects.includes(projectName)) {
      alert('المشروع مضاف بالفعل في هذا الكشف!');
      return;
    }

    const updatedProjects = [...projects, projectName];

    const updatedSheets = timesheets.map((ts) => {
      if (ts.id === selectedSheetId) {
        const updatedDays = ts.days.map(day => {
          const projectValues = day.projectValues ? { ...day.projectValues } : {};
          projects.forEach(p => {
            if (!projectValues[p]) {
              const vals = getNormalizedDayValues(day, projects, ts);
              projectValues[p] = vals[p] || { daily: 0, overtime: 0, sohra: 0 };
            }
          });
          projectValues[projectName] = { daily: 0, overtime: 0, sohra: 0 };
          return { ...day, projectValues };
        });

        return {
          ...ts,
          projects: updatedProjects,
          days: updatedDays
        };
      }
      return ts;
    });

    onSave(updatedSheets);
    setSelectedProjectToAdd('');
  };

  // Remove project dynamically from the current sheet
  const handleRemoveProjectFromSheet = (projectName: string) => {
    if (!selectedSheet || !computedSums) return;
    const { projects } = computedSums;

    if (projects.length <= 1) {
      alert('يجب الإبقاء على مشروع واحد على الأقل في الكشف!');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من حذف العمود الخاص بمشروع "${projectName}" من هذا الكشف؟`)) {
      return;
    }

    const updatedProjects = projects.filter(p => p !== projectName);

    const updatedSheets = timesheets.map((ts) => {
      if (ts.id === selectedSheetId) {
        const updatedDays = ts.days.map(day => {
          const projectValues = day.projectValues ? { ...day.projectValues } : {};
          delete projectValues[projectName];
          return { ...day, projectValues };
        });

        return {
          ...ts,
          projects: updatedProjects,
          days: updatedDays
        };
      }
      return ts;
    });

    onSave(updatedSheets);
  };

  // Create new timesheet with customizable header values
  const handleCreateTimesheet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorker.trim()) {
      alert('الرجاء إدخال اسم العامل!');
      return;
    }

    const start = new Date(newStart);
    const end = new Date(newEnd);
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    const diffDays = Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays <= 0) {
      alert('تاريخ النهاية يجب أن يكون مساوياً أو بعد تاريخ البداية!');
      return;
    }

    const daysArr: DayEntry[] = [];
    const activeProjects = projectsList && projectsList.length > 0 ? projectsList : [];

    for (let i = 0; i < diffDays; i++) {
      const currDate = new Date(start);
      currDate.setDate(start.getDate() + i);
      
      // Get dynamic Arabic weekday name
      const dayName = currDate.toLocaleDateString('ar-EG', { weekday: 'long' });
      
      const projectValues: { [projectName: string]: { daily: number; overtime: number; sohra: number } } = {};
      activeProjects.forEach(p => {
        projectValues[p] = { daily: 0, overtime: 0, sohra: 0 };
      });

      daysArr.push({
        dayName: dayName,
        date: currDate.toISOString().split('T')[0],
        projectValues: projectValues
      });
    }

    const prevTotalVal = parseFloat(newPrevTotal) || 0;
    const prevPaidVal = parseFloat(newPrevPaid) || 0;

    const newSheet: LaborTimesheetData = {
      id: `timesheet-${Date.now()}`,
      workerName: newWorker.trim(),
      startDate: newStart,
      endDate: newEnd,
      previousTotal: prevTotalVal,
      previousPaid: prevPaidVal,
      previousRemaining: prevTotalVal - prevPaidVal,
      currentPaid: 0,
      dailyRate: parseFloat(newDailyRate) || 300,
      overtimeRate: parseFloat(newOvertimeRate) || 300,
      sohraRate: parseFloat(newSohraRate) || 45,
      projects: activeProjects,
      days: daysArr,
    };

    const updated = [newSheet, ...timesheets];
    onSave(updated);
    setSelectedSheetId(newSheet.id);
    setShowCreateForm(false);
    setNewWorker('');
  };

  const handleDeleteTimesheet = async () => {
    if (!selectedSheet) return;
    if (
      window.confirm(
        `هل أنت متأكد من حذف كشف حضور العامل "${selectedSheet.workerName}" نهائياً من السيستم؟`
      )
    ) {
      setIsDeleting(true);
      try {
        const res = await fetch('/api/state/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            laborTimesheets: timesheets.filter((ts) => ts.id !== selectedSheetId),
            deletedLaborTimesheetIds: [selectedSheetId]
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            // Update local state immediately before refetching
            const updated = timesheets.filter((ts) => ts.id !== selectedSheetId);
            onSave(updated);
            setSelectedSheetId(updated[0]?.id || '');
            if (onRefresh) {
              onRefresh();
            }
          } else {
            alert(`فشل حذف الكشف: ${data.error || 'خطأ غير معروف'}`);
          }
        } else {
          alert('فشل الاتصال بالسيرفر لحذف الكشف.');
        }
      } catch (err) {
        console.error('Error deleting labor timesheet:', err);
        alert('حدث خطأ أثناء الاتصال بالسيرفر لحذف الكشف.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // Core Dynamic Excel exporter workbook builder
  const handleExportExcelDynamic = (sheet: LaborTimesheetData, computed: any) => {
    const projects = computed.projects;
    const N = projects.length;
    const rows: any[][] = [];

    const emptyRowCols = Array(2 + 3 * N).fill("");
    rows.push([`كشف حضور وأجور العمالة اليومية - العامل: ${sheet.workerName}`, ...emptyRowCols.slice(1)]);
    rows.push([...emptyRowCols]);

    const metaRow = Array(2 + 3 * N).fill("");
    metaRow[0] = "من تاريخ";
    metaRow[1] = sheet.startDate;
    metaRow[2] = "إلى تاريخ";
    metaRow[3] = sheet.endDate;
    metaRow[4] = "الإجمالي السابق";
    metaRow[5] = sheet.previousTotal;
    metaRow[6] = "المسدد السابق";
    metaRow[7] = sheet.previousPaid;
    metaRow[8] = "المتبقي السابق";
    metaRow[9] = sheet.previousRemaining;
    rows.push(metaRow);
    rows.push([...emptyRowCols]);

    const headerRow1 = Array(2 + 3 * N).fill("");
    headerRow1[0] = "اليوم (Day)";
    headerRow1[1] = "التاريخ (Date)";
    headerRow1[2] = "مشروع - يومية (Daily Rate Projects)";
    headerRow1[2 + N] = "اضافي (Overtime Projects)";
    headerRow1[2 + 2 * N] = "سهرات بالساعة (Hourly Sohra Projects)";
    rows.push(headerRow1);

    const headerRow2 = Array(2 + 3 * N).fill("");
    for (let i = 0; i < N; i++) {
      headerRow2[2 + i] = projects[i];
      headerRow2[2 + N + i] = projects[i];
      headerRow2[2 + 2 * N + i] = projects[i];
    }
    rows.push(headerRow2);

    sheet.days.forEach(day => {
      const dayRow = Array(2 + 3 * N).fill(0);
      dayRow[0] = day.dayName;
      dayRow[1] = day.date;

      const valMap = getNormalizedDayValues(day, projects, sheet);
      for (let i = 0; i < N; i++) {
        const p = projects[i];
        const v = valMap[p] || { daily: 0, overtime: 0, sohra: 0 };
        dayRow[2 + i] = v.daily;
        dayRow[2 + N + i] = v.overtime;
        dayRow[2 + 2 * N + i] = v.sohra;
      }
      rows.push(dayRow);
    });

    const sumsRow = Array(2 + 3 * N).fill("");
    sumsRow[0] = "عدد الايام / الساعات";
    for (let i = 0; i < 3 * N; i++) {
      const colLetter = colIndexToLabel(2 + i);
      sumsRow[2 + i] = { f: `SUM(${colLetter}7:${colLetter}13)` };
    }
    rows.push(sumsRow);

    const ratesRow = Array(2 + 3 * N).fill("");
    ratesRow[0] = "الفئة (Rate per unit)";
    for (let i = 0; i < N; i++) {
      ratesRow[2 + i] = sheet.dailyRate;
      ratesRow[2 + N + i] = sheet.overtimeRate;
      ratesRow[2 + 2 * N + i] = sheet.sohraRate;
    }
    rows.push(ratesRow);

    const subtotalsRow = Array(2 + 3 * N).fill("");
    subtotalsRow[0] = "اجمالي اسبوعي (Sub-Total)";
    for (let i = 0; i < 3 * N; i++) {
      const colLetter = colIndexToLabel(2 + i);
      subtotalsRow[2 + i] = { f: `${colLetter}14*${colLetter}15` };
    }
    rows.push(subtotalsRow);

    rows.push([...emptyRowCols]);

    const overallTotalRow = Array(2 + 3 * N).fill("");
    overallTotalRow[0] = "الإجمالي العام (Overall Total)";
    const startCol = colIndexToLabel(2);
    const endCol = colIndexToLabel(2 + 3 * N - 1);
    const prevRemCol = colIndexToLabel(9);
    overallTotalRow[2] = { f: `SUM(${startCol}16:${endCol}16)+${prevRemCol}3` };
    rows.push(overallTotalRow);

    const currentPaidRow = Array(2 + 3 * N).fill("");
    currentPaidRow[0] = "المسدد الحالي (Current Paid)";
    currentPaidRow[2] = sheet.currentPaid;
    rows.push(currentPaidRow);

    const remainingRow = Array(2 + 3 * N).fill("");
    remainingRow[0] = "الصافي المتبقي للعمل (Remaining)";
    remainingRow[2] = { f: `C18-C19` };
    rows.push(remainingRow);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 2 + 3 * N - 1 } },
      { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },
      { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } },
      { s: { r: 4, c: 2 }, e: { r: 4, c: 2 + N - 1 } },
      { s: { r: 4, c: 2 + N }, e: { r: 4, c: 2 + 2 * N - 1 } },
      { s: { r: 4, c: 2 + 2 * N }, e: { r: 4, c: 2 + 3 * N - 1 } },
      { s: { r: 14, c: 0 }, e: { r: 14, c: 1 } },
      { s: { r: 15, c: 0 }, e: { r: 15, c: 1 } },
      { s: { r: 16, c: 0 }, e: { r: 16, c: 1 } },
      { s: { r: 18, c: 0 }, e: { r: 18, c: 1 } },
      { s: { r: 19, c: 0 }, e: { r: 19, c: 1 } },
      { s: { r: 20, c: 0 }, e: { r: 20, c: 1 } },
    ];
    ws['!merges'] = merges;
    ws['!views'] = [{ RTL: true }];

    // Apply exact visual formatting with blue dashed borders matching image_282f9b.png
    const borderDashedBlue = {
      top: { style: "dashed", color: { rgb: "4F81BD" } },
      bottom: { style: "dashed", color: { rgb: "4F81BD" } },
      left: { style: "dashed", color: { rgb: "4F81BD" } },
      right: { style: "dashed", color: { rgb: "4F81BD" } }
    };
    const fillHeader = { fgColor: { rgb: "D9E1F2" } }; // Soft blue header
    const fontHeader = { name: "Arial", sz: 10, bold: true, color: { rgb: "1F4E78" } };

    ws['A1'].s = {
      font: { name: "Arial", sz: 14, bold: true, color: { rgb: "1F4E78" } },
      fill: { fgColor: { rgb: "F2F6FA" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: borderDashedBlue
    };

    for (let c = 0; c < 10; c++) {
      const cellRef = `${colIndexToLabel(c)}3`;
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { bold: true, sz: 10 },
          fill: { fgColor: { rgb: "F5F5F5" } },
          border: borderDashedBlue
        };
      }
    }

    for (let c = 0; c < 2 + 3 * N; c++) {
      const colLetter = colIndexToLabel(c);
      ['5', '6'].forEach(row => {
        const cellRef = `${colLetter}${row}`;
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: fontHeader,
            fill: fillHeader,
            alignment: { horizontal: "center", vertical: "center" },
            border: borderDashedBlue
          };
        }
      });
    }

    for (let r = 7; r <= 13; r++) {
      for (let c = 0; c < 2 + 3 * N; c++) {
        const cellRef = `${colIndexToLabel(c)}${r}`;
        if (ws[cellRef]) {
          ws[cellRef].s = {
            border: borderDashedBlue,
            font: { name: "Arial", sz: 10 },
            alignment: { horizontal: "center", vertical: "center" }
          };
        }
      }
    }

    ['14', '15', '16'].forEach(row => {
      for (let c = 0; c < 2 + 3 * N; c++) {
        const cellRef = `${colIndexToLabel(c)}${row}`;
        if (ws[cellRef]) {
          ws[cellRef].s = {
            border: borderDashedBlue,
            font: { name: "Arial", sz: 10, bold: true },
            fill: { fgColor: { rgb: "F2F2F2" } },
            alignment: { horizontal: "center" }
          };
        }
      }
    });

    ['18', '19', '20'].forEach(row => {
      for (let c = 0; c < 4; c++) {
        const cellRef = `${colIndexToLabel(c)}${row}`;
        if (ws[cellRef]) {
          ws[cellRef].s = {
            border: borderDashedBlue,
            font: { name: "Arial", sz: 10, bold: true },
            fill: { fgColor: { rgb: "E2EFDA" } }, // Soft green
            alignment: { horizontal: "center" }
          };
        }
      }
    });

    // Set auto-width
    const colsWidth = [{ wch: 15 }, { wch: 14 }];
    for (let i = 0; i < 3 * N; i++) {
      colsWidth.push({ wch: 12 });
    }
    ws['!cols'] = colsWidth;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Labor Timesheet");
    return wb;
  };

  const handleExportFileClick = () => {
    if (!selectedSheet || !computedSums) return;
    const wb = handleExportExcelDynamic(selectedSheet, computedSums);
    XLSX.writeFile(wb, `Labor_Report_${selectedSheet.workerName}.xlsx`);
  };

  // Approve & Archive current weekly sheet to database archives list
  const handleApproveAndArchive = () => {
    if (!selectedSheet || !computedSums) return;

    if (!window.confirm(`هل أنت متأكد من ترحيل واعتماد هذا الكشف للعمل؟ سيتم إغلاقه وتوليد كشف إكسل رسمي وحفظه تلقائياً بالأرشيف الخاص بالعامل: (${selectedSheet.workerName}).`)) {
      return;
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const weekNum = 27; // Custom Week ID
    const fileName = `Labor_Report_${selectedSheet.workerName}_Week_${weekNum}_${selectedSheet.startDate}.xlsx`;

    try {
      const wb = handleExportExcelDynamic(selectedSheet, computedSums);
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });

      const newArchive = {
        id: `archive-${Date.now()}`,
        name: fileName,
        type: 'labor',
        ownerName: selectedSheet.workerName,
        date: dateStr,
        weekNumber: weekNum,
        size: `${Math.round((wbout.length * 0.75) / 1024)} KB`,
        url: wbout
      };

      const updatedArchives = [newArchive, ...archives];
      if (onUpdateArchives) {
        onUpdateArchives(updatedArchives);
        alert(`تم اعتماد وأرشفة الكشف تلقائياً بنجاح في مجلد العمالة الخاص بـ (${selectedSheet.workerName}) 🚀`);
      }
    } catch (e: any) {
      alert(`حدث خطأ أثناء التوليد والأرشفة: ${e.message}`);
    }
  };

  // Helper to trigger download from Base64 string saved in the database
  const handleDownloadArchiveFile = (file: any) => {
    if (!file.url) return;
    try {
      const byteCharacters = atob(file.url);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (e: any) {
      alert(`فشل تحميل الملف: ${e.message}`);
    }
  };

  // Helper to handle manual custom uploads (images, PDFs, spreadsheets) inside supervisor folders
  const handleManualArchiveUpload = (e: React.ChangeEvent<HTMLInputElement>, folderName: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Content = result.split(',')[1];
      const dateStr = new Date().toISOString().split('T')[0];

      const newArchive = {
        id: `archive-manual-${Date.now()}`,
        name: file.name,
        type: 'labor',
        ownerName: folderName,
        date: dateStr,
        size: `${Math.round(file.size / 1024)} KB`,
        url: base64Content
      };

      const updated = [newArchive, ...archives];
      if (onUpdateArchives) {
        onUpdateArchives(updated);
        alert(`تم رفع المستند وحفظه بنجاح داخل مجلد العمالة: ${folderName}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteArchiveFile = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الملف المؤرشف نهائياً؟')) {
      const updated = archives.filter(item => item.id !== id);
      if (onUpdateArchives) {
        onUpdateArchives(updated);
      }
    }
  };

  // Dynamic system project suggestions
  const dynamicProjects = useMemo(() => {
    return projectsList;
  }, [projectsList]);

  // Group labor archives into virtual folder directories
  const laborFolders = useMemo(() => {
    const laborDocs = archives.filter(f => f.type === 'labor');
    const foldersMap: { [supervisor: string]: any[] } = {};
    
    // Auto populate folders based on workerNames in system to avoid empty dirs
    timesheets.forEach(ts => {
      if (!foldersMap[ts.workerName]) {
        foldersMap[ts.workerName] = [];
      }
    });

    laborDocs.forEach(doc => {
      const owner = doc.ownerName || 'عام';
      if (!foldersMap[owner]) foldersMap[owner] = [];
      foldersMap[owner].push(doc);
    });

    return Object.entries(foldersMap).map(([name, files]) => ({
      name,
      files
    }));
  }, [archives, timesheets]);

  return (
    <div className="space-y-6">
      {/* Scoped style block to force landscape print and solid professional borders */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: landscape !important;
            margin: ${printFixPageBreak ? '4mm 6mm 4mm 6mm' : '8mm 10mm 8mm 10mm'} !important;
          }

          /* Explicit DOM clearance: hide all interactive controls, sidebars, page headers, etc. */
          header, nav, footer, aside, .no-print, .print\:hidden, [class*="print:hidden"],
          button, select, input, textarea, .bg-[#111827], .sidebar, .navbar,
          .space-y-6 > div:not(.landscape-print) {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Ensure layout parents start printing cleanly at the top of page 1 without pushdown */
          html, body, #root, .main-container, main {
            margin: 0 !important;
            padding: 0 !important;
            margin-top: 0 !important;
            padding-top: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            display: block !important;
            float: none !important;
            position: static !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Arial', sans-serif !important;
          }

          .landscape-print, .landscape-print-outer-container {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-before: avoid !important;
            break-before: avoid !important;
            background: #ffffff !important;
            color: #000000 !important;
          }

          .landscape-print * {
            visibility: visible !important;
          }

          /* Standardize text and numbers rendering and alignments inside tables */
          .landscape-print table.landscape-print-attendance-table {
            border-collapse: collapse !important;
            width: 100% !important;
            margin-top: 5px !important;
            margin-bottom: 5px !important;
          }

          .landscape-print table.no-print-border {
            border: none !important;
            border-style: none !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            width: 100% !important;
          }

          .landscape-print table.no-print-border tr,
          .landscape-print table.no-print-border td {
            border: none !important;
            border-style: none !important;
            background: transparent !important;
            background-color: transparent !important;
          }

          .landscape-print .landscape-print-attendance-table th {
            text-align: center !important;
            vertical-align: middle !important;
            padding: 4px 6px !important; /* Compact padding to fit layout in single page */
            font-size: 11px !important; /* Enlarged by one step */
            font-weight: bold !important;
          }

          .landscape-print .landscape-print-attendance-table td {
            text-align: center !important;
            vertical-align: middle !important;
            padding: 4px 6px !important; /* Compact padding to fit layout in single page */
            font-size: 12px !important; /* Enlarged by one step to be super clear */
            font-weight: 600 !important;
          }

          /* Custom Sticky Notes / Accounting Squares for printing */
          .print-sticky-note {
            width: 250px !important;
            max-width: 250px !important;
            min-width: 250px !important;
            display: inline-block !important;
            background-color: #ffffff !important;
            border: 2.2px solid #000000 !important;
            border-radius: 0px !important;
            padding: 0px !important;
            box-sizing: border-box !important;
          }

          .print-sticky-note table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 0 !important;
            border: none !important;
          }

          .print-sticky-note tr {
            background-color: #ffffff !important;
            border: none !important;
          }

          .print-sticky-note td {
            padding: 5px 10px !important; /* Spacious, professional padding */
            background: #ffffff !important;
            border: 1.5px solid #000000 !important;
            vertical-align: middle !important;
            font-size: 11.5px !important;
            line-height: 1.2 !important;
          }

          .print-sticky-note td.label {
            text-align: right !important; /* Aligned to the right */
            font-weight: bold !important;
            color: #000000 !important;
            background-color: #f2f2f2 !important; /* Soft gray for accountant look */
            white-space: nowrap !important; /* Do not wrap text */
          }

          .print-sticky-note td.value {
            text-align: left !important; /* Aligned to the left */
            font-weight: 900 !important;
            font-family: monospace !important;
            color: #000000 !important;
            white-space: nowrap !important; /* Let column grow dynamically with number length */
          }

          .print-sticky-note td.value-rose {
            text-align: left !important; /* Aligned to the left */
            font-weight: 900 !important;
            font-family: monospace !important;
            color: #be123c !important;
            white-space: nowrap !important;
          }

          .print-sticky-note td.value-emerald {
            text-align: left !important; /* Aligned to the left */
            font-weight: 900 !important;
            font-family: monospace !important;
            color: #047857 !important;
            white-space: nowrap !important;
          }

          .landscape-print .overflow-visible {
            margin-bottom: 5px !important;
          }

          .landscape-print-summary-card {
            margin-top: 5px !important;
          }

          /* Style the dynamic border styles option selected in UI */
          ${printBorderThickness === 'sharp' ? `
            .landscape-print-outer-container {
              border: 2.5px solid #000000 !important;
              padding: 10px !important;
              background-color: #ffffff !important;
            }
            .landscape-print-summary-card {
              border: 2px solid #000000 !important;
              padding: 6px 10px !important;
            }
            .landscape-print .landscape-print-attendance-table, 
            .landscape-print .landscape-print-attendance-table th, 
            .landscape-print .landscape-print-attendance-table td {
              border: 1.5px solid #000000 !important;
              border-color: #000000 !important;
              border-style: solid !important;
              color: #000000 !important;
            }
            /* Neutral print backgrounds */
            .landscape-print thead tr {
              background-color: #f2f2f2 !important;
            }
            .landscape-print .landscape-print-attendance-table tr, 
            .landscape-print .landscape-print-attendance-table td {
              background-color: #ffffff !important;
            }
          ` : `
            .landscape-print-outer-container {
              border: 3px solid #4F81BD !important;
              padding: 10px !important;
              background-color: #ffffff !important;
            }
            .landscape-print-summary-card {
              border: 2px solid #4F81BD !important;
              padding: 6px 10px !important;
            }
            .landscape-print .landscape-print-attendance-table, 
            .landscape-print .landscape-print-attendance-table th, 
            .landscape-print .landscape-print-attendance-table td {
              border: 1px solid #4F81BD !important;
              border-style: solid !important;
            }
            .landscape-print .landscape-print-attendance-table th {
              background-color: #D9E1F2 !important;
            }
          `}

          /* Enforce black text color on all elements unconditionally during printing and screen reports */
          .landscape-print, 
          .landscape-print *, 
          .landscape-print h2, 
          .landscape-print h1, 
          .landscape-print span, 
          .landscape-print div, 
          .landscape-print td, 
          .landscape-print th, 
          .landscape-print table {
            color: #000000 !important;
          }

          /* Enforce solid black grid lines on all tables and cells unconditionally with extremely high specificity */
          body .landscape-print table.landscape-print-attendance-table, 
          body .landscape-print table.landscape-print-attendance-table tr, 
          body .landscape-print table.landscape-print-attendance-table th, 
          body .landscape-print table.landscape-print-attendance-table td,
          body .landscape-print .print-sticky-note, 
          body .landscape-print .print-sticky-note table, 
          body .landscape-print .print-sticky-note tr, 
          body .landscape-print .print-sticky-note th, 
          body .landscape-print .print-sticky-note td,
          body .print-sticky-note, 
          body .print-sticky-note table, 
          body .print-sticky-note tr, 
          body .print-sticky-note th, 
          body .print-sticky-note td {
            border: 1.5px solid #000000 !important;
            border-style: solid !important;
            border-color: #000000 !important;
            border-collapse: collapse !important;
          }

          /* Re-apply non-print-border exception so layout helper tables stay borderless */
          table.no-print-border, table.no-print-border tr, table.no-print-border td {
            border: none !important;
            border-style: none !important;
          }

          /* Complete and robust centering and balance CSS for Labor Report Header */
          @media print, screen {
            .labor-report-header {
              display: grid !important;
              grid-template-columns: 250px 1fr 250px !important; /* 3-part layout to guarantee perfect alignment */
              align-items: start !important;
              width: 100% !important;
              margin-bottom: 25px !important;
              color: #000000 !important;
              border-bottom: 2.5px solid #000000 !important;
              padding-bottom: 12px !important;
            }

            .header-center-titles {
              text-align: center !important;
              display: flex !important;
              flex-direction: column !important;
              gap: 8px !important;
              justify-content: center !important;
              align-items: center !important;
            }

            .header-center-titles h1, 
            .header-center-titles h2, 
            .header-center-titles p, 
            .header-center-titles span {
              color: #000000 !important;
              font-weight: bold !important;
              margin: 0 !important;
              text-align: center !important;
            }

            /* Anchor the Previous Balances Card on the left (at end of grid in RTL) */
            .header-left-balances {
              justify-self: end !important;
              width: 250px !important;
              background: #ffffff !important;
              border: 1.5px solid #000000 !important;
              border-radius: 4px !important;
              padding: 0px !important;
              box-sizing: border-box !important;
            }
          }
        }
      `}} />

      <div className="space-y-6 print:hidden">
        {/* Navigation Department Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('entry')}
          className={`px-5 py-3 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'entry'
              ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
          } rounded-t-xl`}
        >
          <Clock className="w-4 h-4" />
          <span>يوميات وتسجيل حضور العمالة اليومية 📝</span>
        </button>
        <button
          onClick={() => setActiveTab('archive')}
          className={`px-5 py-3 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'archive'
              ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5'
              : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
          } rounded-t-xl`}
        >
          <FolderOpen className="w-4 h-4" />
          <span>أرشيف مجلدات العمالة والمستندات 📁</span>
        </button>
      </div>

      {activeTab === 'entry' && (
        <>
          {/* Selector & Setup Header */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <Clock className="text-indigo-400 w-5 h-5" />
              <span className="text-sm font-bold text-slate-300">اختر كشف حضور العامل:</span>
              <select
                value={selectedSheetId}
                onChange={(e) => setSelectedSheetId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500 transition-all cursor-pointer min-w-[200px]"
              >
                <option value="">-- اختر كشف العمالة --</option>
                {timesheets.map((ts) => (
                  <option key={ts.id} value={ts.id}>
                    {ts.workerName} ({ts.startDate} إلى {ts.endDate})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-400 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء كشف حضور جديد 📅</span>
              </button>
            </div>

            {selectedSheet && (
              <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleApproveAndArchive}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md"
                  title="اعتماد كشف العمالة وإرساله للأرشيف الأسبوعي"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>اعتماد الكشف وأرشفته 🔒</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportFileClick}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md no-print"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير كشف الحضور كـ Excel 📥</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md no-print"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة الكشف 🖨️</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeleteTimesheet}
                  disabled={isDeleting}
                  className={`border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="حذف الكشف بالكامل"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Create New Timesheet Form */}
          {showCreateForm && (
            <form onSubmit={handleCreateTimesheet} className="bg-[#111827] border border-indigo-500/20 rounded-2xl p-6 shadow-md grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="md:col-span-4 border-b border-slate-800 pb-2 mb-1 flex justify-between items-center">
                <h4 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider">إنشاء كشف حضور أسبوعي جديد للعامل</h4>
                <span className="text-[10px] text-slate-400">فئة اليوميات قابلة للتعديل والضبط</span>
              </div>

              <div className="md:col-span-4 bg-slate-900/40 border border-indigo-500/10 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 mb-2">
                <div className="text-right">
                  <span className="text-xs font-bold text-indigo-400 block mb-0.5">🚀 هل تريد ملء البيانات تلقائياً بالذكاء الاصطناعي؟</span>
                  <p className="text-[10px] text-slate-400">ارفع كشف الحضور اليدوي أو كشف العمالة الورقي وسيقوم Gemini OCR بقراءته وتعبئة الحقول فوراً.</p>
                </div>
                <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0">
                  <Upload className="w-4 h-4" />
                  <span>{isProcessingAI ? 'جاري معالجة الكشف... ⏳' : 'رفع وتحليل بالذكاء الاصطناعي 🤖'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleLaborOCR}
                    disabled={isProcessingAI}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">اسم العامل اليومي *</label>
                <input
                  type="text"
                  placeholder="مثال: شاهر"
                  value={newWorker}
                  onChange={(e) => setNewWorker(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">تاريخ بداية الأسبوع *</label>
                <input
                  type="date"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">تاريخ نهاية الأسبوع *</label>
                <input
                  type="date"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">الفئة اليومية الأساسية (EGP)</label>
                <input
                  type="number"
                  value={newDailyRate}
                  onChange={(e) => setNewDailyRate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">فئة يوم العمل الإضافي (EGP)</label>
                <input
                  type="number"
                  value={newOvertimeRate}
                  onChange={(e) => setNewOvertimeRate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">فئة ساعة السهرة الإضافية (EGP)</label>
                <input
                  type="number"
                  value={newSohraRate}
                  onChange={(e) => setNewSohraRate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">إجمالي الحساب السابق (EGP)</label>
                <input
                  type="number"
                  value={newPrevTotal}
                  onChange={(e) => setNewPrevTotal(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">المسدد السابق (EGP)</label>
                <input
                  type="number"
                  value={newPrevPaid}
                  onChange={(e) => setNewPrevPaid(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="md:col-span-4 flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  حفظ وتوليد الكشف الجديد
                </button>
              </div>
            </form>
          )}

          {selectedSheet && computedSums && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Sidebar controls: Pricing & Project management */}
              <div className="space-y-6">
                
                {/* Financial Rates adjustment card */}
                <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4">
                  <h4 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800/60 pb-2">
                    <DollarSign className="w-4 h-4" />
                    <span>ضبط فئات الحساب وأجور هذا الكشف</span>
                  </h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">اسم العامل اليومي:</label>
                      <input
                        type="text"
                        value={selectedSheet.workerName}
                        onChange={(e) => handleMetaFieldChange('workerName', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">فئة اليومية الأساسية:</label>
                        <input
                          type="number"
                          value={selectedSheet.dailyRate}
                          onChange={(e) => handleMetaFieldChange('dailyRate', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">فئة الإضافي (يوم):</label>
                        <input
                          type="number"
                          value={selectedSheet.overtimeRate}
                          onChange={(e) => handleMetaFieldChange('overtimeRate', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">فئة السهرة الإضافية (ساعة):</label>
                        <input
                          type="number"
                          value={selectedSheet.sohraRate}
                          onChange={(e) => handleMetaFieldChange('sohraRate', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Unlimited Projects Management System */}
                <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4">
                  <h4 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800/60 pb-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>إدارة مشاريع الكشف (مفتوح وديناميكي)</span>
                  </h4>

                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      يمكنك ربط وإضافة أي عدد من مشاريع الموقع في هذا الكشف. سيتم توسيع الجدول والملف المصدّر تلقائياً وبشكل فوري:
                    </p>

                    <div className="flex gap-2">
                      <select
                        value={selectedProjectToAdd}
                        onChange={(e) => setSelectedProjectToAdd(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-2.5 py-2 text-xs outline-none focus:border-indigo-500 cursor-pointer font-bold"
                      >
                        <option value="">-- اختر مشروعاً للإضافة --</option>
                        {dynamicProjects.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAddProjectToSheet(selectedProjectToAdd)}
                        disabled={!selectedProjectToAdd}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة</span>
                      </button>
                    </div>

                    <div className="space-y-1.5 pt-2">
                      <span className="text-[10px] text-slate-400 font-bold block">المشاريع النشطة حالياً في كشف الأسبوع:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {computedSums.projects.map(proj => (
                          <div 
                            key={proj} 
                            className="bg-indigo-950/40 text-indigo-300 border border-indigo-900/60 px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1.5"
                          >
                            <span>{proj}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveProjectFromSheet(proj)}
                              className="text-indigo-400 hover:text-rose-400 transition-colors"
                              title="إزالة المشروع من الكشف"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Statement Ledger Accounts balance summary */}
                <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4">
                  <h4 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800/60 pb-2">
                    <span>كشف الأرصدة التراكمية والتصفية</span>
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">الإجمالي التراكمي السابق:</label>
                        <input
                          type="number"
                          value={selectedSheet.previousTotal}
                          onChange={(e) => handleMetaFieldChange('previousTotal', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">المسدد التراكمي السابق:</label>
                        <input
                          type="number"
                          value={selectedSheet.previousPaid}
                          onChange={(e) => handleMetaFieldChange('previousPaid', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-bold font-mono outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-800/60 pt-3 space-y-3">
                      <span className="text-xs font-extrabold text-indigo-400 block mb-1">مطابقة الحسابات المالية التراكمية</span>
                      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[10px] font-bold">
                              <th className="p-2.5 text-right">البيان المالي</th>
                              <th className="p-2.5 text-left">القيمة (EGP)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-850 hover:bg-slate-900/10">
                              <td className="p-2.5 text-slate-300 font-medium text-right">الرصيد المتبقي التراكمي السابق (المنقول)</td>
                              <td className="p-2.5 text-left font-mono font-bold text-rose-400">{formatCurrency(selectedSheet.previousRemaining)} EGP</td>
                            </tr>
                            <tr className="border-b border-slate-850 hover:bg-slate-900/10">
                              <td className="p-2.5 text-slate-300 font-medium text-right">إجمالي مستحقات الأسبوع الحالي</td>
                              <td className="p-2.5 text-left font-mono font-bold text-indigo-400">+{formatCurrency(computedSums.weeklyTotal)} EGP</td>
                            </tr>
                            <tr className="border-b border-slate-850 bg-slate-900/30">
                              <td className="p-2.5 text-indigo-300 font-bold text-right">المجموع التراكمي المستحق (الإجمالي الكلي)</td>
                              <td className="p-2.5 text-left font-mono font-extrabold text-amber-400">{formatCurrency(computedSums.overallTotal)} EGP</td>
                            </tr>
                            <tr className="border-b border-slate-850">
                              <td className="p-2.5 text-slate-300 font-medium text-right">
                                <label className="text-[10px] text-slate-400 font-bold block mb-1">المسدد الحالي (المبلغ المدفوع حالياً) *</label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={selectedSheet.currentPaid}
                                    onChange={(e) => handleMetaFieldChange('currentPaid', e.target.value)}
                                    className="w-28 bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 text-[10px] font-bold font-mono outline-none focus:border-indigo-500 text-left"
                                  />
                                </div>
                              </td>
                              <td className="p-2.5 text-left font-mono font-bold text-rose-500 align-middle">-{formatCurrency(selectedSheet.currentPaid)} EGP</td>
                            </tr>
                            <tr className="bg-[#10b981]/15 text-emerald-400">
                              <td className="p-2.5 font-extrabold text-right">الرصيد المتبقي الكلي الجديد (الصافي)</td>
                              <td className="p-2.5 text-left font-mono font-black text-sm">{formatCurrency(computedSums.remainingBalance)} EGP</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Dynamic formula matching user request */}
                      <div className="bg-indigo-950/20 border border-indigo-900/50 rounded-xl p-3 text-center text-xs text-indigo-300 font-bold space-y-1.5 mt-3" dir="rtl">
                        <div className="font-extrabold text-slate-200">📊 معادلة مطابقة الرصيد التراكمي للعمالة:</div>
                        <div className="flex flex-wrap items-center justify-center gap-1 font-mono font-bold text-[10.5px] text-slate-100">
                          <span>({formatCurrency(selectedSheet.previousRemaining)})</span>
                          <span className="text-indigo-400 font-bold">+</span>
                          <span>({formatCurrency(computedSums.weeklyTotal)})</span>
                          <span className="text-indigo-400 font-bold">=</span>
                          <span className="text-amber-400">({formatCurrency(computedSums.overallTotal)})</span>
                          <span className="text-indigo-400 font-bold">-</span>
                          <span className="text-rose-500">({formatCurrency(selectedSheet.currentPaid)})</span>
                          <span className="text-indigo-400 font-bold">=</span>
                          <span className="text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded text-xs font-black">({formatCurrency(computedSums.remainingBalance)})</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium leading-normal">(الرصيد السابق) + (إجمالي الأسبوع الحالي) = (المجموع التراكمي) - (المسدد الحالي) = (الرصيد المتبقي)</div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Print Customizer Options Panel */}
                <div className="bg-[#111827] border border-blue-500/30 p-6 rounded-2xl shadow-md space-y-4 no-print">
                  <h4 className="text-xs font-extrabold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-800/60 pb-2">
                    <Printer className="w-4 h-4 text-blue-400" />
                    <span>أداة التحكم الذكية في الطباعة 🖨️</span>
                  </h4>
                  
                  <div className="space-y-4 text-right">
                    {/* Border Style Selector */}
                    <div>
                      <label className="text-xs text-slate-300 font-bold block mb-2">شكل وسمك حدود الجدول (Border Style):</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPrintBorderThickness('light')}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            printBorderThickness === 'light'
                              ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          خطوط خفيفة 🔹
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintBorderThickness('sharp')}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            printBorderThickness === 'sharp'
                              ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          حدود مالية حادة وصريحة ⬛
                        </button>
                      </div>
                    </div>

                    {/* Fix Page Break Switch */}
                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <div className="text-right">
                        <label className="text-xs text-slate-300 font-bold block">إصلاح ترحيل الصفحات ديناميكياً</label>
                        <p className="text-[10px] text-slate-400 leading-normal mt-0.5">يلغي الهوامش والفراغات التي تدفع الكشف لصفحة جديدة فارغة.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPrintFixPageBreak(!printFixPageBreak)}
                        className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer ${
                          printFixPageBreak ? 'bg-blue-500' : 'bg-slate-800'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                            printFixPageBreak ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="bg-blue-950/20 border border-blue-900/40 rounded-xl p-3 text-[10px] text-blue-300 leading-relaxed">
                      💡 <strong>نصيحة الطباعة:</strong> يُفضّل تفعيل "إصلاح ترحيل الصفحات" واستخدام خيار "حدود مالية حادة وصريحة" لضمان خروج الكشف كصفحة واحدة منسقة بخطوط داكنة تظهر بوضوح فائق عند طباعتها على الورق أو تصديرها كـ PDF.
                    </div>
                  </div>
                </div>

              </div>

              {/* Attendance Matrix Table Grid Container */}
              <div className="lg:col-span-2 space-y-6">
                
                <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md space-y-4">
                  <div className="border-b border-slate-850 pb-3 flex justify-between items-center flex-wrap gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users className="text-indigo-400 w-4 h-4" />
                      <span>جدول تسجيل حضور وساعات العمالة اليومية بالتفصيل</span>
                    </h3>
                    <span className="text-xs text-slate-400">
                      الفتره: من {selectedSheet.startDate} إلى {selectedSheet.endDate}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse text-xs select-none">
                      <thead>
                        {/* Nested Header Row 1 */}
                        <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-900/40">
                          <th className="py-3 px-2 text-right border-l border-slate-800" rowSpan={2}>اليوم</th>
                          <th className="py-3 px-2 text-right border-l border-slate-800" rowSpan={2}>التاريخ</th>
                          <th colSpan={computedSums.projects.length} className="py-2 text-center border-l border-slate-800 bg-indigo-500/5 text-indigo-400">مشروع - يومية (حضور)</th>
                          <th colSpan={computedSums.projects.length} className="py-2 text-center border-l border-slate-800 bg-emerald-500/5 text-emerald-400">إضافي (يوم)</th>
                          <th colSpan={computedSums.projects.length} className="py-2 text-center bg-rose-500/5 text-rose-400">سهرات بالساعة (ساعة)</th>
                        </tr>
                        {/* Nested Header Row 2 (Project columns) */}
                        <tr className="border-b border-slate-800 text-slate-500 font-extrabold text-[10px]">
                          {/* Daily */}
                          {computedSums.projects.map((proj, idx) => (
                            <th 
                              key={`head-daily-${proj}`} 
                              className={`py-2 px-1 bg-indigo-500/5 text-indigo-300 ${idx === computedSums.projects.length - 1 ? 'border-l border-slate-800' : ''}`}
                            >
                              {proj}
                            </th>
                          ))}
                          {/* Overtime */}
                          {computedSums.projects.map((proj, idx) => (
                            <th 
                              key={`head-ot-${proj}`} 
                              className={`py-2 px-1 bg-emerald-500/5 text-emerald-300 ${idx === computedSums.projects.length - 1 ? 'border-l border-slate-800' : ''}`}
                            >
                              {proj}
                            </th>
                          ))}
                          {/* Sohra */}
                          {computedSums.projects.map((proj) => (
                            <th 
                              key={`head-sohra-${proj}`} 
                              className="py-2 px-1 bg-rose-500/5 text-rose-300"
                            >
                              {proj}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSheet.days.map((day, dIdx) => {
                          const valMap = getNormalizedDayValues(day, computedSums.projects, selectedSheet);
                          return (
                            <tr key={day.date + '-' + dIdx} className="border-b border-slate-850 text-slate-300 hover:bg-slate-900/20 transition-all font-medium">
                              <td className="py-3 px-2 text-right border-l border-slate-800 font-bold text-white">{day.dayName}</td>
                              <td className="py-3 px-2 text-right border-l border-slate-800 font-mono text-slate-400 text-[10px]">{day.date}</td>
                              
                              {/* Daily Inputs */}
                              {computedSums.projects.map((proj, idx) => (
                                <td key={`input-daily-${proj}`} className={`p-1 bg-indigo-500/5 ${idx === computedSums.projects.length - 1 ? 'border-l border-slate-800' : ''}`}>
                                  <input
                                    type="number" step="any" 
                                    value={valMap[proj]?.daily || ''} 
                                    placeholder="0"
                                    onChange={(e) => handleCellChange(dIdx, proj, 'daily', e.target.value)}
                                    className="w-12 bg-slate-950 border border-slate-800 hover:border-slate-700 text-white text-center py-1 rounded outline-none text-xs font-bold font-mono"
                                  />
                                </td>
                              ))}

                              {/* Overtime Inputs */}
                              {computedSums.projects.map((proj, idx) => (
                                <td key={`input-ot-${proj}`} className={`p-1 bg-emerald-500/5 ${idx === computedSums.projects.length - 1 ? 'border-l border-slate-800' : ''}`}>
                                  <input
                                    type="number" step="any" 
                                    value={valMap[proj]?.overtime || ''} 
                                    placeholder="0"
                                    onChange={(e) => handleCellChange(dIdx, proj, 'overtime', e.target.value)}
                                    className="w-12 bg-slate-950 border border-slate-800 hover:border-slate-700 text-white text-center py-1 rounded outline-none text-xs font-bold font-mono"
                                  />
                                </td>
                              ))}

                              {/* Sohra Inputs */}
                              {computedSums.projects.map((proj) => (
                                <td key={`input-sohra-${proj}`} className="p-1 bg-rose-500/5">
                                  <input
                                    type="number" step="any" 
                                    value={valMap[proj]?.sohra || ''} 
                                    placeholder="0"
                                    onChange={(e) => handleCellChange(dIdx, proj, 'sohra', e.target.value)}
                                    className="w-12 bg-slate-950 border border-slate-800 hover:border-slate-700 text-white text-center py-1 rounded outline-none text-xs font-bold font-mono"
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}

                        {/* Sums Row */}
                        <tr className="border-t border-slate-800 bg-slate-900/50 font-black text-slate-300">
                          <td colSpan={2} className="py-3 px-2 text-right border-l border-slate-800">إجمالي كميات الحضور والعمل:</td>
                          {computedSums.projects.map((proj, idx) => (
                            <td key={`sum-daily-${proj}`} className={`py-3 font-mono text-center text-indigo-400 bg-indigo-500/5 ${idx === computedSums.projects.length - 1 ? 'border-l border-slate-800' : ''}`}>
                              {computedSums.projectSums[proj]?.sumDaily || 0}
                            </td>
                          ))}
                          {computedSums.projects.map((proj, idx) => (
                            <td key={`sum-ot-${proj}`} className={`py-3 font-mono text-center text-emerald-400 bg-emerald-500/5 ${idx === computedSums.projects.length - 1 ? 'border-l border-slate-800' : ''}`}>
                              {computedSums.projectSums[proj]?.sumOvertime || 0}
                            </td>
                          ))}
                          {computedSums.projects.map((proj) => (
                            <td key={`sum-sohra-${proj}`} className="py-3 font-mono text-center text-rose-400 bg-rose-500/5">
                              {computedSums.projectSums[proj]?.sumSohra || 0}
                            </td>
                          ))}
                        </tr>

                        {/* Rates Row */}
                        <tr className="border-t border-slate-800/60 bg-slate-900/30 text-slate-400 font-bold">
                          <td colSpan={2} className="py-2.5 px-2 text-right border-l border-slate-800">الفئة واليومية المتفق عليها:</td>
                          {computedSums.projects.map((proj, idx) => (
                            <td key={`rate-daily-${proj}`} className={`py-2.5 font-mono text-center text-indigo-300 ${idx === computedSums.projects.length - 1 ? 'border-l border-slate-800' : ''}`}>
                              {selectedSheet.dailyRate}
                            </td>
                          ))}
                          {computedSums.projects.map((proj, idx) => (
                            <td key={`rate-ot-${proj}`} className={`py-2.5 font-mono text-center text-emerald-300 ${idx === computedSums.projects.length - 1 ? 'border-l border-slate-800' : ''}`}>
                              {selectedSheet.overtimeRate}
                            </td>
                          ))}
                          {computedSums.projects.map((proj) => (
                            <td key={`rate-sohra-${proj}`} className="py-2.5 font-mono text-center text-rose-300">
                              {selectedSheet.sohraRate}
                            </td>
                          ))}
                        </tr>

                        {/* Sub-totals Row */}
                        <tr className="border-t-2 border-indigo-500 bg-indigo-950/20 text-white font-black">
                          <td colSpan={2} className="py-3 px-2 text-right border-l border-slate-800">اجمالي الحساب لكل مشروع:</td>
                          {computedSums.projects.map((proj, idx) => (
                            <td key={`total-daily-${proj}`} className={`py-3 font-mono text-center text-indigo-400 ${idx === computedSums.projects.length - 1 ? 'border-l border-slate-800' : ''}`}>
                              {computedSums.projectSums[proj]?.totalDailyVal.toLocaleString()}
                            </td>
                          ))}
                          {computedSums.projects.map((proj, idx) => (
                            <td key={`total-ot-${proj}`} className={`py-3 font-mono text-center text-emerald-400 ${idx === computedSums.projects.length - 1 ? 'border-l border-slate-800' : ''}`}>
                              {computedSums.projectSums[proj]?.totalOvertimeVal.toLocaleString()}
                            </td>
                          ))}
                          {computedSums.projects.map((proj) => (
                            <td key={`total-sohra-${proj}`} className="py-3 font-mono text-center text-rose-400">
                              {computedSums.projectSums[proj]?.totalSohraVal.toLocaleString()}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-850">
                    <span className="text-xs font-bold text-slate-400">إجمالي حساب العامل عن كافة المشاريع لهذا الأسبوع:</span>
                    <span className="text-lg font-black text-indigo-400 font-mono">
                      {computedSums.weeklyTotal.toLocaleString()} EGP
                    </span>
                  </div>

                </div>

              </div>

            </div>
          )}
        </>
      )}

      {activeTab === 'archive' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Folders Directories Tree */}
          <div className="bg-[#111827] border border-slate-800 p-5 rounded-2xl shadow-md space-y-4">
            <h3 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800/80">
              <Folder className="w-4 h-4 text-amber-500" />
              <span>مجلد العمالة الرئيسي (Labor Archive)</span>
            </h3>

            <div className="space-y-1.5">
              <button
                onClick={() => setSelectedFolder(null)}
                className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
                  selectedFolder === null
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <span>عرض الكل (All Folders)</span>
              </button>

              {laborFolders.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setSelectedFolder(f.name)}
                  className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                    selectedFolder === f.name
                      ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedFolder === f.name ? (
                      <FolderOpen className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span className="truncate">{f.name}</span>
                  </div>
                  <span className="bg-slate-800 text-slate-400 font-mono text-[9px] px-1.5 py-0.5 rounded-full">
                    {f.files.length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Files List and Upload Workspace */}
          <div className="lg:col-span-3 space-y-6">
            
            <div className="bg-[#111827] border border-slate-800 p-6 rounded-2xl shadow-md">
              <div className="border-b border-slate-850 pb-4 mb-4 flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FolderOpen className="text-indigo-400 w-4 h-4" />
                    <span>تصفح ملفات مجلد:</span>
                    <span className="text-indigo-400 font-black">{selectedFolder || 'الكل (All Folders)'}</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    كشوف الحسابات المعتمدة ودفاتر الحضور الأسبوعية المحفوظة بصيغة Excel
                  </p>
                </div>

                {/* Upload zone within supervisor folder */}
                {selectedFolder && (
                  <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md">
                    <Upload className="w-3.5 h-3.5" />
                    <span>رفع ملف يدوي للمجلد 📤</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleManualArchiveUpload(e, selectedFolder)}
                      accept="image/*,application/pdf,.pdf,.xlsx,.xls"
                    />
                  </label>
                )}
              </div>

              {/* Grid or List of Archived Files */}
              {laborFolders.length === 0 || (selectedFolder && laborFolders.find(f => f.name === selectedFolder)?.files.length === 0) ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <AlertCircle className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-bold">لا توجد ملفات مؤرشفة في هذا المجلد بعد</p>
                  <p className="text-[10px] text-slate-400">قم باعتماد كشف حضور العامل أو ارفع ملفاتك يدوياً ليتم حفظها هنا بشكل دائم</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {laborFolders
                    .filter(f => selectedFolder === null || f.name === selectedFolder)
                    .flatMap(f => f.files)
                    .map((file) => (
                      <div 
                        key={file.id} 
                        className="bg-[#0b0f19]/40 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-4 hover:border-slate-700 transition-all shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2.5 bg-emerald-950/40 text-emerald-400 rounded-lg shrink-0">
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-white block truncate" title={file.name}>
                              {file.name}
                            </span>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
                              <span>{file.date}</span>
                              <span>•</span>
                              <span>{file.size}</span>
                              {file.weekNumber && (
                                <>
                                  <span>•</span>
                                  <span className="text-indigo-400 font-bold">أسبوع {file.weekNumber}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDownloadArchiveFile(file)}
                            className="bg-indigo-600/10 hover:bg-indigo-600/25 text-indigo-400 p-2 rounded-lg transition-colors cursor-pointer"
                            title="تحميل الملف المؤرشف"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteArchiveFile(file.id)}
                            className="text-rose-500 hover:bg-rose-500/10 p-2 rounded-lg transition-colors cursor-pointer"
                            title="حذف الملف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

            </div>

          </div>

        </div>
      )}
      </div>
      {/* Landscape print-only layout matching image_282f9b.png */}
      {selectedSheet && computedSums && (
        <div className="hidden print:block w-full text-black font-sans landscape-print animate-in fade-in duration-300" dir="rtl" style={{ fontFamily: 'Arial' }}>
          <div className="landscape-print-outer-container space-y-4 bg-white">
            
            {/* Real Official Header Banner matching user layout with Grid Table Fixed Layout */}
            <div className="labor-report-header" dir="rtl">
              {/* Right Area (الطرف الأيمن): Empty space to maintain symmetric balance */}
              <div style={{ width: '250px' }}></div>

              {/* Center Area (المنتصف تماماً): Centered core texts on separate lines without overlap */}
              <div className="header-center-titles">
                <h2 className="text-[18px] font-black tracking-wide" style={{ whiteSpace: 'nowrap', textAlign: 'center', color: '#000000' }}>
                  بيان حضور العمالة اليومية وتفصيل الأجور
                </h2>
                
                <div className="flex flex-col gap-2 text-[12px] font-bold text-black items-center justify-center text-center" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <div className="flex items-center gap-2 justify-center" style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', justifyContent: 'center' }}>
                    <span style={{ color: '#000000' }}>العامل:</span>
                    <span className="font-black px-2.5 py-0.5 bg-slate-50 rounded border border-slate-200" style={{ color: '#000000' }}>
                      {selectedSheet.workerName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 justify-center" style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', justifyContent: 'center' }}>
                    <span style={{ color: '#000000' }}>الفترة الزمنية لشيت الحضور:</span>
                    <span className="font-mono bg-[#F2F6FA] px-2.5 py-0.5 rounded border border-slate-200" style={{ color: '#000000' }}>
                      من {selectedSheet.startDate} إلى {selectedSheet.endDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Left Area (الطرف الأيسر): Compact Sticky Note Previous Balances Card */}
              <div className="header-left-balances">
                <div className="text-[9px] font-black text-right mb-1" style={{ color: '#000000', padding: '3px 6px 0 0' }}>
                  📌 الرصيد السابق
                </div>
                <div className="print-sticky-note" style={{ width: '100%', maxWidth: '100%', minWidth: '100%', border: 'none' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
                    <tbody>
                      <tr>
                        <td className="label" style={{ color: '#000000', fontWeight: 'bold', width: '140px' }}>الإجمالي السابق</td>
                        <td className="value" style={{ color: '#000000', fontWeight: 'bold' }}>{selectedSheet.previousTotal.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="label" style={{ color: '#000000', fontWeight: 'bold', width: '140px' }}>المسدد السابق</td>
                        <td className="value" style={{ color: '#000000', fontWeight: 'bold' }}>{selectedSheet.previousPaid.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="label" style={{ color: '#000000', fontWeight: 'bold', width: '140px' }}>المتبقي السابق</td>
                        <td className="value-rose" style={{ color: '#000000', fontWeight: 'black' }}>{selectedSheet.previousRemaining.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Dynamic Columns Attendance Table with blue solid borders */}
            <div className="overflow-visible">
              <table className="landscape-print-attendance-table w-full text-center border-2 border-solid border-[#4F81BD] border-collapse text-[10px] font-sans">
                <thead>
                  {/* Nested Header Row 1 */}
                  <tr className="border-b-2 border-solid border-[#4F81BD] text-[#1F4E78] bg-[#D9E1F2] font-black">
                    <th className="py-2.5 px-1 border-e-2 border-solid border-[#4F81BD]" rowSpan={2}>اليوم</th>
                    <th className="py-2.5 px-1 border-e-2 border-solid border-[#4F81BD]" rowSpan={2}>التاريخ</th>
                    <th colSpan={computedSums.projects.length} className="py-1.5 text-center border-e-2 border-solid border-[#4F81BD] bg-[#F2F6FA]">مشروع - يومية (حضور)</th>
                    <th colSpan={computedSums.projects.length} className="py-1.5 text-center border-e-2 border-solid border-[#4F81BD] bg-[#E2EFDA]">إضافي (يوم)</th>
                    <th colSpan={computedSums.projects.length} className="py-1.5 text-center bg-[#FFF2CC]">سهرات بالساعة (ساعة)</th>
                  </tr>
                  {/* Nested Header Row 2 (Project names) */}
                  <tr className="border-b-2 border-solid border-[#4F81BD] text-slate-700 font-extrabold bg-[#F9FBFD]">
                    {/* Daily */}
                    {computedSums.projects.map((proj, idx) => (
                      <th key={`print-head-daily-${proj}`} className={`py-2 px-1 border-e-2 border-solid border-[#4F81BD] ${idx === computedSums.projects.length - 1 ? 'border-e-2 border-solid border-[#4F81BD]' : ''}`}>
                        {proj}
                      </th>
                    ))}
                    {/* Overtime */}
                    {computedSums.projects.map((proj, idx) => (
                      <th key={`print-head-ot-${proj}`} className={`py-2 px-1 border-e-2 border-solid border-[#4F81BD] ${idx === computedSums.projects.length - 1 ? 'border-e-2 border-solid border-[#4F81BD]' : ''}`}>
                        {proj}
                      </th>
                    ))}
                    {/* Sohra */}
                    {computedSums.projects.map((proj, idx) => (
                      <th key={`print-head-sohra-${proj}`} className={`py-2 px-1 ${idx === computedSums.projects.length - 1 ? '' : 'border-e-2 border-solid border-[#4F81BD]'}`}>
                        {proj}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedSheet.days.map((day, dIdx) => {
                    const valMap = getNormalizedDayValues(day, computedSums.projects, selectedSheet);
                    return (
                      <tr key={day.date + '-' + dIdx} className="border-b border-solid border-[#4F81BD] text-slate-800 font-bold bg-white">
                        <td className="py-2 px-1 border-e-2 border-solid border-[#4F81BD] bg-[#F5F7FA]">{day.dayName}</td>
                        <td className="py-2 px-1 border-e-2 border-solid border-[#4F81BD] font-mono text-[9px]">{day.date}</td>
                        
                        {/* Daily values */}
                        {computedSums.projects.map((proj, idx) => (
                          <td key={`print-val-daily-${proj}`} className={`py-2 px-1 border-e-2 border-solid border-[#4F81BD] ${valMap[proj]?.daily ? 'bg-[#F2F6FA]' : ''}`}>
                            {valMap[proj]?.daily || 0}
                          </td>
                        ))}
                        {/* Overtime values */}
                        {computedSums.projects.map((proj, idx) => (
                          <td key={`print-val-ot-${proj}`} className={`py-2 px-1 border-e-2 border-solid border-[#4F81BD] ${valMap[proj]?.overtime ? 'bg-[#E2EFDA]' : ''}`}>
                            {valMap[proj]?.overtime || 0}
                          </td>
                        ))}
                        {/* Sohra values */}
                        {computedSums.projects.map((proj, idx) => (
                          <td key={`print-val-sohra-${proj}`} className={`py-2 px-1 ${idx === computedSums.projects.length - 1 ? '' : 'border-e-2 border-solid border-[#4F81BD]'} ${valMap[proj]?.sohra ? 'bg-[#FFF2CC]' : ''}`}>
                            {valMap[proj]?.sohra || 0}
                          </td>
                        ))}
                      </tr>
                    );
                  })}

                  {/* Totals Row */}
                  <tr className="border-t-2 border-solid border-[#4F81BD] font-black bg-[#F2F2F2] text-[#1F4E78]">
                    <td className="py-2.5 px-1 border-e-2 border-solid border-[#4F81BD]" colSpan={2}>عدد الايام / الساعات</td>
                    
                    {computedSums.projects.map((p) => (
                      <td key={`print-sum-daily-${p}`} className="py-2.5 px-1 border-e-2 border-solid border-[#4F81BD]">
                        {computedSums.projectSums[p]?.sumDaily || 0}
                      </td>
                    ))}
                    {computedSums.projects.map((p) => (
                      <td key={`print-sum-ot-${p}`} className="py-2.5 px-1 border-e-2 border-solid border-[#4F81BD]">
                        {computedSums.projectSums[p]?.sumOvertime || 0}
                      </td>
                    ))}
                    {computedSums.projects.map((p, idx) => (
                      <td key={`print-sum-sohra-${p}`} className={`py-2.5 px-1 ${idx === computedSums.projects.length - 1 ? '' : 'border-e-2 border-solid border-[#4F81BD]'}`}>
                        {computedSums.projectSums[p]?.sumSohra || 0}
                      </td>
                    ))}
                  </tr>

                  {/* Rate Row */}
                  <tr className="border-t border-solid border-[#4F81BD] font-black bg-[#E9EEF4]">
                    <td className="py-2.5 px-1 border-e-2 border-solid border-[#4F81BD]" colSpan={2}>الفئة اليومية والاجر</td>
                    
                    {computedSums.projects.map((p) => (
                      <td key={`print-rate-daily-${p}`} className="py-2.5 px-1 border-e-2 border-solid border-[#4F81BD]">
                        {selectedSheet.dailyRate.toLocaleString()}
                      </td>
                    ))}
                    {computedSums.projects.map((p) => (
                      <td key={`print-rate-ot-${p}`} className="py-2.5 px-1 border-e-2 border-solid border-[#4F81BD]">
                        {selectedSheet.overtimeRate.toLocaleString()}
                      </td>
                    ))}
                    {computedSums.projects.map((p, idx) => (
                      <td key={`print-rate-sohra-${p}`} className={`py-2.5 px-1 ${idx === computedSums.projects.length - 1 ? '' : 'border-e-2 border-solid border-[#4F81BD]'}`}>
                        {selectedSheet.sohraRate.toLocaleString()}
                      </td>
                    ))}
                  </tr>

                  {/* Weekly Subtotal Row */}
                  <tr className="border-t-2 border-b-2 border-solid border-[#4F81BD] font-black bg-[#E2EFDA] text-[#375623]">
                    <td className="py-3 px-1 border-e-2 border-solid border-[#4F81BD]" colSpan={2}>اجمالي اسبوعي لكل مشروع</td>
                    
                    {computedSums.projects.map((p) => (
                      <td key={`print-tot-daily-${p}`} className="py-3 px-1 border-e-2 border-solid border-[#4F81BD]">
                        {(computedSums.projectSums[p]?.totalDailyVal || 0).toLocaleString()}
                      </td>
                    ))}
                    {computedSums.projects.map((p) => (
                      <td key={`print-tot-ot-${p}`} className="py-3 px-1 border-e-2 border-solid border-[#4F81BD]">
                        {(computedSums.projectSums[p]?.totalOvertimeVal || 0).toLocaleString()}
                      </td>
                    ))}
                    {computedSums.projects.map((p, idx) => (
                      <td key={`print-tot-sohra-${p}`} className={`py-3 px-1 ${idx === computedSums.projects.length - 1 ? '' : 'border-e-2 border-solid border-[#4F81BD]'}`}>
                        {(computedSums.projectSums[p]?.totalSohraVal || 0).toLocaleString()}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* New Clean Sticky-note Summary Card (Symmetrical, aligned to the right/اليمين) */}
            <div className="w-full mt-4 break-inside-avoid" dir="rtl" style={{ display: 'block', textAlign: 'right', width: '100%' }}>
              <div style={{ display: 'inline-block', width: '250px' }}>
                <div className="text-[9px] text-slate-500 font-black text-right mb-1">
                  📌 ملخص الرصيد الحالي والشيت
                </div>
                <div className="print-sticky-note" style={{ width: '250px', maxWidth: '250px', minWidth: '250px', border: '2.5px solid #000000' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none' }}>
                    <tbody>
                      <tr style={{ border: 'none' }}>
                        <td className="label" style={{ textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f2f2f2', width: '120px', color: '#000000', border: '1.5px solid #000000' }}>إجمالي أسبوعي</td>
                        <td className="value" style={{ textAlign: 'left', fontWeight: '900', color: '#000000', border: '1.5px solid #000000' }}>{computedSums.weeklyTotal.toLocaleString()}</td>
                      </tr>
                      <tr style={{ border: 'none' }}>
                        <td className="label" style={{ textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f2f2f2', width: '120px', color: '#000000', border: '1.5px solid #000000' }}>الإجمالي</td>
                        <td className="value" style={{ textAlign: 'left', fontWeight: '900', color: '#000000', border: '1.5px solid #000000' }}>{computedSums.overallTotal.toLocaleString()}</td>
                      </tr>
                      <tr style={{ border: 'none' }}>
                        <td className="label" style={{ textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f2f2f2', width: '120px', color: '#000000', border: '1.5px solid #000000' }}>المسدد</td>
                        <td className="value" style={{ textAlign: 'left', fontWeight: '900', color: '#000000', border: '1.5px solid #000000' }}>{selectedSheet.currentPaid.toLocaleString()}</td>
                      </tr>
                      <tr style={{ border: 'none' }}>
                        <td className="label" style={{ textAlign: 'right', fontWeight: 'bold', backgroundColor: '#f2f2f2', width: '120px', color: '#000000', border: '1.5px solid #000000' }}>المتبقي</td>
                        <td className="value" style={{ textAlign: 'left', fontWeight: '900', color: '#000000', border: '1.5px solid #000000' }}>{computedSums.remainingBalance.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

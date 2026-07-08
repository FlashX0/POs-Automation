import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  Sparkles, 
  Save, 
  ArrowLeft, 
  TrendingDown, 
  TrendingUp, 
  Clock, 
  CreditCard,
  FileText,
  Briefcase,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Layers,
  Edit2,
  Upload,
  Loader2
} from 'lucide-react';

interface SupplierOffer {
  supplierName: string;
  specs: string;
  unitPrice: number;
  totalPrice: number;
  deliveryTime: string;
  paymentTerms: string;
  isWinner?: boolean;
  isTechnicalMatching?: boolean;
  technicalWarning?: string;
  cashFlowImpactScore?: string;
}

interface QuotationComparison {
  id?: string;
  title: string;
  poId: string;
  material: string;
  quantity: number;
  offers: SupplierOffer[];
  notes: string;
  recommendationMemo?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface PriceComparisonProps {
  documents: any[];
  onNotify: (type: 'success' | 'error' | 'info' | 'warning', title: string, message: string) => void;
}

export const PriceComparison: React.FC<PriceComparisonProps> = ({ documents = [], onNotify }) => {
  const [comparisons, setComparisons] = useState<QuotationComparison[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [activeComparison, setActiveComparison] = useState<QuotationComparison | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [poId, setPoId] = useState('');
  const [material, setMaterial] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [offers, setOffers] = useState<SupplierOffer[]>([
    { supplierName: 'المورد الأول', specs: 'مواصفات قياسية', unitPrice: 0, totalPrice: 0, deliveryTime: '3 أيام', paymentTerms: 'كاش' },
    { supplierName: 'المورد الثاني', specs: 'مواصفات قياسية', unitPrice: 0, totalPrice: 0, deliveryTime: '5 أيام', paymentTerms: 'آجل 30 يوم' },
    { supplierName: 'المورد الثالث', specs: 'مواصفات قياسية', unitPrice: 0, totalPrice: 0, deliveryTime: '7 أيام', paymentTerms: 'مستخلصات' }
  ]);

  // AI-Specific states
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [recommendationMemo, setRecommendationMemo] = useState<string>('');

  const handleAIAnalysis = async () => {
    if (selectedFiles.length === 0) {
      onNotify('warning', 'لا توجد ملفات', 'الرجاء اختيار ملف واحد على الأقل من عروض أسعار الموردين لبدء التحليل.');
      return;
    }

    setIsAnalyzing(true);
    onNotify('info', 'بدء تحليل الـ AI', 'جاري رفع وقراءة عروض الأسعار المحددة بواسطة Gemini Vision OCR... قد يستغرق ذلك بضع ثوانٍ.');

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    formData.append('prId', poId);
    formData.append('fallbackMaterial', material);
    formData.append('fallbackQuantity', String(quantity));

    try {
      const res = await fetch('/api/comparisons/analyze', {
        method: 'POST',
        body: formData
      });

      const resData = await res.json();
      if (resData.success && resData.data) {
        const aiData = resData.data;
        
        setTitle(aiData.title || '');
        setMaterial(aiData.material || '');
        setQuantity(Number(aiData.quantity) || 1);
        setRecommendationMemo(aiData.recommendationMemo || '');
        
        if (aiData.offers && Array.isArray(aiData.offers)) {
          setOffers(aiData.offers);
        }

        onNotify('success', 'تم التحليل بنجاح', 'نجح الذكاء الاصطناعي في مطابقة المواصفات، وفحص التدفق النقدي لشروط الدفع، وتحديد العرض الفائز وتوليد مذكرة الترسية!');
      } else {
        onNotify('error', 'فشل التحليل بالذكاء الاصطناعي', resData.error || 'فشلت معالجة عروض الأسعار المرفوعة.');
      }
    } catch (err: any) {
      console.error(err);
      onNotify('error', 'خطأ في الاتصال بالسيرفر', err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Fetch saved comparisons on load
  const fetchComparisons = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/comparisons');
      const data = await res.json();
      if (data.success) {
        setComparisons(data.comparisons || []);
      } else {
        console.error("Failed to fetch comparisons:", data.error);
      }
    } catch (err: any) {
      console.error("Error fetching comparisons:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparisons();
  }, []);

  // Filter documents of type PO to link them
  const poDocuments = documents.filter(d => d.type?.toLowerCase() === 'po' || d.type === 'أمر شراء');

  // Handle PO change to pre-fill material or title
  const handlePOSelect = (selectedPoId: string) => {
    setPoId(selectedPoId);
    if (!selectedPoId) return;

    const poDoc = documents.find(d => d.id === selectedPoId);
    if (poDoc) {
      setTitle(`مقارنة عروض أسعار لطلب شراء رقم ${poDoc.docNumber || 'جديد'} - ${poDoc.projectName || ''}`);
      
      // Auto fill items if available
      if (poDoc.items && poDoc.items.length > 0) {
        const firstItem = poDoc.items[0];
        setMaterial(firstItem.description || '');
        setQuantity(Number(firstItem.quantity) || 1);
        
        // Populate the offers specs with the PO specs
        setOffers(prev => prev.map(o => ({
          ...o,
          specs: firstItem.description || o.specs,
          unitPrice: o.unitPrice || Number(firstItem.unitPrice) || 0
        })));
      }
    }
  };

  // Add a supplier offer row
  const addOfferRow = () => {
    if (offers.length >= 6) {
      onNotify('warning', 'الحد الأقصى للعروض', 'يمكنك مقارنة حتى 6 موردين كحد أقصى لتناسق العرض والتصدير.');
      return;
    }
    setOffers([
      ...offers,
      { 
        supplierName: `المورد الجديد ${offers.length + 1}`, 
        specs: material || 'مواصفات قياسية', 
        unitPrice: 0, 
        totalPrice: 0, 
        deliveryTime: '3 أيام', 
        paymentTerms: 'كاش' 
      }
    ]);
  };

  // Remove a supplier offer row
  const removeOfferRow = (index: number) => {
    if (offers.length <= 2) {
      onNotify('warning', 'الحد الأدنى للمقارنة', 'يجب أن تحتوي المقارنة على موردين على الأقل لتحديد أفضل سعر.');
      return;
    }
    setOffers(offers.filter((_, idx) => idx !== index));
  };

  // Update offer fields
  const handleOfferChange = (index: number, field: keyof SupplierOffer, value: any) => {
    const updated = [...offers];
    if (field === 'unitPrice') {
      const uPrice = Number(value) || 0;
      updated[index].unitPrice = uPrice;
      updated[index].totalPrice = uPrice * quantity;
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value
      };
    }
    setOffers(updated);
  };

  // Calculate winner (lowest price among non-zero unit prices)
  const getWinnerIndex = (): number => {
    let minPrice = Infinity;
    let winIdx = -1;
    offers.forEach((o, idx) => {
      if (o.unitPrice > 0 && o.unitPrice < minPrice) {
        minPrice = o.unitPrice;
        winIdx = idx;
      }
    });
    return winIdx;
  };

  const winnerIdx = getWinnerIndex();

  // Handle Save comparison
  const handleSave = async () => {
    if (!title.trim()) {
      onNotify('error', 'بيانات ناقصة', 'الرجاء إدخال عنوان المقارنة (مثل: مقارنة حديد تسليح)');
      return;
    }
    if (!material.trim()) {
      onNotify('error', 'بيانات ناقصة', 'الرجاء إدخال اسم المادة أو البند للمقارنة');
      return;
    }

    const preparedOffers = offers.map((o, idx) => ({
      ...o,
      totalPrice: o.unitPrice * quantity,
      isWinner: idx === winnerIdx
    }));

    const body = {
      id: activeComparison?.id,
      title: title.trim(),
      poId,
      material: material.trim(),
      quantity,
      offers: preparedOffers,
      notes: notes.trim(),
      recommendationMemo: recommendationMemo.trim()
    };

    try {
      const res = await fetch('/api/comparisons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        onNotify('success', 'تم حفظ المقارنة', 'تم حفظ وتوثيق لوحة مقارنة عروض الأسعار والموردين بنجاح!');
        fetchComparisons();
        setIsEditing(false);
        setActiveComparison(null);
      } else {
        onNotify('error', 'خطأ في الحفظ', data.error || 'حدث خطأ غير متوقع أثناء الحفظ');
      }
    } catch (err: any) {
      onNotify('error', 'فشل الإرسال', err.message);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف مقارنة عروض الأسعار هذه نهائياً؟')) return;
    try {
      const res = await fetch(`/api/comparisons/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        onNotify('success', 'تم الحذف', 'تم إزالة سجل المقارنة بنجاح من قاعدة البيانات.');
        fetchComparisons();
      } else {
        onNotify('error', 'فشل الحذف', data.error || 'عذراً حدث خطأ ما');
      }
    } catch (err: any) {
      onNotify('error', 'خطأ بالشبكة', err.message);
    }
  };

  // Set up form to edit existing
  const startEdit = (comp: QuotationComparison) => {
    setActiveComparison(comp);
    setTitle(comp.title);
    setPoId(comp.poId || '');
    setMaterial(comp.material || '');
    setQuantity(comp.quantity || 1);
    setNotes(comp.notes || '');
    setOffers(comp.offers || []);
    setRecommendationMemo(comp.recommendationMemo || '');
    setSelectedFiles([]);
    setIsEditing(true);
  };

  // Reset form to add new
  const startNew = () => {
    setActiveComparison(null);
    setTitle('');
    setPoId('');
    setMaterial('');
    setQuantity(1);
    setNotes('');
    setRecommendationMemo('');
    setSelectedFiles([]);
    setOffers([
      { supplierName: 'شركة الهدى للتوريدات', specs: 'مواصفات قياسية معتمدة', unitPrice: 0, totalPrice: 0, deliveryTime: '3 أيام', paymentTerms: 'كاش' },
      { supplierName: 'شركة النيل للمقاولات', specs: 'مواصفات قياسية معتمدة', unitPrice: 0, totalPrice: 0, deliveryTime: '5 أيام', paymentTerms: 'آجل 30 يوم' },
      { supplierName: 'المجموعة المصرية للمواد', specs: 'مواصفات قياسية معتمدة', unitPrice: 0, totalPrice: 0, deliveryTime: '7 أيام', paymentTerms: 'مستخلصات شهرياً' }
    ]);
    setIsEditing(true);
  };

  // EXPORT TO EXCEL
  const handleExportToExcel = (comp: QuotationComparison) => {
    try {
      // 1. Create Worksheet
      const ws = XLSX.utils.aoa_to_sheet([]);

      // Setup worksheet dimensions and structure
      const titleRow = ["Delta for Road Construction - ديلتا لإنشاء الطرق واللاندسكيب"];
      const docHeaderRow = ["تحليل عروض الأسعار ومقارنة الموردين (Price Comparison Report)"];
      const compTitle = [`الموضوع: ${comp.title}`];
      const compMeta = [
        `البند: ${comp.material}`,
        "",
        `الكمية المطلوبة: ${comp.quantity}`,
        "",
        `التاريخ: ${new Date(comp.updatedAt || comp.createdAt || '').toLocaleDateString('ar-EG')}`
      ];

      // Table Headers (10 columns)
      const tableHeaders = [
        "اسم المورد (Supplier Name)",
        "المواصفات الفنية (Technical Specs)",
        "الكمية (Qty)",
        "سعر الوحدة (Unit Price)",
        "الإجمالي (Total Price)",
        "فترة التوريد (Delivery Time)",
        "شروط الدفع (Payment Terms)",
        "المطابقة الفنية (Technical Match)",
        "أثر التدفق النقدي (Cash Flow)",
        "الحالة الفائزة (Status)"
      ];

      // Insert metadata rows
      XLSX.utils.sheet_add_aoa(ws, [titleRow], { origin: "A1" });
      XLSX.utils.sheet_add_aoa(ws, [docHeaderRow], { origin: "A2" });
      XLSX.utils.sheet_add_aoa(ws, [compTitle], { origin: "A4" });
      XLSX.utils.sheet_add_aoa(ws, [compMeta], { origin: "A5" });
      XLSX.utils.sheet_add_aoa(ws, [[]], { origin: "A6" }); // empty divider
      XLSX.utils.sheet_add_aoa(ws, [tableHeaders], { origin: "A7" });

      // Find winner for excel highlighting
      let excelWinnerIdx = -1;
      let minUnitPrice = Infinity;
      comp.offers.forEach((o, idx) => {
        if (o.unitPrice > 0 && o.unitPrice < minUnitPrice) {
          minUnitPrice = o.unitPrice;
          excelWinnerIdx = idx;
        }
      });

      // Insert offers with advanced columns
      const rowsData = comp.offers.map((offer, idx) => {
        const isWin = idx === excelWinnerIdx;
        const techMatch = offer.isTechnicalMatching !== false ? "مطابق للمواصفات" : `غير مطابق: ${offer.technicalWarning || ''}`;
        const cashFlow = offer.cashFlowImpactScore || "";
        return [
          offer.supplierName,
          offer.specs,
          comp.quantity,
          offer.unitPrice,
          offer.unitPrice * comp.quantity,
          offer.deliveryTime,
          offer.paymentTerms,
          techMatch,
          cashFlow,
          isWin ? "🏆 العرض الأفضل سعراً وفنياً" : "عادي"
        ];
      });

      XLSX.utils.sheet_add_aoa(ws, rowsData, { origin: "A8" });

      // Add summary cost savings text
      const finalWinner = comp.offers[excelWinnerIdx];
      let savingNotes: string[] = [];
      if (finalWinner) {
        savingNotes = [
          "",
          `العرض الفائز المقترح: ${finalWinner.supplierName} بإجمالي ${ (finalWinner.unitPrice * comp.quantity).toLocaleString() } ج.م`,
          "التحليل الذكي وفروق الأسعار الفردية مقارنة بالعرض الأغلى في الجدول:"
        ];
        
        comp.offers.forEach((o, idx) => {
          if (idx !== excelWinnerIdx && o.unitPrice > 0) {
            const diffAmount = (o.unitPrice - finalWinner.unitPrice) * comp.quantity;
            const savingPercent = ((o.unitPrice - finalWinner.unitPrice) / o.unitPrice) * 100;
            savingNotes.push(`- التوفير مقابل [${o.supplierName}]: ${diffAmount.toLocaleString()} ج.م (نسبة توفير تبلغ %${savingPercent.toFixed(1)})`);
          }
        });
      }

      // If we have an AI recommendation memo, let's include it nicely structured at the bottom
      if (comp.recommendationMemo) {
        savingNotes.push("");
        savingNotes.push("----------------------------------------------------------------------------------------------------------------------------------------------------------------");
        savingNotes.push("مذكرة الترسية والتوصية الفنية والمالية المعتمدة (Award Recommendation Memo):");
        savingNotes.push("----------------------------------------------------------------------------------------------------------------------------------------------------------------");
        const lines = comp.recommendationMemo.split("\n");
        lines.forEach(l => {
          if (l.trim()) {
            savingNotes.push(l);
          }
        });
      }

      XLSX.utils.sheet_add_aoa(ws, savingNotes.map(line => [line]), { origin: `A${8 + comp.offers.length + 1}` });

      // Apply Styling using xlsx-js-style properties
      // Set Column Widths (10 columns)
      ws['!cols'] = [
        { wch: 30 }, // A: Supplier Name
        { wch: 35 }, // B: Specs
        { wch: 10 }, // C: Qty
        { wch: 15 }, // D: Unit Price
        { wch: 18 }, // E: Total Price
        { wch: 18 }, // F: Delivery Time
        { wch: 22 }, // G: Payment Terms
        { wch: 25 }, // H: Technical Match
        { wch: 30 }, // I: Cash Flow
        { wch: 22 }  // J: Status
      ];

      // Cell style objects
      const styleTitle = {
        font: { name: "Segoe UI", sz: 16, bold: true, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const styleSubTitle = {
        font: { name: "Segoe UI", sz: 12, bold: true, color: { rgb: "1E293B" } },
        fill: { patternType: "solid", fgColor: { rgb: "F1F5F9" } },
        alignment: { horizontal: "center", vertical: "center" }
      };

      const styleMeta = {
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "475569" } },
        alignment: { horizontal: "right" }
      };

      const styleHeaderCell = {
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: "1E3A8A" } }, // Dark Blue Header
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "medium", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } }
        }
      };

      const styleNormalCell = {
        font: { name: "Segoe UI", sz: 11, color: { rgb: "1E293B" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "E2E8F0" } },
          bottom: { style: "thin", color: { rgb: "E2E8F0" } },
          left: { style: "thin", color: { rgb: "E2E8F0" } },
          right: { style: "thin", color: { rgb: "E2E8F0" } }
        }
      };

      const styleWinnerCell = {
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "15803D" } }, // Deep emerald text
        fill: { patternType: "solid", fgColor: { rgb: "DCFCE7" } }, // Soft green background
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "medium", color: { rgb: "16A34A" } },
          bottom: { style: "medium", color: { rgb: "16A34A" } },
          left: { style: "thin", color: { rgb: "16A34A" } },
          right: { style: "thin", color: { rgb: "16A34A" } }
        }
      };

      const styleWinnerBadge = {
        font: { name: "Segoe UI", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: "16A34A" } }, // Full solid green
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "medium", color: { rgb: "16A34A" } },
          bottom: { style: "medium", color: { rgb: "16A34A" } },
          left: { style: "thin", color: { rgb: "16A34A" } },
          right: { style: "thin", color: { rgb: "16A34A" } }
        }
      };

      // Apply styles to cells
      const range = XLSX.utils.decode_range(ws['!ref'] || "A1:J20");

      // Title rows merge (merged across all 10 columns)
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, // merge row 1
        { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, // merge row 2
        { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } }  // merge row 4
      ];

      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          const cell = ws[cellRef];
          if (!cell) continue;

          if (r === 0) {
            cell.s = styleTitle;
          } else if (r === 1) {
            cell.s = styleSubTitle;
          } else if (r === 3) {
            cell.s = styleMeta;
          } else if (r === 4) {
            cell.s = styleMeta;
          } else if (r === 6) {
            // Header Row
            cell.s = styleHeaderCell;
          } else if (r >= 7 && r < 7 + comp.offers.length) {
            // Offer rows
            const offerIdx = r - 7;
            const isWinnerOffer = offerIdx === excelWinnerIdx;
            
            if (isWinnerOffer) {
              if (c === 9) {
                cell.s = styleWinnerBadge; // Status column gets fully filled green
              } else {
                cell.s = styleWinnerCell;  // Other columns get soft green background
              }
            } else {
              cell.s = styleNormalCell;
            }

            // Set cell number format for price columns
            if (c === 3 || c === 4) {
              cell.z = "#,##0.00";
            }
          } else if (r >= 7 + comp.offers.length) {
            // Savings and Recommendation Memo at the bottom
            const textLine = String(cell.v || "");
            const isHeader = textLine.startsWith("مذكرة") || textLine.startsWith("---");
            cell.s = {
              font: { 
                name: "Segoe UI", 
                sz: isHeader ? 11 : 10, 
                bold: isHeader || textLine.startsWith("العرض الفائز"), 
                color: textLine.startsWith("العرض الفائز") ? { rgb: "15803D" } : { rgb: "1E293B" } 
              },
              alignment: { horizontal: "right" }
            };
          }
        }
      }

      // Package to workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "مقارنة الأسعار");

      // Save
      XLSX.writeFile(wb, `Delta_Comparison_${comp.material.replace(/\s+/g, '_')}.xlsx`);
      onNotify('success', 'تصدير إكسيل ناجح', 'تم تصدير تقرير مقارنة عروض الأسعار بصيغة إكسيل منسقة احترافياً وبألوان مطابقة لهوية ديلتا بنجاح!');
    } catch (err: any) {
      console.error(err);
      onNotify('error', 'فشل التصدير', err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-stretch" dir="rtl">
      
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-l from-slate-950 via-[#0d1527] to-slate-950 border-b border-slate-800 p-6 px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 text-sky-400 font-bold text-xs tracking-wider">
            <Sparkles className="w-4 h-4 animate-pulse text-sky-400" />
            <span>نظام ديلتا الذكي للتحليل المالي والمشتريات • Delta Road Construction</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            مقارنة عروض الأسعار وتحليل الموردين
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            قارن عروض الأسعار لحديد التسليح والأسمنت والمواد والمستلزمات، وحدد العرض الفائز ذكياً وصدر التقارير لإدارة السيولة.
          </p>
        </div>
        
        {!isEditing && (
          <button
            onClick={startNew}
            className="flex items-center justify-center gap-2 bg-sky-650 hover:bg-sky-600 text-white font-extrabold text-xs sm:text-sm py-3 px-5 rounded-xl shadow-lg shadow-sky-950/40 transition-all cursor-pointer select-none"
          >
            <Plus className="w-4 h-4" />
            <span>مقارنة عروض جديدة</span>
          </button>
        )}
      </div>

      <div className="p-4 sm:p-6 lg:p-8 flex-1 flex flex-col">
        {isEditing ? (
          /* ========================================================
             FORM VIEW: CREATE / EDIT COMPARISON
             ======================================================== */
          <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-2xl p-6 sm:p-8 flex flex-col gap-6">
            
            {/* Top row with Back button */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setActiveComparison(null);
                }}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-100 text-xs sm:text-sm transition-colors font-bold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>العودة لقائمة المقارنات</span>
              </button>
              
              <span className="text-xs bg-sky-950 text-sky-400 font-extrabold px-3 py-1 rounded-full border border-sky-900">
                {activeComparison ? 'تعديل مقارنة أسعار' : 'إعداد مقارنة أسعار جديدة'}
              </span>
            </div>

            {/* AI SMART UPLOAD & ANALYSIS ZONE */}
            <div className="bg-[#111c30]/50 border border-sky-900/40 rounded-2xl p-5 mb-2">
              <div className="flex items-center gap-2 text-sky-400 font-bold text-xs mb-3">
                <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
                <span>مساعد المشتريات والتحليل الذكي بالذكاء الاصطناعي (Gemini 3.5 Flash)</span>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                
                {/* Upload Zone */}
                <div className="lg:col-span-7 flex flex-col gap-3">
                  <div 
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const files = Array.from(e.dataTransfer.files);
                      setSelectedFiles(prev => [...prev, ...files]);
                    }}
                    onClick={() => document.getElementById('ai-quote-files')?.click()}
                    className="border-2 border-dashed border-sky-900/50 hover:border-sky-500/50 bg-slate-900/50 hover:bg-slate-900/80 p-6 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all gap-2"
                  >
                    <Upload className="w-8 h-8 text-sky-400" />
                    <span className="text-xs font-bold text-slate-200">اسحب وأفلت عروض أسعار الموردين هنا أو اضغط للتصفح</span>
                    <span className="text-[10px] text-slate-500">يدعم ملفات PDF والصور (PNG، JPG) - يرجى رفع ملفات الموردين المختلفة لنفس المعاملة</span>
                    <input 
                      id="ai-quote-files"
                      type="file" 
                      multiple 
                      accept=".pdf,image/*" 
                      onChange={(e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files);
                          setSelectedFiles(prev => [...prev, ...files]);
                        }
                      }}
                      className="hidden" 
                    />
                  </div>

                  {/* Selected Files List */}
                  {selectedFiles.length > 0 && (
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-900 flex flex-col gap-2 max-h-36 overflow-y-auto">
                      <div className="flex justify-between items-center border-b border-slate-900 pb-1.5">
                        <span className="text-[10px] font-bold text-slate-400">الملفات المختارة للتحليل والمقارنة ({selectedFiles.length})</span>
                        <button 
                          onClick={() => setSelectedFiles([])}
                          className="text-[9px] text-rose-500 hover:underline font-bold"
                        >
                          مسح الكل
                        </button>
                      </div>
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs text-slate-300 bg-slate-900/40 p-1.5 rounded border border-slate-900">
                          <span className="truncate max-w-[80%] font-mono text-[11px]">{file.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFiles(selectedFiles.filter((_, i) => i !== idx));
                              }}
                              className="text-rose-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* PR / PO Linking & Actions */}
                <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900/30 p-4 border border-slate-800/60 rounded-xl gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-slate-300">ربط بطلب الشراء الداخلي (PR)</label>
                    <select
                      value={poId}
                      onChange={(e) => handlePOSelect(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-sky-500 transition-colors w-full"
                    >
                      <option value="">-- اختر طلب شراء لتطابق الكميات والمواصفات --</option>
                      {poDocuments.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.docNumber} - {doc.projectName} ({doc.clientName})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      ربط طلب الشراء يتيح للذكاء الاصطناعي مطابقة الكميات والمواصفات الفنية المكتوبة بعروض الأسعار مع طلب المهندس الأصلي تلقائياً.
                    </p>
                  </div>

                  <button
                    onClick={handleAIAnalysis}
                    disabled={selectedFiles.length === 0 || isAnalyzing}
                    className={`w-full py-3 px-5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                      selectedFiles.length === 0 
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-900' 
                        : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-lg shadow-sky-950/50 cursor-pointer'
                    }`}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>جاري قراءة وتحليل عروض الأسعار بالـ AI...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-white animate-pulse" />
                        <span>تحليل عروض الأسعار بالـ AI ✨</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>

            {/* Basic Info Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Linked PO (Optional) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">ربط بأمر شراء قائم (اختياري)</label>
                <select
                  value={poId}
                  onChange={(e) => handlePOSelect(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500 transition-colors"
                >
                  <option value="">-- اختر أمر شراء لملء البيانات --</option>
                  {poDocuments.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.docNumber} - {doc.projectName} ({doc.clientName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div className="flex flex-col gap-1.5 lg:col-span-2">
                <label className="text-xs font-bold text-slate-300">عنوان المقارنة / الموضوع *</label>
                <input
                  type="text"
                  placeholder="مثال: مقارنة عروض أسعار حديد عز لمشروع يونيو"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              {/* Material / Item Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">المادة / البند المُراد شراؤه *</label>
                <input
                  type="text"
                  placeholder="مثال: حديد تسليح 16 مم عز"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              {/* Quantity */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">الكمية المطلوبة *</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => {
                    const qty = Math.max(1, Number(e.target.value) || 1);
                    setQuantity(qty);
                    // Update all offers total price
                    setOffers(offers.map(o => ({
                      ...o,
                      totalPrice: o.unitPrice * qty
                    })));
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 outline-none focus:border-sky-500 transition-colors"
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5 lg:col-span-3">
                <label className="text-xs font-bold text-slate-300">ملاحظات التحليل والاعتماد</label>
                <input
                  type="text"
                  placeholder="ملاحظات حول الجودة، الاعتمادات الفنية للمهندس الاستشاري، إلخ..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500 transition-colors"
                />
              </div>

            </div>

            {/* SUPPLIERS COMPARISON INPUT TABLE */}
            <div className="mt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>عروض أسعار الموردين والشركات المنافسة</span>
                </h3>
                <button
                  type="button"
                  onClick={addOfferRow}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-sky-400 border border-sky-900/60 font-bold text-xs py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة عرض مورد</span>
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-300 text-xs border-b border-slate-800">
                      <th className="p-3 text-center w-8">#</th>
                      <th className="p-3">اسم الشركة / المورد *</th>
                      <th className="p-3">المواصفات الفنية المقدمة</th>
                      <th className="p-3 w-28">سعر الوحدة *</th>
                      <th className="p-3 w-32">السعر الإجمالي</th>
                      <th className="p-3 w-32">فترة التوريد</th>
                      <th className="p-3 w-40">شروط الدفع المالية</th>
                      <th className="p-3 w-56 text-right">التقييم الفني وأثر التدفق النقدي (AI)</th>
                      <th className="p-3 text-center w-12">حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((offer, idx) => {
                      const isWinning = idx === winnerIdx;
                      return (
                        <tr 
                          key={idx} 
                          className={`border-b border-slate-900/60 transition-colors text-xs ${
                            isWinning ? 'bg-emerald-950/20 hover:bg-emerald-950/30 border-r-4 border-r-emerald-500' : 'hover:bg-slate-900/40'
                          }`}
                        >
                          <td className="p-3 text-center font-bold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={offer.supplierName}
                              onChange={(e) => handleOfferChange(idx, 'supplierName', e.target.value)}
                              className="w-full bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500 transition-colors"
                              placeholder="مثل: شركة الهدى للحديد"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={offer.specs}
                              onChange={(e) => handleOfferChange(idx, 'specs', e.target.value)}
                              className="w-full bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500 transition-colors"
                              placeholder="مثل: حديد استثماري معتمد"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              value={offer.unitPrice || ''}
                              onChange={(e) => handleOfferChange(idx, 'unitPrice', e.target.value)}
                              className="w-full bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-sky-500 transition-colors"
                              placeholder="0"
                            />
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-300">
                            {(offer.unitPrice * quantity).toLocaleString()} ج.م
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={offer.deliveryTime}
                              onChange={(e) => handleOfferChange(idx, 'deliveryTime', e.target.value)}
                              className="w-full bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500 transition-colors"
                              placeholder="مثل: يومين"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={offer.paymentTerms}
                              onChange={(e) => handleOfferChange(idx, 'paymentTerms', e.target.value)}
                              className="w-full bg-slate-900 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500 transition-colors"
                            >
                              <option value="كاش">كاش</option>
                              <option value="آجل 30 يوم">آجل 30 يوم</option>
                              <option value="آجل 60 يوم">آجل 60 يوم</option>
                              <option value="مستخلصات شهرية">مستخلصات شهرية</option>
                              <option value="دفعة مقدمة + مستخلص">دفعة مقدمة + مستخلص</option>
                            </select>
                          </td>
                          <td className="p-2 text-right">
                            <div className="flex flex-col gap-1 text-[10px]">
                              {/* Technical Match */}
                              <div className="flex items-center gap-1.5">
                                {offer.isTechnicalMatching !== false ? (
                                  <span className="bg-emerald-500/10 text-emerald-400 font-extrabold px-2 py-0.5 rounded border border-emerald-900/30 flex items-center gap-1 text-[10px]">
                                    <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                                    <span>مطابق للمواصفات</span>
                                  </span>
                                ) : (
                                  <span className="bg-rose-500/10 text-rose-400 font-extrabold px-2 py-0.5 rounded border border-rose-900/30 flex items-center gap-1 text-[10px]" title={offer.technicalWarning}>
                                    <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                    <span>غير مطابق: {offer.technicalWarning || "المواصفات"}</span>
                                  </span>
                                )}
                              </div>
                              {/* Cash Flow Impact */}
                              {offer.cashFlowImpactScore && (
                                <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                                  <CreditCard className="w-3 h-3 text-sky-400 shrink-0" />
                                  <span className="truncate max-w-[180px] font-bold" title={offer.cashFlowImpactScore}>
                                    {offer.cashFlowImpactScore}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeOfferRow(idx)}
                              className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* LIVE SMART RECOMMENDATIONS PANEL */}
            {winnerIdx > -1 && offers[winnerIdx].unitPrice > 0 && (
              <div className="bg-emerald-950/25 border border-emerald-800/40 rounded-2xl p-6 flex flex-col md:flex-row gap-6 justify-between items-stretch">
                
                {/* Winner badge */}
                <div className="flex gap-4 items-start md:w-2/3">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl shrink-0 mt-1">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-emerald-500 text-slate-950 font-black px-2.5 py-0.5 rounded-full">التحليل الذكي للفروق</span>
                      <h4 className="text-sm font-bold text-emerald-400">
                        العرض الفائز المقترح: [{offers[winnerIdx].supplierName}]
                      </h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      نظام التوجيه التلقائي يوصي باختيار هذا العرض كونه يقدم السعر الأفضل بقيمة تبلغ <strong className="text-slate-200 font-mono">{(offers[winnerIdx].unitPrice).toLocaleString()} ج.م</strong> للوحدة وإجمالي يبلغ <strong className="text-emerald-400 font-mono">{(offers[winnerIdx].unitPrice * quantity).toLocaleString()} ج.م</strong>.
                    </p>
                    
                    <div className="mt-3 flex flex-col gap-1 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-sky-400" />
                        <span>فترة التوريد: {offers[winnerIdx].deliveryTime || 'غير محددة'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                        <span>طريقة الدفع المقترحة: {offers[winnerIdx].paymentTerms || 'غير محددة'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Savings stats block */}
                <div className="flex flex-col justify-center bg-slate-900/60 border border-slate-800 p-4 rounded-xl md:w-1/3 gap-3">
                  <div className="text-center md:text-right">
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">نسب التوفير والوفورات المتوقعة</span>
                    
                    {offers.map((o, idx) => {
                      if (idx === winnerIdx || o.unitPrice <= 0) return null;
                      const diffPrice = (o.unitPrice - offers[winnerIdx].unitPrice) * quantity;
                      const savingPercent = ((o.unitPrice - offers[winnerIdx].unitPrice) / o.unitPrice) * 100;
                      return (
                        <div key={idx} className="flex justify-between items-center text-xs mt-1 border-t border-slate-800/40 pt-1">
                          <span className="text-slate-400">مقارنة بـ [{o.supplierName}]</span>
                          <span className="text-emerald-400 font-bold font-mono">
                            +{diffPrice.toLocaleString()} ج.م (%{savingPercent.toFixed(1)})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* AWARD RECOMMENDATION MEMO PANEL */}
            {recommendationMemo && (
              <div className="bg-[#0f172a]/80 border border-slate-800/80 rounded-2xl p-6 sm:p-8 flex flex-col gap-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-xs sm:text-sm font-black text-slate-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-sky-400" />
                    <span>مذكرة الترسية والتوصية الفنية والمالية المعتمدة (Award Recommendation Memo)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(recommendationMemo);
                      onNotify('success', 'تم نسخ المذكرة', 'تم نسخ نص مذكرة الترسية المعتمدة بنجاح لتبادلها أو طباعتها!');
                    }}
                    className="text-[10px] text-sky-400 hover:text-sky-300 font-extrabold border border-sky-900/60 px-3 py-1.5 rounded-lg bg-sky-950/40 transition-colors cursor-pointer"
                  >
                    نسخ نص المذكرة
                  </button>
                </div>

                <div 
                  className="bg-slate-950 p-6 rounded-xl border border-slate-900 text-slate-300 text-xs font-mono leading-relaxed whitespace-pre-wrap text-right max-h-96 overflow-y-auto"
                >
                  {recommendationMemo}
                </div>

                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 justify-end">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>المذكرة تم توليدها بالذكاء الاصطناعي بناءً على مطابقة البنود والكميات والتدفقات النقدية لديلتا.</span>
                </div>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setActiveComparison(null);
                }}
                className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs sm:text-sm py-3 px-6 rounded-xl cursor-pointer"
              >
                إلغاء التغييرات
              </button>
              
              <button
                onClick={handleSave}
                className="flex items-center gap-2 bg-sky-650 hover:bg-sky-600 text-white font-black text-xs sm:text-sm py-3 px-8 rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>حفظ المقارنة والتحليل بالداتابيز</span>
              </button>
            </div>

          </div>
        ) : (
          /* ========================================================
             LIST VIEW: SAVED COMPARISONS LIST & DASHBOARD CARDS
             ======================================================== */
          <div className="flex-1 flex flex-col gap-6">
            
            {/* INSTRUCTION ALERTS */}
            <div className="bg-[#0b0f19]/40 border border-sky-950 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex gap-3.5">
                <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl shrink-0 mt-0.5">
                  <FileSpreadsheet className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-200">مقارنة وتصنيف عروض الأسعار بصيغة إكسيل منسقة</h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-1">
                    يمكنك إنشاء لوحة مقارنة أسعار جديدة للموردين، تحديد العرض الفائز بناءً على السعر الأدنى وشروط التوريد والدفع، وتصدير شيت إكسيل بتنسيق شرطي جذاب فورا!
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-10 h-10 border-4 border-sky-600/20 border-t-sky-500 rounded-full animate-spin"></div>
                <span className="text-xs text-slate-500">جاري تحميل سجل مقارنات عروض الموردين...</span>
              </div>
            ) : comparisons.length === 0 ? (
              <div className="bg-[#111827] rounded-2xl border border-slate-800 p-12 text-center flex flex-col items-center gap-4 justify-center">
                <div className="p-4 bg-slate-900 rounded-full text-slate-600">
                  <FileText className="w-12 h-12" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-300">لا يوجد سجل مقارنات أسعار مضاف بعد</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    ابدأ بإنشاء أول مقارنة عروض أسعار للموردين الآن! قارن أسعار الحديد، الأسمنت، الرمل، أو أي بنود وقم بالتصدير إلى ملف إكسيل مالي منسق للموقع.
                  </p>
                </div>
                <button
                  onClick={startNew}
                  className="mt-2 bg-sky-650 hover:bg-sky-600 text-white font-bold text-xs py-2.5 px-6 rounded-xl transition-all cursor-pointer"
                >
                  إنشاء أول مقارنة أسعار
                </button>
              </div>
            ) : (
              /* GRID OF SAVED COMPARISONS */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {comparisons.map((comp) => {
                  // Find winning offer
                  let compWinPrice = Infinity;
                  let winOffer: SupplierOffer | null = null;
                  comp.offers?.forEach(o => {
                    if (o.unitPrice > 0 && o.unitPrice < compWinPrice) {
                      compWinPrice = o.unitPrice;
                      winOffer = o;
                    }
                  });

                  return (
                    <div 
                      key={comp.id} 
                      className="bg-[#111827] hover:bg-[#111827]/80 rounded-2xl border border-slate-800 hover:border-slate-750 p-5 flex flex-col justify-between shadow-lg hover:shadow-2xl transition-all group relative"
                    >
                      <div>
                        {/* Title & Badge */}
                        <div className="flex justify-between items-start gap-3 mb-3">
                          <span className="text-[9px] font-extrabold bg-sky-950 text-sky-400 border border-sky-900 px-2.5 py-0.5 rounded-full">
                            {comp.offers?.length || 0} موردين
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(comp.updatedAt || comp.createdAt || '').toLocaleDateString('ar-EG')}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-xs sm:text-sm font-black text-slate-200 line-clamp-2 leading-relaxed">
                          {comp.title}
                        </h3>

                        {/* Description metadata */}
                        <div className="mt-4 bg-slate-950/40 rounded-xl p-3 border border-slate-900 flex flex-col gap-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">البند المالي:</span>
                            <span className="text-slate-300 font-bold">{comp.material}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">الكمية الإجمالية:</span>
                            <span className="text-slate-300 font-mono font-bold">{comp.quantity}</span>
                          </div>
                        </div>

                        {/* Best offer summary */}
                        {winOffer && (
                          <div className="mt-3 p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-xl flex items-center justify-between">
                            <div>
                              <span className="text-[9px] bg-emerald-500 text-slate-950 font-extrabold px-1.5 py-0.2 rounded-md block w-max mb-1">
                                العرض الأقل سعراً 🏆
                              </span>
                              <span className="text-xs font-bold text-slate-300 block">
                                {(winOffer as SupplierOffer).supplierName}
                              </span>
                            </div>
                            <div className="text-left">
                              <span className="text-xs font-black text-emerald-400 font-mono">
                                {(((winOffer as SupplierOffer).unitPrice) * comp.quantity).toLocaleString()} ج.م
                              </span>
                              <span className="text-[10px] text-slate-500 block mt-0.5">
                                توريد في {(winOffer as SupplierOffer).deliveryTime}
                              </span>
                            </div>
                          </div>
                        )}

                        {comp.recommendationMemo && (
                          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-sky-400 font-bold bg-sky-950/20 border border-sky-900/40 rounded-xl px-2.5 py-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse shrink-0" />
                            <span>مرفق مذكرة الترسية والتحليل بالـ AI</span>
                          </div>
                        )}

                        {comp.notes && (
                          <p className="text-[10px] text-slate-500 mt-3 line-clamp-1 italic">
                            ملاحظة: {comp.notes}
                          </p>
                        )}
                      </div>

                      {/* CARD ACTIONS */}
                      <div className="mt-5 border-t border-slate-900 pt-4 flex items-center justify-between gap-2">
                        {/* Delete button */}
                        <button
                          onClick={() => comp.id && handleDelete(comp.id)}
                          className="p-2 bg-slate-900 hover:bg-rose-950/20 text-slate-600 hover:text-rose-500 rounded-xl transition-all cursor-pointer"
                          title="حذف المقارنة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="flex gap-2">
                          {/* Edit Button */}
                          <button
                            onClick={() => startEdit(comp)}
                            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold text-xs py-2 px-3.5 rounded-xl transition-all cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>

                          {/* Excel Button */}
                          <button
                            onClick={() => handleExportToExcel(comp)}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs py-2 px-4 rounded-xl shadow-md shadow-emerald-950/20 transition-all cursor-pointer"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>تصدير إكسيل</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}
      </div>

    </div>
  );
};

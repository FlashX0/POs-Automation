/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo, useCallback, ChangeEvent, FormEvent, MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Sparkles,
  Table, 
  Folder,
  FolderOpen, 
  Smartphone, 
  Settings, 
  Upload, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  Plus, 
  Edit,
  Pencil,
  Search, 
  Send, 
  Bell, 
  X, 
  Activity, 
  DollarSign, 
  Calendar, 
  User, 
  ArrowLeft, 
  Loader2,
  ExternalLink,
  ChevronRight,
  Info,
  FileSpreadsheet,
  Briefcase,
  GitCompare,
  ArrowLeftRight,
  Printer,
  CircleDot,
  Save,
  TrendingUp,
  BarChart2,
  Layers,
  PlusCircle,
  Users,
  Truck,
  Database,
  Scale,
  Sliders,
  RefreshCw,
  Shield,
  ShieldAlert,
  Copy,
  Check,
  Lock,
  Unlock,
  Eye,
  EyeOff
} from 'lucide-react';
// @ts-ignore
import * as XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
// @ts-ignore
import deltaLogo from './assets/images/delta_road_logo_1781798697279.jpg';

// Helper function to convert OKLCH & OKLAB color strings (used by Tailwind v4) to standard RGB/RGBA.
// This prevents html2canvas from failing with the: "Attempting to parse an unsupported color function" error.
function calculateRgbFromOklab(L: number, a: number, b: number, A: number): string {
  // Oklab to LMS color space conversion
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855414 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS to linear sRGB conversion
  const rLinear = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  // Linear sRGB to standard sRGB linear companding
  const toSRGB = (c: number) => {
    const cClamp = Math.max(0, Math.min(1, c));
    const res = cClamp <= 0.0031308 
      ? 12.92 * cClamp 
      : 1.055 * Math.pow(cClamp, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(res * 255)));
  };

  const rVal = toSRGB(rLinear);
  const gVal = toSRGB(gLinear);
  const bVal = toSRGB(bLinear);

  if (A < 1) {
    return `rgba(${rVal}, ${gVal}, ${bVal}, ${A})`;
  }
  return `rgb(${rVal}, ${gVal}, ${bVal})`;
}

function convertOklToRgb(colorStr: string): string {
  try {
    if (!colorStr) return colorStr;
    
    // Process oklch replacement inside colorStr (robust regex allowing spaces, commas, slashes, and negative values)
    let result = colorStr.replace(/oklch\(\s*([0-9eE\-\.\%]+)[\s,]+([0-9eE\-\.\%]+)[\s,]+([0-9eE\-\.\%]+)(?:[\s,\/]+([0-9eE\-\.\%]+))?\s*\)/gi, (fullMatch, group1, group2, group3, group4) => {
      const parseVal = (str: string, percentRef: number = 1) => {
        if (str.endsWith('%')) {
          return (parseFloat(str) / 100) * percentRef;
        }
        return parseFloat(str);
      };

      const L = parseVal(group1, 1);
      const C = parseVal(group2, 1);
      const H = parseVal(group3, 360);
      const A = group4 ? parseVal(group4, 1) : 1;

      const hRad = (H * Math.PI) / 180;
      const labA = C * Math.cos(hRad);
      const labB = C * Math.sin(hRad);

      return calculateRgbFromOklab(L, labA, labB, A);
    });

    // Process oklab replacement inside colorStr (robust regex allowing spaces, commas, slashes, and negative values)
    result = result.replace(/oklab\(\s*([0-9eE\-\.\%]+)[\s,]+([0-9eE\-\.\%]+)[\s,]+([0-9eE\-\.\%]+)(?:[\s,\/]+([0-9eE\-\.\%]+))?\s*\)/gi, (fullMatch, group1, group2, group3, group4) => {
      const parseVal = (str: string, percentRef: number = 1) => {
        if (str.endsWith('%')) {
          return (parseFloat(str) / 100) * percentRef;
        }
        return parseFloat(str);
      };

      const L = parseVal(group1, 1);
      const a = parseVal(group2, 1);
      const b = parseVal(group3, 1);
      const A = group4 ? parseVal(group4, 1) : 1;

      return calculateRgbFromOklab(L, a, b, A);
    });

    return result;
  } catch (e) {
    console.warn("Failed converting okl color function:", colorStr, e);
    return "rgb(0, 0, 0)";
  }
}

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { ProcessedDocument, AppStats, AppNotification, LineItem } from './types';

const normalizeArabic = (text: any): string => {
  if (text === null || text === undefined) return '';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ةه]/g, 'ه')
    .replace(/[ىي]/g, 'ى');
};

const convertEasternToWesternNumerals = (str: any): string => {
  if (str === null || str === undefined) return '';
  const text = String(str);
  const easternDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  let result = text;
  for (let i = 0; i < 10; i++) {
    result = result.replace(easternDigits[i], String(i)).replace(persianDigits[i], String(i));
  }
  return result;
};

const parseAdvance = (advanceStr: any, totalAmount: number) => {
  if (!advanceStr) return null;
  const str = String(advanceStr).trim();
  if (!str) return null;
  
  let value = 0;
  if (str.endsWith('%')) {
    const pct = parseFloat(str.replace(/%/g, ''));
    if (!isNaN(pct)) {
      value = (pct / 100) * totalAmount;
    }
  } else {
    // Keep only numbers and dots
    const cleaned = str.replace(/[^0-9.]/g, '');
    if (cleaned) {
      value = parseFloat(cleaned);
    }
  }
  
  if (isNaN(value) || value <= 0) return null;
  const remaining = Math.max(0, totalAmount - value);
  return { value, remaining };
};

const getAdvancePercentageDetails = (advanceStr: any, totalAmount: number) => {
  if (!advanceStr) return null;
  // Convert Eastern Arabic numerals (٣٠) to Western (30)
  let str = convertEasternToWesternNumerals(String(advanceStr)).trim();
  if (!str) return null;
  
  let p = 0;
  // Look for any percentage in the string, e.g., "40%"
  const matchPct = str.match(/(\d+(?:\.\d+)?)\s*%/);
  if (matchPct) {
    p = parseFloat(matchPct[1]);
  } else {
    // If no percent sign, find first numeric sequence
    const matchNum = str.match(/(\d+(?:\.\d+)?)/);
    if (matchNum) {
      const val = parseFloat(matchNum[1]);
      if (!isNaN(val) && val > 0) {
        if (val <= 100) {
          p = val;
        } else if (totalAmount > 0) {
          p = (val / totalAmount) * 100;
        }
      }
    }
  }
  
  if (isNaN(p) || p <= 0 || p >= 100) {
    // Safe default to avoid any raw text leakage with Arabic letters when parsing fails
    p = 50;
  }
  
  const formatPctVal = (v: number) => {
    return v % 1 === 0 ? v.toFixed(0) : v.toFixed(1);
  };
  
  return {
    advanceStr: `${formatPctVal(p)}%`,
    deliveryStr: `${formatPctVal(100 - p)}%`
  };
};

const sanitizeAndExtractBrands = (docs: ProcessedDocument[]): ProcessedDocument[] => {
  if (!docs) return [];
  
  // 1. Dynamic brand learning: Extract all unique user-entered or existing non-empty brands from docs
  const learnedBrandsSet = new Set<string>();
  docs.forEach(doc => {
    if (doc.items && Array.isArray(doc.items)) {
      doc.items.forEach((item: any) => {
        const b = item.brand?.trim();
        if (b && b !== "" && b.length > 1) {
          learnedBrandsSet.add(b);
        }
      });
    }
  });

  // Sort learned brands descending by length so more specific matches run first
  const sortedLearnedList = Array.from(learnedBrandsSet).sort((a, b) => b.length - a.length);
  const dynamicRules = sortedLearnedList.map(b => {
    const escaped = b.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    return {
      pattern: new RegExp(`(?:^|[\\s\\(\\)\\[\\]\\{\\}\\,\\.\\/\\-])` + escaped + `(?:$|[\\s\\(\\)\\[\\]\\{\\}\\,\\.\\/\\-])`, 'i'),
      canonical: b,
      rawBrand: b
    };
  });

  const baseBrandRules = [
    { pattern: /(كومر\s+مصرى|كومر\s+مصري|Comer\s+Masry)/i, canonical: "كومر مصرى", rawBrand: "كومر مصرى" },
    { pattern: /(كومر|Comer)/i, canonical: "كومر", rawBrand: "كومر" },
    { pattern: /(ويلدون|ويلد\s+ون|ويلد-ون|Weldon|Weld-on)/i, canonical: "ويلدون", rawBrand: "ويلدون" },
    { pattern: /(اليزية|اليزيه|أليزيه|أليزية|Elysee|Elise|Elyse|Elisie|Alizee|Alize)/i, canonical: "اليزية", rawBrand: "اليزية" },
    { pattern: /(هوزا|هوزة|هوذا|Hosa|Howza)/i, canonical: "هوزا", rawBrand: "هوزا" },
    { pattern: /(هوز|Hoza|Hozar)/i, canonical: "هوز", rawBrand: "هوز" },
    { pattern: /(جوزا|جوزة|Joza)/i, canonical: "جوزا", rawBrand: "جوزا" },
    { pattern: /(جوز|Goza)/i, canonical: "جوز", rawBrand: "جوز" },
    { pattern: /(شيرة\s+مصرى|شيرة\s+مصري|شيره\s+مصرى|شيره\s+مصري|Chira)/i, canonical: "شيرة مصرى", rawBrand: "شيرة مصرى" },
    { pattern: /(شيرة|شيره)/i, canonical: "شيرة", rawBrand: "شيرة" },
    { pattern: /(الشريف|Al-Sherif|El-Sherif)/i, canonical: "الشريف", rawBrand: "الشريف" },
    { pattern: /(سمارت\s+هوم|Smart\s+Home)/i, canonical: "سمارت هوم", rawBrand: "سمارت هوم" },
    { pattern: /(سمارت|Smart)/i, canonical: "سمارت", rawBrand: "سمارت" },
    { pattern: /(باننجر|بانيجر|بأننجر|Banninger|Bänninger)/i, canonical: "باننجر", rawBrand: "باننجر" },
    { pattern: /(بايبلايف|بايب\s+لايف|Pipelife)/i, canonical: "بايبلايف", rawBrand: "بايبلايف" },
    { pattern: /(جورج\s+فيشر|Georg\s+Fischer)/i, canonical: "جورج فيشر", rawBrand: "جورج فيشر" },
    { pattern: /(جى\s+اف|جي\s+اف|GF)/i, canonical: "GF", rawBrand: "GF" },
    { pattern: /(كيسان|Kisan)/i, canonical: "كيسان", rawBrand: "كيسان" },
    { pattern: /(إيجاب|ايجاب|EGAP)/i, canonical: "إيجاب", rawBrand: "إيجاب" },
    { pattern: /(فيجا|Viega)/i, canonical: "فيجا", rawBrand: "فيجا" },
    { pattern: /(كوبرا|Cobra)/i, canonical: "كوبرا", rawBrand: "كوبرا" },
    { pattern: /(أكواثيرم|أكواتيرم|Aquatherm)/i, canonical: "أكواثيرم", rawBrand: "أكواثيرم" },
    { pattern: /(السويدى|السويدي|Elsewedy|Seweedy)/i, canonical: "السويدي", rawBrand: "السويدي" },
    { pattern: /(الفنار|Alfanar)/i, canonical: "الفنار", rawBrand: "الفنار" },
    { pattern: /(روكا|Roca)/i, canonical: "روكا", rawBrand: "روكا" },
    { pattern: /(جروهى|جروهي|Grohe)/i, canonical: "جروهي", rawBrand: "جروهي" },
    { pattern: /(دورافيت|Duravit)/i, canonical: "دورافيت", rawBrand: "دورافيت" },
    { pattern: /(سيكا|Sika)/i, canonical: "سيكا", rawBrand: "سيكا" },
    { pattern: /(مابى|Mapei)/i, canonical: "مابي", rawBrand: "مابي" },
    { pattern: /(كيما|Kima)/i, canonical: "كيما", rawBrand: "كيما" },
    { pattern: /(أهرام|الاهرام|الأهرام|Ahram)/i, canonical: "الأهرام", rawBrand: "الأهرام" },
    { pattern: /(دورو|Douro|Duru)/i, canonical: "دورو", rawBrand: "دورو" }
  ];

  // Combine learned dynamic rules and standard pre-defined system rules
  const brandRules = [...dynamicRules, ...baseBrandRules];

  return docs.map(doc => {
    if (!doc.items || !Array.isArray(doc.items)) return doc;
    
    const updatedItems = doc.items.map((item: LineItem) => {
      let desc = item.description || "";
      let foundBrand = "";
      
      for (const rule of brandRules) {
        const match = desc.match(rule.pattern);
        if (match) {
          if (!foundBrand) {
            foundBrand = rule.canonical;
          }
          if (rule.rawBrand) {
            const escRaw = rule.rawBrand.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            desc = desc.replace(new RegExp(escRaw, 'gi'), " ");
          } else {
            desc = desc.replace(rule.pattern, " ");
          }
        }
      }
      
      const q = Number(item.quantity) || 0;
      const p = Number(item.unitPrice) || 0;
      const tot = Number((q * p).toFixed(2));

      let clean = desc;
      clean = clean.replace(/[\(\[\{\/]\s*[\)\]\}/]/g, " ");
      clean = clean.replace(/(ماركة|ماركه|براند|نوع|صنع|بجوزا|هوزا|برند)\s+/gi, ' ');
      clean = clean.trim().replace(/\s+/g, ' ');
      clean = clean.replace(/^[-\s,\.\/—\|_]+/, '').replace(/[-\s,\.\/—\|_]+$/, '').trim();
      
      const finalBrand = item.brand && item.brand.trim() !== "" ? item.brand : foundBrand;
      
      return {
        ...item,
        brand: finalBrand || "",
        description: finalBrand ? (clean || desc) : desc,
        quantity: q,
        unitPrice: p,
        total: tot
      };
    });

    const computedTotal = updatedItems.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
    const roundedComputedTotal = Number(computedTotal.toFixed(2));

    return {
      ...doc,
      items: updatedItems,
      totalAmount: roundedComputedTotal
    };
  });
};

export default function App() {
  const [rawDocuments, setRawDocuments] = useState<ProcessedDocument[]>([]);
  const setDocuments = useCallback((val: ProcessedDocument[] | ((prev: ProcessedDocument[]) => ProcessedDocument[])) => {
    setRawDocuments(prev => {
      const resolved = typeof val === 'function' ? val(prev) : val;
      return sanitizeAndExtractBrands(resolved);
    });
  }, []);
  const documents = rawDocuments;
  const isInitialFetchCompleted = useRef(false);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [projectsList, setProjectsList] = useState<string[]>([]);
  const [newProjectInput, setNewProjectInput] = useState<string>('');
  const [suppliersList, setSuppliersList] = useState<string[]>([]);
  const [newSupplierInput, setNewSupplierInput] = useState<string>('');
  const [logoError, setLogoError] = useState<boolean>(false);
  
  // Navigation & Control States
  const [activeTab, setActiveTab] = useState<'spreadsheet' | 'files' | 'projects'>('spreadsheet');
  const [selectedDoc, setSelectedDoc] = useState<ProcessedDocument | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadInstructions, setUploadInstructions] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'po' | 'quote'>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>('');
  const [filterAmount, setFilterAmount] = useState<string>('');
  const [filterWithholdingOnly, setFilterWithholdingOnly] = useState<boolean>(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState<string>('');
  const [selectedFolderProject, setSelectedFolderProject] = useState<string | null>(null);

  // Projects Budget & Spending analytics states
  const [projectSubTab, setProjectSubTab] = useState<'folders' | 'charts' | 'suppliers' | 'units'>('folders');
  const [chartSelectedProject, setChartSelectedProject] = useState<string>('all');
  const [chartSelectedCurrency, setChartSelectedCurrency] = useState<string>('EGP');
  const [chartSelectedDocType, setChartSelectedDocType] = useState<'po' | 'quote' | 'all'>('po');

  // Inline Editing Mode States for Spreadsheet
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [rawEditDocs, setRawEditDocs] = useState<ProcessedDocument[]>([]);
  const setEditDocs = useCallback((val: ProcessedDocument[] | ((prev: ProcessedDocument[]) => ProcessedDocument[])) => {
    setRawEditDocs(prev => {
      const resolved = typeof val === 'function' ? val(prev) : val;
      return sanitizeAndExtractBrands(resolved);
    });
  }, []);
  const editDocs = rawEditDocs;

  // Document Comparison States
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [compareDocAId, setCompareDocAId] = useState<string | null>(null);
  const [compareDocBId, setCompareDocBId] = useState<string | null>(null);
  const [printDirection, setPrintDirection] = useState<'rtl' | 'ltr'>('ltr');
  const [showExcelGrid, setShowExcelGrid] = useState<boolean>(false);
  const [showPrintInstructions, setShowPrintInstructions] = useState<boolean>(false);
  const [isSavingDrawer, setIsSavingDrawer] = useState<boolean>(false);

  // Duplicate upload warning states
  const [duplicateModalOpen, setDuplicateModalOpen] = useState<boolean>(false);
  const [existingDuplicateDoc, setExistingDuplicateDoc] = useState<ProcessedDocument | null>(null);
  const [proposedDuplicateDoc, setProposedDuplicateDoc] = useState<ProcessedDocument | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<boolean>(false);

  // Custom premium modal/dialog states to bypass iframe confirm/prompt browser locks
  const [customProjectDeleteModal, setCustomProjectDeleteModal] = useState<{ isOpen: boolean; projectName: string }>({ isOpen: false, projectName: '' });
  const [customProjectRenameModal, setCustomProjectRenameModal] = useState<{ isOpen: boolean; projectName: string; inputValue: string }>({ isOpen: false, projectName: '', inputValue: '' });
  const [customSupplierDeleteModal, setCustomSupplierDeleteModal] = useState<{ isOpen: boolean; supplierName: string }>({ isOpen: false, supplierName: '' });
  const [customSupplierRenameModal, setCustomSupplierRenameModal] = useState<{ isOpen: boolean; supplierName: string; inputValue: string }>({ isOpen: false, supplierName: '', inputValue: '' });
  const [customUnitRenameModal, setCustomUnitRenameModal] = useState<{ isOpen: boolean; unitName: string; inputValue: string }>({ isOpen: false, unitName: '', inputValue: '' });
  const [customDocDeleteModal, setCustomDocDeleteModal] = useState<{ isOpen: boolean; docId: string }>({ isOpen: false, docId: '' });

  // Decoupled window/tab print routing detection
  const [printDocId, setPrintDocId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('print');
    }
    return null;
  });
  const [printDirectionParam, setPrintDirectionParam] = useState<'rtl' | 'ltr'>(() => {
    if (typeof window !== 'undefined') {
      return (new URLSearchParams(window.location.search).get('dir') as 'rtl' | 'ltr') || 'ltr';
    }
    return 'ltr';
  });
  const [tableAlignment, setTableAlignment] = useState<'center' | 'left' | 'right' | 'auto'>(() => {
    if (typeof window !== 'undefined') {
      return (new URLSearchParams(window.location.search).get('align') as 'center' | 'left' | 'right' | 'auto') || 'center';
    }
    return 'center';
  });
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);

  // States for interactive custom print margins (in milimeters/mm) with default margin of (15mm)
  const [printMarginTop, setPrintMarginTop] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('printMarginTop');
      if (saved !== null) return Number(saved);
    }
    return 15;
  });
  const [printMarginBottom, setPrintMarginBottom] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('printMarginBottom');
      if (saved !== null) return Number(saved);
    }
    return 15;
  });
  const [printMarginLeft, setPrintMarginLeft] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('printMarginLeft');
      if (saved !== null) return Number(saved);
    }
    return 15;
  });
  const [printMarginRight, setPrintMarginRight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('printMarginRight');
      if (saved !== null) return Number(saved);
    }
    return 15;
  });

  // Device Fingerprint & IP Verification States
  const [deviceStatus, setDeviceStatus] = useState<'checking' | 'approved' | 'pending' | 'blocked'>('checking');
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [deviceInfoState, setDeviceInfoState] = useState<string>('');
  const [adminDevices, setAdminDevices] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [isAdminView, setIsAdminView] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const isAdminPath = path === '/admin' || 
                          path === '/admin/' || 
                          path === '/admin-access' || 
                          path.includes('admin-access') || 
                          path === '/admin-secret-access-control' || 
                          path.includes('admin-secret-access-control') ||
                          path === '/override-system-protection' ||
                          path.includes('override-system-protection') ||
                          path === '/device-unblock-portal' ||
                          path.includes('device-unblock-portal') ||
                          path === '/direct-security-access' ||
                          path.includes('direct-security-access') ||
                          params.get('admin') !== null ||
                          params.get('bypass') === 'true' || 
                          params.get('override') === 'true';
      return isAdminPath;
    }
    return false;
  });

  const isUrlAdmin = typeof window !== 'undefined' && (
    window.location.pathname === '/admin' ||
    window.location.pathname === '/admin/' ||
    window.location.pathname.includes('admin-access') ||
    window.location.pathname.includes('admin-secret-access-control') ||
    window.location.pathname.includes('override-system-protection') ||
    window.location.pathname.includes('device-unblock-portal') ||
    window.location.pathname.includes('direct-security-access') ||
    (new URLSearchParams(window.location.search).get('admin') !== null) ||
    (new URLSearchParams(window.location.search).get('bypass') === 'true') || 
    (new URLSearchParams(window.location.search).get('override') === 'true')
  );

  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('admin_authenticated_key') === 'DeltaAdmin2026';
    }
    return false;
  });
  const isSecretAdminView = false;
  const [passwordError, setPasswordError] = useState<string>('');

  // Calculate browser fingerprint without external dependencies
  const getDeviceFingerprint = (): string => {
    try {
      const navigator_info = window.navigator;
      const screen_info = window.screen;
      let uid = navigator_info.userAgent;
      uid += screen_info.height + "x" + screen_info.width + "x" + screen_info.colorDepth;
      uid += navigator_info.language || "";
      uid += new Date().getTimezoneOffset();
      
      let hash = 0;
      for (let i = 0; i < uid.length; i++) {
        const char = uid.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return "dev_" + Math.abs(hash).toString(16);
    } catch (e) {
      return "dev_unknown";
    }
  };

  const getDeviceInfo = (): string => {
    try {
      const ua = navigator.userAgent;
      let deviceName = "Unknown Device";
      if (/android/i.test(ua)) {
        deviceName = "Android Device";
      } else if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
        deviceName = "iOS Device";
      } else if (/Macintosh/i.test(ua)) {
        deviceName = "macOS";
      } else if (/Windows/i.test(ua)) {
        deviceName = "Windows PC";
      } else if (/Linux/i.test(ua)) {
        deviceName = "Linux PC";
      }
      return deviceName;
    } catch (e) {
      return "Device";
    }
  };

  const checkDeviceStatus = async (fp: string, info: string) => {
    try {
      const res = await fetch('/api/device/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: fp, deviceInfo: info })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.device) {
          setDeviceStatus(data.device.status);
        } else {
          setDeviceStatus('pending');
        }
      } else {
        setDeviceStatus('approved'); // Graceful fallback
      }
    } catch (err) {
      console.error('Error checking device status:', err);
      setDeviceStatus('approved'); // Graceful fallback
    }
  };

  const fetchAdminDevices = async () => {
    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin/devices');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAdminDevices(data.devices || []);
        }
      }
    } catch (err) {
      console.error('Error fetching admin devices:', err);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleUpdateDeviceStatus = async (fp: string, status: 'approved' | 'blocked' | 'pending') => {
    try {
      const res = await fetch('/api/admin/devices/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: fp, status })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Update locally
          setAdminDevices(prev => prev.map(d => d.device_fingerprint === fp ? { ...d, status } : d));
          // If we are updating our own device, sync state
          if (fp === deviceFingerprint) {
            setDeviceStatus(status);
          }
        }
      }
    } catch (err) {
      console.error('Error updating device status:', err);
    }
  };

  const handleApproveMyCurrentDevice = async () => {
    if (!isAdminAuthenticated) {
      alert('غير مصرح! يجب تسجيل الدخول كمسؤول أولاً باستخدام كلمة المرور.');
      return;
    }
    try {
      // Approve both dev_7ae2a0cd and current calculated deviceFingerprint
      await fetch('/api/admin/devices/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: 'dev_7ae2a0cd', status: 'approved' })
      });

      if (deviceFingerprint && deviceFingerprint !== 'dev_7ae2a0cd') {
        await fetch('/api/admin/devices/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fingerprint: deviceFingerprint, status: 'approved' })
        });
      }

      setDeviceStatus('approved');
      alert('تم اعتماد جهازي الحالي كمسؤول فوراً بنجاح! تم تحديث الحالة في قاعدة البيانات.');
      fetchAdminDevices();
    } catch (err) {
      console.error('Error approving current device:', err);
      alert('حدث خطأ أثناء محاولة اعتماد الجهاز.');
    }
  };

  // Perform device check on load
  useEffect(() => {
    const fp = getDeviceFingerprint();
    const info = getDeviceInfo();
    setDeviceFingerprint(fp);
    setDeviceInfoState(info);
    
    // Check device status
    checkDeviceStatus(fp, info);
    
    // If we're on the admin page (and authenticated), load the device table
    if (isAdminView && isAdminAuthenticated) {
      fetchAdminDevices();
    }
  }, [isAdminView, isAdminAuthenticated]);

  // Sync print margins to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('printMarginTop', String(printMarginTop));
      localStorage.setItem('printMarginBottom', String(printMarginBottom));
      localStorage.setItem('printMarginLeft', String(printMarginLeft));
      localStorage.setItem('printMarginRight', String(printMarginRight));
    }
  }, [printMarginTop, printMarginBottom, printMarginLeft, printMarginRight]);

  // States for Local Storage Data Retention & Sync Backup
  const [hasBackupToRestore, setHasBackupToRestore] = useState<boolean>(false);
  const [backupCount, setBackupCount] = useState<number>(0);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);

  // Local interactive sound/ping settings
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [showNotificationToast, setShowNotificationToast] = useState<AppNotification | null>(null);

  // References for file uploads
  const dashboardFileInputRef = useRef<HTMLInputElement>(null);

  // Keep track of total document count to trigger local screen notifications on addition
  const lastDocCountRef = useRef<number | null>(null);

  // 1. Initial State Fetch and Continual Polling
  const fetchData = async (isPoll = false) => {
    let res: Response | null = null;
    let attempt = 0;
    const maxAttempts = isPoll ? 1 : 5;

    while (attempt < maxAttempts) {
      try {
        if (!isPoll && attempt === 0) setLoading(true);
        res = await fetch('/api/documents');
        if (res.ok) {
          break;
        }
      } catch (e) {
        console.warn(`Fetch attempt ${attempt + 1} failed:`, e);
      }
      attempt++;
      if (attempt < maxAttempts) {
        // Wait 1.5 seconds between initial attempts to let container boot
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    try {
      if (!res || !res.ok) throw new Error('فشل جلب البيانات من الخادم');
      const data = await res.json();
      
      setDocuments(data.documents || []);
      setNotifications(data.notifications || []);
      setProjectsList(data.projects || []);
      setSuppliersList(data.suppliers || []);
      isInitialFetchCompleted.current = true;
 
      // Trigger instant audio notification if new documents are received in background (polling)
      if (lastDocCountRef.current !== null && (data.documents?.length || 0) > lastDocCountRef.current) {
        const latestDoc = data.documents[0];
        const newNotif: AppNotification = {
          id: `toast_${Date.now()}`,
          type: 'success',
          title: 'تم استلام مستند جديد تلقائياً!',
          message: `وصول ${latestDoc.docType === 'po' ? 'أمر شراء' : 'عرض سعر'} من المورد "${latestDoc.clientName}" بقيمة ${latestDoc.totalAmount} ${latestDoc.currency}`,
          timestamp: new Date().toISOString(),
          read: false
        };
 
        setShowNotificationToast(newNotif);
        setTimeout(() => setShowNotificationToast(null), 7000);
 
        if (audioEnabled) {
          try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = context.createOscillator();
            const gain = context.createGain();
            osc.connect(gain);
            gain.connect(context.destination);
            osc.frequency.setValueAtTime(587.33, context.currentTime); // D5 note
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.15, context.currentTime);
            osc.start();
            osc.stop(context.currentTime + 0.15);
            setTimeout(() => {
              const osc2 = context.createOscillator();
              const gain2 = context.createGain();
              osc2.connect(gain2);
              gain2.connect(context.destination);
              osc2.frequency.setValueAtTime(880, context.currentTime); // A5 note
              osc2.type = 'sine';
              gain2.gain.setValueAtTime(0.15, context.currentTime);
              osc2.start();
              osc2.stop(context.currentTime + 0.3);
            }, 150);
          } catch (e) {
            console.log("Audio feedback blocker active:", e);
          }
        }
      }
 
      lastDocCountRef.current = data.documents?.length || 0;
      setErrorMsg(null);
    } catch (err: any) {
      console.error(err);
      if (!isPoll) setErrorMsg('خطأ في الاتصال بالخادم. تأكد من تشغيل Express Backend.');
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  const handleAddProject = async (projectName: string) => {
    if (!projectName || !projectName.trim()) return;
    try {
      const res = await fetch('/api/projects/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.projects) {
          setProjectsList(data.projects);
        }
      }
    } catch (err) {
      console.error('Error adding project:', err);
    }
  };

  const handleRenameProject = async (oldName: string, newName: string) => {
    if (!oldName || !newName || !newName.trim()) return;
    try {
      setLoading(true);
      const res = await fetch('/api/projects/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName: newName.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.projects) {
          setProjectsList(data.projects);
          if (selectedFolderProject === oldName) {
            setSelectedFolderProject(newName.trim());
          }
          await fetchData(false);
          triggerNotificationToast('success', 'تم تعديل اسم المشروع بنجاح', `تم تعديل "${oldName}" إلى "${newName.trim()}" وتحديث كافة الوثائق بنصيبها`);
        }
      } else {
        const errorData = await res.json();
        triggerNotificationToast('error', 'فشل تعديل الاسم', errorData.error || 'فشل تعديل اسم المشروع');
      }
    } catch (err) {
      console.error('Error renaming project:', err);
      triggerNotificationToast('error', 'خطأ في الاتصال بالخادم', 'فشل تعديل الاسم بسبب خطأ تقني في الشبكة');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameSupplier = async (oldName: string, newName: string) => {
    if (!oldName || !newName || !newName.trim()) return;
    try {
      setLoading(true);
      const res = await fetch('/api/suppliers/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName: newName.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.suppliers) {
          setSuppliersList(data.suppliers);
          await fetchData(false);
          triggerNotificationToast('success', 'تم تعديل اسم المورد بنجاح', `تم تعديل "${oldName}" إلى "${newName.trim()}"`);
        }
      } else {
        const errorData = await res.json();
        triggerNotificationToast('error', 'فشل تعديل الاسم', errorData.error || 'فشل تعديل اسم المورد');
      }
    } catch (err) {
      console.error('Error renaming supplier:', err);
      triggerNotificationToast('error', 'خطأ في الاتصال بالخادم', 'فشل تعديل الاسم بسبب خطأ تقني في الشبكة');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = async (supplierName: string, deleteDocuments: boolean = false) => {
    if (!supplierName) return;
    try {
      setLoading(true);
      const res = await fetch('/api/suppliers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: supplierName, deleteDocuments })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.suppliers) {
          setSuppliersList(data.suppliers);
          await fetchData(false);
          triggerNotificationToast('success', 'تم حذف المورد بنجاح', `تم إزالة المورد "${supplierName}" وتحديث الوثائق بنجاح.`);
        }
      } else {
        const errorData = await res.json();
        triggerNotificationToast('error', 'فشل حذف المورد', errorData.error || 'فشل حذف المورد');
      }
    } catch (err) {
      console.error('Error deleting supplier:', err);
      triggerNotificationToast('error', 'خطأ في الاتصال بالخادم', 'فشل عملية حذف المورد');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameUnit = async (oldName: string, newName: string) => {
    if (!oldName || !newName || !newName.trim()) return;
    try {
      setLoading(true);
      const res = await fetch('/api/units/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName: newName.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        await fetchData(false);
        triggerNotificationToast('success', 'تم تعديل اسم الوحدة بنجاح', `تم تعديل "${oldName}" إلى "${newName.trim()}" في ${data.updatedCount || 0} بنود.`);
      } else {
        const errorData = await res.json();
        triggerNotificationToast('error', 'فشل تعديل اسم الوحدة', errorData.error || 'خطأ أثناء المعالجة');
      }
    } catch (err) {
      console.error('Error renaming unit:', err);
      triggerNotificationToast('error', 'خطأ في الاتصال بالخادم', 'فشل عملية تعديل اسم الوحدة');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectName: string, deleteDocuments: boolean = false, bypassConfirm: boolean = false) => {
    if (!projectName) return;
    if (!bypassConfirm) {
      const confirmMsg = deleteDocuments 
        ? `هل أنت متأكد تماماً من حذف مشروع "${projectName}" وحذف جميع ملفاته ومستنداته المرفقة بشكل نهائي؟` 
        : `هل تريد إزالة مشروع "${projectName}" من قائمة المراجع وتحويل جميع معاملاته ومستنداته المسجلة إلى مشروع "عام"؟`;
      
      if (!window.confirm(confirmMsg)) return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/projects/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, deleteDocuments })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.projects) {
          setProjectsList(data.projects);
          if (selectedFolderProject === projectName) {
            setSelectedFolderProject(null);
          }
          await fetchData(false);
          triggerNotificationToast('success', 'تم حذف المشروع بنجاح', `تم إزالة مشروع "${projectName}" من قائمة المراجع وتحديث الوثائق بنجاح.`);
        }
      } else {
        const errorData = await res.json();
        triggerNotificationToast('error', 'فشل حذف المشروع', errorData.error || 'يرجى مراجعة إدارة العمليات');
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      triggerNotificationToast('error', 'خطأ في الاتصال بالخادم', 'فشل حذف المشروع بسبب عطل بالاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = async (supplierName: string) => {
    if (!supplierName || !supplierName.trim()) return;
    try {
      const res = await fetch('/api/suppliers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: supplierName.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.suppliers) {
          setSuppliersList(data.suppliers);
        }
      }
    } catch (err) {
      console.error('Error adding supplier:', err);
    }
  };

  useEffect(() => {
    fetchData();

    // Poll the backend API every 4 seconds for real-time file arrival notifications!
    const interval = setInterval(() => {
      fetchData(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [audioEnabled]);

  // Handle iframe sandbox inspection for print notices
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsInIframe(window.self !== window.top);
    }
  }, []);

  // Reactive backups to localStorage to prevent data loss across server restarts/container deletions
  useEffect(() => {
    if (!loading && isInitialFetchCompleted.current) {
      if (rawDocuments.length === 0 && hasBackupToRestore) {
        return;
      }
      localStorage.setItem('delta_documents_backup', JSON.stringify(rawDocuments));
    }
  }, [loading, rawDocuments, hasBackupToRestore]);

  useEffect(() => {
    if (projectsList && projectsList.length > 0) {
      localStorage.setItem('delta_projects_backup', JSON.stringify(projectsList));
    }
  }, [projectsList]);

  useEffect(() => {
    if (suppliersList && suppliersList.length > 0) {
      localStorage.setItem('delta_suppliers_backup', JSON.stringify(suppliersList));
    }
  }, [suppliersList]);

  // Proactive check to detect if server database list is empty but browser has a local backup ready
  useEffect(() => {
    if (!loading && documents && documents.length === 0) {
      try {
        const localData = localStorage.getItem('delta_documents_backup');
        if (localData) {
          const parsed = JSON.parse(localData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setHasBackupToRestore(true);
            setBackupCount(parsed.length);
          }
        }
      } catch (e) {
        console.warn("Could not parse delta_documents_backup:", e);
      }
    } else if (documents && documents.length > 0) {
      setHasBackupToRestore(false);
    }
  }, [loading, documents]);

  // Bulk restore engine to merge and push local backup list up to the active server
  const handleRestoreFromBackup = async () => {
    try {
      const localData = localStorage.getItem('delta_documents_backup');
      const localProj = localStorage.getItem('delta_projects_backup');
      const localSupp = localStorage.getItem('delta_suppliers_backup');
      
      let docsToRestore = [];
      if (localData) {
        docsToRestore = JSON.parse(localData);
      }

      if (docsToRestore.length === 0) {
        alert("عذراً، لا تتوفر أية سجلات لتاريخ المعالجة بالنسخة الاحتياطية.");
        return;
      }

      setLoading(true);
      
      // Update the empty main server database with the complete backup records array
      const res = await fetch('/api/documents/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: docsToRestore })
      });

      if (res.ok) {
        // Sequentially restore learned projects and suppliers list as well
        if (localProj) {
          try {
            const projs = JSON.parse(localProj);
            if (Array.isArray(projs)) {
              for (const p of projs) {
                await handleAddProject(p);
              }
            }
          } catch {}
        }
        if (localSupp) {
          try {
            const supps = JSON.parse(localSupp);
            if (Array.isArray(supps)) {
              for (const s of supps) {
                await handleAddSupplier(s);
              }
            }
          } catch {}
        }

        triggerNotificationToast(
          'success',
          'تم استعادة أرشيف البيانات بكامل تفاصيله! 📂',
          `تمت مزامنة واسترجاع عدد (${docsToRestore.length}) مستندات تالفة وإعادتها لقاعدة بيانات النظام تلقائياً وبنجاح.`
        );
        fetchData();
      } else {
        throw new Error('فشلت المزامنة من خادم Cloud Run.');
      }
    } catch (e: any) {
      alert("عذراً، واجهنا مشكلة أثناء استعادة البيانات المحلية: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Initialize draft spreadsheet values when editing mode toggled
  useEffect(() => {
    if (isEditing) {
      setEditDocs(JSON.parse(JSON.stringify(documents)));
    }
  }, [isEditing, documents]);

  const [expectedPoNumbers, setExpectedPoNumbers] = useState<{ [key: string]: string }>({});

  const fetchNextPoNumber = async (projectName: string) => {
    if (!projectName) return null;
    try {
      const res = await fetch(`/api/projects/next-po-number?projectName=${encodeURIComponent(projectName)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.nextPoNumber) {
          setExpectedPoNumbers(prev => ({
            ...prev,
            [projectName]: data.nextPoNumber
          }));
          return data.nextPoNumber as string;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch next PO number:", err);
    }
    return null;
  };

  // Get the next auto-incremented PO number for a project (e.g. if previous is 11, next is 12)
  const getNextPoNumberForProject = (projName: string, docsList = documents) => {
    const cleanProj = projName?.trim() || 'عام';
    const projectPos = docsList.filter(
      d => d.docType === 'po' && (d.projectName?.trim() || 'عام') === cleanProj
    );
    
    let maxNum = 0;
    projectPos.forEach(d => {
      if (d.docNumber) {
        const cleanStr = d.docNumber.replace(/[^\d]/g, '');
        const num = parseInt(cleanStr, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    if (maxNum > 0) {
      return maxNum + 1;
    }

    // إذا كان هذا هو أول PO يتم إنشاؤه للمشروع على الإطلاق، يبدأ الترقيم تلقائياً من رقم 1.
    return 1;
  };

  // Get style for due dates based on closeness to today
  const getDueDateWarningStyle = (dueDateStr?: string) => {
    if (!dueDateStr) return "text-slate-400 italic";
    const due = new Date(dueDateStr);
    if (isNaN(due.getTime())) return "text-slate-400";
    const now = new Date();
    // Reset hours to compare purely by days/hours
    const diffMs = due.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 0) {
      return "text-rose-600 bg-rose-50 border border-rose-150 px-2 py-0.5 rounded-md font-bold text-[10px]";
    }
    if (diffHours <= 48) {
      return "text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-extrabold text-[10px] animate-pulse";
    }
    return "text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md font-medium text-[10px]";
  };

  // Get list of unique projects dynamically
  const uniqueProjects = useMemo(() => {
    const list = documents.map(d => d.projectName?.trim()).filter(Boolean);
    const combined = [...projectsList, ...list];
    const unique = Array.from(new Set(combined)).map(p => p.trim()).filter(Boolean);
    // Remove 'عام' if present so we can manually add it to start
    const cleanUnique = unique.filter(p => p !== 'عام');
    cleanUnique.unshift('عام');
    return cleanUnique;
  }, [projectsList, documents]);

  // Self-learning values loaded dynamically from all documents and items
  const uniqueClientsList = useMemo(() => {
    const list = documents.map(d => d.clientName?.trim()).filter(Boolean);
    const combined = [...suppliersList, ...list];
    return Array.from(new Set(combined)).map(s => s.trim()).filter(Boolean);
  }, [suppliersList, documents]);

  const uniqueItemNames = useMemo(() => {
    const list: string[] = [];
    documents.forEach(d => {
      d.items?.forEach(item => {
        if (item.description?.trim()) list.push(item.description.trim());
      });
    });
    return Array.from(new Set(list));
  }, [documents]);

  const uniqueItemBrands = useMemo(() => {
    const list: string[] = ["اليزية", "اليزيه", "Elysee"];
    documents.forEach(d => {
      d.items?.forEach(item => {
        if (item.brand?.trim()) list.push(item.brand.trim());
      });
    });
    return Array.from(new Set(list));
  }, [documents]);

  const uniqueItemUnits = useMemo(() => {
    const defaultUnits = ["عدد", "متر", "طن", "كغم", "متر مربع", "متر مكعب", "ساعة", "يوم"];
    const list: string[] = [...defaultUnits];
    documents.forEach(d => {
      d.items?.forEach(item => {
        let u = item.unit?.trim();
        if (u) {
          if (u === 'عئد' || u === 'عئد.' || u.includes('عئد')) {
            u = 'عدد';
          }
          list.push(u);
        }
      });
    });
    return Array.from(new Set(list)).filter(Boolean);
  }, [documents]);

  const unitUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach(d => {
      d.items?.forEach(item => {
        let u = item.unit?.trim();
        if (u) {
          if (u === 'عئد' || u === 'عئد.' || u.includes('عئد')) {
            u = 'عدد';
          }
          counts[u] = (counts[u] || 0) + 1;
        }
      });
    });
    return counts;
  }, [documents]);

  // 2. Calculated Dashboard Statistics
  const stats: AppStats = useMemo(() => {
    const uniqueClients = new Set(documents.map(d => d.clientName.trim()));
    
    // Sum by currency (EGP, USD, SAR, etc.)
    const currencyTotals: Record<string, number> = {};
    documents.forEach(doc => {
      if (doc.status === 'processed') {
        const c = doc.currency || 'EGP';
        currencyTotals[c] = (currencyTotals[c] || 0) + doc.totalAmount;
      }
    });

    return {
      totalProcessedCount: documents.length,
      uniqueClientCount: uniqueClients.size,
      totalValueByCurrency: currencyTotals,
      latestDocumentDate: documents.length > 0 ? documents[0].receiptDate : null
    };
  }, [documents]);

  // Filter spreadsheet rows dynamically based on Supplier name, Receipt Date, Amount & Withholding Tax, item names & unit prices
  const filteredDocs = useMemo(() => {
    const normSearch = normalizeArabic(searchTerm);
    const normFilterClient = normalizeArabic(filterClient);
    return (isEditing ? editDocs : documents).filter(doc => {
      const matchSearch = normSearch === '' ? true : (
        normalizeArabic(doc.clientName).includes(normSearch) ||
        normalizeArabic(doc.docNumber).includes(normSearch) ||
        normalizeArabic(doc.projectName).includes(normSearch) ||
        (doc.summary && normalizeArabic(doc.summary).includes(normSearch)) ||
        doc.receiptDate.includes(searchTerm) ||
        (doc.items && doc.items.some(item => 
          normalizeArabic(item.description).includes(normSearch) ||
          normalizeArabic(item.brand).includes(normSearch) ||
          (item.unitPrice && item.unitPrice.toString().includes(searchTerm)) ||
          (item.total && item.total.toString().includes(searchTerm))
        ))
      );
      
      const matchType = 
        typeFilter === 'all' ? true : doc.docType === typeFilter;

      const matchFilterDate = filterDate.trim() === '' ? true : (
        doc.receiptDate.includes(filterDate) || (doc.dueDate && doc.dueDate.includes(filterDate))
      );

      const matchFilterClient = normFilterClient === '' ? true : (
        normalizeArabic(doc.clientName).includes(normFilterClient)
      );

      const matchFilterAmount = filterAmount.trim() === '' ? true : (
        doc.totalAmount.toString().includes(filterAmount) || 
        (doc.totalAmount - (doc.withholdingTaxEnabled ? (doc.totalAmount * (doc.withholdingTaxRate || 1)) / 100 : 0)).toString().includes(filterAmount)
      );

      const matchWithholding = filterWithholdingOnly ? !!doc.withholdingTaxEnabled : true;

      return matchSearch && matchType && matchFilterDate && matchFilterClient && matchFilterAmount && matchWithholding;
    });
  }, [documents, editDocs, isEditing, searchTerm, typeFilter, filterDate, filterClient, filterAmount, filterWithholdingOnly]);

  // 3. Document Action Handlers
  
  // Direct file drag-and-drop dashboard portal
  const handleDirectFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);
    if (uploadInstructions && uploadInstructions.trim() !== '') {
      formData.append('instructions', uploadInstructions.trim());
    }

    setUploading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        body: formData
      });
      
      let data: any = {};
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text || `استجابة غير صحيحة من الخادم (رمز ${res.status})`);
      }
      
      if (!res.ok) throw new Error(data.error || 'عذراً، فشل رفع وتحليل المستند');
      
      // Clear instructions on success
      setUploadInstructions('');
      
      if (data.duplicateDetected) {
        setExistingDuplicateDoc(data.existingDocument);
        setProposedDuplicateDoc(data.proposedDocument);
        setDuplicateModalOpen(true);
        setUploading(false);
        return;
      }

      if (data.document?.extractionFailed) {
        triggerNotificationToast(
          'info',
          'تم الرفع كمسودة يدوية ⚠️',
          'قنوات الذكاء الاصطناعي مشغولة حالياً، تم إنشاء مسودة للمستند لتمكينك من إدخال وتعديل البنود يدوياً دون توقف العمل.'
        );
      } else {
        triggerNotificationToast(
          'success',
          'تم الرفع وتصنيف البنود بنجاح ✨',
          `تم جلب بيانات المستند وتصنيفه لـ "${data.document?.clientName || ''}" بنجاح.`
        );
      }
      
      fetchData();
    } catch (err: any) {
      console.error("File upload failed:", err);
      setErrorMsg(err.message);
      triggerNotificationToast(
        'error',
        'فشل رفع وتحليل المستند ❌',
        err.message || 'حدث خطأ غير متوقع أثناء المعالجة سحابياً.'
      );
      alert(`عذراً، حدث خطأ أثناء محاولة رفع ومعالجة الملف:\n${err.message}`);
    } finally {
      setUploading(false);
      if (dashboardFileInputRef.current) dashboardFileInputRef.current.value = '';
    }
  };

  // Confirm potential duplicate upload action
  const handleConfirmDuplicateAction = async (action: 'proceed' | 'merge') => {
    setConfirmingAction(true);
    try {
      const res = await fetch('/api/upload/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          proposedDocument: proposedDuplicateDoc,
          existingId: existingDuplicateDoc?.id
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'فشلت معالجة الطلب');
      }

      triggerNotificationToast(
        'success',
        action === 'merge' ? 'تم دمج البنود بنجاح 🔗' : 'تم رفع المستند المكرر بنجاح 📂',
        action === 'merge' 
          ? `تمت إضافة بنود المستند الجديد للمستند الحالي للمورد "${existingDuplicateDoc?.clientName}" وتحديث الإجمالي.`
          : `تم حفظ المستند الجديد كنسخة مكررة بنجاح.`
      );

      setDuplicateModalOpen(false);
      setExistingDuplicateDoc(null);
      setProposedDuplicateDoc(null);
      fetchData();
    } catch (err: any) {
      alert(`خطأ: ${err.message}`);
    } finally {
      setConfirmingAction(false);
    }
  };

  // Delete document record
  const handleDeleteDoc = async (id: string, event?: any, bypassConfirm: boolean = false) => {
    if (event) event.stopPropagation();
    if (!bypassConfirm) {
      if (!confirm('هل أنت متأكد من حذف هذا السجل والمستند نهائياً؟')) return;
    }

    const remaining = documents.filter(d => d.id !== id);
    try {
      const res = await fetch('/api/documents/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: remaining })
      });
      if (res.ok) {
        setDocuments(remaining);
        if (isEditing) {
          setEditDocs(remaining);
        }
        if (selectedDoc?.id === id) setSelectedDoc(null);
        triggerNotificationToast('success', 'تم حذف السجل بنجاح', 'تم إزالة البند وتحديث الملفات النشطة على الفور.');
      } else {
        triggerNotificationToast('error', 'فشل الحذف', 'الخادم لم يرخص عملية الحذف في الوقت الحالي.');
      }
    } catch (e) {
      triggerNotificationToast('error', 'خطأ في الشبكة', 'فشل الاتصال بالخادم لحذف السجل.');
    }
  };

  // Inline grid edits saver
  const handleSaveSpreadsheetEdits = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/documents/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: editDocs })
      });
      
      if (res.ok) {
        setDocuments(editDocs);
        setIsEditing(false);
        triggerNotificationToast('success', 'تم حفظ التعديلات بنجاح', 'تم تسجيل كافة البنود وتحديث البيانات');
      } else {
        throw new Error('فشل الحفظ');
      }
    } catch (e: any) {
      alert('فشل حفظ التعديلات على شيت الإكسيل: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Add arbitrary manual blank row to editor
  const handleAddManualRow = () => {
    const today = new Date().toISOString().split('T')[0];
    const nextPoNum = getNextPoNumberForProject('عام', documents);
    const newRow: ProcessedDocument = {
      id: `doc_manual_${Date.now()}`,
      clientName: 'مورد جديد يدوي',
      projectName: 'عام',
      shipToAddress: 'عام',
      receiptDate: today,
      docType: 'po',
      docNumber: String(nextPoNum),
      items: [{ description: 'خدمة/بند افتراضي', quantity: 1, unitPrice: 0, total: 0 }],
      totalAmount: 0,
      currency: 'EGP',
      originalFilename: 'إدخال يدوي مباشر',
      classifiedPath: '',
      status: 'processed',
      processedAt: new Date().toISOString(),
      telegramUser: null,
      summary: 'بند مدخل يدوياً من الشيت البديل',
      notes: '',
      projectStatus: 'in_progress'
    };

    if (isEditing) {
      setEditDocs([newRow, ...editDocs]);
    } else {
      const updated = [newRow, ...documents];
      setDocuments(updated);
      setIsEditing(true);
      setEditDocs([newRow, ...documents]);
    }
  };

  // Trigger local utility toast
  const triggerNotificationToast = (type: 'success' | 'info' | 'error', title: string, message: string) => {
    const notif: AppNotification = {
      id: `toast_${Date.now()}`,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false
    };
    setShowNotificationToast(notif);
    setTimeout(() => setShowNotificationToast(null), 5000);
  };

  // Clean and download physical file safely within iframe sandbox
  const triggerFileDownload = async (doc: ProcessedDocument) => {
    if (!doc.classifiedPath) {
      alert('هذا البند لا يحتوي على مستند مادي مرتبط (إدخال يدوي).');
      return;
    }
    try {
      const downloadUrl = `/api/documents/download?path=${encodeURIComponent(doc.classifiedPath)}`;
      // Fetch through our server-side proxy (same-origin) to avoid iframe download blocks & CORS
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error('فشل تحميل الملف من الخادم');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extract a safe filename
      let filename = "document.pdf";
      try {
        const urlObj = new URL(doc.classifiedPath);
        filename = urlObj.pathname.split('/').pop() || "document.pdf";
      } catch {
        filename = doc.classifiedPath.split('/').pop() || "document.pdf";
      }
      if (!filename.toLowerCase().endsWith('.pdf') && !filename.toLowerCase().endsWith('.png') && !filename.toLowerCase().endsWith('.jpg') && !filename.toLowerCase().endsWith('.jpeg') && !filename.toLowerCase().endsWith('.docx') && !filename.toLowerCase().endsWith('.xlsx')) {
        filename += '.pdf'; // Default fallback
      }
      
      a.download = decodeURIComponent(filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Iframe-safe direct blob download failed, falling back to window.open:", err);
      window.open(`/api/documents/download?path=${encodeURIComponent(doc.classifiedPath)}`, '_blank');
    }
  };

  // Export spreadsheet using xlsx compiled helper
  const handleExportToExcel = () => {
    if (documents.length === 0) {
      alert('لا توجد بيانات متاحة للتصدير حالياً.');
      return;
    }

    const dataToExport = filteredDocs.map((doc, idx) => {
      return {
        "م": idx + 1,
        "اسم المشروع": doc.projectName || "عام",
        "اسم المورد": doc.clientName,
        "تاريخ الاستلام": doc.receiptDate,
        "تاريخ الاستحقاق": doc.dueDate || "—",
        "نوع المستند": doc.docType === 'po' ? 'أمر شراء (PO)' : doc.docType === 'quote' ? 'عرض سعر (Quote)' : 'غير معروف',
        "رقم مرجعي": doc.docNumber,
        "المبلغ الإجمالي": doc.totalAmount,
        "العملة": doc.currency,
        "ملخص المستند": doc.summary || doc.notes || '',
        "تاريخ المعالجة بالذكاء الاصطناعي": new Date(doc.processedAt).toLocaleString('ar-EG'),
        "حالة الملف": doc.status === 'processed' ? 'مكتمل ومصنف' : 'قيد الانتظار',
        "المستقبل": 'رفع مباشر'
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "شيت الفواتير وعروض الأسعار");
    
    // Set column sizing for readable layouts
    ws['!cols'] = [
      { wch: 6 },   // م
      { wch: 25 },  // اسم المشروع
      { wch: 25 },  // اسم المورد
      { wch: 15 },  // تاريخ الاستلام
      { wch: 15 },  // تاريخ الاستحقاق
      { wch: 20 },  // نوع المستند
      { wch: 15 },  // رقم مرجعي
      { wch: 18 },  // المبلغ الإجمالي
      { wch: 10 },  // العملة
      { wch: 45 },  // ملخص المستند
      { wch: 25 },  // تاريخ المعالجة بالذكاء الاصطناعي
      { wch: 18 },  // حالة الملف
      { wch: 15 }   // المستقبل
    ];

    // Auto-apply gorgeous styling to each cell in the worksheet
    for (const cellRef in ws) {
      if (cellRef.startsWith('!')) continue;
      const cell = ws[cellRef];
      if (!cell) continue;

      const match = cellRef.match(/^([A-Z]+)([0-9]+)$/);
      if (!match) continue;
      const colStr = match[1];
      const rowStr = match[2];
      const r = parseInt(rowStr) - 1; // 0-indexed row

      if (r === 0) {
        // Styled Table Headers
        // @ts-ignore
        cell.s = {
          font: { name: "Segoe UI", sz: 10.5, bold: true, color: { rgb: "FFFFFF" } },
          fill: { patternType: "solid", fgColor: { rgb: "0284C7" } }, // Bright modern theme matching web UI
          alignment: { horizontal: "center", vertical: "center", wrapText: true },
          border: {
            top: { style: "thin", color: { rgb: "0284C7" } },
            bottom: { style: "medium", color: { rgb: "0284C7" } },
            left: { style: "thin", color: { rgb: "CBD5E1" } },
            right: { style: "thin", color: { rgb: "CBD5E1" } }
          }
        };
      } else {
        // Table body rows styling with alternating light gray/white background
        const isOdd = r % 2 !== 0;
        const bgRgb = isOdd ? "F8FAFC" : "FFFFFF";
        let cellColor = "1E293B"; // Default slate text
        const isTotalCol = colStr === 'H';

        if (isTotalCol) {
          cellColor = "0F172A"; // Darker for total
        }

        // @ts-ignore
        cell.s = {
          font: { name: "Segoe UI", sz: 10, bold: isTotalCol, color: { rgb: cellColor } },
          fill: { patternType: "solid", fgColor: { rgb: bgRgb } },
          alignment: { 
            horizontal: (colStr === 'B' || colStr === 'C' || colStr === 'J') ? "right" : "center", 
            vertical: "center" 
          },
          border: {
            top: { style: "thin", color: { rgb: "E2E8F0" } },
            bottom: { style: "thin", color: { rgb: "E2E8F0" } },
            left: { style: "thin", color: { rgb: "E2E8F0" } },
            right: { style: "thin", color: { rgb: "E2E8F0" } }
          }
        };

        // Number format for Amount (H)
        if (isTotalCol) {
          cell.z = "#,##0.00";
        }
      }
    }

    XLSX.writeFile(wb, "سجل_أوامر_الشراء_وعروض_الأسعار_المصنف.xlsx");
    triggerNotificationToast('success', 'اكتمل تصدير الملف', 'تم تصدير ملف الإكسيل التفاعلي وتحميله بنجاح!');
  };

  // Convert Gregorian YYYY-MM-DD to Arabic Slash D/M/YYYY
  const formatDateToArabicSlash = (dateStr: string) => {
    if (!dateStr) return "24/9/2025";
    try {
      const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
      if (parts.length === 3) {
        // if already D/M/YYYY, return it
        if (dateStr.includes('/')) return dateStr;
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]);
        const d = parseInt(parts[2]);
        return `${d}/${m}/${y}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const transliteratedArabic = (text: string): string => {
    const charMap: { [key: string]: string } = {
      'أ': 'a', 'إ': 'a', 'آ': 'a', 'ا': 'a',
      'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
      'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
      'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh',
      'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
      'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'y', 'ة': 'h', 'ئ': 'y',
      'ء': 'a', 'ؤ': 'w', 'لا': 'la'
    };
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (charMap[char] !== undefined) {
        result += charMap[char];
      } else {
        result += char;
      }
    }
    return result;
  };

   const sanitizeStorageName = (name: any): string => {
    if (!name) return 'unnamed';
    const nameStr = name.toString().trim();
    const cleanStr = transliteratedArabic(nameStr);
    let sanitized = cleanStr
      .replace(/[\s_/\-\\–—]+/g, '-') // تحويل المسافات والعواض المزدوجة إلى عارضة مفردة
      .replace(/[^a-zA-Z0-9\-]/g, '') // الحفاظ فقط على الحروف والأرقام والعواض الإنجليزية النظيفة لمنع مشاكل الـ Invalid key
      .replace(/-+/g, '-') // منع تكرار العوارض المتتالية
      .replace(/^-+|-+$/g, ''); // إزالة العوارض الطرفية
      
    if (!sanitized) {
      // Fallback to hex characters to maintain valid ASCII
      let hex = '';
      for (let i = 0; i < Math.min(nameStr.length, 8); i++) {
        hex += nameStr.charCodeAt(i).toString(16);
      }
      sanitized = hex.substring(0, 8);
    }
    return sanitized || 'unnamed';
  };

  // Export selected purchase order / document to matching DELTA Excel template structure
  const generateDeltaExcelWorkbook = (doc: ProcessedDocument): any => {
    try {
      const isQuote = doc.docType === 'quote';
      const itemsCount = Math.max(doc.items?.length || 0, 5);
      
      const itemsSubtotal = (doc.items || []).reduce((sum, item) => sum + Number(((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)), 0);
      const discPct = doc.discountPercentage || 0;
      const discAmt = doc.discountAmount || 0;
      const pctDiscountVal = (itemsSubtotal * discPct) / 100;
      const flatDiscountVal = discAmt;
      const totalDiscount = pctDiscountVal + flatDiscountVal;
      const finalTotalAmount = Math.max(0, itemsSubtotal - totalDiscount);

      let discountOffset = 0;
      if (discPct > 0 || discAmt > 0) {
        discountOffset = 1 + (discPct > 0 ? 1 : 0) + (discAmt > 0 ? 1 : 0);
      }

      const taxOffset = doc.withholdingTaxEnabled ? 2 : 0;
      const totalRowIdx = 8 + itemsCount;
      const termsStart = totalRowIdx + 2 + discountOffset + taxOffset;
      const sigHeadersRowIdx = totalRowIdx + 12 + discountOffset + taxOffset;
      const sigNamesRowIdx = totalRowIdx + 13 + discountOffset + taxOffset;
      const totalRowsCount = sigNamesRowIdx + 3;

      const rows: any[][] = [];
      for (let i = 0; i < totalRowsCount; i++) {
        rows[i] = Array(7).fill(""); // columns A to G (0 to 6)
      }

      // 1. Title Banner BLOCK
      rows[1][0] = "DELTA";
      rows[1][6] = "PURCHASE";
      rows[2][0] = "FOR ROAD CONSTRUCTION";
      rows[2][6] = "ORDER";

      // 2. Metadata Labels Headers
      rows[4][0] = "Vendor";
      rows[4][3] = "Ship to";
      rows[4][5] = "No";
      rows[4][6] = "PO Total"; // Matches spelling of DELTA requirements

      // Calculated Values with defaults
      const vendorName = doc.clientName || "رواد للتوكيلات التجارية";
      const shipToValue = doc.projectName || (doc.shipToAddress || "عام");
      const orderNo = (doc.docNumber && doc.docNumber !== "N/A" && doc.docNumber !== "REF") ? doc.docNumber : "31";
      const orderDate = formatDateToArabicSlash(doc.receiptDate);
      
      // Default delivery date: order date + 5 days, or use customized deliveryDate, or default 15-06-2026
      let deliveryDateStr = doc.deliveryDate || "15-06-2026";
      if (!doc.deliveryDate && doc.receiptDate) {
        try {
          const dParts = doc.receiptDate.split('-');
          if (dParts.length === 3) {
            const dateObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
            dateObj.setDate(dateObj.getDate() + 5);
            deliveryDateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;
          }
        } catch(e) {}
      } else if (doc.deliveryDate) {
        deliveryDateStr = formatDateToArabicSlash(doc.deliveryDate);
      }

      const totalText = `${doc.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ${doc.currency || 'EGP'}`;

      // 3. Metadata Values
      rows[5][0] = vendorName;
      rows[5][3] = shipToValue;
      rows[5][5] = orderNo;
      // Use dynamic formula for total in the metadata box pointing to the final totals row (Excel Row `termsStart - 1`)
      rows[5][6] = { t: "n", f: `G${termsStart - 1}`, v: doc.totalAmount || 0 };

      // 4. Line Items Table headers (Columns A, B, C, D, E, F, G)
      // We merge column B & C for Description to match Excel A, B, D, E, F, G layout
      rows[7][0] = "No";
      rows[7][1] = "Describtion"; // Exactly matches screenshot spelling
      rows[7][2] = "";            // Merged under Description
      rows[7][3] = "Unit";
      rows[7][4] = "Qty";
      rows[7][5] = "Price";
      rows[7][6] = "Amount";

      // 5. Populate grid items (starting at row index 8, i.e. Row 9 in Excel)
      for (let i = 0; i < itemsCount; i++) {
        const item = doc.items && doc.items[i];
        const rIdx = 8 + i; 
        rows[rIdx][0] = i + 1; // serial No.
        
        if (item) {
          // If a brand is specified, we output description with brand appended
          let fullDesc = item.description || "";
          if (item.brand && item.brand.trim() !== "") {
            fullDesc += ` (${item.brand})`;
          }
          rows[rIdx][1] = fullDesc;
          rows[rIdx][2] = ""; // merged
          rows[rIdx][3] = item.unit || "عدد";
          rows[rIdx][4] = item.quantity || 0;
          rows[rIdx][5] = item.unitPrice || 0;
          // Excel formula: Qty * Price
          rows[rIdx][6] = { t: "n", f: `E${rIdx + 1}*F${rIdx + 1}`, v: (item.quantity * item.unitPrice) || 0 };
        } else {
          rows[rIdx][1] = "";
          rows[rIdx][2] = "";
          rows[rIdx][3] = "";
          rows[rIdx][4] = "";
          rows[rIdx][5] = "";
          rows[rIdx][6] = "";
        }
      }

      // 6. Table Total sum Row & Discount Rows
      if (discountOffset === 0) {
        rows[totalRowIdx][0] = doc.withholdingTaxEnabled ? "Total Before Tax / الإجمالي قبل الخصم" : "Total";
        // Excel formula: SUM of line items Amount cells (G9 to G[8 + itemsCount])
        rows[totalRowIdx][6] = { t: "n", f: `SUM(G9:G${8 + itemsCount})`, v: doc.totalAmount || 0 };

        if (doc.withholdingTaxEnabled) {
          const rate = doc.withholdingTaxRate || 1;
          const taxAmount = (doc.totalAmount * rate) / 100;
          const netValue = doc.totalAmount - taxAmount;

          const totalRowExcelNum = totalRowIdx + 1; // 1-based Row Number for total cell
          rows[totalRowIdx + 1][0] = `Commercial & Industrial Profits Tax (${rate}%) / خصم أ.ت.ص`;
          rows[totalRowIdx + 1][6] = { t: "n", f: `-G${totalRowExcelNum}*${rate}/100`, v: -taxAmount };

          rows[totalRowIdx + 2][0] = "Net Payable / صافي القيمة المستحقة";
          rows[totalRowIdx + 2][6] = { t: "n", f: `G${totalRowExcelNum}+G${totalRowExcelNum + 1}`, v: netValue };
        }
      } else {
        let currentIdx = totalRowIdx;
        
        // A) Subtotal Row
        rows[currentIdx][0] = "Subtotal (Before Discount) / الإجمالي قبل التخفيض";
        rows[currentIdx][6] = { t: "n", f: `SUM(G9:G${8 + itemsCount})`, v: itemsSubtotal };
        const subtotalExcelNum = currentIdx + 1;
        currentIdx++;
        
        // B) Discount Percentage Row
        let discPctExcelNum = 0;
        if (discPct > 0) {
          rows[currentIdx][0] = `Discount Percentage (${discPct}%) / خصم نسبة مئوية`;
          rows[currentIdx][6] = { t: "n", f: `-G${subtotalExcelNum}*${discPct}/100`, v: -pctDiscountVal };
          discPctExcelNum = currentIdx + 1;
          currentIdx++;
        }
        
        // C) Discount Amount Row
        let discAmtExcelNum = 0;
        if (discAmt > 0) {
          rows[currentIdx][0] = "Discount Amount / تخفيض نقدي إضافي";
          rows[currentIdx][6] = { t: "n", v: -flatDiscountVal };
          discAmtExcelNum = currentIdx + 1;
          currentIdx++;
        }
        
        // D) Total After Discount Row
        rows[currentIdx][0] = doc.withholdingTaxEnabled ? "Total After Discount / الإجمالي بعد التخفيض" : "Total / الإجمالي النهائي";
        
        const formulaParts = [`G${subtotalExcelNum}`];
        if (discPct > 0) formulaParts.push(`G${discPctExcelNum}`);
        if (discAmt > 0) formulaParts.push(`G${discAmtExcelNum}`);
        const totalAfterDiscountExcelNum = currentIdx + 1;
        
        rows[currentIdx][6] = { t: "n", f: formulaParts.join("+"), v: finalTotalAmount };
        
        if (doc.withholdingTaxEnabled) {
          const rate = doc.withholdingTaxRate || 1;
          const taxAmount = (finalTotalAmount * rate) / 100;
          const netValue = finalTotalAmount - taxAmount;

          rows[currentIdx + 1][0] = `Commercial & Industrial Profits Tax (${rate}%) / خصم أ.ت.ص`;
          rows[currentIdx + 1][6] = { t: "n", f: `-G${totalAfterDiscountExcelNum}*${rate}/100`, v: -taxAmount };

          rows[currentIdx + 2][0] = "Net Payable / صافي القيمة المستحقة";
          rows[currentIdx + 2][6] = { t: "n", f: `G${totalAfterDiscountExcelNum}+G${totalAfterDiscountExcelNum + 1}`, v: netValue };
        }
      }

      // 7. Terms & Conditions BLOCK
      rows[termsStart][0] = "Terms & conditions";
      rows[termsStart + 1][0] = doc.vatTerms || "Prices include 14% VAT.";
      rows[termsStart + 2][0] = doc.deliveryTerms || "Prices include Transportation.";
      rows[termsStart + 3][0] = `Place of delivery :  ${shipToValue}`;
      rows[termsStart + 4][0] = `Date of delivery at site: ${deliveryDateStr}`;

      rows[termsStart + 5][0] = "Payment Terms :";
      rows[termsStart + 6][0] = "Payment by check in the name of the company as shown in your commercial register";
      rows[termsStart + 7][0] = ", or in the name of the authorized person through your company";
      rows[termsStart + 8][0] = `, or by bank transfer to your company account within ${doc.paymentDays || "10"} days of the delivery date.`;
      const pctDetails = getAdvancePercentageDetails(doc.advancePayment, finalTotalAmount || doc.totalAmount);
      if (pctDetails) {
        rows[termsStart + 9][0] = `Advanced Payment: ${pctDetails.advanceStr} - Upon Delivery: ${pctDetails.deliveryStr}`;
      } else {
        rows[termsStart + 9][0] = "";
      }

      // 8. Signatures Block
      rows[sigHeadersRowIdx][0] = "Head of Procurement and Contracts";
      rows[sigHeadersRowIdx][3] = "Technical Office Manager";
      rows[sigHeadersRowIdx][6] = "Generl Manager"; // Spelled exactly like DELTA requirements screenshot

      rows[sigNamesRowIdx][0] = doc.signatureProcurement || "Mr. Mohamed Al-Daly";
      rows[sigNamesRowIdx][3] = doc.signatureTechnical || "Eng. Nasr Mahmoud";
      rows[sigNamesRowIdx][6] = doc.signatureManager || "Eng. Sherif Mahmoud";

      // Convert 2D array matrix to standard SheetJS Worksheet object
      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Define cells merges (Columns A to G, i.e. 0 to 6)
      const merges = [
        // Merge title "DELTA" across columns A to F (0 to 5)
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },

        // Vendor meta header and value cell mergers spanning A to C (0 to 2)
        { s: { r: 4, c: 0 }, e: { r: 4, c: 2 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } },

        // Ship to meta header and value cell mergers spanning D to E (3 to 4)
        { s: { r: 4, c: 3 }, e: { r: 4, c: 4 } },
        { s: { r: 5, c: 3 }, e: { r: 5, c: 4 } },

        // Item Header Description merge (B and C, index 1 and 2)
        { s: { r: 7, c: 1 }, e: { r: 7, c: 2 } },

        // Table Total label row span A to F (index 0 to 5)
        { s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: 5 } }
      ];

      if (discountOffset > 0) {
        for (let r = totalRowIdx + 1; r <= totalRowIdx + discountOffset; r++) {
          merges.push({ s: { r, c: 0 }, e: { r, c: 5 } });
        }
      }

      if (doc.withholdingTaxEnabled) {
        merges.push(
          { s: { r: totalRowIdx + discountOffset + 1, c: 0 }, e: { r: totalRowIdx + discountOffset + 1, c: 5 } },
          { s: { r: totalRowIdx + discountOffset + 2, c: 0 }, e: { r: totalRowIdx + discountOffset + 2, c: 5 } }
        );
      }

      // Item Description merges (Column B & C)
      for (let i = 0; i < itemsCount; i++) {
        merges.push({ s: { r: 8 + i, c: 1 }, e: { r: 8 + i, c: 2 } });
      }

      // Terms & Conditions mergers (A to G, index 0 to 6)
      for (let i = 0; i < 10; i++) {
        merges.push({ s: { r: termsStart + i, c: 0 }, e: { r: termsStart + i, c: 6 } });
      }

      // Signatures column alignments
      merges.push(
        // Head of Procurement and Contracts / Mr. Mohamed Al-Daly (A to C: 0 to 2)
        { s: { r: sigHeadersRowIdx, c: 0 }, e: { r: sigHeadersRowIdx, c: 2 } },
        { s: { r: sigNamesRowIdx, c: 0 }, e: { r: sigNamesRowIdx, c: 2 } },

        // Technical Office Manager / Eng. Nasr Mahmoud (D to F: 3 to 5)
        { s: { r: sigHeadersRowIdx, c: 3 }, e: { r: sigHeadersRowIdx, c: 5 } },
        { s: { r: sigNamesRowIdx, c: 3 }, e: { r: sigNamesRowIdx, c: 5 } }
      );

      ws['!merges'] = merges;

      // Auto-fit Columns Width with safety padding of at least 5
      const colWidths = Array(7).fill(12); // Start with default minimum width of 12 for all 7 columns
      for (const cellRef in ws) {
        if (cellRef.startsWith('!')) continue;
        const cell = ws[cellRef];
        if (!cell) continue;

        const match = cellRef.match(/^([A-Z]+)([0-9]+)$/);
        if (!match) continue;
        const colStr = match[1];
        let colIdx = 0;
        for (let idx = 0; idx < colStr.length; idx++) {
          colIdx = colIdx * 26 + (colStr.charCodeAt(idx) - 64);
        }
        colIdx = colIdx - 1; // 0-indexed column

        if (colIdx >= 0 && colIdx < 7) {
          let valStr = "";
          if (cell.v !== undefined && cell.v !== null) {
            valStr = cell.w ? cell.w.toString() : cell.v.toString();
          } else if (cell.f) {
            valStr = "123,456.78 EGP"; // safe placeholder for sum/amount cells
          }

          const rowStr = match[2];
          const r = parseInt(rowStr) - 1;

          // تجاهل الخلايا المدمجة تماماً حتى لا تتسبب في فرش العمود بناءً على العناوين الكبيرة
          const isMerged = merges.some(m => 
            r >= m.s.r && r <= m.e.r && colIdx >= m.s.c && colIdx <= m.e.c
          );
          const isMasterOfMerge = merges.some(m =>
            m.s.r === r && m.s.c === colIdx
          );

          if (isMerged && !isMasterOfMerge) {
            continue; 
          }

          const length = valStr.length;
          // إذا كانت الخلية تحتوي على نص طويل جداً (مثل نصوص الشروط)، نضع حداً أقصى حتى لا يفرش العمود
          if (length > 0 && length < 50) {
            colWidths[colIdx] = Math.max(colWidths[colIdx], length + 4);
          }
        }
      }

      // Ensure some reasonable defaults or minimums with explicit overrides
      ws['!cols'] = colWidths.slice(0, 7).map((w, idx) => {
        if (idx === 0) return { wch: 8 };  // Column A: Serial No (Fixed to 8)
        if (idx === 1) return { wch: 50 }; // Column B: Description (Fixed to 50 - Description مريح)
        if (idx === 2) return { wch: 12 }; // Column C: Description Part 2 (Fixed to 12)
        if (idx === 3) return { wch: 14 }; // Column D: Unit / Ship To part 1 (Fixed to 14)
        if (idx === 4) return { wch: 14 }; // Column E: Qty / Ship To part 2 (Fixed to 14)
        if (idx === 5) return { wch: 15 }; // Column F: Price / No (Fixed to 15)
        if (idx === 6) return { wch: 22 }; // Column G: Amount / PO Total (Fixed to 22 - مساحة واسعة تمنع الـ ### تماماً)
        return { wch: w };
      });

      // Configure comfortable row heights
      const rowHeights = [];
      for (let i = 0; i < totalRowsCount; i++) {
        if (i === 1 || i === 2) {
          rowHeights[i] = { hpt: 30 }; // Banner rows
        } else if (i === 4) {
          rowHeights[i] = { hpt: 30 }; // Metadata labels Row 5 (Comfortable 30 height per request)
        } else if (i === 5) {
          rowHeights[i] = { hpt: 35 }; // Metadata values Row 6 (Fixed to 35 for space containing vendor & project name)
        } else if (i === 6) {
          rowHeights[i] = { hpt: 0 };  // Row 7 is canceled / hidden as requested
        } else if (i === 7) {
          rowHeights[i] = { hpt: 25 }; // Table header
        } else if (i >= 8 && i < 8 + itemsCount) {
          const item = doc.items && doc.items[i - 8];
          let descriptionText = "";
          if (item) {
            descriptionText = item.description || "";
            if (item.brand && item.brand.trim() !== "") {
              descriptionText += ` (${item.brand})`;
            }
          }
          const lineCount = Math.ceil(descriptionText.length / 50) || 1;
          // إذا كان سطر واحد يأخذ 26، وإذا كان أكثر يفتح ديناميكياً ليمنع قطع أي كلمة (19 درجة لكل سطر)
          rowHeights[i] = { hpt: lineCount === 1 ? 26 : (lineCount * 19) };
        } else if (i >= totalRowIdx && i < termsStart) {
          rowHeights[i] = { hpt: 28 }; // Total and Net Payable rows highlighted to be comfortable and visually prominent (28 height)
        } else if (i >= termsStart && i < termsStart + 10) {
          rowHeights[i] = { hpt: 22 }; // Terms rows
        } else {
          rowHeights[i] = { hpt: 22 };
        }
      }
      ws['!rows'] = rowHeights;

      // Apply highly refined cell-by-cell styling structure for the DELTA design format
      for (const cellRef in ws) {
        if (cellRef.startsWith('!')) continue;
        const cell = ws[cellRef];
        if (!cell) continue;

        const match = cellRef.match(/^([A-Z]+)([0-9]+)$/);
        if (!match) continue;
        const colStr = match[1];
        const rowStr = match[2];
        const r = parseInt(rowStr) - 1; // 0-indexed row
        
        let c = 0;
        for (let idx = 0; idx < colStr.length; idx++) {
          c = c * 26 + (colStr.charCodeAt(idx) - 64);
        }
        c = c - 1; // 0-indexed column

        // Initialize general fallback styling shell
        // @ts-ignore
        cell.s = {
          font: { name: "Segoe UI", sz: 14, color: { rgb: "334155" } },
          alignment: { vertical: "center", wrapText: true }
        };

        // Header Top Banners (r = 1, 2)
        if (r === 1 || r === 2) {
          if (c < 6) {
            // "DELTA" Title Banner (Cols A-F)
            // @ts-ignore
            cell.s = {
              font: { name: "Segoe UI", sz: 16, bold: true, color: { rgb: "0000FF" } }, // Explicit 16 font size for DELTA and FOR ROAD CONSTRUCTION per request
              alignment: { horizontal: "left", vertical: "center" }
            };
          } else {
            // "PURCHASE ORDER" / "PRICE OFFER" (Cols G-H)
            // @ts-ignore
            cell.s = {
              font: { name: "Segoe UI", sz: 16, bold: true, color: { rgb: "FFFFFF" } },
              fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
              alignment: { horizontal: "center", vertical: "center" }
            };
          }
        }

        // Project and Client Metadata headers & values (r = 4, 5)
        else if (r === 4) {
          // Label Headers
          // @ts-ignore
          cell.s = {
            font: { name: "Segoe UI", sz: 16, bold: true, color: { rgb: "FFFFFF" } },
            fill: { patternType: "solid", fgColor: { rgb: "0284C7" } }, // Matches modern primary highlights
            alignment: { horizontal: "center", vertical: "center", wrapText: true }
          };
        }
        else if (r === 5) {
          // Metadata dynamic values
          // @ts-ignore
          cell.s = {
            font: { name: "Segoe UI", sz: 14, bold: true, color: { rgb: "0F172A" } },
            fill: { patternType: "solid", fgColor: { rgb: "F1F5F9" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true }
          };
          if (c === 6) {
            cell.z = `#,##0.00 " ${doc.currency || 'EGP'}"`;
          }
        }

        // Table Header row (r = 7)
        else if (r === 7) {
          // @ts-ignore
          cell.s = {
            font: { name: "Segoe UI", sz: 16, bold: true, color: { rgb: "FFFFFF" } },
            fill: { patternType: "solid", fgColor: { rgb: "0F172A" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "0F172A" } },
              bottom: { style: "medium", color: { rgb: "0F172A" } },
              left: { style: "thin", color: { rgb: "334155" } },
              right: { style: "thin", color: { rgb: "334155" } }
            }
          };
        }

        // Line Items Body cells (r >= 8 && r < 8 + itemsCount)
        else if (r >= 8 && r < 8 + itemsCount) {
          const isOdd = r % 2 !== 0;
          const bgRgb = isOdd ? "F8FAFC" : "FFFFFF";
          let alignStr = "center";
          
          if (c === 1 || c === 2) {
            alignStr = "left"; // Explicitly left-aligned to align with description wrapText settings
          } else if (c === 6) {
            alignStr = "center"; // Amount column centered horizontally & vertically per user request
          }

          if (c === 6) {
            alignStr = "center";
          }

          // @ts-ignore
          cell.s = {
            font: { name: "Segoe UI", sz: 14, bold: c === 0 || c === 6, color: { rgb: "1E293B" } },
            fill: { patternType: "solid", fgColor: { rgb: bgRgb } },
            alignment: { horizontal: alignStr, vertical: "center", wrapText: true },
            border: {
              top: { style: "thin", color: { rgb: "E2E8F0" } },
              bottom: { style: "thin", color: { rgb: "E2E8F0" } },
              left: { style: "thin", color: { rgb: "E2E8F0" } },
              right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
          };

          if (c === 4) {
            cell.z = "#,##0";
          } else if (c === 5 || c === 6) {
            cell.z = "#,##0.00";
          }
        }

        // Subtotals, Discounts, & Net Totals Rows (r >= totalRowIdx && r < termsStart)
        else if (r >= totalRowIdx && r < termsStart) {
          const isFinalPayRow = (r === termsStart - 2) || (r === totalRowIdx && !doc.withholdingTaxEnabled);
          const bgFillColor = isFinalPayRow ? "D1FAE5" : "FEF3C7"; // Light emerald vs warm gold amber
          const borderStyleBottom = isFinalPayRow ? "double" : "thin";

          // @ts-ignore
          cell.s = {
            font: { 
              name: "Segoe UI", 
              sz: 14, 
              bold: true, 
              color: isFinalPayRow && c === 6 ? { rgb: "15803D" } : { rgb: "0F172A" } 
            },
            fill: { patternType: "solid", fgColor: { rgb: bgFillColor } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "CBD5E1" } },
              bottom: { style: borderStyleBottom, color: { rgb: "475569" } },
              left: { style: "thin", color: { rgb: "CBD5E1" } },
              right: { style: "thin", color: { rgb: "CBD5E1" } }
            }
          };

          if (c === 6) {
            cell.z = "#,##0.00";
          }
        }

        // Terms details panel (r >= termsStart && r < termsStart + 10)
        else if (r >= termsStart && r < termsStart + 10) {
          const isTitleRow = r === termsStart;
          // @ts-ignore
          cell.s = {
            font: {
              name: "Segoe UI",
              sz: isTitleRow ? 16 : 14,
              bold: isTitleRow,
              color: isTitleRow ? { rgb: "0284C7" } : { rgb: "475569" }
            },
            fill: { patternType: "solid", fgColor: { rgb: "F8FAFC" } },
            alignment: { horizontal: "left", vertical: "top", wrapText: true },
            border: {
              top: isTitleRow ? { style: "thin", color: { rgb: "CBD5E1" } } : undefined,
              bottom: (r === termsStart + 9) ? { style: "thin", color: { rgb: "CBD5E1" } } : undefined,
              left: (c === 0) ? { style: "thin", color: { rgb: "CBD5E1" } } : undefined,
              right: (c === 6) ? { style: "thin", color: { rgb: "CBD5E1" } } : undefined
            }
          };
        }

        // Signatures area (r >= sigHeadersRowIdx && r <= sigNamesRowIdx)
        else if (r >= sigHeadersRowIdx && r <= sigNamesRowIdx) {
          const isTitle = r === sigHeadersRowIdx;
          // @ts-ignore
          cell.s = {
            font: { name: "Segoe UI", sz: 14, bold: true, color: isTitle ? { rgb: "475569" } : { rgb: "0F172A" } },
            fill: { patternType: "solid", fgColor: { rgb: "F1F5F9" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: isTitle ? { style: "medium", color: { rgb: "475569" } } : undefined,
              bottom: !isTitle ? { style: "thin", color: { rgb: "CBD5E1" } } : undefined
            }
          };
        }
      }

      // Package to workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "DELTA_PO");

      return wb;
    } catch (e: any) {
      console.error("Workbook generation failed", e);
      throw e;
    }
  };

  const handleExportToDeltaExcel = (doc: ProcessedDocument) => {
    if (!doc) {
      alert('الرجاء تحديد مستند أولاً لتصديره.');
      return;
    }
    try {
      const wb = generateDeltaExcelWorkbook(doc);
      const orderNo = (doc.docNumber && doc.docNumber !== "N/A" && doc.docNumber !== "REF") ? doc.docNumber : "31";
      XLSX.writeFile(wb, `DELTA_PO_${orderNo}.xlsx`);
      triggerNotificationToast('success', 'تم تصدير شيت DELTA', 'تم إنشاء وتنزيل شيت إكسيل كود مالي منسق ومطابق لنسق شركة DELTA بنجاح!');
    } catch (e: any) {
      alert('فشل تصدير قالب DELTA: ' + e.message);
    }
  };

  // Update a single field inside document's line-items in the details drawer and sync immediately in state
  const handleUpdateDrawerItem = (itemIdx: number, field: keyof LineItem | 'brand' | 'unit', value: any) => {
    if (!selectedDoc) return;
    
    const updatedDoc = { ...selectedDoc };
    const updatedItems = [...(updatedDoc.items || [])];
    const updatedItem = { ...updatedItems[itemIdx] };
    
    if (field === 'quantity') {
      updatedItem.quantity = Number(value) || 0;
      updatedItem.total = updatedItem.quantity * updatedItem.unitPrice;
    } else if (field === 'unitPrice') {
      updatedItem.unitPrice = Number(value) || 0;
      updatedItem.total = updatedItem.quantity * updatedItem.unitPrice;
    } else {
      (updatedItem as any)[field] = value;
    }
    
    updatedItems[itemIdx] = updatedItem;
    updatedDoc.items = updatedItems;
    
    // Recalculate invoice overall totalAmount
    updatedDoc.totalAmount = updatedItems.reduce((sum, item) => sum + Number(((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)), 0);
    
    setSelectedDoc(updatedDoc);
    
    // Propagate changes to parent document list state dynamically in memory
    const updatedDocsList = documents.map(d => d.id === selectedDoc.id ? updatedDoc : d);
    setDocuments(updatedDocsList);
  };

  // Update a single field inside print document's line-items from the print sheet and sync with state
  const handleUpdatePrintItem = (itemIdx: number, field: keyof LineItem | 'brand' | 'unit', value: any) => {
    const docId = printDocId || (selectedDoc ? selectedDoc.id : null);
    if (!docId) return;
    
    setDocuments(prevDocs => {
      const currentDoc = prevDocs.find(d => d.id === docId);
      if (!currentDoc) return prevDocs;
      
      const updatedDoc = { ...currentDoc };
      const updatedItems = [...(updatedDoc.items || [])];
      const updatedItem = { ...updatedItems[itemIdx] };
      
      if (field === 'quantity') {
        updatedItem.quantity = Math.max(0, parseFloat(value) || 0);
        updatedItem.total = updatedItem.quantity * (updatedItem.unitPrice || 0);
      } else if (field === 'unitPrice') {
        updatedItem.unitPrice = Math.max(0, parseFloat(value) || 0);
        updatedItem.total = (updatedItem.quantity || 0) * updatedItem.unitPrice;
      } else {
        (updatedItem as any)[field] = value;
      }
      
      updatedItems[itemIdx] = updatedItem;
      updatedDoc.items = updatedItems;
      
      // Recalculate invoice overall totalAmount
      updatedDoc.totalAmount = updatedItems.reduce((sum, pitem) => sum + Number(((pitem.quantity || 0) * (pitem.unitPrice || 0)).toFixed(2)), 0);
      
      // If this is also the selected document in the drawer, sync too!
      if (selectedDoc && selectedDoc.id === docId) {
        setSelectedDoc(updatedDoc);
      }
      
      return prevDocs.map(d => d.id === docId ? updatedDoc : d);
    });
  };

  // Update a single top-level field inside print document's metadata from the print sheet and sync with state
  const handleUpdatePrintDocField = (field: keyof ProcessedDocument, value: any) => {
    const docId = printDocId || (selectedDoc ? selectedDoc.id : null);
    if (!docId) return;
    
    setDocuments(prevDocs => {
      const currentDoc = prevDocs.find(d => d.id === docId);
      if (!currentDoc) return prevDocs;
      
      const updatedDoc = { ...currentDoc, [field]: value };
      
      // If this is also the selected document in the drawer, sync too!
      if (selectedDoc && selectedDoc.id === docId) {
        setSelectedDoc(updatedDoc);
      }
      
      return prevDocs.map(d => d.id === docId ? updatedDoc : d);
    });
  };

  // Update a top-level field or multiple fields of the document inside the drawer and sync with state
  const handleUpdateDrawerField = (fieldOrFields: keyof ProcessedDocument | Partial<ProcessedDocument>, value?: any) => {
    setSelectedDoc(prev => {
      if (!prev) return null;
      
      let updates: Partial<ProcessedDocument> = {};
      if (typeof fieldOrFields === 'string') {
        updates = { [fieldOrFields]: value };
      } else if (fieldOrFields && typeof fieldOrFields === 'object') {
        updates = fieldOrFields;
      }

      let updatedDoc = { ...prev, ...updates };
      
      if (updates.projectName !== undefined) {
        updatedDoc.shipToAddress = updates.projectName;
        if (updatedDoc.docType === 'po') {
          const nextNum = getNextPoNumberForProject(updates.projectName || 'عام', documents.filter(d => d.id !== prev.id));
          updatedDoc.docNumber = String(nextNum);
          
          fetchNextPoNumber(updates.projectName || 'عام').then((fetchedNum) => {
            if (fetchedNum) {
              setSelectedDoc(current => {
                if (current && current.id === prev.id) {
                  const withFetched = { ...current, docNumber: fetchedNum };
                  setDocuments(prevDocs => prevDocs.map(d => d.id === current.id ? withFetched : d));
                  return withFetched;
                }
                return current;
              });
            }
          });
        }
      } else if (updates.shipToAddress !== undefined) {
        updatedDoc.projectName = updates.shipToAddress;
        if (updatedDoc.docType === 'po') {
          const nextNum = getNextPoNumberForProject(updates.shipToAddress || 'عام', documents.filter(d => d.id !== prev.id));
          updatedDoc.docNumber = String(nextNum);
          
          fetchNextPoNumber(updates.shipToAddress || 'عام').then((fetchedNum) => {
            if (fetchedNum) {
              setSelectedDoc(current => {
                if (current && current.id === prev.id) {
                  const withFetched = { ...current, docNumber: fetchedNum };
                  setDocuments(prevDocs => prevDocs.map(d => d.id === current.id ? withFetched : d));
                  return withFetched;
                }
                return current;
              });
            }
          });
        }
      } else if (updates.docType !== undefined) {
        if (updates.docType === 'po') {
          const nextNum = getNextPoNumberForProject(updatedDoc.projectName || 'عام', documents.filter(d => d.id !== prev.id));
          updatedDoc.docNumber = String(nextNum);
          
          fetchNextPoNumber(updatedDoc.projectName || 'عام').then((fetchedNum) => {
            if (fetchedNum) {
              setSelectedDoc(current => {
                if (current && current.id === prev.id) {
                  const withFetched = { ...current, docNumber: fetchedNum };
                  setDocuments(prevDocs => prevDocs.map(d => d.id === current.id ? withFetched : d));
                  return withFetched;
                }
                return current;
              });
            }
          });
        }
      }

      // Sync to the standard documents list state in background
      setDocuments(prevDocs => prevDocs.map(d => d.id === prev.id ? updatedDoc : d));
      return updatedDoc;
    });
  };

  // Dedicated Permanent Saver for changes made inside the details inspection drawer
  const handleSaveDrawerEdits = async () => {
    if (!selectedDoc) return;
    try {
      setIsSavingDrawer(true);
      
      const updatedDocsList = documents.map(d => d.id === selectedDoc.id ? selectedDoc : d);
      setDocuments(updatedDocsList);

      const res = await fetch('/api/documents/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: updatedDocsList })
      });
      
      if (res.ok) {
        if (audioEnabled) {
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.setValueAtTime(880, audioCtx.currentTime); // high ping
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.12);
          } catch (e) {}
        }
        triggerNotificationToast(
          'success', 
          'تم حفظ كافة التعديلات بنجاح! 💾', 
          'تم تحديث وتثبيت شروط الدفع، التوصيل، والبنود المخصصة بأمان تامة على خادم البيانات.'
        );
      } else {
        throw new Error('فشل تسجيل التغييرات على الخادم');
      }
    } catch (e: any) {
      alert('عذراً، حدث خطأ أثناء حفظ التعديلات: ' + e.message);
    } finally {
      setIsSavingDrawer(false);
    }
  };

  // Safe Print engine with graceful in-tab rendering to prevent Cloud Run 403 popup errors
  const handlePrintDocument = () => {
    if (!selectedDoc) return;
    try {
      setPrintDirectionParam(printDirection);
      setTableAlignment('center');
      setPrintDocId(selectedDoc.id);
    } catch (err: any) {
      console.warn("Print trigger failed:", err);
    }
  };

  // Client-side Direct PDF Render & Download to bypass all browser prints/popups blocks
  const handleDownloadPDF = async () => {
    const element = document.getElementById("printable-excel-sheet-delta-isolated");
    if (!element) {
      alert("عذراً، لم نتمكن من تحديد جدول الطباعة.");
      return;
    }

    const activeDocForBrand = documents.find(d => d.id === printDocId) || selectedDoc;
    const hasAnyBrand = !!(activeDocForBrand && activeDocForBrand.items && activeDocForBrand.items.some(item => item.brand?.trim() !== ""));

    setIsGeneratingPDF(true);
    try {
      // Force scroll to top of element to prevent cut-off in rendering
      const restoreScroll = window.scrollY;
      window.scrollTo(0, 0);

      // Render crisp canvas representation of printable sheet with oklch safety transform
      const canvas = await (html2canvas as any)(element, {
        scale: 2, // Scale 2 as explicitly requested by user
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: false,
        scrollY: 0,
        letterRendering: true,
        onclone: (clonedDoc) => {
          // Clean all <style> tags inside the cloned document before html2canvas parses them
          const clonedStyles = clonedDoc.getElementsByTagName("style");
          Array.from(clonedStyles).forEach((styleEl: any) => {
            if (styleEl.textContent && (styleEl.textContent.includes('oklch') || styleEl.textContent.includes('oklab'))) {
              styleEl.textContent = convertOklToRgb(styleEl.textContent);
            }
          });

          const clonedElement = clonedDoc.getElementById("printable-excel-sheet-delta-isolated");
          if (!clonedElement) return;

          // Force perfect desktop aspect-ratio geometry and size regardless of screen width
          clonedElement.style.width = "900px";
          clonedElement.style.minWidth = "900px";
          clonedElement.style.maxWidth = "900px";
          clonedElement.style.backgroundColor = "#ffffff";
          clonedElement.style.boxSizing = "border-box";
          clonedElement.style.border = "3px solid #000000";

          // Unhide desktop metadata grid and hide mobile responsive details specifically for PDF screenshot logic
          const desktopMetadataGrid = clonedElement.querySelector(".hidden.md\\:grid") as HTMLElement;
          if (desktopMetadataGrid) {
            desktopMetadataGrid.style.display = "grid";
            desktopMetadataGrid.style.width = "100%";
            desktopMetadataGrid.style.setProperty('height', 'auto', 'important');
            desktopMetadataGrid.style.setProperty('min-height', 'auto', 'important');
            desktopMetadataGrid.style.setProperty('max-height', 'auto', 'important');
            
            // Format all header boxes to have auto-height and padding
            const cells = Array.from(desktopMetadataGrid.children) as HTMLElement[];
            cells.forEach((cell) => {
              cell.style.setProperty('height', 'auto', 'important');
              cell.style.setProperty('min-height', 'auto', 'important');
              cell.style.setProperty('max-height', 'auto', 'important');
              cell.style.setProperty('padding', '12px 8px', 'important');
              cell.style.setProperty('line-height', '1.4', 'important');
              cell.style.display = "flex";
              cell.style.flexDirection = "column";
              cell.style.justifyContent = "center";
              cell.style.alignItems = "center";
              cell.style.boxSizing = "border-box";
              
              const innerElements = Array.from(cell.querySelectorAll('span, div')) as HTMLElement[];
              innerElements.forEach((el) => {
                el.style.setProperty('height', 'auto', 'important');
                el.style.setProperty('min-height', 'auto', 'important');
                el.style.setProperty('max-height', 'auto', 'important');
                el.style.setProperty('line-height', '1.4', 'important');
                el.style.display = "block";
              });
            });
          }
          const mobileMetadataBox = clonedElement.querySelector(".md\\:hidden") as HTMLElement;
          if (mobileMetadataBox) {
            mobileMetadataBox.style.display = "none";
          }

          // Apply solid, explicit, highly-visible black borders directly to the table and cells in DOM clone
          const tables = clonedElement.getElementsByTagName("table");
          Array.from(tables).forEach((table) => {
            const t = table as HTMLTableElement;
            t.style.borderCollapse = "collapse";
            t.style.width = "100%";
            t.style.border = "2px solid #000000";
          });

          // Style all cloned ths with dynamic row height and safe padding
          const ths = clonedElement.getElementsByTagName("th");
          Array.from(ths).forEach((th) => {
            const cell = th as HTMLTableCellElement;
            cell.style.setProperty('height', 'auto', 'important');
            cell.style.setProperty('min-height', 'auto', 'important');
            cell.style.setProperty('max-height', 'auto', 'important');
            cell.style.setProperty('line-height', '1.5', 'important');
            cell.style.setProperty('padding', '12px 10px', 'important');
            cell.style.border = "1px solid #000000";
            cell.style.borderColor = "#000000";
            cell.style.color = "#000000";
            cell.style.verticalAlign = "middle";
            cell.style.textAlign = "center";
          });

          // Style all cloned tds with dynamic heights, line-height, and padding
          const tds = clonedElement.getElementsByTagName("td");
          Array.from(tds).forEach((td) => {
            const cell = td as HTMLTableCellElement;
            cell.style.setProperty('height', 'auto', 'important');
            cell.style.setProperty('min-height', 'auto', 'important');
            cell.style.setProperty('max-height', 'auto', 'important');
            cell.style.setProperty('line-height', '1.5', 'important');
            cell.style.setProperty('padding', '12px 10px', 'important');
            cell.style.border = "1px solid #000000";
            cell.style.borderColor = "#000000";
            cell.style.color = "#000000";
            cell.style.verticalAlign = "middle";
            
            // Prevent horizontal compressing, allow wrapping, and safe word wrapping
            cell.style.setProperty('white-space', 'normal', 'important');
            cell.style.setProperty('overflow', 'visible', 'important');
            cell.style.setProperty('word-wrap', 'break-word', 'important');
            cell.style.setProperty('word-break', 'break-word', 'important');

            // Force dynamic line heights and text formatting on any nested div/span inside the cells
            const nestedItems = Array.from(cell.querySelectorAll('div, span')) as HTMLElement[];
            nestedItems.forEach((inner) => {
              inner.style.setProperty('height', 'auto', 'important');
              inner.style.setProperty('min-height', 'auto', 'important');
              inner.style.setProperty('max-height', 'auto', 'important');
              inner.style.setProperty('line-height', '1.5', 'important');
              inner.style.setProperty('padding', '0', 'important');
              inner.style.setProperty('margin', '0', 'important');
              inner.style.setProperty('white-space', 'normal', 'important');
              inner.style.setProperty('word-wrap', 'break-word', 'important');
              inner.style.setProperty('word-break', 'break-word', 'important');
            });
          });

          // Force column widths precisely and avoid breaking inside pages
          const rows = clonedElement.getElementsByTagName("tr");
          Array.from(rows).forEach((row) => {
            const tr = row as HTMLTableRowElement;
            tr.style.setProperty('height', 'auto', 'important');
            tr.style.setProperty('min-height', 'auto', 'important');
            tr.style.setProperty('max-height', 'auto', 'important');
            tr.style.setProperty('page-break-inside', 'avoid', 'important');
            tr.style.setProperty('break-inside', 'avoid', 'important');

            const cells = Array.from(tr.cells);
            
            // Adjust individual columns for actual table items
            const startIndex = showExcelGrid ? 2 : 0;
            const actualCells = cells.slice(startIndex);
            if (actualCells.length >= 6) {
              if (hasAnyBrand) {
                // Column proportions with Brand: No (5%), Description (42%), Brand (8%), Unit (8%), Qty (8%), Price (14%), Amount (15%) = 100%
                if (actualCells[0]) {
                  actualCells[0].style.setProperty('width', '5%', 'important');
                  actualCells[0].style.setProperty('min-width', '5%', 'important');
                  actualCells[0].style.setProperty('max-width', '5%', 'important');
                  actualCells[0].style.textAlign = "center";
                }
                if (actualCells[1]) {
                  actualCells[1].style.setProperty('width', '42%', 'important');
                  actualCells[1].style.setProperty('min-width', '42%', 'important');
                  actualCells[1].style.setProperty('max-width', '42%', 'important');
                  actualCells[1].style.textAlign = "right";
                  actualCells[1].style.direction = "rtl";
                  const innerDiv = actualCells[1].querySelector('div') as HTMLElement;
                  if (innerDiv) {
                    innerDiv.style.textAlign = "right";
                    innerDiv.style.direction = "rtl";
                  }
                }
                if (actualCells[2]) {
                  actualCells[2].style.setProperty('width', '8%', 'important');
                  actualCells[2].style.setProperty('min-width', '8%', 'important');
                  actualCells[2].style.setProperty('max-width', '8%', 'important');
                  actualCells[2].style.textAlign = "center";
                }
                if (actualCells[3]) {
                  actualCells[3].style.setProperty('width', '8%', 'important');
                  actualCells[3].style.setProperty('min-width', '8%', 'important');
                  actualCells[3].style.setProperty('max-width', '8%', 'important');
                  actualCells[3].style.textAlign = "center";
                }
                if (actualCells[4]) {
                  actualCells[4].style.setProperty('width', '8%', 'important');
                  actualCells[4].style.setProperty('min-width', '8%', 'important');
                  actualCells[4].style.setProperty('max-width', '8%', 'important');
                  actualCells[4].style.textAlign = "center";
                }
                if (actualCells[5]) {
                  actualCells[5].style.setProperty('width', '14%', 'important');
                  actualCells[5].style.setProperty('min-width', '14%', 'important');
                  actualCells[5].style.setProperty('max-width', '14%', 'important');
                  actualCells[5].style.textAlign = "center";
                  actualCells[5].style.setProperty('white-space', 'nowrap', 'important');
                }
                if (actualCells[6]) {
                  actualCells[6].style.setProperty('width', '15%', 'important');
                  actualCells[6].style.setProperty('min-width', '15%', 'important');
                  actualCells[6].style.setProperty('max-width', '15%', 'important');
                  actualCells[6].style.textAlign = "center";
                  actualCells[6].style.setProperty('white-space', 'nowrap', 'important');
                }
              } else {
                // Column proportions without Brand: No (5%), Description (50%), Unit (8%), Qty (8%), Price (14%), Amount (15%) = 100%
                if (actualCells[0]) {
                  actualCells[0].style.setProperty('width', '5%', 'important');
                  actualCells[0].style.setProperty('min-width', '5%', 'important');
                  actualCells[0].style.setProperty('max-width', '5%', 'important');
                  actualCells[0].style.textAlign = "center";
                }
                if (actualCells[1]) {
                  actualCells[1].style.setProperty('width', '50%', 'important');
                  actualCells[1].style.setProperty('min-width', '50%', 'important');
                  actualCells[1].style.setProperty('max-width', '50%', 'important');
                  actualCells[1].style.textAlign = "right";
                  actualCells[1].style.direction = "rtl";
                  const innerDiv = actualCells[1].querySelector('div') as HTMLElement;
                  if (innerDiv) {
                    innerDiv.style.textAlign = "right";
                    innerDiv.style.direction = "rtl";
                  }
                }
                if (actualCells[2]) {
                  actualCells[2].style.setProperty('width', '8%', 'important');
                  actualCells[2].style.setProperty('min-width', '8%', 'important');
                  actualCells[2].style.setProperty('max-width', '8%', 'important');
                  actualCells[2].style.textAlign = "center";
                }
                if (actualCells[3]) {
                  actualCells[3].style.setProperty('width', '8%', 'important');
                  actualCells[3].style.setProperty('min-width', '8%', 'important');
                  actualCells[3].style.setProperty('max-width', '8%', 'important');
                  actualCells[3].style.textAlign = "center";
                }
                if (actualCells[4]) {
                  actualCells[4].style.setProperty('width', '14%', 'important');
                  actualCells[4].style.setProperty('min-width', '14%', 'important');
                  actualCells[4].style.setProperty('max-width', '14%', 'important');
                  actualCells[4].style.textAlign = "center";
                  actualCells[4].style.setProperty('white-space', 'nowrap', 'important');
                }
                if (actualCells[5]) {
                  actualCells[5].style.setProperty('width', '15%', 'important');
                  actualCells[5].style.setProperty('min-width', '15%', 'important');
                  actualCells[5].style.setProperty('max-width', '15%', 'important');
                  actualCells[5].style.textAlign = "center";
                  actualCells[5].style.setProperty('white-space', 'nowrap', 'important');
                }
              }
            }
          });

          // Prevent wrapping inside date-container and date-texts in the clone
          const dateTexts = clonedElement.querySelectorAll(".date-text, .date-container") as NodeListOf<HTMLElement>;
          Array.from(dateTexts).forEach((dt) => {
            dt.style.whiteSpace = "nowrap";
            dt.style.wordBreak = "keep-all";
          });

          const allElements = clonedElement.getElementsByTagName("*");
          const elementsList = [clonedElement, ...Array.from(allElements)];

          elementsList.forEach((el) => {
            const htmlEl = el as HTMLElement;
            if (!htmlEl.style) return;

            // Resolve any computed styles containing oklch or oklab colors (which crashes html2canvas parsing)
            const computed = window.getComputedStyle(htmlEl);
            const colorProps = [
              'color', 
              'backgroundColor', 
              'borderColor', 
              'borderTopColor', 
              'borderBottomColor', 
              'borderLeftColor', 
              'borderRightColor',
              'outlineColor'
            ];

            colorProps.forEach((prop) => {
              const val = computed[prop as any];
              if (val && (val.includes('oklch') || val.includes('oklab'))) {
                htmlEl.style[prop as any] = convertOklToRgb(val);
              }
            });
          });
        }
      });

      // Restore scroll
      window.scrollTo(0, restoreScroll);

      // Setup PDF document mirroring A4 layout (portrait, mm)
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 5; // 5mm minimal print margins
      const contentWidth = pdfWidth - (margin * 2);
      const pagePrintableHeight = pdfHeight - (margin * 2);

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calculate scale factor from the physical DOM element to canvas pixels
      const elementHeight = element.getBoundingClientRect().height;
      const scaleFactor = imgHeight / elementHeight;
      const pageHeightPx = Math.floor(imgWidth * (pagePrintableHeight / contentWidth));

      // Get pixel positions of all table rows (tr) relative to the top of the container
      const containerRect = element.getBoundingClientRect();
      const rows = element.querySelectorAll('tr');
      const rowPositions = Array.from(rows).map(row => {
        const rect = row.getBoundingClientRect();
        return {
          top: (rect.top - containerRect.top) * scaleFactor,
          bottom: (rect.bottom - containerRect.top) * scaleFactor
        };
      });

      let sourceY = 0;
      let pageCount = 0;
      while (sourceY < imgHeight) {
        let sliceHeight = Math.min(pageHeightPx, imgHeight - sourceY);
        
        // If there is enough height remaining, try to perform a clean split on row boundaries
        if (sourceY + pageHeightPx < imgHeight) {
          const splitLine = sourceY + pageHeightPx;
          // Find if the mathematical split cuts through any table row
          const intersectingRow = rowPositions.find(r => r.top < splitLine && r.bottom > splitLine);
          
          if (intersectingRow) {
            const cleanHeight = intersectingRow.top - sourceY;
            // Split early if there is some preceding content, leaving at least 50px of space
            if (cleanHeight > 50) {
              sliceHeight = Math.floor(cleanHeight);
            }
          }
        }
        
        // Create an in-memory canvas for this slice
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = imgWidth;
        sliceCanvas.height = sliceHeight;
        
        const sliceCtx = sliceCanvas.getContext('2d');
        if (sliceCtx) {
          sliceCtx.drawImage(
            canvas,
            0, sourceY, imgWidth, sliceHeight, // source rect
            0, 0, imgWidth, sliceHeight        // dest rect
          );
        }
        
        const sliceImgData = sliceCanvas.toDataURL('image/png');
        
        if (pageCount > 0) {
          pdf.addPage();
        }
        
        const sliceHeightMm = (sliceHeight / imgWidth) * contentWidth;
        pdf.addImage(sliceImgData, 'PNG', margin, margin, contentWidth, sliceHeightMm);
        
        sourceY += sliceHeight;
        pageCount++;
      }

      // Format clean filename for saving
      const docNum = printDoc ? (printDoc.docNumber || "document") : "DELTA";
      const projName = printDoc ? (printDoc.projectName || "DELTA") : "PROJECT";
      const vendorName = printDoc ? (printDoc.clientName || "Unknown_Client") : "Unknown_Client";
      
      // Save locally to user device
      pdf.save(`${projName}_${docNum}_DELTA_Direct.pdf`);

      // Upload file dynamically to Supabase Storage and capture Public URL
      if (printDocId) {
        triggerNotificationToast(
          'info',
          'جاري رفع ملف الـ PDF وتحديث السجل سحابياً...',
          'يرجى عدم إغلاق النافذة أثناء الحفظ في Supabase Storage.'
        );
        
        let pdfBlob: Blob;
        try {
          pdfBlob = pdf.output('blob');
        } catch (blobErr: any) {
          console.error("Failed to generate PDF blob:", blobErr);
          throw new Error(`تعذر إنشاء مصفوفة الـ Blob من مستند PDF: ${blobErr.message}`);
        }

        const uploadForm = new FormData();
        uploadForm.append('file', pdfBlob, `PO_${docNum}.pdf`);
        uploadForm.append('documentId', printDocId);
        uploadForm.append('projectName', projName);
        uploadForm.append('vendorName', vendorName);
        uploadForm.append('docNumber', docNum);

        const uploadRes = await fetch('/api/documents/upload-generated-pdf', {
          method: 'POST',
          body: uploadForm
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || 'عذراً، فشل رفع ملف الـ PDF إلى خادم التخزين السحابي.');
        }

        const uploadResult = await uploadRes.json();
        console.log("Uploaded PDF Public URL:", uploadResult.publicUrl);
        
        // Update documents list in background
        setDocuments(prevDocs => 
          prevDocs.map(d => d.id === printDocId ? { ...d, classifiedPath: uploadResult.publicUrl, status: 'processed' as const } : d)
        );

        triggerNotificationToast(
          'success',
          'تم تحديث وحفظ ملف الـ PDF بنجاح ✨',
          'تم حفظ ملف الـ PDF بأمان في Supabase Storage وتحديث السجل.'
        );
      }
    } catch (error: any) {
      console.error("Direct PDF Generation/Upload failed:", error);
      triggerNotificationToast(
        'error',
        'فشل الرفع السحابي والمزامنة ❌',
        error.message || 'حدث خطأ أثناء الرفع إلى مخزن Supabase Storage.'
      );
      alert(`عذراً، حدث خطأ أثناء توليد أو رفع ملف الـ PDF:\n${error.message}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Add a blank line item to the document
  const handleAddDrawerItem = () => {
    if (!selectedDoc) return;
    const updatedDoc = { ...selectedDoc };
    const newItem: LineItem = {
      description: "",
      brand: "",
      unit: "عدد",
      quantity: 1,
      unitPrice: 0,
      total: 0
    };
    updatedDoc.items = [...(updatedDoc.items || []), newItem];
    updatedDoc.totalAmount = updatedDoc.items.reduce((sum, item) => sum + Number(((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)), 0);
    setSelectedDoc(updatedDoc);
    
    const updatedDocsList = documents.map(d => d.id === selectedDoc.id ? updatedDoc : d);
    setDocuments(updatedDocsList);
    
    fetch('/api/documents/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents: updatedDocsList })
    }).catch(() => {});
  };

  // Remove a line item at a specific index
  const handleRemoveDrawerItem = (itemIdx: number) => {
    if (!selectedDoc || !selectedDoc.items) return;
    const updatedDoc = { ...selectedDoc };
    const updatedItems = [...(updatedDoc.items || [])];
    updatedItems.splice(itemIdx, 1);
    updatedDoc.items = updatedItems;
    updatedDoc.totalAmount = updatedItems.reduce((sum, item) => sum + Number(((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)), 0);
    setSelectedDoc(updatedDoc);
    
    const updatedDocsList = documents.map(d => d.id === selectedDoc.id ? updatedDoc : d);
    setDocuments(updatedDocsList);
    
    fetch('/api/documents/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents: updatedDocsList })
    }).catch(() => {});
  };

  // Clear system warning alerts logs
  const handleClearNotifications = async () => {
    try {
      const res = await fetch('/api/notifications/clear', { method: 'POST' });
      if (res.ok) setNotifications([]);
    } catch (e) {}
  };

  // Group categorized documents by unique suppliers for Supplier folders tree
  const documentsByClient = useMemo(() => {
    const groups: Record<string, ProcessedDocument[]> = {};
    documents.forEach(doc => {
      const name = doc.clientName || 'مورد غير معروف';
      if (!groups[name]) groups[name] = [];
      groups[name].push(doc);
    });
    return groups;
  }, [documents]);

  // Group categorized documents by unique projects
  const documentsByProject = useMemo(() => {
    const groups: Record<string, ProcessedDocument[]> = {};
    // Initialize all known projects with an empty array
    uniqueProjects.forEach(proj => {
      groups[proj] = [];
    });
    if (!groups['عام']) {
      groups['عام'] = [];
    }
    // Populate with documents
    documents.forEach(doc => {
      const name = doc.projectName?.trim() || 'عام';
      if (!groups[name]) groups[name] = [];
      groups[name].push(doc);
    });
    return groups;
  }, [uniqueProjects, documents]);

  // Dynamically filter projects by search query
  const filteredProjectsEntries = useMemo(() => {
    const entries = Object.entries(documentsByProject) as [string, ProcessedDocument[]][];
    if (!projectSearchTerm.trim()) return entries;
    const q = projectSearchTerm.trim().toLowerCase();
    return entries.filter(([pName, pDocs]) => {
      const matchesName = pName.toLowerCase().includes(q);
      const matchesDoc = pDocs.some(d => 
        (d.clientName || '').toLowerCase().includes(q) ||
        (d.docNumber || '').toLowerCase().includes(q) ||
        (d.summary || '').toLowerCase().includes(q)
      );
      return matchesName || matchesDoc;
    });
  }, [documentsByProject, projectSearchTerm]);

  // Helper to compute net spending for a document safely
  const getDocNetSpent = (doc: ProcessedDocument) => {
    if (doc.items && doc.items.length > 0) {
      const itemsSubtotal = doc.items.reduce((sum, item) => sum + Number(((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)), 0);
      const discPct = doc.discountPercentage || 0;
      const discAmt = doc.discountAmount || 0;
      const totalDiscount = ((itemsSubtotal * discPct) / 100) + discAmt;
      const subtotalAfterDiscount = Math.max(0, itemsSubtotal - totalDiscount);
      
      const pricesIncludeTax = doc.pricesIncludeTax !== false; // default true
      const taxAddPercentEnabled = !pricesIncludeTax && !!doc.taxAddPercentEnabled;
      const taxAddPercentRate = doc.taxAddPercentRate ?? 14;
      const vatAmount = taxAddPercentEnabled ? (subtotalAfterDiscount * taxAddPercentRate / 100) : 0;
      const totalAfterVat = subtotalAfterDiscount + vatAmount;

      const taxRate = doc.withholdingTaxEnabled ? (doc.withholdingTaxRate || 1) : 0;
      const withholdingTaxAmount = (subtotalAfterDiscount * taxRate) / 100;
      
      return totalAfterVat - withholdingTaxAmount;
    }
    return doc.totalAmount || 0;
  };

  const projectAnalytics = useMemo(() => {
    // 1. Get unique list of Projects and Currencies from all documents
    const uniqueCurrencies = new Set<string>();
    const projectsSet = new Set<string>();
    
    // Always pre-populate the project list from the documentsByProject keys
    Object.keys(documentsByProject).forEach(pName => {
      projectsSet.add(pName);
    });

    documents.forEach(d => {
      if (d.currency) uniqueCurrencies.add(d.currency);
    });
    
    // Default EGP to guarantee at least one currency
    if (uniqueCurrencies.size === 0) uniqueCurrencies.add('EGP');
    const currenciesList = Array.from(uniqueCurrencies);
    const projectsList = Array.from(projectsSet);
    
    // Map of month keys to their labels
    const getMonthLabel = (key: string) => {
      if (key === '0000-00') return 'غير محدد';
      const parts = key.split('-');
      if (parts.length === 2) {
        const [y, m] = parts;
        const arabicMonths: Record<string, string> = {
          '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
          '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
          '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
        };
        return `${arabicMonths[m]} ${y}`;
      }
      return key;
    };

    // Filter documents by selected currency first
    const currencyFiltered = documents.filter(d => {
      const c = d.currency || 'EGP';
      return c === chartSelectedCurrency;
    });

    // Sub-filter by document type selector
    const typeFiltered = currencyFiltered.filter(d => {
      if (chartSelectedDocType === 'all') return d.docType === 'po' || d.docType === 'quote';
      return d.docType === chartSelectedDocType;
    });

    // 2. Compute project distribution (for PieChart or Horizontal Bar Comparison)
    // Map project name to total sum
    const projectSums: Record<string, number> = {};
    projectsList.forEach(p => { projectSums[p] = 0; });
    
    typeFiltered.forEach(d => {
      const pName = d.projectName?.trim() || 'عام';
      const amt = getDocNetSpent(d);
      projectSums[pName] = (projectSums[pName] || 0) + amt;
    });
    
    const projectComparisonData = Object.entries(projectSums)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a,b) => b.value - a.value);

    // 3. Compute group by month
    // Find all month keys across typeFiltered
    const allDocMonths = new Set<string>();
    typeFiltered.forEach(d => {
      const dStr = d.receiptDate || d.processedAt || '';
      const match = dStr.match(/^(\d{4})-(\d{2})/);
      const mKey = match ? `${match[1]}-${match[2]}` : '0000-00';
      allDocMonths.add(mKey);
    });
    
    // Sort month keys chronologically
    const sortedMonthKeys = Array.from(allDocMonths).sort();

    interface MonthlyEntry {
      month: string;
      monthKey: string;
      total?: number;
      amount?: number;
      cumulative: number;
      docCount?: number;
      [key: string]: any;
    }

    const monthlyData: MonthlyEntry[] = [];
    let runningCumulative = 0;

    if (chartSelectedProject === 'all') {
      // Series contains monthly breakdown of all projects
      sortedMonthKeys.forEach(mKey => {
        const mLabel = getMonthLabel(mKey);
        const item: MonthlyEntry = {
          month: mLabel,
          monthKey: mKey,
          total: 0,
          cumulative: 0
        };
        
        // Initialize 0 for each project
        projectsList.forEach(p => {
          item[p] = 0;
        });

        // Sum docs in this month
        typeFiltered.forEach(d => {
          const dStr = d.receiptDate || d.processedAt || '';
          const match = dStr.match(/^(\d{4})-(\d{2})/);
          const docMKey = match ? `${match[1]}-${match[2]}` : '0000-00';
          
          if (docMKey === mKey) {
            const pName = d.projectName?.trim() || 'عام';
            const amt = getDocNetSpent(d);
            item[pName] = (item[pName] || 0) + amt;
            item.total = (item.total || 0) + amt;
          }
        });

        runningCumulative += item.total || 0;
        item.cumulative = runningCumulative;
        
        monthlyData.push(item);
      });
    } else {
      // Series contains monthly spending for ONE specific project
      const projName = chartSelectedProject;
      sortedMonthKeys.forEach(mKey => {
        const mLabel = getMonthLabel(mKey);
        const item: MonthlyEntry = {
          month: mLabel,
          monthKey: mKey,
          amount: 0,
          cumulative: 0,
          docCount: 0
        };

        typeFiltered.forEach(d => {
          const pName = d.projectName?.trim() || 'عام';
          if (pName !== projName) return;
          
          const dStr = d.receiptDate || d.processedAt || '';
          const match = dStr.match(/^(\d{4})-(\d{2})/);
          const docMKey = match ? `${match[1]}-${match[2]}` : '0000-00';
          
          if (docMKey === mKey) {
            const amt = getDocNetSpent(d);
            item.amount = (item.amount || 0) + amt;
            item.docCount = (item.docCount || 0) + 1;
          }
        });

        runningCumulative += item.amount || 0;
        item.cumulative = runningCumulative;

        if ((item.amount || 0) > 0 || item.cumulative > 0) {
          monthlyData.push(item);
        }
      });
    }

    // Prepare overview stats for selected project / all projects
    let statsTotalAmount = 0;
    let statsDocCount = 0;

    typeFiltered.forEach(d => {
      const pName = d.projectName?.trim() || 'عام';
      if (chartSelectedProject !== 'all' && pName !== chartSelectedProject) return;
      statsTotalAmount += getDocNetSpent(d);
      statsDocCount += 1;
    });

    const statsAverageAmount = statsDocCount > 0 ? statsTotalAmount / statsDocCount : 0;

    return {
      currenciesList,
      projectsList,
      projectComparisonData,
      monthlyData,
      totalSpentOverall: statsTotalAmount,
      docCountOverall: statsDocCount,
      averageSpentOverall: statsAverageAmount
    };
  }, [documents, documentsByProject, chartSelectedProject, chartSelectedCurrency, chartSelectedDocType]);

  // Find printable document from documents list
  const printDoc = useMemo(() => {
    if (!printDocId) return null;
    return documents.find(d => d.id === printDocId);
  }, [printDocId, documents]);

  // Print trigger auto-opens browser dialog disabled to prevent infinite print loops and support manual clicks
  useEffect(() => {
    // Disabled auto window.print() trigger to prevent endless loops and respect direct button interactions
  }, [printDocId, loading, printDoc]);

  if (printDocId) {
    if (loading) {
      return (
        <div className="min-h-screen bg-white flex flex-col justify-center items-center gap-4 text-center font-sans p-6" dir="rtl">
          <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-extrabold text-slate-800">جاري جلب تفاصيل المستند وتجهيز شيت DELTA للطباعة...</p>
        </div>
      );
    }

    if (!printDoc) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center gap-4 text-center font-sans p-6" dir="rtl">
          <div className="p-3 bg-red-100 text-red-700 rounded-2xl border border-red-200 text-lg">⚠️</div>
          <p className="text-sm font-bold text-slate-700">عذراً، لم نتمكن من العثور على هذا المستند أو أن معرف المستند غير صحيح.</p>
          <button 
            type="button"
            onClick={() => window.close()} 
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
          >
            إغلاق هذه الصفحة ❌
          </button>
        </div>
      );
    }

    const hasAnyBrand = !!(printDoc.items && printDoc.items.some(item => item.brand?.trim() !== ""));

    // Direct printable clean view structure
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-2 sm:p-5 print:p-0 print:bg-white" dir={printDirectionParam}>
        
        {/* NON-PRINTABLE DIRECTIVE BANNER (Will be hidden completely during true printing) */}
        <div className="no-print bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 max-w-4xl mx-auto flex flex-col gap-4 text-right shadow-xl font-sans text-slate-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3 text-sky-400">
              <Printer className="w-5 h-5 flex-shrink-0" />
              <h2 className="text-sm font-black text-white">
                تجهيز وطباعة شيت DELTA الفني 🖨️
              </h2>
            </div>
            <div className="px-2 py-0.5 bg-indigo-500/20 text-indigo-350 text-[10px] font-bold rounded">
              إصدار فائق التوافق (v2)
            </div>
          </div>
          
          <div className="text-xs text-slate-300 leading-relaxed font-medium space-y-3">
            <p>
              لتوفير توافق كامل بنسبة 100% مع جميع المتصفحات (Brave, Google Chrome, Firefox, Safari) وتفادي قيود الحماية المفروضة على نوافذ المحاكاة (Iframe) أو مشاكل تسجيل الدخول، قمنا بإتاحة طريقتين مكملتين لحفظ الشيت:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-right">
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-800">
                <span className="text-sky-400 font-extrabold block mb-1">الخيار الأول: تنزيل ملف PDF مباشر (موصى به لـ Brave و Iframe) 📥</span>
                يقوم بتوليد شيت PDF فوري وتنزيله إلى جهازك مباشرة بـ نقرة واحدة دون استخدام نافذة الطباعة التقليدية.
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-800">
                <span className="text-emerald-400 font-extrabold block mb-1">الخيار الثاني: طباعة المتصفح التقليدية 🖨️</span>
                يفتح نافذة الطباعة الرسمية الخاصة بـ المتصفح (يعمل بكفاءة عند فتح التطبيق في نافذة مستقلة).
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 bg-slate-800/40 p-4 rounded-xl border border-slate-800 mt-1 text-right">
            <span className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5 justify-end">
              <span>تنسيق نصوص الجدول وعرض الخلايا:</span>
              <span>🛠️</span>
            </span>
            <div className="flex flex-wrap gap-2 text-xs font-sans justify-end mt-1">
              <button
                type="button"
                onClick={() => setTableAlignment('center')}
                className={`px-2.5 py-1.5 rounded-lg font-black transition-all cursor-pointer ${tableAlignment === 'center' ? 'bg-sky-650 text-white shadow' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`}
              >
                🎯 في المنتصف (الافتراضي)
              </button>
              <button
                type="button"
                onClick={() => setTableAlignment('right')}
                className={`px-2.5 py-1.5 rounded-lg font-black transition-all cursor-pointer ${tableAlignment === 'right' ? 'bg-sky-650 text-white shadow' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`}
              >
                ➡️ محاذاة لليمين
              </button>
              <button
                type="button"
                onClick={() => setTableAlignment('left')}
                className={`px-2.5 py-1.5 rounded-lg font-black transition-all cursor-pointer ${tableAlignment === 'left' ? 'bg-sky-650 text-white shadow' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`}
              >
                ⬅️ محاذاة لليسار
              </button>
              <button
                type="button"
                onClick={() => setTableAlignment('auto')}
                className={`px-2.5 py-1.5 rounded-lg font-black transition-all cursor-pointer ${tableAlignment === 'auto' ? 'bg-sky-650 text-white shadow' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}`}
              >
                🔄 تلقائي طبق الاتجاه
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 bg-slate-800/40 p-4 rounded-xl border border-slate-800 mt-2 text-right">
            <span className="text-xs font-extrabold text-slate-300 flex items-center gap-1.5 justify-end">
              <span>تخصيص هوامش صفحة الطباعة (mm):</span>
              <span>📐</span>
            </span>
            <div className="flex flex-wrap gap-4 text-xs font-mono justify-end mt-1 items-center">
              <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-bold">يسار (Left):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={printMarginLeft}
                  onChange={(e) => setPrintMarginLeft(Math.max(0, Number(e.target.value) || 0))}
                  className="w-12 bg-slate-800 border border-slate-700 text-white font-bold text-center px-1 py-0.5 rounded focus:outline-hidden focus:border-sky-500"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-bold">يمين (Right):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={printMarginRight}
                  onChange={(e) => setPrintMarginRight(Math.max(0, Number(e.target.value) || 0))}
                  className="w-12 bg-slate-800 border border-slate-700 text-white font-bold text-center px-1 py-0.5 rounded focus:outline-hidden focus:border-sky-500"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-bold">تحت (Bottom):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={printMarginBottom}
                  onChange={(e) => setPrintMarginBottom(Math.max(0, Number(e.target.value) || 0))}
                  className="w-12 bg-slate-800 border border-slate-700 text-white font-bold text-center px-1 py-0.5 rounded focus:outline-hidden focus:border-sky-500"
                />
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-bold">فوق (Top):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={printMarginTop}
                  onChange={(e) => setPrintMarginTop(Math.max(0, Number(e.target.value) || 0))}
                  className="w-12 bg-slate-800 border border-slate-700 text-white font-bold text-center px-1 py-0.5 rounded focus:outline-hidden focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-3 mt-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => {
                setPrintDocId(null);
                const url = new URL(window.location.href);
                if (url.searchParams.has('print')) {
                  url.searchParams.delete('print');
                  url.searchParams.delete('dir');
                  url.searchParams.delete('align');
                  window.location.href = url.pathname;
                }
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer hover:scale-[1.02]"
            >
              العودة للوحة التحكم 🔙
            </button>
            
            <div className="flex flex-wrap gap-2.5">
              {/* Direct PDF Download Button */}
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="px-5 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none"
              >
                {isGeneratingPDF ? (
                  <>
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                    <span>جاري توليد ملف PDF فائق الوضوح...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-sky-200" />
                    <span>تنزيل ملف PDF مباشر 📥</span>
                  </>
                )}
              </button>

              {/* Force Open in New Tab URL Anchor for sandboxed bypass */}
              <a
                href={`${window.location.origin}${window.location.pathname}?print=${printDoc.id}&dir=${printDirectionParam}`}
                target="_blank"
                rel="noopener"
                className="px-5 py-2 bg-[#1d4ed8] hover:bg-blue-600 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-2 hover:scale-[1.02] no-print"
              >
                <ExternalLink className="w-4 h-4 text-blue-200" />
                <span>فتح في نافذة كاملة للطباعة الفورية 🌐</span>
              </a>

              {/* Standard printer trigger */}
              <button
                type="button"
                onClick={() => {
                  if (isInIframe) {
                    alert("⚠️ القيود الأمنية للمتصفح تمنع الطباعة من داخل إطار المعاينة (Iframe).\n\nيرجى التفضل بالضغط أولاً على الزر الأزرق المجاور لفتح الصفحة في نافذة كاملة مستقلة [فتح في نافذة كاملة للطباعة الفورية 🌐] لتمكين الطباعة الورقية وحفظها بنقرة واحدة!");
                    return;
                  }
                  try {
                    window.focus();
                    window.print();
                  } catch (e) {
                    console.warn("Manual print error:", e);
                  }
                }}
                disabled={isGeneratingPDF}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 hover:scale-[1.02]"
              >
                <Printer className="w-4 h-4 text-emerald-200" />
                <span>طباعة عبر المتصفح 🖨️</span>
              </button>
            </div>
          </div>
        </div>

        {/* Iframe restricted browser print warning */}
        {isInIframe && (
          <div className="w-full max-w-4xl mx-auto mb-6 bg-amber-950/40 border border-amber-900/40 rounded-2xl p-4 text-right no-print" dir="rtl">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">⚠️</span>
              <div className="space-y-1 font-sans">
                <h4 className="text-xs font-black text-amber-400">تنبيه لضمان جودة الطباعة المباشرة:</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed font-bold">
                  أنت تتصفح الموقع حالياً من داخل إطار المعاينة لـ AI Studio (Iframe). 
                  متصفحات الويب تمنع تشغيل أمر الطباعة المباشرة داخل الإطارات بسبب قيود الحماية.
                </p>
                <div className="pt-2 text-[10.5px] text-amber-300 font-medium space-y-1">
                  <div>💡 للحصول على المستند الورقي، يرجى الضغط على زر <span className="font-extrabold text-white bg-slate-800 px-1.5 py-0.5 rounded-md text-[10px]">تنزيل ملف PDF مباشر 📥</span> بالأعلى ثم طباعته كالمعتاد.</div>
                  <div>🔄 أو قم بفتح الموقع في نافذة مستقلة بالكامل عبر زر الانتقال بأعلى الشاشة لتشغيل ميزة الطباعة الفورية للورق!</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic User Custom Margins and @page overrider injection */}
        <style dangerouslySetInnerHTML={{ __html: `
          #printable-excel-sheet-delta-isolated,
          #printable-excel-sheet-delta-isolated table,
          #printable-excel-sheet-delta-isolated th,
          #printable-excel-sheet-delta-isolated td,
          #printable-excel-sheet-delta-isolated span,
          #printable-excel-sheet-delta-isolated div {
            font-size: 11px !important;
          }
          #printable-excel-sheet-delta-isolated tr {
            height: auto !important;
            min-height: auto !important;
            max-height: auto !important;
          }
          #printable-excel-sheet-delta-isolated td,
          #printable-excel-sheet-delta-isolated th {
            display: table-cell !important;
            height: auto !important;
            min-height: auto !important;
            max-height: auto !important;
            line-height: 1.4 !important;
          }
          @media print {
            @page {
              size: A4 portrait !important;
              margin: ${printMarginTop}mm ${printMarginRight}mm ${printMarginBottom}mm ${printMarginLeft}mm !important;
            }
            #printable-excel-sheet-delta-isolated,
            #printable-excel-sheet-delta-isolated table,
            #printable-excel-sheet-delta-isolated th,
            #printable-excel-sheet-delta-isolated td,
            #printable-excel-sheet-delta-isolated span,
            #printable-excel-sheet-delta-isolated div {
              font-size: 11px !important;
            }
            #printable-excel-sheet-delta-isolated tr {
              height: auto !important;
              min-height: auto !important;
              max-height: auto !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            #printable-excel-sheet-delta-isolated td,
            #printable-excel-sheet-delta-isolated th {
              display: table-cell !important;
              height: auto !important;
              min-height: auto !important;
              max-height: auto !important;
              line-height: 1.4 !important;
              padding: 12px 10px !important;
            }
            .col-print-no {
              width: 5% !important;
              min-width: 5% !important;
              max-width: 5% !important;
            }
            .col-print-desc {
              width: ${hasAnyBrand ? '42%' : '50%'} !important;
              min-width: ${hasAnyBrand ? '42%' : '50%'} !important;
              max-width: ${hasAnyBrand ? '42%' : '50%'} !important;
              text-align: right !important;
              direction: rtl !important;
            }
            .col-print-brand {
              width: 8% !important;
              min-width: 8% !important;
              max-width: 8% !important;
            }
            .col-print-unit {
              width: 8% !important;
              min-width: 8% !important;
              max-width: 8% !important;
            }
            .col-print-qty {
              width: 8% !important;
              min-width: 8% !important;
              max-width: 8% !important;
            }
            .col-print-price {
              width: 14% !important;
              min-width: 14% !important;
              max-width: 14% !important;
              white-space: nowrap !important;
            }
            .col-print-amount {
              width: 15% !important;
              min-width: 15% !important;
              max-width: 15% !important;
              white-space: nowrap !important;
            }
          }
        `}} />

        {/* PRISTINE VIRTUAL EXCEL SHEET FOR PRINT */}
        <div className="w-full max-w-4xl mx-auto print-me-wrapper">
          <div 
            id="printable-excel-sheet-delta-isolated"
            className={`border border-slate-300 bg-white font-sans text-xs select-none print-me ${
              printDirectionParam === 'rtl' ? 'print-rtl' : 'print-ltr'
            }`}
          >
            {/* Header Banner Block with dark blue top bar */}
            <div className="excel-header-banner border-t-[5px] border-[#0000FF] border-b border-black py-4 px-4 flex justify-between items-center bg-[#B2B2B2]">
              <div className="text-left font-sans">
                <div className="text-xl font-bold text-black tracking-tight leading-none">DELTA</div>
                <div className="text-[10px] md:text-xs font-bold text-black mt-1.5 tracking-wider uppercase">FOR ROAD CONSTRUCTION</div>
              </div>
              <div className="text-right font-sans">
                <div className="text-base font-bold text-black tracking-wider leading-none uppercase">
                  PURCHASE
                </div>
                <div className="text-base font-bold text-black tracking-wider leading-none mt-1 uppercase">
                  ORDER
                </div>
              </div>
            </div>

              {/* Metadata Box styled as Excel Rows - Merged into a desktop grid or responsive mobile blocks */}
              <div className="hidden md:grid grid-cols-12 border-b border-slate-350 text-black font-sans bg-white select-text print:grid" style={{ height: 'auto', minHeight: 'auto' }}>
                {/* Column 1: Vendor (Seller) */}
                <div 
                  className="col-span-3 border-e border-slate-300 flex flex-col gap-1 justify-center text-center items-center"
                  style={{ height: 'auto', minHeight: 'auto', maxHeight: 'auto', padding: '12px 8px', lineHeight: '1.4' }}
                >
                  <span className="text-xs font-black text-black uppercase tracking-wider text-center whitespace-normal select-none" style={{ lineHeight: '1.4' }}>
                    {printDirectionParam === 'rtl' ? 'اسم البائع (Vendor)' : 'Vendor'}
                  </span>
                  <div
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                    className="font-black text-black text-[14px] mt-1 w-full text-center block whitespace-normal break-words focus:outline-hidden focus:ring-1 focus:ring-sky-500 focus:bg-amber-50/10 cursor-text rounded px-1 transition-colors"
                    style={{ lineHeight: '1.4' }}
                    onBlur={(e) => {
                      const text = e.currentTarget.innerText || "";
                      handleUpdatePrintDocField('clientName', text.trim());
                    }}
                  >
                    {printDoc.clientName || "غير محدد"}
                  </div>
                </div>

                {/* Column 2: Ship to */}
                <div 
                  className="col-span-2 border-e border-slate-300 flex flex-col gap-1 justify-center text-center items-center"
                  style={{ height: 'auto', minHeight: 'auto', maxHeight: 'auto', padding: '12px 8px', lineHeight: '1.4' }}
                >
                  <span className="text-xs font-black text-black uppercase tracking-wider text-center whitespace-normal select-none" style={{ lineHeight: '1.4' }}>
                    {printDirectionParam === 'rtl' ? 'اسم المشروع' : 'SHIP TO'}
                  </span>
                  <span className="font-extrabold text-slate-850 text-xs text-black" style={{ lineHeight: '1.4' }}>
                    {printDoc.projectName || "عام"}
                  </span>
                </div>

                {/* Column 3: PO No */}
                <div 
                  className="col-span-2 border-e border-slate-300 flex flex-col gap-1 justify-center text-center items-center"
                  style={{ height: 'auto', minHeight: 'auto', maxHeight: 'auto', padding: '12px 8px', lineHeight: '1.4' }}
                >
                  <span className="text-xs font-black text-black uppercase tracking-wider text-center whitespace-normal select-none" style={{ lineHeight: '1.4' }}>
                    {printDirectionParam === 'rtl' ? 'رقم أمر الشراء / PO' : 'PO No'}
                  </span>
                  <span className="font-mono font-black text-black text-sm mt-1 w-full text-center block whitespace-normal break-all" style={{ lineHeight: '1.4' }}>
                    #{printDoc.docNumber || "31"}
                  </span>
                </div>

                {/* Column 4: Date */}
                <div 
                  className="col-span-2 border-e border-slate-300 flex flex-col gap-1 justify-center text-center items-center date-container"
                  style={{ height: 'auto', minHeight: 'auto', maxHeight: 'auto', padding: '12px 8px', lineHeight: '1.4' }}
                >
                  <span className="text-xs font-black text-black uppercase tracking-wider text-center whitespace-normal select-none" style={{ lineHeight: '1.4' }}>
                    {printDirectionParam === 'rtl' ? 'تاريخ المستند' : 'Order Date'}
                  </span>
                  <span className="font-mono font-black text-black text-sm mt-1 w-full text-center block whitespace-nowrap date-text" style={{ lineHeight: '1.4' }}>
                    {printDoc.receiptDate || ""}
                  </span>
                </div>

                {/* Column 5: Total */}
                <div 
                  className="col-span-3 flex flex-col gap-1 justify-center text-center bg-amber-50/10 select-text items-center"
                  style={{ height: 'auto', minHeight: 'auto', maxHeight: 'auto', padding: '12px 8px', lineHeight: '1.4' }}
                >
                  <span className="text-xs font-black text-black uppercase tracking-wider text-center whitespace-normal select-none" style={{ lineHeight: '1.4' }}>
                    {printDirectionParam === 'rtl' ? 'PO Total' : 'PO Total'}
                  </span>
                  <span className="font-mono font-black text-[#DC2626] text-[13.5px] mt-1 select-text w-full text-center block whitespace-nowrap overflow-visible" style={{ lineHeight: '1.4' }}>
                    {getDocNetSpent(printDoc).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Mobile-Friendly Metadata View for printable sheet (Screen interface only, hidden in print output) */}
              <div className="md:hidden print:hidden border-b border-slate-200 bg-slate-50/70 p-4 space-y-3 font-sans text-right" dir="rtl">
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] font-bold text-slate-450 mb-1">
                      {printDirectionParam === 'rtl' ? 'اسم البائع (Vendor)' : 'Vendor'}
                    </span>
                    <div
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      className="font-extrabold text-slate-800 text-xs focus:outline-hidden focus:ring-1 focus:ring-sky-500 focus:bg-amber-50/10 cursor-text rounded px-1"
                      onBlur={(e) => {
                        const text = e.currentTarget.innerText || "";
                        handleUpdatePrintDocField('clientName', text.trim());
                      }}
                    >
                      {printDoc.clientName || "غير محدد"}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] font-bold text-slate-450 mb-1">
                      {printDirectionParam === 'rtl' ? 'اسم المشروع' : 'SHIP TO'}
                    </span>
                    <span className="font-extrabold text-slate-800 text-xs">
                      {printDoc.projectName || "عام"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] font-bold text-slate-450 mb-1">P.O. Number</span>
                    <span className="font-mono font-bold text-slate-800 text-[11px] mt-0.5">
                      #{printDoc.docNumber || "31"}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center date-container">
                    <span className="text-[10px] font-bold text-slate-450 mb-1">تاريخ المعاملة</span>
                    <span className="font-mono font-bold text-slate-800 text-[11px] mt-0.5 whitespace-nowrap date-text">
                      {printDoc.receiptDate || ""}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] font-bold text-slate-450 mb-1">القيمة الإجمالية</span>
                    <span className="font-mono font-black text-[#DC2626] text-[11px] mt-0.5">
                      {getDocNetSpent(printDoc).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

            {/* Excel Row Headers */}
            {showExcelGrid && (
              <div className="bg-[#FAFAFA] border-b border-slate-300 text-slate-400 font-mono text-[9px] font-bold text-center flex animate-none select-none">
                <div className="py-1 w-12 border-e border-slate-200 bg-[#EFEFEF] text-slate-500 font-bold">Row</div>
                <div className="py-1 w-12 border-e border-slate-200 bg-[#EFEFEF]">A</div>
                <div className="py-1 flex-1 border-e border-slate-200">B</div>
                {hasAnyBrand && <div className="py-1 w-24 border-e border-slate-200">C</div>}
                <div className="py-1 w-16 border-e border-slate-200">{hasAnyBrand ? 'D' : 'C'}</div>
                <div className="py-1 w-16 border-e border-slate-200">{hasAnyBrand ? 'E' : 'D'}</div>
                <div className="py-1 w-24 border-e border-slate-200">{hasAnyBrand ? 'F' : 'E'}</div>
                <div className="py-1 w-32">{hasAnyBrand ? 'G' : 'F'}</div>
              </div>
            )}

            {/* Excel Table Area */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border-b border-slate-300 text-sm text-slate-800 table-fixed">
                <thead>
                  <tr className="bg-[#EFEFEF] border-b border-slate-300 font-extrabold text-black text-center select-none text-xs align-middle">
                    {showExcelGrid && (
                      <th className="border-e border-slate-300 py-4 w-12 min-w-[48px] max-w-[48px] font-mono text-[10px] text-center align-middle font-bold text-black" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        -
                      </th>
                    )}
                    {showExcelGrid && (
                      <th className="border-e border-slate-300 py-4 w-12 min-w-[48px] max-w-[48px] font-mono text-[10px] text-center align-middle font-bold text-black" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        Row No.
                      </th>
                    )}
                    <th className="border-e border-[#B0B0B0] py-4 w-12 min-w-[48px] max-w-[48px] font-sans text-center select-none align-middle font-bold text-black col-print-no" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                      No
                    </th>
                    <th className="border-e border-[#B0B0B0] py-4 px-3 min-w-[260px] text-center align-middle font-bold text-black col-print-desc" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                      {printDirectionParam === 'rtl' ? 'الوصف التفصيلي (Description)' : 'Description'}
                    </th>
                    {hasAnyBrand && (
                      <th className="border-e border-slate-300 py-4 w-24 min-w-[96px] max-w-[96px] font-sans text-center align-middle font-bold text-black col-print-brand" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                        {printDirectionParam === 'rtl' ? 'البراند (Brand)' : 'Brand'}
                      </th>
                    )}
                    <th className="border-e border-slate-300 py-4 w-16 min-w-[64px] max-w-[64px] text-center align-middle font-bold text-black col-print-unit" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                      Unit
                    </th>
                    <th className="border-e border-slate-300 py-4 w-16 min-w-[64px] max-w-[64px] text-center align-middle font-bold text-black col-print-qty" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                      Qty
                    </th>
                    <th className="border-e border-slate-300 py-4 w-28 min-w-[112px] max-w-[112px] text-center align-middle font-bold text-black col-print-price" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                      Price
                    </th>
                    <th className="py-4 w-28 min-w-[112px] max-w-[112px] text-center align-middle font-bold text-black col-print-amount" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const printTotalBaseCount = printDoc.items?.length || 0;
                    
                    return (
                      <>
                        {/* Actual Document Items */}
                        {printDoc.items && printDoc.items.length > 0 ? (
                          printDoc.items.map((item, idx) => {
                            const sequenceNo = idx + 1;
                            const rowNo = idx + 10;
                            const pricesIncludeTax = printDoc.pricesIncludeTax !== false;
                            const taxAddPercentEnabled = !pricesIncludeTax && !!printDoc.taxAddPercentEnabled;
                            const taxAddPercentRate = printDoc.taxAddPercentRate ?? 14;
                            const isDescVeryLarge = item.description && (item.description.length > 100 || item.description.includes('\n') || item.description.includes('<br'));
                            const shouldBreak = false; // تم إيقاف فصل الصفحات الإجباري بناءً على طلب المستخدم لتبدو البنود متتالية
                            return (
                              <tr 
                                key={idx} 
                                className="border-b border-slate-200 font-bold hover:bg-slate-50/50"
                                style={{
                                  pageBreakInside: 'avoid',
                                  breakInside: 'avoid',
                                  pageBreakAfter: 'auto',
                                  breakAfter: 'auto'
                                }}
                              >
                                {showExcelGrid && (
                                  <td className="border-e border-slate-200 bg-[#EFEFEF] text-center text-[10px] font-mono font-bold text-slate-400 py-5 w-12 min-w-[48px] max-w-[48px] select-none align-middle" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                    {rowNo}
                                  </td>
                                )}
                                {showExcelGrid && (
                                  <td className="border-e border-slate-200 py-5 text-center text-slate-500 font-mono font-semibold w-12 min-w-[48px] max-w-[48px] select-none align-middle" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                    {sequenceNo}
                                  </td>
                                )}
                                <td className="border-e border-slate-200 py-5 text-center font-bold text-black w-12 min-w-[48px] max-w-[48px] align-middle col-print-no" style={{ verticalAlign: 'middle', textAlign: 'center' }}>{idx + 1}</td>
                                <td className="border-e border-slate-200 py-5 px-3 min-w-[260px] align-middle text-center col-print-desc" dir="auto" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                  <div 
                                    contentEditable={true}
                                    suppressContentEditableWarning={true}
                                    dir="auto"
                                    className="font-bold text-black leading-relaxed text-[13px] whitespace-normal break-words w-full text-center align-middle focus:outline-hidden focus:ring-1 focus:ring-sky-500 focus:bg-amber-50/10 cursor-text rounded px-1 transition-colors" 
                                    title={item.description}
                                    onBlur={(e) => {
                                      const text = e.currentTarget.innerText || "";
                                      handleUpdatePrintItem(idx, 'description', text);
                                    }}
                                  >
                                    {item.description ? convertEasternToWesternNumerals(item.description.replace(/\\"/g, '"').replace(/\\/g, '').trim()) : ""}
                                  </div>
                                </td>
                                {hasAnyBrand && (
                                  <td className="border-e border-slate-200 py-5 text-black font-bold w-24 min-w-[96px] max-w-[96px] break-words whitespace-normal font-sans text-center align-middle col-print-brand" dir="auto" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                    <div
                                      contentEditable={true}
                                      suppressContentEditableWarning={true}
                                      dir="auto"
                                      className="w-full text-center focus:outline-hidden focus:ring-1 focus:ring-sky-500 focus:bg-amber-50/10 cursor-text rounded px-1"
                                      onBlur={(e) => {
                                        const text = e.currentTarget.innerText || "";
                                        handleUpdatePrintItem(idx, 'brand', text);
                                      }}
                                    >
                                      {item.brand ? convertEasternToWesternNumerals(item.brand) : "غير محدد"}
                                    </div>
                                  </td>
                                )}
                                <td className="border-e border-slate-200 py-5 text-black font-bold w-16 min-w-[64px] max-w-[64px] break-words whitespace-normal text-center align-middle col-print-unit" dir="auto" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                  <div
                                    contentEditable={true}
                                    suppressContentEditableWarning={true}
                                    dir="auto"
                                    className="w-full text-center focus:outline-hidden focus:ring-1 focus:ring-sky-500 focus:bg-amber-50/10 cursor-text rounded px-1"
                                    onBlur={(e) => {
                                      let text = e.currentTarget.innerText || "";
                                      text = text.trim();
                                      if (text === 'عئد' || text === 'عئد.' || text.includes('عئد')) {
                                        text = 'عدد';
                                        e.currentTarget.innerText = 'عدد';
                                      }
                                      handleUpdatePrintItem(idx, 'unit', text);
                                    }}
                                  >
                                    {item.unit && !item.unit.includes('عئد') && item.unit !== 'عئد.' && item.unit !== 'عئد' ? convertEasternToWesternNumerals(item.unit) : "عدد"}
                                  </div>
                                </td>
                                <td className="border-e border-slate-200 py-5 font-bold text-black w-16 min-w-[64px] max-w-[64px] text-center align-middle col-print-qty" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                  <div
                                    contentEditable={true}
                                    suppressContentEditableWarning={true}
                                    className="w-full text-center font-mono focus:outline-hidden focus:ring-1 focus:ring-sky-500 focus:bg-amber-50/10 cursor-text rounded px-1"
                                    onBlur={(e) => {
                                      const cleanText = e.currentTarget.innerText.replace(/,/g, '').trim();
                                      const val = parseFloat(cleanText) || 0;
                                      handleUpdatePrintItem(idx, 'quantity', val);
                                    }}
                                  >
                                    {item.quantity || "1"}
                                  </div>
                                </td>
                                <td className="border-e border-slate-200 py-5 font-bold text-black w-28 min-w-[112px] max-w-[112px] text-center align-middle font-mono text-[12px] whitespace-nowrap text-nowrap col-print-price" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                  <div
                                    contentEditable={true}
                                    suppressContentEditableWarning={true}
                                    className="w-full text-center font-mono focus:outline-hidden focus:ring-1 focus:ring-sky-500 focus:bg-amber-50/10 cursor-text rounded px-1 whitespace-nowrap text-nowrap"
                                    onBlur={(e) => {
                                      const cleanText = e.currentTarget.innerText.replace(/[^\d.]/g, '').trim();
                                      let val = parseFloat(cleanText) || 0;
                                      if (taxAddPercentEnabled) {
                                        val = val / (1 + taxAddPercentRate / 100);
                                      }
                                      handleUpdatePrintItem(idx, 'unitPrice', val);
                                    }}
                                  >
                                    {(() => {
                                      const basePrice = item.unitPrice || 0;
                                      const displayedPrice = taxAddPercentEnabled ? basePrice * (1 + taxAddPercentRate / 100) : basePrice;
                                      return displayedPrice.toLocaleString('en-US', { minimumFractionDigits: 2 });
                                    })()}
                                  </div>
                                </td>
                                <td className="py-5 w-28 min-w-[112px] max-w-[112px] select-text font-black text-black font-mono text-[12px] text-center align-middle font-mono whitespace-nowrap text-nowrap col-print-amount" style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                  <div className="whitespace-nowrap text-nowrap text-center w-full">
                                    {(() => {
                                      const baseTotal = item.total ? item.total : ((item.quantity || 0) * (item.unitPrice || 0));
                                      const displayedTotal = taxAddPercentEnabled ? baseTotal * (1 + taxAddPercentRate / 100) : baseTotal;
                                      return displayedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
                                    })()}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : null}

                        {(() => {
                          const pricesIncludeTax = printDoc.pricesIncludeTax !== false;
                          const taxAddPercentEnabled = !pricesIncludeTax && !!printDoc.taxAddPercentEnabled;
                          const taxAddPercentRate = printDoc.taxAddPercentRate ?? 14;

                          const originalSubtotal = printDoc.items && printDoc.items.length > 0
                            ? printDoc.items.reduce((sum, item) => sum + (item.total ? item.total : ((item.quantity || 0) * (item.unitPrice || 0))), 0)
                            : (printDoc.totalAmount || 0);

                          const itemsSubtotal = taxAddPercentEnabled
                            ? originalSubtotal * (1 + taxAddPercentRate / 100)
                            : originalSubtotal;

                          const withholdingTaxRate = printDoc.withholdingTaxEnabled ? (printDoc.withholdingTaxRate || 1) : 0;
                          const withholdingTaxAmount = (originalSubtotal * withholdingTaxRate) / 100;
                          const finalNetPayable = itemsSubtotal - withholdingTaxAmount;

                          return (
                            <>
                              {/* 1. Subtotal Row (Always shown, includes VAT directly if taxAddPercentEnabled) */}
                              <tr className="bg-[#F9FAFB] border-t border-slate-300 font-bold text-slate-900 text-center select-none animate-none">
                                {showExcelGrid && (
                                  <td colSpan={2} className="border-e border-slate-200 bg-[#DEDEDE] text-center text-[10px] font-mono font-bold text-slate-500 py-5 w-24" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                    {10 + printTotalBaseCount}
                                  </td>
                                )}
                                <td colSpan={hasAnyBrand ? 6 : 5} className="border-e border-slate-200 text-center align-middle py-5 font-bold text-slate-800 uppercase tracking-wide" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                  {printDirectionParam === 'rtl' ? 'الإجمالي (Total)' : 'Total'}
                                </td>
                                <td className="py-5 w-28 min-w-[112px] max-w-[112px] font-extrabold text-black font-mono text-xs select-text whitespace-nowrap text-center align-middle px-3" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                  {itemsSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>

                              {/* 2. Conditional withholding tax row */}
                              {printDoc.withholdingTaxEnabled && (
                                <tr className="bg-[#FFFDF3] border-t border-slate-200 text-slate-700 text-center select-none font-semibold text-xs font-sans">
                                  {showExcelGrid && (
                                    <td colSpan={2} className="border-e border-slate-150 bg-[#E8E8E8] text-center text-[10px] font-mono font-bold text-slate-400 py-5 w-24" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                      {11 + printTotalBaseCount}
                                    </td>
                                  )}
                                  <td colSpan={hasAnyBrand ? 6 : 5} className="border-e border-slate-200 text-center align-middle py-5 text-amber-700 font-medium whitespace-nowrap" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                    {printDirectionParam === 'rtl' 
                                      ? `خصم ضريبة الأرباح التجارية والصناعية (${printDoc.withholdingTaxRate || 1}%)` 
                                      : `Commercial & Industrial Profits Tax Discount (${printDoc.withholdingTaxRate || 1}%)`
                                    }
                                  </td>
                                  <td className="py-5 w-28 min-w-[112px] max-w-[112px] font-bold text-amber-600 font-mono text-xs select-text whitespace-nowrap text-center align-middle px-3" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                    -{withholdingTaxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              )}

                              {/* 3. Final Net Payable Row */}
                              {printDoc.withholdingTaxEnabled && (
                                <tr className="bg-[#E5E7EB] border-t-2 border-slate-350 font-bold text-slate-950 text-center select-none font-sans">
                                  {showExcelGrid && (
                                    <td colSpan={2} className="border-e border-slate-200 bg-[#DEDEDE] text-center text-[10px] font-mono font-bold text-slate-500 py-5 w-24" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                      {12 + printTotalBaseCount}
                                    </td>
                                  )}
                                  <td colSpan={hasAnyBrand ? 6 : 5} className="border-e border-slate-200 text-center align-middle py-5 font-bold text-[#DC2626] uppercase tracking-wide" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                    Net Payable
                                  </td>
                                  <td className="py-5 w-28 min-w-[112px] max-w-[112px] font-extrabold text-[#DC2626] bg-amber-50/20 font-mono text-xs select-text whitespace-nowrap text-center align-middle px-3" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                    {finalNetPayable.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })()}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* Terms and conditions block styled as Sheet Cells with strict LTR alignment */}
            <div className="bg-[#FCFCFC] border-t-2 border-dashed border-slate-200 p-5 space-y-4 text-xs font-sans text-left select-text" dir="ltr">
              <div>
                <div className="font-extrabold text-black mb-2.5 uppercase select-none tracking-wide text-[11px]">
                  Terms & conditions
                </div>
                <div className="space-y-4 text-black font-semibold font-sans">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0 mt-1.5" />
                    <span><strong className="text-black mr-1 font-bold">VAT:</strong> {printDoc.vatTerms ?? "Prices include 14% VAT."}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0 mt-1.5" />
                    <span><strong className="text-black mr-1 font-bold">Logistic Terms:</strong> {printDoc.deliveryTerms ?? "Prices include Transportation."}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0 mt-1.5" />
                    <span><strong className="text-black mr-1 font-bold">Place of delivery:</strong> {printDoc.projectName ? printDoc.projectName.replace(/\s*project\s*$/i, "").trim() : (printDoc.shipToAddress || "عام")}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-black shrink-0 mt-1.5" />
                    <span><strong className="text-black mr-1 font-bold">Date of delivery at site:</strong> {printDoc.deliveryDate || "15-06-2026"}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <div className="font-extrabold text-black mb-2.5 uppercase select-none tracking-wide text-[11px]">
                  Payment Terms :
                </div>
                <div className="space-y-2 text-black font-semibold font-sans">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-black shrink-0 w-3 text-[11px]">1.</span>
                    <span>Payment by check in the name of the company as shown in your commercial register.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-black shrink-0 w-3 text-[11px]">2.</span>
                    <span>Or in the name of the authorized person through your company.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-black shrink-0 w-3 text-[11px]">3.</span>
                    <span>Or by bank transfer to your company account within <strong>{printDoc.paymentDays || "10"}</strong> days of the delivery date.</span>
                  </div>
                  {(() => {
                    const pctDetails = getAdvancePercentageDetails(printDoc.advancePayment, printDoc.totalAmount);
                    if (!pctDetails) return null;
                    return (
                      <>
                        <div className="flex items-start gap-2 border-t border-slate-100 pt-2 mt-2">
                          <span className="font-bold text-[#DC2626] shrink-0 w-3 text-[11px]">4.</span>
                          <span className="w-full text-[#DC2626] font-bold">
                            Advanced Payment: <span className="font-mono text-black font-black text-sm ml-1">{pctDetails.advanceStr}</span>
                          </span>
                        </div>
                        {pctDetails.deliveryStr && (
                          <div className="flex items-start gap-2 bg-emerald-50/70 border border-emerald-100 p-2 rounded-lg mt-1">
                            <span className="font-bold text-emerald-800 shrink-0 w-3 text-[11px]">5.</span>
                            <span className="w-full text-emerald-900 font-extrabold">
                              Upon Delivery: <span className="font-mono text-emerald-950 font-black text-sm ml-1 underline decoration-double decoration-emerald-600">{pctDetails.deliveryStr}</span>
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Signatures block side-by-side matching the Excel image layout */}
            <div className="border-t border-[#B0B0B0] grid grid-cols-3 bg-transparent text-center select-text pt-2 pb-2">
              <div className="border-e border-[#B0B0B0] p-2 flex flex-col justify-between min-h-[140px]">
                <span className="font-extrabold text-black text-[13px] uppercase leading-normal font-sans whitespace-normal block tracking-tight max-w-full mx-auto text-center">
                  Head of Procurement and Contracts
                </span>
                <div className="h-12 flex-1"></div>
                <span className="font-bold text-black text-sm block">{printDoc.signatureProcurement || "Mr. Mohamed Al-Daly"}</span>
              </div>
              <div className="border-e border-[#B0B0B0] p-2 flex flex-col justify-between min-h-[140px]">
                <span className="font-extrabold text-black text-[13px] uppercase leading-normal font-sans whitespace-normal block tracking-tight max-w-full mx-auto text-center">
                  Technical Office Manager
                </span>
                <div className="h-12 flex-1"></div>
                <span className="font-bold text-black text-sm block">{printDoc.signatureTechnical || "Eng. Nasr Mahmoud"}</span>
              </div>
              <div className="p-2 flex flex-col justify-between min-h-[140px]">
                <span className="font-extrabold text-black text-[13px] uppercase leading-normal font-sans whitespace-normal block tracking-tight max-w-full mx-auto text-center">
                  General Manager
                </span>
                <div className="h-12 flex-1"></div>
                <span className="font-bold text-black text-sm block">{printDoc.signatureManager || "Eng. Sherif Mahmoud"}</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  if (false) {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans overflow-x-hidden w-full max-w-full p-6 text-right" dir="rtl">
        <div className="max-w-7xl mx-auto w-full space-y-6">
          
          {/* Secret Admin Header */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-md flex flex-col md:flex-row justify-between items-center gap-4 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-[3px] bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500"></div>
            <div className="flex items-center gap-4 text-right md:order-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-md">
                <Lock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-black text-white font-sans flex items-center gap-2">
                  <span>لوحة التحكم السرية للأجهزة</span>
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full">Secret Bypass Path</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">تجاوز حماية النظام المباشرة وإدارة الأجهزة وبصمات الـ IP للتحكم في الوصول</p>
              </div>
            </div>

            <div className="flex items-center gap-3 md:order-1">
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-5 rounded-xl border border-slate-700 transition-all text-sm flex items-center gap-2 cursor-pointer shadow-md"
              >
                <ArrowLeft className="w-4 h-4" />
                الدخول للموقع الرئيسي
              </button>

              <button
                onClick={fetchAdminDevices}
                disabled={adminLoading}
                className="bg-sky-500 hover:bg-sky-600 disabled:bg-sky-800 text-slate-950 font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-sky-500/15 transition-all text-sm flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${adminLoading ? 'animate-spin' : ''}`} />
                تحديث البيانات
              </button>
            </div>
          </div>

          {/* INSTANT APPROVE MY DEVICE HERO BLOCK */}
          <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-950 border-2 border-emerald-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="text-right space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-emerald-400 justify-start">
                <span className="text-xs font-bold font-mono tracking-wider">SECURE INSTANT BYPASS & AUTOPROMOTE</span>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
              </div>
              <h2 className="text-xl font-bold text-white font-sans">
                هل أنت محجوز خارج النظام؟ اعتمد جهازك الحالي كمسؤول فوراً!
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                عند الضغط على هذا الزر، سيقوم النظام بالتقاط بصمة جهازك الحالي بالإضافة للبصمة المسجلة <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-xs">dev_7ae2a0cd</code> ويرسل أمراً فورياً لقواعد البيانات (Supabase & DB) لتعديل الحالة إلى <strong className="text-emerald-400 font-bold">"مسموح / Approved"</strong>. بعد الاعتماد، ستتمكن من تصفح الموقع والوظائف بشكل طبيعي تماماً دون أي حظر.
              </p>
            </div>
            
            <div className="shrink-0">
              <button
                onClick={handleApproveMyCurrentDevice}
                className="relative group bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-base py-4 px-8 rounded-2xl shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-3 animate-shimmer"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-300"></div>
                <Check className="w-5 h-5 shrink-0" />
                <span className="relative">اعتماد جهازي الحالي كمسؤول فوراً</span>
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between text-right shadow-md">
              <div>
                <span className="text-xs text-slate-400 block mb-1">الأجهزة المعتمدة</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {adminDevices.filter(d => d.status === 'approved').length}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Check className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between text-right shadow-md">
              <div>
                <span className="text-xs text-slate-400 block mb-1">أجهزة في الانتظار</span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {adminDevices.filter(d => d.status === 'pending' || !d.status).length}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between text-right shadow-md">
              <div>
                <span className="text-xs text-slate-400 block mb-1">الأجهزة المحظورة</span>
                <span className="text-2xl font-black text-red-400 font-mono">
                  {adminDevices.filter(d => d.status === 'blocked').length}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Your Current Device Card */}
          <div className="bg-[#0e121a] border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-right">
              <div className="flex items-center gap-2 text-sky-400 mb-1 justify-end sm:justify-start">
                <span className="text-xs font-bold font-mono">CURRENT BROWSER INFO</span>
                <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></div>
              </div>
              <h3 className="text-sm font-semibold text-slate-200">
                تفاصيل اتصالك الحالي النشط في متصفحك الآن
              </h3>
            </div>
            <div className="flex flex-wrap gap-4 bg-slate-950/80 py-3 px-5 rounded-2xl border border-slate-850 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-right">FINGERPRINT</span>
                <span className="text-sky-300 font-bold">{deviceFingerprint || 'Unknown'}</span>
              </div>
              <div className="border-l border-slate-800 hidden sm:block"></div>
              <div>
                <span className="text-slate-500 block text-right">DEVICE TYPE</span>
                <span className="text-slate-300 font-semibold">{deviceInfoState || 'Generic Platform'}</span>
              </div>
              <div className="border-l border-slate-800 hidden sm:block"></div>
              <div>
                <span className="text-slate-500 block text-right">STATUS</span>
                <span className={`font-bold uppercase ${
                  deviceStatus === 'approved' ? 'text-emerald-400' :
                  deviceStatus === 'blocked' ? 'text-red-400' : 'text-amber-400'
                }`}>{deviceStatus}</span>
              </div>
            </div>
          </div>

          {/* Device Management Table */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center">
              <span className="text-xs text-slate-400 font-mono">Synced database: Supabase & Local Cluster</span>
              <h3 className="text-base font-bold text-white font-sans">قائمة الأجهزة المسجلة في النظام</h3>
            </div>
            {adminLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-sky-400" />
                <span className="text-sm text-slate-400">جاري جلب قائمة الأجهزة وعناوين الـ IP المتاحة...</span>
              </div>
            ) : adminDevices.length === 0 ? (
              <div className="p-20 text-center text-slate-500">
                <AlertCircle className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                <span>لم يتم العثور على أي أجهزة مسجلة في قاعدة البيانات حالياً.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-xs font-bold uppercase select-none">
                      <th className="py-4 px-6 text-center">الحالة الحالية</th>
                      <th className="py-4 px-6 text-center">التحكم الفوري بالصلاحية</th>
                      <th className="py-4 px-6 text-right">عنوان الـ IP</th>
                      <th className="py-4 px-6 text-right">نوع الجهاز والـ User-Agent</th>
                      <th className="py-4 px-6 text-right">بصمة الجهاز (Device Fingerprint)</th>
                      <th className="py-4 px-6 text-center">#</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 bg-slate-900/10">
                    {adminDevices.map((device, index) => {
                      const isMyDevice = device.device_fingerprint === deviceFingerprint;
                      return (
                        <tr key={device.device_fingerprint || index} className={`hover:bg-slate-800/35 transition-all ${isMyDevice ? 'bg-emerald-500/5' : ''}`}>
                          
                          {/* Current Status Badge */}
                          <td className="py-4 px-6 text-center align-middle">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold gap-1.5 ${
                              device.status === 'approved' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : device.status === 'blocked'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                device.status === 'approved' ? 'bg-emerald-400' :
                                device.status === 'blocked' ? 'bg-red-400' : 'bg-amber-400'
                              }`}></span>
                              {device.status === 'approved' ? 'مسموح (Approved)' :
                               device.status === 'blocked' ? 'محظور (Blocked)' : 'قيد المراجعة (Pending)'}
                            </span>
                          </td>

                          {/* Quick Decision Operations */}
                          <td className="py-4 px-6 align-middle text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleUpdateDeviceStatus(device.device_fingerprint, 'approved')}
                                disabled={device.status === 'approved'}
                                className="bg-emerald-500/15 hover:bg-emerald-500 hover:text-slate-950 disabled:bg-slate-800/40 disabled:text-slate-600 text-emerald-400 px-3.5 py-1.5 rounded-xl border border-emerald-500/20 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                سماح
                              </button>
                              
                              <button
                                onClick={() => handleUpdateDeviceStatus(device.device_fingerprint, 'blocked')}
                                disabled={device.status === 'blocked'}
                                className="bg-red-500/15 hover:bg-red-500 hover:text-slate-950 disabled:bg-slate-800/40 disabled:text-slate-600 text-red-400 px-3.5 py-1.5 rounded-xl border border-red-500/20 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                حظر
                              </button>

                              <button
                                onClick={() => handleUpdateDeviceStatus(device.device_fingerprint, 'pending')}
                                disabled={device.status === 'pending' || !device.status}
                                className="bg-slate-800 hover:bg-slate-700 disabled:text-slate-600 text-slate-300 px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs transition-all cursor-pointer flex items-center gap-1"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                تصفير
                              </button>
                            </div>
                          </td>

                          {/* IP Address */}
                          <td className="py-4 px-6 font-mono text-xs text-slate-300 align-middle text-right" dir="ltr">
                            {device.ip_address || "0.0.0.0"}
                          </td>

                          {/* Device Platform info */}
                          <td className="py-4 px-6 align-middle text-right">
                            <span className="text-slate-200 text-sm font-semibold block">{device.device_info || "Generic Client Web Browser"}</span>
                            {isMyDevice && <span className="text-xs text-emerald-400 font-bold font-sans block mt-0.5">★ جهازك الحالي النشط</span>}
                          </td>

                          {/* Device unique hash */}
                          <td className="py-4 px-6 font-mono text-xs text-sky-400 select-all align-middle text-right" dir="ltr">
                            <div className="flex items-center gap-2 justify-end">
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(device.device_fingerprint);
                                  alert("تم نسخ بصمة الجهاز بنجاح!");
                                }}
                                className="text-slate-500 hover:text-sky-400 p-1 rounded-md hover:bg-slate-800 transition-all"
                                title="Copy Fingerprint"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <span className="font-bold">{device.device_fingerprint}</span>
                            </div>
                          </td>

                          {/* Index */}
                          <td className="py-4 px-6 text-center text-slate-500 font-mono align-middle">
                            {index + 1}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
        </div>
      </div>
    );
  }

  if (isAdminView || isUrlAdmin) {
    if (!isAdminAuthenticated) {
      return (
        <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center font-sans p-6 text-right" dir="rtl">
          <div className="max-w-md w-full bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500"></div>
            
            <div className="text-center flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400 mb-4 border border-sky-500/20 shadow-md">
                <Lock className="w-8 h-8 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2 font-sans tracking-tight">بوابة إدارة الأجهزة</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                هذه الصفحة مخصصة لمسؤولي النظام فقط ومحمية ببروتوكولات الأمان. يرجى إدخال كلمة المرور للمتابعة.
              </p>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (adminPasswordInput === 'DeltaAdmin2026') {
                setIsAdminAuthenticated(true);
                sessionStorage.setItem('admin_authenticated_key', 'DeltaAdmin2026');
                setPasswordError('');
              } else {
                setPasswordError('كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
              }
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 mr-1">كلمة مرور المسؤول (Admin Password)</label>
                <div className="relative">
                  <input 
                    type="password"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="أدخل كلمة المرور..."
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-650 text-sm outline-none transition-all pr-10 text-center font-mono"
                    autoFocus
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center text-slate-500">
                    <Lock className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {passwordError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-2.5 px-4 rounded-xl font-bold flex items-center gap-2 justify-start">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <button 
                type="submit"
                className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-black py-3.5 px-6 rounded-xl shadow-lg shadow-sky-500/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer font-sans"
              >
                <Unlock className="w-4 h-4" />
                تأكيد الدخول والتحقق
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-800/60 flex justify-center">
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="text-xs text-slate-400 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                العودة للموقع الرئيسي
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans overflow-x-hidden w-full max-w-full p-6 text-right" dir="rtl">
        <div className="max-w-7xl mx-auto w-full space-y-6">
          
          {/* Admin Header */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-md flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
            <div className="flex items-center gap-4 text-right md:order-2">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20 shadow-md">
                <Shield className="w-6 h-6" />
              </div>
              <div className="text-right">
                <h1 className="text-xl font-bold text-white font-sans flex items-center gap-2">
                  <span>لوحة التحكم بالأجهزة المسموحة</span>
                  <span className="text-xs bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-1 rounded-full">Secure Admin Mode</span>
                </h1>
                <p className="text-xs text-slate-400 mt-1">إدارة الأجهزة وبصمات الـ IP للتحكم في الوصول إلى النظام</p>
              </div>
            </div>

            <div className="flex items-center gap-3 md:order-1">
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2.5 px-5 rounded-xl border border-slate-700 transition-all text-sm flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                العودة للموقع الرئيسي
              </button>

              <button
                onClick={fetchAdminDevices}
                disabled={adminLoading}
                className="bg-sky-500 hover:bg-sky-600 disabled:bg-sky-800 text-slate-950 font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-sky-500/10 transition-all text-sm flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${adminLoading ? 'animate-spin' : ''}`} />
                تحديث قائمة الأجهزة
              </button>
            </div>
          </div>

          {/* INSTANT APPROVE MY DEVICE HERO BLOCK */}
          <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-950 border-2 border-emerald-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="text-right space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-emerald-400 justify-start">
                <span className="text-xs font-bold font-mono tracking-wider">SECURE INSTANT BYPASS & AUTOPROMOTE</span>
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
              </div>
              <h2 className="text-xl font-bold text-white font-sans">
                اعتماد جهازي الحالي كمسؤول فوراً وبنقرة واحدة
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                عند الضغط على هذا الزر، سيقوم النظام بالتقاط بصمة جهازك الحالي والـ IP والمنصة بالإضافة للبصمة المسجلة <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono text-xs">dev_7ae2a0cd</code> ثم يقوم بترقيتهم وتحديث حالتهم في قواعد بيانات Supabase والمخازن المحلية إلى <strong className="text-emerald-400 font-bold">"مسموح / Approved"</strong> لتصفح الموقع الأساسي فوراً دون قيود.
              </p>
            </div>
            
            <div className="shrink-0">
              <button
                onClick={handleApproveMyCurrentDevice}
                className="relative group bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-base py-4 px-8 rounded-2xl shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center gap-3"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-300"></div>
                <Check className="w-5 h-5 shrink-0" />
                <span className="relative">اعتماد جهازي الحالي كمسؤول فوراً</span>
              </button>
            </div>
          </div>

          {/* Device Counter / Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between text-right">
              <div>
                <span className="text-xs text-slate-400 block mb-1">الأجهزة المعتمدة</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {adminDevices.filter(d => d.status === 'approved').length}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Check className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between text-right">
              <div>
                <span className="text-xs text-slate-400 block mb-1">أجهزة في الانتظار</span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {adminDevices.filter(d => d.status === 'pending' || !d.status).length}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between text-right">
              <div>
                <span className="text-xs text-slate-400 block mb-1">الأجهزة المحظورة</span>
                <span className="text-2xl font-black text-red-400 font-mono">
                  {adminDevices.filter(d => d.status === 'blocked').length}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Current Device Highlight Card */}
          <div className="bg-gradient-to-r from-sky-950/30 to-indigo-950/30 border border-sky-500/20 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-right">
              <div className="flex items-center gap-2 text-sky-400 mb-1 justify-end sm:justify-start">
                <span className="text-xs font-bold font-mono">YOUR CURRENT DEVICE</span>
                <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></div>
              </div>
              <h3 className="text-sm font-semibold text-slate-200">
                هذا هو جهازك الحالي الذي تستخدمه الآن للوصول إلى لوحة التحكم.
              </h3>
            </div>
            <div className="flex gap-4 bg-slate-950/60 py-2.5 px-4 rounded-xl border border-slate-800/80 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-right">FINGERPRINT</span>
                <span className="text-sky-300 font-bold">{deviceFingerprint}</span>
              </div>
              <div className="border-l border-slate-800"></div>
              <div>
                <span className="text-slate-500 block text-right">STATUS</span>
                <span className={`font-bold uppercase ${
                  deviceStatus === 'approved' ? 'text-emerald-400' :
                  deviceStatus === 'blocked' ? 'text-red-400' : 'text-amber-400'
                }`}>{deviceStatus}</span>
              </div>
            </div>
          </div>

          {/* Main List Table Card */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            {adminLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-sky-400" />
                <span className="text-sm text-slate-400">جاري تحميل قائمة الأجهزة والتحقق من البيانات...</span>
              </div>
            ) : adminDevices.length === 0 ? (
              <div className="p-20 text-center text-slate-500">
                <AlertCircle className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                <span>لا توجد أجهزة مسجلة حالياً في النظام.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-xs font-bold uppercase select-none">
                      <th className="py-4 px-6 text-center">حالة الجهاز</th>
                      <th className="py-4 px-6 text-center">التحكم والعمليات</th>
                      <th className="py-4 px-6 text-right">عنوان الـ IP</th>
                      <th className="py-4 px-6 text-right">نوع ونظام الجهاز</th>
                      <th className="py-4 px-6 text-right">بصمة الجهاز (Fingerprint)</th>
                      <th className="py-4 px-6 text-center">#</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 bg-slate-900/20">
                    {adminDevices.map((device, index) => {
                      const isCurrent = device.device_fingerprint === deviceFingerprint;
                      return (
                        <tr key={device.device_fingerprint || index} className={`hover:bg-slate-800/20 transition-all ${isCurrent ? 'bg-sky-500/5' : ''}`}>
                          {/* Status badge */}
                          <td className="py-4 px-6 text-center align-middle">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold gap-1.5 ${
                              device.status === 'approved' 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : device.status === 'blocked'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                device.status === 'approved' ? 'bg-emerald-400' :
                                device.status === 'blocked' ? 'bg-red-400' : 'bg-amber-400'
                              }`}></span>
                              {device.status === 'approved' ? 'مسموح' :
                               device.status === 'blocked' ? 'محظور' : 'في الانتظار'}
                            </span>
                          </td>

                          {/* Quick Controls */}
                          <td className="py-4 px-6 align-middle text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleUpdateDeviceStatus(device.device_fingerprint, 'approved')}
                                disabled={device.status === 'approved'}
                                className="bg-emerald-500/10 hover:bg-emerald-500 hover:text-slate-950 disabled:bg-slate-800/40 disabled:text-slate-600 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" />
                                سماح (Approve)
                              </button>
                              
                              <button
                                onClick={() => handleUpdateDeviceStatus(device.device_fingerprint, 'blocked')}
                                disabled={device.status === 'blocked'}
                                className="bg-red-500/10 hover:bg-red-500 hover:text-slate-950 disabled:bg-slate-800/40 disabled:text-slate-600 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
                                حظر (Block)
                              </button>

                              <button
                                onClick={() => handleUpdateDeviceStatus(device.device_fingerprint, 'pending')}
                                disabled={device.status === 'pending' || !device.status}
                                className="bg-slate-800 hover:bg-slate-700 disabled:text-slate-600 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 text-xs transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                تصفير
                              </button>
                            </div>
                          </td>

                          {/* IP Address */}
                          <td className="py-4 px-6 font-mono text-xs text-slate-300 align-middle text-right" dir="ltr">
                            {device.ip_address || "Unknown"}
                          </td>

                          {/* Device Info */}
                          <td className="py-4 px-6 align-middle text-right">
                            <span className="text-slate-200 text-sm font-semibold block">{device.device_info || "Generic Browser"}</span>
                            <span className="text-xs text-slate-500 block font-mono">Client-Agent Detected</span>
                          </td>

                          {/* Device Fingerprint */}
                          <td className="py-4 px-6 font-mono text-xs text-sky-400 select-all align-middle text-right" dir="ltr">
                            <div className="flex items-center gap-2 justify-end">
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(device.device_fingerprint);
                                  alert("تم نسخ البصمة!");
                                }}
                                className="text-slate-500 hover:text-sky-400 p-1 rounded-md hover:bg-slate-800 transition-all"
                                title="Copy Fingerprint"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <span>{device.device_fingerprint}</span>
                            </div>
                          </td>

                          {/* Counter */}
                          <td className="py-4 px-6 text-center text-slate-500 font-mono align-middle">
                            {index + 1}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
        </div>
      </div>
    );
  }

  if (!isAdminView && !isUrlAdmin && !isSecretAdminView && deviceStatus === 'checking') {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center font-sans p-6">
        <div className="max-w-md w-full bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-md shadow-2xl text-center flex flex-col items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500"></div>
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-sky-500/20 blur animate-pulse -z-10"></div>
          </div>
          <h2 className="text-xl font-bold mb-3 tracking-tight text-white font-sans">جاري التحقق من الجهاز</h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-4">
            يرجى الانتظار أثناء التحقق من بصمة جهازك والـ IP الخاص بك لتأمين الاتصال بالنظام...
          </p>
          <div className="w-full bg-slate-950/60 rounded-xl p-3 border border-slate-800/50">
            <div className="text-xs text-slate-500 font-mono">SECURE AGENT HANDSHAKE</div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdminView && !isUrlAdmin && !isSecretAdminView && deviceStatus === 'pending') {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center font-sans p-6 text-right" dir="rtl">
        <div className="max-w-lg w-full bg-slate-900/50 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 to-yellow-500 animate-pulse"></div>
          
          <div className="text-center flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4 shadow-inner">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2 font-sans tracking-tight">في انتظار موافقة المسؤول</h2>
            <p className="text-slate-300 text-sm leading-relaxed max-w-sm">
              تم تسجيل جهازك بنجاح في النظام وهو قيد المراجعة حالياً. يرجى التواصل مع المسؤول لتفعيل حسابك.
            </p>
          </div>

          <div className="space-y-4 bg-slate-950/70 p-5 rounded-2xl border border-slate-800/80 text-right">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">تفاصيل الجهاز Device Details</h3>
            
            <div className="flex justify-between items-center bg-slate-900/60 px-4 py-3 rounded-xl border border-slate-800/40">
              <span className="font-mono text-sm text-sky-400 select-all" dir="ltr">{deviceFingerprint}</span>
              <span className="text-xs text-slate-400">بصمة الجهاز (Fingerprint)</span>
            </div>

            <div className="flex justify-between items-center bg-slate-900/60 px-4 py-3 rounded-xl border border-slate-800/40">
              <span className="font-mono text-sm text-slate-200" dir="ltr">{deviceInfoState}</span>
              <span className="text-xs text-slate-400">نوع الجهاز (Device Info)</span>
            </div>

            <div className="text-center text-[10px] text-slate-500 mt-2 font-sans">
              سجل هذا الجهاز تلقائياً وسيظهر للمسؤول في لوحة التحكم فوراً.
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full">
            <button 
              onClick={() => checkDeviceStatus(deviceFingerprint, deviceInfoState)}
              className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-amber-500/10 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer font-sans"
            >
              <RefreshCw className="w-4 h-4" />
              تحديث الحالة
            </button>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`بصمة جهازي: ${deviceFingerprint}\nنوع الجهاز: ${deviceInfoState}`);
                alert("تم نسخ تفاصيل الجهاز بنجاح!");
              }}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3.5 px-6 rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
            >
              <Copy className="w-4 h-4" />
              نسخ بيانات الجهاز
            </button>
          </div>

          {/* Secure Admin Gate Access Button */}
          <div className="mt-6 pt-5 border-t border-slate-800/60 w-full text-center">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/admin';
                }
              }}
              className="w-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-bold py-3 px-6 rounded-xl border border-sky-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer font-sans text-xs"
            >
              <Shield className="w-4 h-4" />
              الدخول للوحة التحكم والموافقة (للمسؤولين فقط)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdminView && !isUrlAdmin && !isSecretAdminView && deviceStatus === 'blocked') {
    return (
      <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center font-sans p-6 text-right" dir="rtl">
        <div className="max-w-md w-full bg-slate-900/50 border border-red-500/20 rounded-3xl p-8 backdrop-blur-md shadow-2xl text-center flex flex-col items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-600 to-rose-500"></div>
          
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6 shadow-inner animate-bounce">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-black text-white mb-2 font-sans tracking-tight">تم حظر هذا الجهاز</h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-6 text-center">
            لقد تم حظر وصول هذا الجهاز إلى النظام بواسطة مسؤول النظام. إذا كنت تعتقد أن هذا خطأ، يرجى مراجعة الإدارة المختصة لإلغاء الحظر.
          </p>

          <div className="w-full bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 text-right space-y-2 mb-6">
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs text-red-400 select-all font-semibold" dir="ltr">{deviceFingerprint}</span>
              <span className="text-xs text-slate-400">بصمة الجهاز</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-red-500 font-bold">محظور (Blocked)</span>
              <span className="text-xs text-slate-400">حالة الوصول</span>
            </div>
          </div>

          {/* Secure Admin Gate Access Button */}
          <div className="w-full mb-6">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/admin';
                }
              }}
              className="w-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-bold py-3 px-6 rounded-xl border border-sky-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer font-sans text-xs"
            >
              <Shield className="w-4 h-4" />
              الدخول للوحة التحكم والموافقة (للمسؤولين فقط)
            </button>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            SECURE SYSTEM BLOCK | DELTA ROAD CONSTRUCTION
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans overflow-x-hidden w-full max-w-full">
      
      {/* 1. Header / Navigation Bar */}
      <header className="bg-[#111827] border-b border-slate-800 sticky top-0 z-40 shadow-lg shadow-black/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center py-4 md:py-0 md:h-20 gap-4">
            
            {/* Title & Brand */}
            <div className="flex items-center gap-3 text-right">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-sky-500/50 shadow-md shadow-sky-600/10 shrink-0 bg-sky-950 flex items-center justify-center font-bold text-sky-400">
                {!logoError ? (
                  <img 
                    src={deltaLogo} 
                    alt="Delta For Road Construction Logo" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <span className="text-sm font-black tracking-wider">DELTA</span>
                )}
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Delta For Road Construction</span>
                  <span className="text-xs bg-sky-600 text-white px-2 py-0.5 rounded-full font-normal">نظام أتمتة الفواتير</span>
                </h1>
                <p className="text-[11px] md:text-xs text-slate-400">التحليل والتصنيف التلقائي الذكي لعروض الأسعار وأوامر الشراء (POs) بواسطة الـ AI</p>
              </div>
            </div>

            {/* Practical Top Action Panel */}
            <div className="flex flex-wrap justify-center md:justify-end items-center gap-3 w-full md:w-auto">
              
              {/* Sound alert switcher */}
              <button 
                onClick={() => setAudioEnabled(!audioEnabled)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                  audioEnabled 
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60 hover:bg-emerald-950/60' 
                    : 'bg-[#1f2937] text-slate-400 border-slate-800 hover:bg-[#374151]'
                }`}
                title="تصفية رنات التنبيه الصوتي عند استلام ملفات جديدة"
              >
                <Bell className={`w-3.5 h-3.5 ${audioEnabled ? 'animate-bounce text-emerald-400' : 'opacity-60'}`} />
                <span>{audioEnabled ? 'الرنات: نشطة' : 'الرنات: صامت'}</span>
              </button>

              {/* Directly Upload Trigger Button */}
              <label 
                className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer shadow-md shadow-sky-600/10 transition-all flex items-center gap-2"
                htmlFor="direct-file-upload-header"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span>تحميل مستند مباشر</span>
                <input 
                  type="file" 
                  id="direct-file-upload-header" 
                  className="hidden" 
                  ref={dashboardFileInputRef}
                  onChange={handleDirectFileUpload}
                  disabled={uploading}
                  accept="image/*,application/pdf,.pdf"
                />
              </label>

            </div>
          </div>
        </div>
      </header>

      {/* 2. Bento Statistics Cards */}
      <section className="bg-[#0b0f19]/60 border-b border-slate-800/80 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Box 1: Total Docs */}
            <div className="bg-[#111827] p-5 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-4">
              <div className="p-3 bg-sky-950/45 text-sky-400 rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-455 block font-medium">المستندات المستخرجة</span>
                <span className="text-2xl font-extrabold text-white">{stats.totalProcessedCount}</span>
                <span className="text-xs text-slate-400 block mt-0.5">ملف مستخرج ومصنف</span>
              </div>
            </div>

            {/* Box 2: Total Clients */}
            <div className="bg-[#111827] p-5 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-4">
              <div className="p-3 bg-[#2e1065]/40 text-[#a78bfa] rounded-xl">
                <FolderOpen className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-455 block font-medium">مجلدات الموردين النشطة</span>
                <span className="text-2xl font-extrabold text-white">{stats.uniqueClientCount}</span>
                <span className="text-xs text-slate-400 block mt-0.5">تصنيف أبجدي وتاريخي مالي</span>
              </div>
            </div>

            {/* Box 3: Total Revenue/Values */}
            <div className="bg-[#111827] p-5 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-4">
              <div className="p-3 bg-emerald-950/40 text-emerald-400 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <span className="text-xs text-slate-455 block font-medium">إجمالي المبالغ من الفواتير</span>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-baseline">
                  {Object.keys(stats.totalValueByCurrency).length > 0 ? (
                    Object.entries(stats.totalValueByCurrency).map(([curr, val]) => (
                      <span key={curr} className="text-lg font-extrabold text-white">
                        {val.toLocaleString()} <span className="text-xs text-emerald-400">{curr}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-lg font-bold text-slate-400">0 EGP</span>
                  )}
                </div>
              </div>
            </div>

            {/* Box 4: Extracted types breakdown status list */}
            <div className="bg-[#111827] p-5 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-4">
              <div className="p-3 bg-indigo-95/40 text-indigo-400 rounded-xl">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-slate-455 block font-medium">تصنيف المستندات المدخلة</span>
                <div className="flex items-center gap-2 mt-1.5 text-xs font-bold leading-none">
                  <span className="bg-sky-950/50 text-sky-400 px-2 py-1 rounded-md border border-sky-900/60">
                    أوامر الشراء (PO): {documents.filter(d => d.docType === 'po').length}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">تصنيف وترتيب دائم بالـ AI</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Global Notification Logs Banner */}
      {notifications.length > 0 && (
        <div className="bg-blue-50/50 border-b border-blue-100 py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center text-xs text-blue-800">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-md font-bold uppercase">تنبيهات فورية</span>
              <span className="font-medium">{notifications[0].message}</span>
              <span className="text-blue-400 font-mono">({new Date(notifications[0].timestamp).toLocaleTimeString('ar-EG')})</span>
            </div>
            <button 
              onClick={handleClearNotifications}
              className="text-blue-500 hover:text-blue-700 underline font-semibold cursor-pointer"
            >
              مسح سجل الإشعارات
            </button>
          </div>
        </div>
      )}

      {/* 4. Core Tabbed Controls */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
        
        {/* Unified Direct Image & PDF Upload Zone required by user */}
        <div className="bg-[#111827] rounded-3xl border border-slate-800 p-6 mb-6 shadow-xl flex flex-col gap-4">
          <div className="text-right">
            <label className="text-xs font-bold text-slate-300 mr-1.5 flex items-center gap-1.5 justify-end">
              <span>توجيهات أو ملاحظات إضافية لتوجيه الـ AI أثناء قراءة هذا المستند (مثال: "المورد هو مظلوم" أو "العملة بالريال")</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            </label>
            <div className="mt-1.5">
              <textarea
                rows={2}
                value={uploadInstructions}
                onChange={(e) => setUploadInstructions(e.target.value)}
                placeholder="توجيهات اختيارية (مثال: استخدم اسم المورد 'مظلوم'، أو صنف هذه المواد كحديد تسليح)... سيقوم جيميني بالالتزام بها فورياً أثناء استخراج وفهرسة البنود."
                className="w-full px-4 py-2.5 text-xs bg-[#0b0f19] border border-slate-800 rounded-xl focus:outline-hidden focus:border-sky-500 text-slate-100 placeholder-slate-500 transition-all resize-none font-sans text-right"
              />
            </div>
          </div>

          <div className="bg-[#0b0f19]/40 rounded-2xl border-2 border-dashed border-sky-900/40 hover:border-sky-500/80 hover:shadow-lg transition-all p-8 text-center cursor-pointer relative group">
            <input 
              type="file" 
              id="portal-file-upload"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={handleDirectFileUpload}
              disabled={uploading}
              accept="image/*,application/pdf,.pdf"
            />
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="p-4 bg-sky-950/40 text-sky-450 rounded-full group-hover:scale-105 transition-transform duration-300">
                {uploading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
                ) : (
                  <Upload className="w-8 h-8 text-sky-400" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200">اسحب أو اختر ملف الباقة / أمر الشراء / عرض السعر</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  يدعم PDF وجميع أنواع الصور (PNG, JPG, ...). سيتم تطبيق التوجيهات المدونة أعلاه أثناء الفحص بالذكاء الاصطناعي
                </p>
              </div>
              <div className="mt-1">
                <span className="px-5 py-2.5 bg-sky-650 hover:bg-sky-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all">
                  {uploading ? 'جاري استخراج البيانات والبنود بالـ AI...' : 'اضغط لاختيار مستند أو اسحبه هنا'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Headers Panel */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-slate-800 pb-3 mb-6 gap-3">
          <div className="flex gap-2 w-full overflow-x-auto pb-2 scrollbar-none scroll-smooth">
            
            <button
              onClick={() => setActiveTab('spreadsheet')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                activeTab === 'spreadsheet'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/10'
                  : 'text-slate-400 hover:bg-[#111827] hover:text-white'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>شيت الإكسيل التفاعلي ({filteredDocs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                activeTab === 'files'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:bg-[#111827] hover:text-white'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              <span>أرشيف مجلدات الموردين ({Object.keys(documentsByClient).length})</span>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 ${
                activeTab === 'projects'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'text-slate-400 hover:bg-[#111827] hover:text-white'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>تقسيم المشاريع ({Object.keys(documentsByProject).length})</span>
            </button>

          </div>

          <div className="text-[10px] md:text-xs font-medium text-slate-500 shrink-0 text-right">
            أخر تحديث بتوقيت النظام: <span className="font-mono text-slate-500">13:38Z (UTC)</span>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-bold">تنبيه بالنظام: </span> {errorMsg}
            </div>
            <button 
              onClick={() => setErrorMsg(null)}
              className="mr-auto text-rose-400 hover:text-rose-600 font-bold"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 5. Tabs Contents rendering */}
        <div className="flex-1 flex flex-col justify-stretch">
          
          {/* TAB 1: INTERACTIVE SPREADSHEET */}
          {activeTab === 'spreadsheet' && (
            <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex-1 flex-col flex">
              
              {/* Local Backup Alert Banner */}
              {hasBackupToRestore && (
                <div className="bg-sky-950/40 border-b border-sky-900/60 p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-right" dir="rtl">
                  <div className="flex items-center gap-3 text-right">
                    <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl shrink-0">
                      <Database className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">رصدنا وجود نسخة احتياطية محلية متطابقة! 📂</h4>
                      <p className="text-[11px] text-slate-300 mt-0.5 font-medium">
                        تتوفر سجلات لعدد ({backupCount}) مستندات سابقة في متصفحك الحالي، بينما قاعدة بيانات الملقم فارغة الآن. اضغط على الزر لنقلها ومزامنتها فوراً.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleRestoreFromBackup}
                    className="w-full sm:w-auto px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black shadow-lg shadow-sky-600/15 transition-all flex items-center justify-center gap-2 shrink-0 hover:scale-[1.02] cursor-pointer"
                  >
                    <span>استعادة البيانات ومزامنتها الآن ⚙️</span>
                  </button>
                </div>
              )}

              {/* Spreadsheet search control panel */}
              <div className="p-4 bg-[#1f2937]/50 border-b border-slate-800 flex flex-col gap-3">
                
                {/* First Row: Actions & Main Search */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Search Term Input */}
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="البحث السريع (بالمورد، رقم المستند، اسم القطعة، أو السعر)..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-4 pr-10 py-1.5 bg-[#0b0f19] rounded-xl border border-slate-800 focus:outline-hidden focus:border-blue-500 text-white placeholder-slate-400 text-xs font-semibold transition-all"
                    />
                  </div>

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Display Type Info Label / Selector */}
                    <div className="flex bg-[#0b0f19] border border-slate-800 px-3 py-1.5 rounded-xl text-[11px] font-bold text-sky-400 gap-1.5 items-center select-none">
                      <span>أوامر شراء (PO)</span>
                      <span className="bg-sky-950/80 text-sky-400 px-1.5 py-0.2 rounded-md border border-sky-900/40 text-[10px] leading-tight">{documents.length}</span>
                    </div>

                    {/* Manual addition direct trigger */}
                    <button
                      onClick={handleAddManualRow}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-[11px] font-bold border border-slate-750 transition-all cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-400" />
                      <span>إضافة صف يدوي</span>
                    </button>

                    {/* Document comparison trigger */}
                    <button
                      onClick={() => {
                        setIsComparing(true);
                        if (documents.length >= 2) {
                          setCompareDocAId(documents[0].id);
                          setCompareDocBId(documents[1].id);
                        } else if (documents.length === 1) {
                          setCompareDocAId(documents[0].id);
                        }
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-md border border-blue-500"
                    >
                      <GitCompare className="w-3.5 h-3.5 text-blue-200" />
                      <span>مقارنة بندين ومطابقة الأسعار</span>
                    </button>

                    {/* Export Excel button */}
                    <button
                      onClick={handleExportToExcel}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-105 rounded-lg text-[11px] font-bold border border-slate-750 transition-all cursor-pointer shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>تصدير إكسيل (.xlsx)</span>
                    </button>

                    {/* Spreadsheet Save/Edit triggers */}
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 animation-fade-in">
                        <button
                          onClick={handleSaveSpreadsheetEdits}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-lg text-[11px] transition-all cursor-pointer shadow-md border border-blue-500"
                        >
                          حفظ التعديلات بالشيت ({editDocs.length})
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold rounded-lg text-[11px] transition-all border border-slate-750 cursor-pointer"
                        >
                          إلغاء التعديل
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-[11px] font-semibold border border-slate-750 transition-all cursor-pointer shadow-xs"
                      >
                        تعديل خلايا الشيت يدوياً
                      </button>
                    )}

                  </div>
                </div>

                {/* Second Row: Specific Filters */}
                <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 items-end">
                  {/* Date Filter */}
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-bold text-slate-400 mr-1">البحث بالتاريخ (تاريخ الاستلام/الاستحقاق):</label>
                    <input
                      type="text"
                      placeholder="امثلة: 2026-06، 2026-06-13..."
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#0b0f19] border border-slate-800 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 font-mono text-white placeholder-slate-500 font-semibold"
                    />
                  </div>

                  {/* Client Filter */}
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-bold text-slate-400 mr-1">البحث باسم المورد:</label>
                    <input
                      type="text"
                      placeholder="اسم المورد لـ PO..."
                      value={filterClient}
                      onChange={(e) => setFilterClient(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#0b0f19] border border-slate-800 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 text-white placeholder-slate-500 font-semibold"
                    />
                  </div>

                  {/* Amount Filter */}
                  <div className="flex flex-col gap-0.5">
                    <label className="text-[10px] font-bold text-slate-400 mr-1">البحث بمبلغ المستند الإجمالي/الصافي:</label>
                    <input
                      type="text"
                      placeholder="مثال: 5000..."
                      value={filterAmount}
                      onChange={(e) => setFilterAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#0b0f19] border border-slate-800 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 font-mono text-white placeholder-slate-500 font-semibold"
                    />
                  </div>

                  {/* Withholding Tax Toggle Checkbox / Button */}
                  <div className="flex items-center h-[34px]">
                    <button
                      onClick={() => setFilterWithholdingOnly(!filterWithholdingOnly)}
                      className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        filterWithholdingOnly 
                          ? 'bg-rose-950/40 border-rose-900/60 text-rose-300 shadow-2xs' 
                          : 'bg-[#1f2937] border-slate-800 text-slate-300 hover:bg-[#2e3b4e]'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${filterWithholdingOnly ? 'bg-rose-500 animate-pulse' : 'bg-slate-600'}`}></span>
                      <span>الموردون الخاضعون لضريبة الخصم والإضافة</span>
                    </button>
                  </div>
                </div>

                {/* Filter helper check: if any active filter, show Reset button */}
                {(filterDate || filterClient || filterAmount || filterWithholdingOnly) && (
                  <div className="flex justify-end pt-0.5">
                    <button
                      onClick={() => {
                        setFilterDate('');
                        setFilterClient('');
                        setFilterAmount('');
                        setFilterWithholdingOnly(false);
                      }}
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-extrabold flex items-center gap-1 cursor-pointer"
                    >
                      <span>🔄 إعادة تعيين محددات البحث المتقدم</span>
                    </button>
                  </div>
                )}

              </div>

              {/* Spreadsheat Interactive Sheet Table */}
              <div className="overflow-x-auto flex-1 w-full max-w-full">
                {loading ? (
                  <div className="py-20 flex flex-col justify-center items-center gap-3">
                    <Loader2 className="w-8 h-8 text-sky-500 animate-spin" />
                    <p className="text-sm text-slate-400">جاري تحميل سجل المعاملات المالية الموثقة...</p>
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <div className="py-24 text-center">
                    <Table className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <h3 className="text-base font-bold text-slate-700">لا توجد مستندات بعد</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      قم برفع ملف في لوحة التصفح، أو أرسله إلى البوت، أو استخدم محاكي الشات بوت لتجربة الاستخراج التلقائي.
                    </p>
                    <button
                      onClick={handleAddManualRow}
                      className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                    >
                      إدراج صف يدوي للتجربة
                    </button>
                  </div>
                ) : (
                  <table className="w-full text-right text-xs border-collapse">
                    <thead className="bg-[#1f2937] text-white font-extrabold sticky top-0 border-b border-slate-700">
                      <tr>
                        <th className="py-4.5 px-4 font-bold">م</th>
                        <th className="py-4.5 px-4 font-bold">اسم المورد</th>
                        <th className="py-4.5 px-4 font-bold">المشروع</th>
                        <th className="py-4.5 px-4 font-bold text-center">حالة المشروع</th>
                        <th className="py-4.5 px-4 font-bold">تاريخ الاستلام</th>
                        <th className="py-4.5 px-4 font-bold text-amber-500">تاريخ الاستحقاق</th>
                        <th className="py-4.5 px-4 font-bold">نوع المستند</th>
                        <th className="py-4.5 px-4 font-bold">رقم المستند</th>
                        <th className="py-4.5 px-4 font-bold">القيمة الإجمالية</th>
                        <th className="py-4.5 px-4 font-bold">العملة</th>
                        <th className="py-4.5 px-4 font-bold">الملخص</th>
                        <th className="py-4.5 px-4 font-bold">المستند</th>
                        <th className="py-4.5 px-4 font-bold text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {filteredDocs.map((doc, idx) => (
                        <tr 
                          key={doc.id}
                          className="hover:bg-[#1f2937]/60 cursor-pointer transition-colors border-b border-slate-800/40"
                          onClick={() => setSelectedDoc(doc)}
                        >
                          {/* Row number */}
                          <td className="py-3 px-4 font-bold text-slate-500 font-mono">{idx + 1}</td>
                          
                          {/* Dynamic clientName cell */}
                          <td className="py-3 px-4 text-sm font-semibold text-slate-200 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="text"
                                value={doc.clientName}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const draft = [...editDocs];
                                  draft[idx].clientName = e.target.value;
                                  setEditDocs(draft);
                                }}
                                list="learned-vendors-list"
                                className="px-2 py-1 border border-sky-900 bg-[#0b0f19] rounded focus:outline-hidden focus:border-sky-550 text-xs text-slate-200"
                              />
                            ) : (
                              <div>
                                <div className="font-bold text-slate-100">{doc.clientName}</div>
                                {normalizeArabic(searchTerm) !== '' && doc.items && doc.items.some(item => 
                                  normalizeArabic(item.description).includes(normalizeArabic(searchTerm)) ||
                                  normalizeArabic(item.brand).includes(normalizeArabic(searchTerm)) ||
                                  (item.unitPrice && item.unitPrice.toString().includes(searchTerm))
                                ) ? (
                                  <div className="mt-1.5 flex flex-col gap-1 max-w-[280px] whitespace-normal">
                                    {doc.items.filter(item => 
                                      normalizeArabic(item.description).includes(normalizeArabic(searchTerm)) ||
                                      normalizeArabic(item.brand).includes(normalizeArabic(searchTerm)) ||
                                      (item.unitPrice && item.unitPrice.toString().includes(searchTerm))
                                    ).map((item, i) => (
                                      <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-sky-950/60 text-sky-300 border border-sky-90/50 rounded-md px-1.5 py-0.5 leading-tight select-text">
                                        <span className="font-semibold text-slate-200">🧩 {item.description}</span>
                                        {item.brand && <span className="text-slate-400 font-mono text-[9px]">({item.brand})</span>}
                                        <span className="font-bold text-sky-400 bg-sky-950/80 px-1 rounded font-mono">💰 {item.unitPrice.toLocaleString()} {doc.currency}</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </td>

                          {/* Project Name Cell */}
                          <td className="py-3 px-4 text-sm font-semibold text-slate-800 whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={uniqueProjects.includes(doc.projectName || "عام") ? (doc.projectName || "عام") : "custom"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val !== "custom") {
                                      const draft = [...editDocs];
                                      draft[idx].projectName = val;
                                      if (draft[idx].docType === 'po') {
                                        const otherDocs = editDocs.filter((_, dIdx) => dIdx !== idx);
                                        const nextNum = getNextPoNumberForProject(val, otherDocs);
                                        draft[idx].docNumber = String(nextNum);
                                        
                                        fetchNextPoNumber(val).then((fetchedNum) => {
                                          if (fetchedNum) {
                                            setEditDocs(currentDraft => {
                                              const updatedDraft = [...currentDraft];
                                              if (updatedDraft[idx]) {
                                                updatedDraft[idx].docNumber = fetchedNum;
                                              }
                                              return updatedDraft;
                                            });
                                          }
                                        });
                                      }
                                      setEditDocs(draft);
                                    }
                                  }}
                                  className="px-1 py-1 border border-sky-300 bg-white rounded text-xs font-bold text-slate-705 focus:outline-hidden cursor-pointer"
                                >
                                  {uniqueProjects.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                  ))}
                                  <option value="custom">✍️ جديد...</option>
                                </select>
                                <input
                                  type="text"
                                  value={doc.projectName || ''}
                                  placeholder="عام"
                                  onChange={(e) => {
                                    const draft = [...editDocs];
                                    draft[idx].projectName = e.target.value;
                                    setEditDocs(draft);
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value;
                                    const draft = [...editDocs];
                                    if (draft[idx].docType === 'po') {
                                      const otherDocs = editDocs.filter((_, dIdx) => dIdx !== idx);
                                      const nextNum = getNextPoNumberForProject(val, otherDocs);
                                      draft[idx].docNumber = String(nextNum);
                                      
                                      fetchNextPoNumber(val).then((fetchedNum) => {
                                        if (fetchedNum) {
                                          setEditDocs(currentDraft => {
                                            const updatedDraft = [...currentDraft];
                                            if (updatedDraft[idx]) {
                                              updatedDraft[idx].docNumber = fetchedNum;
                                            }
                                            return updatedDraft;
                                          });
                                        }
                                      });
                                    }
                                    setEditDocs(draft);
                                  }}
                                  className="w-20 px-2 py-1 border border-sky-200 bg-sky-50/30 rounded focus:outline-hidden focus:border-sky-500 text-xs text-slate-855 font-extrabold"
                                />
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-50 text-sky-700 text-[11px] font-bold border border-sky-100">
                                <Briefcase className="w-3 h-3" />
                                {doc.projectName || 'عام'}
                              </span>
                            )}
                          </td>

                          {/* Project Status Cell */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isEditing ? (
                              <select
                                value={doc.projectStatus || 'in_progress'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const draft = [...editDocs];
                                  draft[idx].projectStatus = e.target.value as any;
                                  setEditDocs(draft);
                                }}
                                className="px-1.5 py-1 border border-sky-200 bg-white rounded-lg focus:outline-hidden focus:border-sky-500 text-[11px] text-slate-800 font-bold cursor-pointer"
                              >
                                <option value="in_progress">⏳ قيد التنفيذ</option>
                                <option value="completed">✔️ مكتمل</option>
                                <option value="deferred">💤 مؤجل</option>
                              </select>
                            ) : (
                              (() => {
                                const status = doc.projectStatus || 'in_progress';
                                if (status === 'completed') {
                                  return (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-100">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      <span>مكتمل</span>
                                    </span>
                                  );
                                } else if (status === 'deferred') {
                                  return (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-extrabold border border-slate-200">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                      <span>مؤجل</span>
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-[10px] font-extrabold border border-amber-100">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                      <span>قيد التنفيذ</span>
                                    </span>
                                  );
                                }
                              })()
                            )}
                          </td>

                          {/* Date Cell */}
                          <td className="py-3 px-4 font-medium font-mono">
                            {isEditing ? (
                              <input
                                type="text"
                                value={doc.receiptDate}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const draft = [...editDocs];
                                  draft[idx].receiptDate = e.target.value;
                                  setEditDocs(draft);
                                }}
                                className="px-2 py-1 border border-sky-200 bg-sky-50/30 rounded focus:outline-hidden focus:border-sky-500 font-mono text-xs text-slate-800"
                              />
                            ) : (
                              doc.receiptDate
                            )}
                          </td>

                          {/* Due Date Cell */}
                          <td className="py-3 px-4 font-mono">
                            {isEditing ? (
                              <input
                                type="text"
                                value={doc.dueDate || ''}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="YYYY-MM-DD"
                                onChange={(e) => {
                                  const draft = [...editDocs];
                                  draft[idx].dueDate = e.target.value;
                                  setEditDocs(draft);
                                }}
                                className="px-2 py-1 border border-sky-200 bg-sky-50/30 rounded focus:outline-hidden focus:border-sky-500 font-mono text-xs text-slate-800 w-24"
                              />
                            ) : (
                              <span className={getDueDateWarningStyle(doc.dueDate)}>
                                {doc.dueDate || '—'}
                              </span>
                            )}
                          </td>

                          {/* Document type selector */}
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[10px] bg-sky-50 text-sky-700 border border-sky-100">
                              أمر شراء PO
                            </span>
                          </td>

                          {/* Ref Doc Number */}
                          <td className="py-3 px-4 font-mono">
                            {isEditing ? (
                              <input
                                type="text"
                                value={doc.docNumber}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const draft = [...editDocs];
                                  draft[idx].docNumber = e.target.value;
                                  setEditDocs(draft);
                                }}
                                className="px-2 py-1 border border-sky-200 bg-sky-50/30 rounded focus:outline-hidden focus:border-sky-500 font-mono text-xs text-slate-800"
                              />
                            ) : (
                              doc.docNumber || 'N/A'
                            )}
                          </td>

                          {/* Amount */}
                          <td className="py-3 px-4 font-bold text-sm text-emerald-700 font-mono text-left">
                            {isEditing ? (
                              <input
                                type="number"
                                value={doc.totalAmount}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const draft = [...editDocs];
                                  draft[idx].totalAmount = Number(e.target.value);
                                  setEditDocs(draft);
                                }}
                                className="px-2 py-1 border border-sky-200 bg-sky-50/30 rounded focus:outline-hidden focus:border-sky-500 font-mono text-xs text-slate-800 text-left"
                              />
                            ) : (
                              getDocNetSpent(doc).toLocaleString(undefined, { minimumFractionDigits: 2 })
                            )}
                          </td>

                          {/* Currency */}
                          <td className="py-3 px-4 font-semibold text-slate-500">
                            {isEditing ? (
                              <input
                                type="text"
                                value={doc.currency}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const draft = [...editDocs];
                                  draft[idx].currency = e.target.value;
                                  setEditDocs(draft);
                                }}
                                className="px-2 py-1 border border-sky-200 bg-sky-50/30 rounded focus:outline-hidden focus:border-sky-500 text-xs text-slate-800"
                              />
                            ) : (
                              doc.currency
                            )}
                          </td>

                          {/* Mini summary sentence */}
                          <td className="py-3 px-4 text-slate-500 max-w-xs truncate" title={doc.summary}>
                            {isEditing ? (
                              <input
                                type="text"
                                value={doc.summary || ''}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const draft = [...editDocs];
                                  draft[idx].summary = e.target.value;
                                  setEditDocs(draft);
                                }}
                                className="w-full px-2 py-1 border border-sky-200 bg-sky-50/30 rounded focus:outline-hidden focus:border-sky-500 text-xs text-slate-800"
                              />
                            ) : (
                              doc.summary || 'توريد بنود تجارية مباشرة'
                            )}
                          </td>

                          {/* Classified File Link */}
                          <td className="py-3 px-4">
                            {doc.classifiedPath ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerFileDownload(doc);
                                }}
                                className="text-sky-600 hover:text-sky-800 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>تحميل</span>
                              </button>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* Delete Item action */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCustomDocDeleteModal({ isOpen: true, docId: doc.id });
                              }}
                              className="p-1 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف البند نهائيا"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: CLIENT FILE ORGANIZER */}
          {activeTab === 'files' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex-1">
              
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-sky-600" />
                  مستودع الموردين وتصنيف المجلدات
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  المجلدات التالية تم إنشاؤها تلقائياً على نظام خادم الملفات. يتم تجميع وحفظ المستندات بداخل كل مورد وتصنيف البنود وتواريخ الاستلام.
                </p>
              </div>

              {Object.keys(documentsByClient).length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-slate-150 rounded-2xl">
                  <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">لا توجد مجلدات موردين نشطة حالياً.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(Object.entries(documentsByClient) as [string, ProcessedDocument[]][]).map(([clientName, docs]) => (
                    <div key={clientName} className="border border-slate-150 rounded-2xl overflow-hidden hover:border-sky-350 hover:shadow-xs transition-all bg-slate-50/30">
                      
                      {/* Customer folder title */}
                      <div className="bg-slate-100 p-4 border-b border-slate-150 flex justify-between items-center">
                        <div className="flex items-center gap-2 max-w-[70%]">
                          <div className="p-1.5 bg-sky-200 text-sky-800 rounded-lg flex-shrink-0">
                            <FolderOpen className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-slate-800 text-sm truncate" title={clientName}>{clientName}</span>
                          <button
                            onClick={() => {
                              setCustomSupplierRenameModal({ isOpen: true, supplierName: clientName, inputValue: clientName });
                            }}
                            className="p-1 hover:bg-slate-250 text-slate-500 hover:text-sky-600 rounded-md transition-colors cursor-pointer flex-shrink-0"
                            title="تعديل اسم المورد"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              setCustomSupplierDeleteModal({ isOpen: true, supplierName: clientName });
                            }}
                            className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer flex-shrink-0"
                            title="حذف المورد"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="px-2 py-0.5 bg-white text-slate-600 rounded-md text-[10px] font-bold border border-slate-150 font-mono flex-shrink-0">
                          {docs.length} ملفات
                        </span>
                      </div>

                      {/* File item list */}
                      <div className="p-4 divide-y divide-slate-100 bg-white">
                        {docs.map(doc => (
                          <div key={doc.id} className="py-2.5 flex justify-between items-center text-xs gap-3">
                            <div className="flex items-start gap-2 min-w-0">
                              <FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-sky-600" />
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-700 block truncate" title={doc.originalFilename}>
                                  أمر شراء #{doc.docNumber || 'X'}
                                </span>
                                <span className="text-[10px] text-slate-400 block font-mono">تاريخ: {doc.receiptDate}</span>
                              </div>
                            </div>
                            
                            <div className="text-left flex-shrink-0 flex items-center gap-2">
                              <span className="font-bold text-slate-800 font-mono">
                                {getDocNetSpent(doc).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] text-slate-400">{doc.currency}</span>
                              </span>
                              {doc.classifiedPath && (
                                <button 
                                  onClick={() => triggerFileDownload(doc)}
                                  className="p-1 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-md border border-slate-150 cursor-pointer"
                                  title="تحميل الملف من مجلده الفيزيائي"
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* TAB 3: PROJECT DIVISION & PO SEQUENTIALS */}
          {activeTab === 'projects' && (
            <div className="space-y-6 flex-1 flex flex-col select-none">
              
              {/* Projects Overview Alert info card */}
              <div className="bg-gradient-to-r from-indigo-50/70 to-blue-50/50 border border-indigo-150 rounded-2xl p-4 flex gap-3 text-indigo-900 shadow-xs">
                <Info className="w-5 h-5 text-indigo-650 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="font-extrabold text-indigo-950">مستكشف تقسيم المشاريع التلقائي (DELTA Project Explorer):</span>
                  <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                    هذا التبويب يقوم بفصل المعاملات وعقود التوريد تلقائياً لكل مشروع إنشائي بصورة مستقلة، مع حساب الرصيد الإجمالي التراكمي وتعيين كود مسلسل مستقل للـ POs الخاص ببلان كل مشروع بالتوالي الزمني للاستلام.
                  </p>
                </div>
              </div>

              {/* Sub-tabs selector for Projects Section (only if not viewing a single folder deep) */}
              {!selectedFolderProject && (
                <div className="flex gap-2 border-b border-slate-200 pb-0.5" dir="rtl">
                  <button
                    onClick={() => setProjectSubTab('folders')}
                    className={`px-4 py-2.5 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      projectSubTab === 'folders'
                        ? 'border-sky-600 text-sky-700 font-extrabold pb-2'
                        : 'border-transparent text-slate-500 hover:text-slate-700 pb-2'
                    }`}
                  >
                    <Folder className="w-4 h-4 text-amber-500" />
                    <span>مجلدات وأرشيف المشاريع</span>
                  </button>
                  <button
                    onClick={() => setProjectSubTab('charts')}
                    className={`px-4 py-2.5 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      projectSubTab === 'charts'
                        ? 'border-sky-600 text-sky-700 font-extrabold pb-2'
                        : 'border-transparent text-slate-500 hover:text-slate-700 pb-2'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4 text-sky-600" />
                    <span>رسوم الميزانية ومعدل الإنفاق الشهري</span>
                  </button>
                  <button
                    onClick={() => setProjectSubTab('suppliers')}
                    className={`px-4 py-2.5 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      projectSubTab === 'suppliers'
                        ? 'border-sky-600 text-sky-700 font-extrabold pb-2'
                        : 'border-transparent text-slate-500 hover:text-slate-700 pb-2'
                    }`}
                  >
                    <Truck className="w-4 h-4 text-emerald-600" />
                    <span>سجل الموردين المعتمدين ({uniqueClientsList.length})</span>
                  </button>
                  <button
                    onClick={() => setProjectSubTab('units')}
                    className={`px-4 py-2.5 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                      projectSubTab === 'units'
                        ? 'border-sky-600 text-sky-700 font-extrabold pb-2'
                        : 'border-transparent text-slate-500 hover:text-slate-700 pb-2'
                    }`}
                  >
                    <Scale className="w-4 h-4 text-sky-600" />
                    <span>دليل وحدات القياس المعتمدة ({uniqueItemUnits.length})</span>
                  </button>
                </div>
              )}

              {selectedFolderProject ? (
                // ------------------ INSIDE A CHOSEN PROJECT FOLDER ------------------
                (() => {
                  const projectName = selectedFolderProject;
                  const docs = documentsByProject[projectName] || [];
                  const pos = docs.filter(d => d.docType === 'po');
                  const quotes = docs.filter(d => d.docType === 'quote');
                  
                  // Calculate rich aggregates specifically for this folder
                  const projectCurrencySums: Record<string, { subtotal: number, discount: number, withholding: number, net: number, count: number }> = {};
                  docs.forEach(d => {
                    const c = d.currency || 'EGP';
                    if (!projectCurrencySums[c]) {
                      projectCurrencySums[c] = { subtotal: 0, discount: 0, withholding: 0, net: 0, count: 0 };
                    }
                    
                    const itemsSubtotal = (d.items || []).reduce((sum, item) => sum + Number(((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)), 0);
                    const discPct = d.discountPercentage || 0;
                    const discAmt = d.discountAmount || 0;
                    const totalDiscount = ((itemsSubtotal * discPct) / 100) + discAmt;
                    const finalTotalAmount = Math.max(0, itemsSubtotal - totalDiscount);
                    
                    const taxRate = d.withholdingTaxEnabled ? (d.withholdingTaxRate || 1) : 0;
                    const taxAmount = (finalTotalAmount * taxRate) / 100;
                    const netPayable = finalTotalAmount - taxAmount;
                    
                    projectCurrencySums[c].subtotal += itemsSubtotal;
                    projectCurrencySums[c].discount += totalDiscount;
                    projectCurrencySums[c].withholding += taxAmount;
                    projectCurrencySums[c].net += netPayable;
                    projectCurrencySums[c].count += 1;
                  });

                  // Sort documents chronologically by receiptDate
                  const sortedDocs = [...docs].sort((a, b) => {
                    const dateA = a.receiptDate || a.processedAt || '';
                    const dateB = b.receiptDate || b.processedAt || '';
                    return dateA.localeCompare(dateB);
                  });

                  return (
                    <div className="space-y-6 flex-1 flex flex-col">
                      
                      {/* Breadcrumbs Navigation */}
                      <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2 text-slate-600">
                        <button 
                          onClick={() => setSelectedFolderProject(null)}
                          className="flex items-center gap-1 hover:text-sky-600 transition-colors font-bold cursor-pointer"
                        >
                          <Folder className="w-4 h-4 text-amber-500" />
                          <span>المشاريع</span>
                        </button>
                        <ChevronRight className="w-3 h-3 text-slate-300" />
                        <span className="font-extrabold text-slate-800 flex items-center gap-1">
                          <FolderOpen className="w-4 h-4 text-sky-500" />
                          {projectName}
                        </span>
                      </div>

                      {/* Folder Title Cover & General Info */}
                      <div className="bg-white rounded-2xl border border-slate-150 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xs relative overflow-hidden">
                        {/* Decorative Folder Header Tab inside */}
                        <div className="absolute top-0 right-8 w-24 h-1.5 bg-sky-500 rounded-t" />
                        
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl border border-sky-100">
                            <FolderOpen className="w-8 h-8" />
                          </div>
                          <div>
                            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                              <span>المجلد:</span>
                              <span className="text-sky-700">{projectName}</span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-1.5 whitespace-nowrap">
                              مجموع الملفات: <span className="font-bold text-slate-700">{docs.length} مستندات</span> (أوامر الشراء: {pos.length} | عروض الأسعار: {quotes.length})
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {projectName !== 'عام' && (
                            <>
                              <button
                                onClick={() => {
                                  setCustomProjectRenameModal({ isOpen: true, projectName, inputValue: projectName });
                                }}
                                className="px-4 py-2 bg-amber-50 hover:bg-amber-105 active:scale-95 text-amber-700 font-extrabold rounded-xl text-xs border border-amber-200 cursor-pointer flex items-center gap-1.5 transition-all shadow-3xs"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>تعديل اسم المشروع</span>
                              </button>
                              <button
                                onClick={() => {
                                  setCustomProjectDeleteModal({ isOpen: true, projectName });
                                }}
                                className="px-4 py-2 bg-rose-50 hover:bg-rose-105 active:scale-95 text-rose-700 font-extrabold rounded-xl text-xs border border-rose-250 cursor-pointer flex items-center gap-1.5 transition-all shadow-3xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف المشروع</span>
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => setSelectedFolderProject(null)}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-205 text-slate-700 font-extrabold rounded-xl text-xs border border-slate-250 cursor-pointer flex items-center gap-1.5 transition-colors"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>عرض جميع المجلدات</span>
                          </button>
                        </div>
                      </div>

                      {/* FINANCIAL STATISTICS SEGMENTED BY CURRENCY */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-extrabold text-slate-600 flex items-center gap-1.5">
                          <span className="w-1.5 h-3.5 bg-sky-600 rounded-sm"></span>
                          <span>تقسيم وتفصيل المبالغ الإجمالية حسب العملة:</span>
                        </h4>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                          {Object.entries(projectCurrencySums).map(([curr, stat]) => (
                            <div 
                              key={curr} 
                              className="bg-slate-50/55 rounded-2xl border border-slate-150 p-5 flex flex-col justify-between"
                            >
                              <div className="flex justify-between items-center pb-3 border-b border-slate-200/60 mb-4">
                                <span className="text-xs bg-slate-200/60 px-2.5 py-1 text-slate-800 rounded-lg font-bold font-mono">
                                  عملة: {curr}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  عدد المعاملات: {stat.count}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-700">
                                {/* Subtotal before Discount */}
                                <div className="space-y-1">
                                  <p className="text-[10px] text-slate-400 font-bold">الإجمالي قبل التخفيض</p>
                                  <p className="text-xs font-extrabold text-slate-700 font-mono">
                                    {stat.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>

                                {/* Discount */}
                                <div className="space-y-1">
                                  <p className="text-[10px] text-slate-400 font-bold">إجمالي الخصومات</p>
                                  <p className="text-xs font-extrabold text-rose-600 font-mono">
                                    -{stat.discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>

                                {/* Withholding Tax */}
                                <div className="space-y-1">
                                  <p className="text-[10px] text-slate-400 font-bold">ضرائب خصم أ.ت.ص</p>
                                  <p className="text-xs font-extrabold text-amber-600 font-mono">
                                    -{stat.withholding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>

                                {/* Net Payable */}
                                <div className="space-y-1">
                                  <p className="text-[10px] text-sky-700 font-bold">صافي القيمة المستحقة</p>
                                  <p className="text-sm font-black text-sky-700 font-mono">
                                    {stat.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Documents table of this folder */}
                      <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-xs">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center">
                          <h4 className="text-xs font-bold text-slate-800">
                            مستندات ومعاملات مجلد المشروع ({docs.length} ملفات)
                          </h4>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-[#FAFBFD] text-slate-500 border-b border-slate-100 uppercase text-[10px] tracking-wider">
                              <tr>
                                <th className="py-3 px-4 font-bold">اسم المورد</th>
                                <th className="py-3 px-4 font-bold">تاريخ الاستلام</th>
                                <th className="py-3 px-4 font-bold text-amber-700">تاريخ الاستحقاق</th>
                                <th className="py-3 px-4 font-bold text-center">حالة المشروع</th>
                                <th className="py-3 px-4 font-bold">نوع المستند</th>
                                <th className="py-3 px-4 font-bold">رقم المستند</th>
                                <th className="py-3 px-4 font-bold">القيمة قبل التخفيض</th>
                                <th className="py-3 px-4 font-bold">صافي المستحق</th>
                                <th className="py-3 px-4 font-bold">الملخص والبنود</th>
                                <th className="py-3 px-4 font-bold text-center w-28">إجراءات</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {sortedDocs.map((doc) => {
                                // Calculate document specific sums
                                const itemsSubtotal = (doc.items || []).reduce((sum, item) => sum + Number(((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)), 0);
                                const discPct = doc.discountPercentage || 0;
                                const discAmt = doc.discountAmount || 0;
                                const totalDiscount = ((itemsSubtotal * discPct) / 100) + discAmt;
                                const finalAmount = Math.max(0, itemsSubtotal - totalDiscount);
                                
                                const taxRate = doc.withholdingTaxEnabled ? (doc.withholdingTaxRate || 1) : 0;
                                const taxAmount = (finalAmount * taxRate) / 100;
                                const netPayable = finalAmount - taxAmount;

                                return (
                                  <tr 
                                    key={doc.id} 
                                    className="hover:bg-slate-50/40 cursor-pointer transition-colors"
                                    onClick={() => setSelectedDoc(doc)}
                                  >
                                    <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                                      {doc.clientName}
                                    </td>

                                    <td className="py-3.5 px-4 font-medium text-slate-400 font-mono">
                                      {doc.receiptDate}
                                    </td>

                                    <td className="py-3.5 px-4 font-mono">
                                      <span className={getDueDateWarningStyle(doc.dueDate)}>
                                        {doc.dueDate || "—"}
                                      </span>
                                    </td>

                                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                      {(() => {
                                        const status = doc.projectStatus || 'in_progress';
                                        if (status === 'completed') {
                                          return (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-100">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                              <span>مكتمل</span>
                                            </span>
                                          );
                                        } else if (status === 'deferred') {
                                          return (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-extrabold border border-slate-200">
                                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                              <span>مؤجل</span>
                                            </span>
                                          );
                                        } else {
                                          return (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-[10px] font-extrabold border border-amber-100">
                                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                              <span>قيد التنفيذ</span>
                                            </span>
                                          );
                                        }
                                      })()}
                                    </td>

                                    <td className="py-3.5 px-4">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800">
                                        أمر شراء
                                      </span>
                                    </td>

                                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                                      {doc.docNumber || 'X'}
                                    </td>

                                    <td className="py-3.5 px-4 font-semibold font-mono text-slate-500">
                                      {itemsSubtotal.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{doc.currency}</span>
                                    </td>

                                    <td className="py-3.5 px-4 font-black font-mono text-sky-700">
                                      {netPayable.toLocaleString()} <span className="text-[10px] text-sky-600/70 font-normal">{doc.currency}</span>
                                    </td>

                                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate font-medium" title={doc.summary}>
                                      {doc.summary || 'بند تجاري معزز'}
                                    </td>

                                    <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-center gap-2">
                                        <button 
                                          onClick={() => setSelectedDoc(doc)}
                                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[10px] border border-slate-200 cursor-pointer"
                                        >
                                          معاينة الخلايا
                                        </button>
                                        {doc.classifiedPath && (
                                          <button 
                                            onClick={() => triggerFileDownload(doc)}
                                            className="p-1 bg-slate-50 hover:bg-slate-100 text-sky-600 rounded border border-slate-200 cursor-pointer animate-none"
                                            title="تحميل مستند"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        <button 
                                          onClick={() => {
                                            setCustomDocDeleteModal({ isOpen: true, docId: doc.id });
                                          }}
                                          className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded border border-rose-200 cursor-pointer"
                                          title="حذف البند نهائيا"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  );
                })()
              ) : projectSubTab === 'charts' ? (
                // ------------------ CHARTS DASHBOARD ------------------
                <div className="space-y-6 flex-grow flex flex-col">
                  
                  {/* Control / Filter Panel */}
                  <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-xs bg-white">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
                      <TrendingUp className="w-5 h-5 text-sky-600" />
                      <h3 className="text-sm font-black text-slate-800">تصفية لوحة الميزانية والإنفاق</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* 1. Project Selector */}
                      <div className="space-y-1.5 text-right">
                        <label className="text-[11px] font-extrabold text-slate-500 block">المشروع الإنشائي:</label>
                        <select 
                          value={chartSelectedProject}
                          onChange={(e) => setChartSelectedProject(e.target.value)}
                          className="w-full text-xs bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2.5 font-bold outline-none focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer text-slate-800"
                        >
                          <option value="all">كافة المشاريع الإنشائية (تجميعي)</option>
                          {projectAnalytics.projectsList.map((pName) => (
                            <option key={pName} value={pName}>{pName}</option>
                          ))}
                        </select>
                      </div>

                      {/* 2. Currency Selector */}
                      <div className="space-y-1.5 text-right">
                        <label className="text-[11px] font-extrabold text-slate-500 block">العملة المالية المعتمدة:</label>
                        <select 
                          value={chartSelectedCurrency}
                          onChange={(e) => setChartSelectedCurrency(e.target.value)}
                          className="w-full text-xs bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2.5 font-bold outline-none focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer font-mono text-slate-800"
                        >
                          {projectAnalytics.currenciesList.map((curr) => (
                            <option key={curr} value={curr}>{curr}</option>
                          ))}
                        </select>
                      </div>

                      {/* 3. Doc Type Selector */}
                      <div className="space-y-1.5 text-right">
                        <label className="text-[11px] font-extrabold text-slate-500 block">تصنيف المستندات للتحليل:</label>
                        <select 
                          value={chartSelectedDocType}
                          onChange={(e) => setChartSelectedDocType(e.target.value as any)}
                          className="w-full text-xs bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2.5 font-bold outline-none focus:ring-2 focus:ring-sky-500 transition-all cursor-pointer text-slate-800"
                        >
                          <option value="po">أوامر الشراء المؤكدة فقط (POs Real Spent)</option>
                          <option value="quote">عروض الأسعار والتسعيرات (Quotes potential)</option>
                          <option value="all">كافة المستندات والمدخلات (تجميعي)</option>
                        </select>
                      </div>

                    </div>
                  </div>

                  {/* STATISTICAL SUMMARY CARDS GRID */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Card 1: Spending Outflow */}
                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between shadow-2xs">
                      <div className="space-y-1 text-right">
                        <span className="text-[10px] text-slate-500 font-extrabold block">إجمالي القيمة المرصودة للتحليل</span>
                        <p className="text-xl font-black text-slate-900 font-mono">
                          {projectAnalytics.totalSpentOverall.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <span className="text-[10px] bg-sky-50 border border-sky-100/50 px-2 py-0.5 rounded text-sky-700 font-bold font-mono">
                          {chartSelectedCurrency}
                        </span>
                      </div>
                      <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
                        <BarChart2 className="w-6 h-6" />
                      </div>
                    </div>

                    {/* Card 2: Document count */}
                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between shadow-2xs">
                      <div className="space-y-1 text-right">
                        <span className="text-[10px] text-slate-500 font-extrabold block">عدد المعاملات والمستندات المفحوصة</span>
                        <p className="text-xl font-black text-slate-900 font-mono">
                          {projectAnalytics.docCountOverall.toLocaleString('en-US')}
                        </p>
                        <span className="text-[10px] bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded text-emerald-800 font-bold">
                          {chartSelectedDocType === 'po' ? 'مستندات PO' : chartSelectedDocType === 'quote' ? 'عروض أسعار' : 'مستندات مختلطة'}
                        </span>
                      </div>
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-emerald-600">
                        <Layers className="w-6 h-6" />
                      </div>
                    </div>

                    {/* Card 3: Average transaction size */}
                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 flex items-center justify-between shadow-2xs">
                      <div className="space-y-1 text-right">
                        <span className="text-[10px] text-slate-500 font-extrabold block">متوسط التدفق التمويلي لكل معاملة</span>
                        <p className="text-xl font-black text-slate-900 font-mono">
                          {projectAnalytics.averageSpentOverall.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                        <span className="text-[10px] bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded text-indigo-800 font-semibold font-mono">
                          {chartSelectedCurrency} / معاملة
                        </span>
                      </div>
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <TrendingUp className="w-6 h-6" />
                      </div>
                    </div>

                  </div>

                  {/* BENTO GRID: MAIN CHART AND PIE CHART */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    
                    {/* Visual 1: Monthly Spending progression over months */}
                    <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-xs xl:col-span-2 flex flex-col justify-between">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-6 font-sans">
                        <div className="text-right font-sans">
                          <h4 className="text-xs font-black text-slate-800">التمثيل الزمني للإنفاق وتدفق المستندات</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">منحنيات التدفق الشهري لمدفوعات التوريد والإنفاق المتراكم وتفصيل ميزانية المشاريع.</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                          عملة التحليل: {chartSelectedCurrency}
                        </span>
                      </div>

                      <div className="w-full h-80 min-h-[320px] flex items-center justify-center relative">
                        {projectAnalytics.monthlyData.length === 0 ? (
                          <div className="text-center p-8 space-y-2">
                            <TrendingUp className="w-10 h-10 text-slate-350 mx-auto animate-pulse" />
                            <p className="text-xs text-slate-500 font-bold">لا تتوفر أية بيانات زمنية مسجلة لهذه الفلترة ومحافظ العملات!</p>
                            <p className="text-[10px] text-slate-400">يرجى رفع أوامر الشراء أو تعديل العملات المختارة.</p>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            {chartSelectedProject === 'all' ? (
                              <BarChart
                                data={projectAnalytics.monthlyData}
                                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis 
                                  dataKey="month" 
                                  stroke="#64748b" 
                                  fontSize={10} 
                                  fontWeight={700}
                                  tickLine={false}
                                />
                                <YAxis 
                                  stroke="#64748b" 
                                  fontSize={10} 
                                  fontWeight={700}
                                  tickLine={false}
                                  tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                                />
                                <Tooltip
                                  content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                      return (
                                        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-lg text-right text-xs space-y-1.5 backdrop-blur-md">
                                          <p className="font-extrabold text-slate-800 border-b border-slate-100 pb-1 mb-1.5">{label}</p>
                                          {payload.map((entry: any, index: number) => {
                                            if (entry.name === 'الإجمالي التراكمي' || entry.name === 'total' || entry.name === 'Total' || !entry.value) return null;
                                            return (
                                              <p key={index} className="font-semibold flex justify-between gap-4 items-center" style={{ color: entry.fill || entry.stroke }}>
                                                <span>{entry.name}:</span>
                                                <span className="font-mono font-black">{(entry.value || 0).toLocaleString()} {chartSelectedCurrency}</span>
                                              </p>
                                            );
                                          })}
                                          <div className="border-t border-slate-100 pt-1.5 mt-1 text-[10px] text-slate-600 font-extrabold flex justify-between gap-4">
                                            <span>مجموع الشهر التراكمي:</span>
                                            <span className="font-mono text-indigo-700">{(payload[0]?.payload?.cumulative || 0).toLocaleString()} {chartSelectedCurrency}</span>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 10, fontWeight: 700 }} />
                                {projectAnalytics.projectsList.map((pName, idx) => (
                                  <Bar 
                                    key={pName} 
                                    dataKey={pName} 
                                    stackId="projectStack" 
                                    fill={idx === 0 ? '#0284c7' : idx === 1 ? '#0d9488' : idx === 2 ? '#f59e0b' : idx === 3 ? '#4f46e5' : idx === 4 ? '#e11d48' : '#16a34a'} 
                                    name={pName}
                                    radius={[0, 0, 0, 0]}
                                  />
                                ))}
                              </BarChart>
                            ) : (
                              <BarChart
                                data={projectAnalytics.monthlyData}
                                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis 
                                  dataKey="month" 
                                  stroke="#64748b" 
                                  fontSize={10} 
                                  fontWeight={700}
                                  tickLine={false}
                                />
                                <YAxis 
                                  stroke="#64748b" 
                                  fontSize={10} 
                                  fontWeight={700}
                                  tickLine={false}
                                  tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                                />
                                <Tooltip
                                  content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                      const primaryData = payload.find(p => p.dataKey === 'amount');
                                      const cumulativeData = payload.find(p => p.dataKey === 'cumulative');
                                      return (
                                        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-lg text-right text-xs space-y-1.5 backdrop-blur-md">
                                          <p className="font-extrabold text-slate-800 border-b border-slate-100 pb-1 mb-1.5">{label}</p>
                                          <p className="text-sky-700 font-semibold flex justify-between gap-6">
                                            <span>الإنفاق المباشر للشهر:</span>
                                            <span className="font-mono font-black">{((primaryData?.value || 0) as number).toLocaleString()} {chartSelectedCurrency}</span>
                                          </p>
                                          <p className="text-indigo-650 font-semibold flex justify-between gap-6">
                                            <span>الرصيد التراكمي للمشروع:</span>
                                            <span className="font-mono font-black">{((cumulativeData?.value || 0) as number).toLocaleString()} {chartSelectedCurrency}</span>
                                          </p>
                                          <p className="text-slate-500 font-semibold flex justify-between gap-6 border-t border-slate-100 pt-1 mt-1 text-[10px]">
                                            <span>عدد المستندات للشهر:</span>
                                            <span className="font-mono font-black">{payload[0]?.payload?.docCount || 0} ملف</span>
                                          </p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 10, fontWeight: 700 }} />
                                <Bar 
                                  dataKey="amount" 
                                  fill="#0284c7" 
                                  name="المبلغ الشهري المستهلك" 
                                  radius={[4, 4, 0, 0]} 
                                />
                              </BarChart>
                            )}
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>

                    {/* Visual 2: Comparative Breakdown in Pie Chart */}
                    <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-xs flex flex-col justify-between">
                      <div className="flex flex-col pb-3 border-b border-slate-100 mb-4 text-right">
                        <h4 className="text-xs font-black text-slate-800">توزيع الإنفاق ومشاركة المحفظة</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">النسبة المئوية لحصة الإنفاق المسحوبة لكل مشروع من إجمالي الموازنة المتاحة.</p>
                      </div>

                      <div className="h-60 flex items-center justify-center relative">
                        {projectAnalytics.projectComparisonData.length === 0 ? (
                          <div className="text-center p-4">
                            <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-pulse" />
                            <p className="text-[11px] text-slate-500 font-bold">مقارنة غير كافية لمشاريع متعددة.</p>
                            <p className="text-[9px] text-slate-400">تأكد من إرسال وتصنيف المستندات لعدة مشاريع.</p>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={projectAnalytics.projectComparisonData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {projectAnalytics.projectComparisonData.map((entry, index) => (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={index === 0 ? '#0284c7' : index === 1 ? '#0d9488' : index === 2 ? '#f59e0b' : index === 3 ? '#4f46e5' : index === 4 ? '#e11d48' : '#16a34a'} 
                                  />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value: number) => [`${value.toLocaleString()} ${chartSelectedCurrency}`, 'الإنفاق المحقق']}
                                contentStyle={{ fontSize: '11px', borderRadius: '12px', textAlign: 'right' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>

                      {/* Manual Side Legends and percentages */}
                      <div className="space-y-2 max-h-40 overflow-y-auto pt-2 border-t border-slate-100 text-xs">
                        {projectAnalytics.projectComparisonData.length === 0 ? (
                          <p className="text-[10px] text-slate-400 text-center">لا يوجد مشاريع لعرضها.</p>
                        ) : (
                          projectAnalytics.projectComparisonData.map((item, index) => {
                            const percent = ((item.value / (projectAnalytics.projectComparisonData.reduce((sum, i) => sum + i.value, 0) || 1)) * 100).toFixed(1);
                            const col = index === 0 ? '#0284c7' : index === 1 ? '#0d9488' : index === 2 ? '#f59e0b' : index === 3 ? '#4f46e5' : index === 4 ? '#e11d48' : '#16a34a';
                            return (
                              <div key={item.name} className="flex items-center justify-between text-slate-700">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span 
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                                    style={{ backgroundColor: col }}
                                  />
                                  <span className="font-bold truncate text-[11px]">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-right flex-shrink-0 font-mono text-[11px]">
                                  <span className="font-black text-slate-800">{percent}%</span>
                                  <span className="text-slate-400 text-[10px]/[1] font-medium">({item.value.toLocaleString()} {chartSelectedCurrency})</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                    </div>

                  </div>

                  {/* STATISTICAL DETAILED MONTHLY LEDGER CARD */}
                  <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-xs bg-white">
                    <div className="p-4 border-b border-slate-100 bg-[#FAFBFD] flex justify-between items-center text-right">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-black text-slate-800">دفتر التفصيل المالي الشهري الدقيق (Expenditure Monthly Log)</h4>
                        <p className="text-[10px] text-slate-400 mt-1">جدول رقمي يبين مبالغ المصروفات وتراكماتها لكل شهر وتأكيد موازنات العقود.</p>
                      </div>
                      <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg font-bold">
                        {chartSelectedProject === 'all' ? 'كافة المشاريع' : chartSelectedProject}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-[#FAFBFD]/50 text-slate-500 border-b border-slate-100 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-3 px-6 font-bold">الجدول الزمني (الشهر)</th>
                            <th className="py-3 px-6 font-bold">{chartSelectedProject === 'all' ? 'إجمالي فواتير الشهر' : 'المنصرف للشهر الحالي'}</th>
                            <th className="py-3 px-6 font-bold">المنصرف التراكمي العام</th>
                            <th className="py-3 px-6 font-bold text-center">عدد مستندات المعاملات</th>
                            <th className="py-3 px-6 font-bold text-center">العملة والوثوقية</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {projectAnalytics.monthlyData.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                                لا يوجد سجلات تاريخية للخيارات المحددة لتكوين الدفتر المالي.
                              </td>
                            </tr>
                          ) : (
                            [...projectAnalytics.monthlyData].reverse().map((row, idx) => {
                              const currentAmount = chartSelectedProject === 'all' ? (row.total || 0) : (row.amount || 0);
                              return (
                                <tr key={row.monthKey || idx} className="hover:bg-slate-50/25 transition-colors">
                                  <td className="py-3.5 px-6 font-bold text-slate-800">{row.month}</td>
                                  <td className="py-3.5 px-6 font-black text-slate-900 font-mono">
                                    {currentAmount.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{chartSelectedCurrency}</span>
                                  </td>
                                  <td className="py-3.5 px-6 font-black text-sky-700 font-mono">
                                    {row.cumulative.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">{chartSelectedCurrency}</span>
                                  </td>
                                  <td className="py-3.5 px-6 text-center font-bold text-slate-600 font-mono">
                                    {chartSelectedProject === 'all' ? '-' : (row.docCount || 0)}
                                  </td>
                                  <td className="py-3.5 px-6 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 text-sky-700 text-[10px] font-bold border border-sky-100/50">
                                      مكتملة ومرحلة
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              ) : projectSubTab === 'suppliers' ? (
                // ------------------ APPROVED SUPPLIERS REGISTER & SEARCH ------------------
                <div className="space-y-6 flex-grow flex flex-col pt-2 text-right font-sans" dir="rtl">
                  
                  {/* Header & Quick Add Supplier */}
                  <div className="flex flex-col gap-4 bg-slate-50/70 p-4 border border-slate-150 rounded-2xl">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 text-right">
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-slate-800">بوابة إدارة سجل الموردين والشركات المعتمدة</h4>
                        <p className="text-[10.5px] text-slate-400">تساعد قائمة الموردين المعتمدة نموذج الذكاء الاصطناعي (Gemini OCR) في مطابقة وتصنيف أسماء الشركات بدقة بالغة وتجنب تكرار الأسماء المتشابهة في أرشيف المعاملات.</p>
                      </div>

                      {/* Search Bar */}
                      <div className="relative max-w-sm w-full">
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                          <Search className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          placeholder="البحث أو تسجيل اسم شركة ومورد معتمد..."
                          value={newSupplierInput}
                          onChange={(e) => setNewSupplierInput(e.target.value)}
                          className="w-full pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs text-right font-semibold text-slate-900"
                        />
                      </div>
                    </div>

                    {/* Quick Add Supplier Input Form */}
                    <div className="border-t border-slate-200/60 pt-3 flex flex-col sm:flex-row items-center gap-3">
                      <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs shrink-0 self-start sm:self-center">
                        <PlusCircle className="w-4 h-4 text-blue-600" />
                        <span>تسجيل مورد/شركة جديدة مباشرة:</span>
                      </div>
                      <div className="flex gap-2 w-full sm:max-w-md">
                        <input
                          type="text"
                          placeholder="اكتب اسم الشركة أو المورد الجديد هنا..."
                          value={newSupplierInput}
                          onChange={(e) => setNewSupplierInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddSupplier(newSupplierInput);
                              setNewSupplierInput('');
                            }
                          }}
                          className="flex-grow px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-right font-semibold text-slate-900"
                        />
                        <button
                          onClick={() => {
                            handleAddSupplier(newSupplierInput);
                            setNewSupplierInput('');
                          }}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 shadow-xs cursor-pointer"
                        >
                          إضافة المورد
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Directory Search & List Content */}
                  {(() => {
                    const filterText = newSupplierInput.trim().toLowerCase();
                    const displayedSuppliers = uniqueClientsList.filter(s => 
                      s.toLowerCase().includes(filterText)
                    );

                    return displayedSuppliers.length === 0 ? (
                      <div className="bg-white rounded-2xl border-2 border-dashed border-slate-150 p-16 text-center shadow-xs">
                        <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 font-semibold text-center">لا توجد نتائج بحث تطابق المورد المطلوب.</p>
                        <p className="text-xs text-slate-400 mt-1 text-center font-medium">سجل المورد الآن عبر حقل الإضافة أعلاه لإدراجه كمرجع نشط ومطابق ذكي.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {displayedSuppliers.map((supplier) => {
                          const vendorDocs = documents.filter(d => (d.clientName || '').trim() === supplier.trim());
                          const poCount = vendorDocs.filter(d => d.docType === 'po').length;
                          const quoteCount = vendorDocs.filter(d => d.docType === 'quote').length;

                          const sums: Record<string, number> = {};
                          vendorDocs.forEach(d => {
                            const c = d.currency || 'EGP';
                            sums[c] = (sums[c] || 0) + d.totalAmount;
                          });

                          return (
                            <motion.div
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              key={supplier}
                              className="bg-white border border-slate-150 hover:border-emerald-500 rounded-2xl p-4 shadow-3xs hover:shadow-xs transition-all flex flex-col justify-between overflow-hidden text-right"
                            >
                              <div className="space-y-2 text-right">
                                <div className="flex justify-between items-center gap-2">
                                  <span className="text-[9.5px] bg-emerald-50 text-emerald-700 font-black px-2 py-0.5 rounded border border-emerald-100">
                                    مورد نشط
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      title="تعديل اسم المورد"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCustomSupplierRenameModal({ isOpen: true, supplierName: supplier, inputValue: supplier });
                                      }}
                                      className="p-1 text-slate-400 hover:text-amber-600 rounded-md hover:bg-slate-100 transition-all cursor-pointer"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      title="حذف المورد"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCustomSupplierDeleteModal({ isOpen: true, supplierName: supplier });
                                      }}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-all cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <h5 className="text-[12px] font-black text-slate-800 line-clamp-2 leading-relaxed" title={supplier}>
                                  {supplier}
                                </h5>
                                <div className="flex gap-3 text-[9.5px] text-slate-400 font-bold">
                                  <span>المستندات: {vendorDocs.length}</span>
                                  <span>أوامر شراء: {poCount}</span>
                                  <span>عروض الأسعار: {quoteCount}</span>
                                </div>
                              </div>

                              <div className="mt-4 pt-3 border-t border-slate-100/60">
                                <span className="text-[9px] text-slate-400 font-extrabold block text-right mb-1">تراكمي المشتريات المالية:</span>
                                {Object.keys(sums).length === 0 ? (
                                  <p className="text-[10px] text-slate-400 font-semibold text-right italic font-mono">0.00 EGP</p>
                                ) : (
                                  <div className="space-y-1">
                                    {Object.entries(sums).map(([curr, total]) => (
                                      <div key={curr} className="flex justify-between items-center text-right font-mono">
                                        <span className="text-slate-500 text-[10px] font-bold">{curr}</span>
                                        <span className="text-xs font-black text-slate-900">{total.toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    );
                  })()}

                </div>
              ) : projectSubTab === 'units' ? (
                // ------------------ REFERENCE UNITS DIRECTORY & MANAGEMENT ------------------
                <div className="space-y-6 flex-grow flex flex-col pt-2 text-right font-sans" dir="rtl">
                  
                  {/* Alert and System Reference Policy */}
                  <div className="bg-[#FAFBFD] border border-sky-150 rounded-2xl p-5 text-right flex flex-col lg:flex-row justify-between gap-5 items-start lg:items-center">
                    <div className="space-y-1.5">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Scale className="w-5 h-5 text-sky-650" />
                        دليل الوحدات المرجعية والقياسية لعمليات التوريد
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
                        يحتوي هذا القسم على سجل بكافة الوحدات المستخدمة لتحديد كميات المواد والتوريدات. 
                        يقوم محرّك الفواتير الذكي بالتبديل التلقائي لمدخلات الوحدات الشائعة التي يتم استخراجها مشوهة باللغة العربية (مثل تحويل كلمة <span className="font-extrabold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">"عئد"</span> إلى الفصيحة <span className="font-extrabold text-teal-600 bg-teal-50 px-1 py-0.5 rounded border border-teal-200">"عدد"</span>) وتعديلها ينعكس فوراً وشاملاً في كامل قاعدة البيانات.
                      </p>
                    </div>

                    <div className="p-3.5 bg-sky-50 text-sky-900 rounded-2xl border border-sky-100/60 font-medium text-xs space-y-1 text-center shrink-0">
                      <div className="font-extrabold text-sm font-mono text-sky-950">{(uniqueItemUnits || []).length}</div>
                      <div>وحدة قياس معتمدة</div>
                    </div>
                  </div>

                  {/* Units dynamic Grid layout */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {uniqueItemUnits.map((unit) => {
                      const count = unitUsageCounts[unit] || 0;
                      return (
                        <motion.div
                          layout
                          key={unit}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white border border-slate-150 hover:border-sky-500 rounded-2xl p-4 shadow-3xs hover:shadow-xs transition-all flex flex-col justify-between"
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1">
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border border-slate-150">
                                وحدة قياس
                              </span>
                              <h5 className="text-xs font-bold text-slate-800 pt-1.5">{unit}</h5>
                            </div>

                            <button
                              title="تعديل اسم الوحدة وتحديث الكل"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCustomUnitRenameModal({ isOpen: true, unitName: unit, inputValue: unit });
                              }}
                              className="p-1 px-1.5 hover:bg-slate-100 text-slate-400 hover:text-sky-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100/60 flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-bold">مرات الاستخدام في الفواتير:</span>
                            <span className="font-mono font-black text-slate-800 bg-sky-50 border border-sky-100/50 px-2.5 py-0.5 rounded-full text-[11px]">
                              {count} مرات
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                </div>
              ) : (
                // ------------------ ROOT LIST OF PROJECT FOLDERS ------------------
                <div className="space-y-6 flex-grow flex flex-col">
                  
                  {/* Search Bar & Header & Project Creation */}
                  <div className="flex flex-col gap-4 bg-slate-50/70 p-4 border border-slate-150 rounded-2xl" dir="rtl">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                      <div className="space-y-1 text-right">
                        <h4 className="text-xs font-black text-slate-800">تصفح مشاريع عقود التوريد النشطة</h4>
                        <p className="text-[10px] text-slate-400">انقر على أي مجلد من المجلدات أدناه لتصفح تفاصيل المعاملات والمبالغ المفصلة لكل مشروع على حدة.</p>
                      </div>

                      <div className="relative max-w-sm w-full">
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                          <Search className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          placeholder="البحث باسم المشروع أو بيانات البنود..."
                          value={projectSearchTerm}
                          onChange={(e) => setProjectSearchTerm(e.target.value)}
                          className="w-full pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-xs text-slate-900 font-semibold text-right"
                        />
                      </div>
                    </div>

                    {/* Quick Add Project Form */}
                    <div className="border-t border-slate-200/60 pt-3 flex flex-col sm:flex-row items-center gap-3">
                      <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs shrink-0 self-start sm:self-center">
                        <PlusCircle className="w-4 h-4 text-blue-600" />
                        <span>إضافة مشروع جديد كمرجع:</span>
                      </div>
                      <div className="flex gap-2 w-full sm:max-w-md">
                        <input
                          type="text"
                          placeholder="مثال: Villette, Azalia, Hyde Park..."
                          value={newProjectInput}
                          onChange={(e) => setNewProjectInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddProject(newProjectInput);
                              setNewProjectInput('');
                            }
                          }}
                          className="flex-grow px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-right text-slate-900 font-semibold"
                        />
                        <button
                          onClick={() => {
                            handleAddProject(newProjectInput);
                            setNewProjectInput('');
                          }}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 shadow-xs cursor-pointer"
                        >
                          إضافة المشروع
                        </button>
                      </div>
                    </div>
                  </div>

                  {filteredProjectsEntries.length === 0 ? (
                    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-150 p-16 text-center shadow-xs">
                      <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-pulse" />
                      <p className="text-sm text-slate-500 font-semibold">لا توجد نتائج بحث تطابق استعلامك.</p>
                      <p className="text-xs text-slate-400 mt-1">تأكد من كتابة أحرف صحيحة أو إضافة مستندات جديدة مسندة لمشاريع مطابقة.</p>
                    </div>
                  ) : (
                    // GRID OF DESIGNER FOLDERS
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredProjectsEntries.map(([projectName, docs]) => {
                        const pos = docs.filter(d => d.docType === 'po');
                        const quotes = docs.filter(d => d.docType === 'quote');
                        
                        // Sum amount for each currency
                        const currencySums: Record<string, number> = {};
                        docs.forEach(d => {
                          const c = d.currency || 'EGP';
                          currencySums[c] = (currencySums[c] || 0) + d.totalAmount;
                        });

                        return (
                          <div 
                            key={projectName} 
                            onClick={() => setSelectedFolderProject(projectName)}
                            className="group relative bg-[#FCFDFE] hover:bg-white border border-slate-150 hover:border-sky-500 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between overflow-hidden"
                          >
                            {/* View/Edit/Delete Overlay controls in the top-left */}
                            {projectName !== 'عام' && (
                              <div className="absolute top-2.5 left-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10" onClick={(e) => e.stopPropagation()}>
                                <button
                                  title="تعديل اسم المشروع"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCustomProjectRenameModal({ isOpen: true, projectName, inputValue: projectName });
                                  }}
                                  className="p-1.5 bg-white hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg border border-slate-200 hover:border-amber-200 transition-all shadow-3xs"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  title="حذف المشروع"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCustomProjectDeleteModal({ isOpen: true, projectName });
                                  }}
                                  className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg border border-slate-200 hover:border-rose-250 transition-all shadow-3xs"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            {/* Visual Folder Tab-flap Overlay */}
                            <div className="absolute top-0 right-6 w-20 h-1.5 bg-amber-400 rounded-b group-hover:bg-sky-500 transition-all duration-300" />
                            
                            <div className="flex items-start gap-4 mt-2">
                              {/* Glowing yellow folder icon which flips to sky on hover */}
                              <div className="p-3 bg-amber-50 text-amber-500 group-hover:bg-sky-50 group-hover:text-sky-600 rounded-xl border border-amber-100/60 group-hover:border-sky-100 transition-colors shadow-2xs">
                                <Folder className="w-8 h-8 fill-amber-300/40 group-hover:fill-sky-300/20" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-black text-slate-800 truncate group-hover:text-sky-700 transition-colors">
                                  {projectName}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[11px] text-slate-500 font-extrabold bg-slate-100 px-1.5 py-0.5 rounded">
                                    {docs.length} مستندات
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    ({pos.length} أوامر / {quotes.length} عروض)
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Financial Summary of folder */}
                            <div className="mt-5 pt-3.5 border-t border-slate-100 flex flex-col gap-1.5">
                              <span className="text-[9px] text-slate-400 font-extrabold uppercase">إجمالي عقود المجلد:</span>
                              {Object.keys(currencySums).length === 0 ? (
                                <span className="text-[11px] text-slate-400 font-semibold font-mono">0.00 EGP</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(currencySums).map(([curr, total]) => (
                                    <span 
                                      key={curr} 
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100/70 group-hover:bg-sky-50 text-slate-700 group-hover:text-sky-700 font-black text-xs rounded-lg border border-slate-150/50 font-mono transition-colors"
                                    >
                                      <span>{total.toLocaleString()}</span>
                                      <span className="text-[10px] text-slate-400 font-bold">{curr}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}

            </div>
          )}

        </div>

      </main>

      {/* 6. MODAL SIDE-IN SHEET FOR INVOICE / PO DOCUMENT INSPECTION */}
      <AnimatePresence>
        {selectedDoc && (
          <div className="fixed inset-0 z-50 flex justify-end">
            
            {/* Overlay backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDoc(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            {/* Inner Side Sheet container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 20, stiffness: 200 }}
              className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-10 overflow-hidden"
            >
              
              {/* Header drawer controls */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedDoc(null)}
                    className="p-1.5 bg-white border border-slate-150 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </button>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      تفاصيل المستند: أمر شراء
                    </h3>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      <p className="text-[10px] text-slate-400 font-mono">ID: {selectedDoc.id}</p>
                      {selectedDoc.classifiedPath && (
                        <p className="text-[10.5px] text-emerald-600 font-mono bg-emerald-50/60 border border-emerald-100/50 px-2.5 py-1 rounded-lg flex items-center gap-1 mt-1 font-semibold">
                          <span className="font-sans text-slate-500 font-bold shrink-0">📂 مسار الحفظ المحلي بالفولدر:</span>
                          <span className="truncate" title={selectedDoc.classifiedPath}>{selectedDoc.classifiedPath}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedDoc.classifiedPath && (
                    <button
                      onClick={() => triggerFileDownload(selectedDoc)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-250"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>تحميل المستند الأصلي</span>
                    </button>
                  )}
                  
                  {(selectedDoc.docType === 'po' || selectedDoc.docType === 'quote') && (
                    <button
                      onClick={() => handleExportToDeltaExcel(selectedDoc)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs border border-emerald-500"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>تصدير نموذج DELTA (.xlsx)</span>
                    </button>
                  )}

                  <button 
                    onClick={() => setSelectedDoc(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-100/50">
                
                {/* Visual Label Banner (Matches Excel & Uploaded Screenshot Style) */}
                <div className="bg-white border border-slate-350 rounded-3xl p-6 shadow-xl relative overflow-hidden max-w-4xl mx-auto font-sans">
                  
                  {/* Decorative clipboard tab style */}
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-700 via-sky-600 to-blue-700" />
                  
                  {/* Helper control line at top of preview */}
                  <div className="flex justify-between items-center mb-4 border-b border-dashed border-slate-250 pb-4 no-print">
                    <span className="text-xs font-bold text-sky-700 bg-sky-50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-sky-600 rounded-full animate-ping" />
                      💡 نموذج ورقة DELTA التفاعلية - يمكنك النقر والتعديل على أى خلية في الشيت أدناه فوراً!
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleAddDrawerItem}
                        className="px-2.5 py-1.5 bg-sky-100 hover:bg-sky-200 text-sky-800 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        <span>إضافة بند جديد (+)</span>
                      </button>
                    </div>
                  </div>

                  {/* PRINT & DIRECTION SETTINGS BAR */}
                  <div className="bg-[#FAFBFD] border border-slate-200 rounded-2xl p-5 mb-5 flex flex-col gap-4 no-print shadow-xs font-sans">
                    
                    {/* First Line: View Options */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
                      
                      {/* Show/Hide Excel Indices */}
                      <div className="flex flex-wrap items-center gap-2.5 w-full justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-600"></div>
                          <span className="text-xs font-bold text-slate-700">هيكل إكسل (الصفوف والأعمدة):</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowExcelGrid(!showExcelGrid)}
                          className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition-all cursor-pointer border ${
                            showExcelGrid 
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                              : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}
                        >
                          {showExcelGrid ? 'معروض (A, B, C / 8, 9) 👁️' : 'مخفي (شكل نظيف ورسمي) 🙈'}
                        </button>
                      </div>

                    </div>

                    {/* Withholding Tax Toggle Options */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-2.5 text-right w-full justify-between sm:justify-start">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                          <span className="text-xs font-bold text-slate-700">شكل أمر الشراء (الأرباح التجارية والصناعية):</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-white shadow-2xs">
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateDrawerField('withholdingTaxEnabled', false);
                              }}
                              className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                                !selectedDoc.withholdingTaxEnabled
                                  ? 'bg-amber-600 text-white shadow-3xs'
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                              }`}
                            >
                              الشكل العادي (بدون خصم) 📑
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateDrawerField({
                                  withholdingTaxEnabled: true,
                                  withholdingTaxRate: selectedDoc.withholdingTaxRate || 1
                                });
                              }}
                              className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                                selectedDoc.withholdingTaxEnabled
                                  ? 'bg-amber-600 text-white shadow-3xs'
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                              }`}
                            >
                              شكل الخصم الضريبي (خصم الأرباح) ✂️
                            </button>
                          </div>

                          {selectedDoc.withholdingTaxEnabled && (
                            <div className="flex items-center gap-2 bg-amber-50/60 border border-amber-200 px-2.5 py-1 rounded-xl">
                              <span className="text-[11px] font-bold text-amber-800">نسبة الخصم (WHT %):</span>
                              <select
                                value={selectedDoc.withholdingTaxRate || 1}
                                onChange={(e) => {
                                  handleUpdateDrawerField('withholdingTaxRate', Number(e.target.value));
                                }}
                                className="bg-white border border-amber-300 rounded-lg text-[11px] font-bold py-0.5 px-1.5 text-amber-950 outline-hidden focus:ring-1 focus:ring-amber-500"
                              >
                                <option value={1}>1% (سلع ومواد توريد)</option>
                                <option value={3}>3% (خدمات وعقود)</option>
                                <option value={5}>5% (إستشارات ومهن)</option>
                                <option value={10}>10% (أخرى)</option>
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tax & VAT Toggle Options */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-2.5 text-right w-full justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                          <span className="text-xs font-bold text-slate-700">الضريبة المضافة (شاملة الضريبة أم لا):</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-white shadow-2xs">
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateDrawerField({
                                  pricesIncludeTax: true,
                                  taxAddPercentEnabled: false
                                });
                              }}
                              className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                                selectedDoc.pricesIncludeTax !== false
                                  ? 'bg-rose-600 text-white shadow-3xs'
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                              }`}
                            >
                              الأسعار شاملة الضريبة 🏷️
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleUpdateDrawerField('pricesIncludeTax', false);
                              }}
                              className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                                selectedDoc.pricesIncludeTax === false
                                  ? 'bg-rose-600 text-white shadow-3xs'
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                              }`}
                            >
                              الأسعار غير شاملة الضريبة ❌
                            </button>
                          </div>

                          {/* Option to add VAT if prices do not include tax */}
                          {selectedDoc.pricesIncludeTax === false && (
                            <div className="flex flex-wrap items-center gap-2.5">
                              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={!!selectedDoc.taxAddPercentEnabled}
                                  onChange={(e) => {
                                    handleUpdateDrawerField({
                                      taxAddPercentEnabled: e.target.checked,
                                      taxAddPercentRate: (e.target.checked && !selectedDoc.taxAddPercentRate) ? 14 : selectedDoc.taxAddPercentRate
                                    });
                                  }}
                                  className="rounded-md border-slate-300 text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                                />
                                <span className="text-[11px] font-black text-rose-800">إضافة ضريبة القيمة المضافة (+VAT)</span>
                              </label>

                              {selectedDoc.taxAddPercentEnabled && (
                                <div className="flex items-center gap-2 bg-rose-50/60 border border-rose-200 px-2.5 py-1 rounded-xl">
                                  <span className="text-[11px] font-bold text-rose-800">نسبة الضريبة:</span>
                                  <select
                                    value={selectedDoc.taxAddPercentRate ?? 14}
                                    onChange={(e) => {
                                      handleUpdateDrawerField('taxAddPercentRate', Number(e.target.value));
                                    }}
                                    className="bg-white border border-rose-300 rounded-lg text-[11px] font-bold py-0.5 px-1.5 text-rose-950 outline-hidden focus:ring-1 focus:ring-rose-500"
                                  >
                                    <option value={14}>14% (الافتراضي)</option>
                                    <option value={5}>5% (تخفيض خاص)</option>
                                    <option value={10}>10% (خدمات خاصة)</option>
                                    <option value={0}>0% (معفى)</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Second Line: Export Action Buttons */}
                    <div className="flex flex-col sm:flex-row justify-end items-center gap-3">
                      
                      {/* Save Changes button */}
                      <button
                        type="button"
                        disabled={isSavingDrawer}
                        onClick={handleSaveDrawerEdits}
                        className={`w-full sm:w-auto px-5 py-2.5 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer border hover:scale-[1.02] ${
                          isSavingDrawer 
                            ? 'bg-blue-400 border-blue-300 cursor-not-allowed opacity-80' 
                            : 'bg-blue-600 hover:bg-blue-700 border-blue-500'
                        }`}
                      >
                        {isSavingDrawer ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                            <span>جاري حفظ التعديلات...</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <Save className="w-4 h-4 text-blue-100" />
                            <span>حفظ تعديلات المستند 💾</span>
                          </span>
                        )}
                      </button>

                      {/* Save to Excel (.XLSX) */}
                      <button
                        type="button"
                        onClick={() => handleExportToDeltaExcel(selectedDoc)}
                        className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer border border-[#1b874c] hover:scale-[1.02]"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                        <span>تحميل كملف إكسيل مالي (.xlsx) 📊</span>
                      </button>

                      {/* Save as PDF */}
                      <button
                        type="button"
                        onClick={handlePrintDocument}
                        className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-indigo-900 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-800 hover:scale-[1.02] text-center shrink-0"
                      >
                        <Printer className="w-4 h-4 text-sky-400" />
                        <span>حفظ بصيغة PDF / طباعة 📄</span>
                      </button>

                    </div>

                  </div>

                  {/* Project & PO Sequence row in Excel label */}
                  <div className="border border-slate-300 border-b-0 bg-slate-100 text-slate-800 font-sans grid grid-cols-1 lg:grid-cols-3 text-xs rounded-t-xl overflow-hidden mb-[-4px] relative z-20 no-print shadow-xs">
                    <div className="border-b lg:border-b-0 lg:border-r border-slate-250 p-4 flex items-center justify-between gap-4 text-right">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
                        <Briefcase className="w-4 h-4 text-sky-600" />
                        اسم المشروع (Project):
                      </span>
                      <div className="flex items-center gap-1.5 flex-1 max-w-[280px]">
                        {(() => {
                          const currentProjValue = selectedDoc.projectName || "عام";
                          const isCustomProject = !uniqueProjects.includes(currentProjValue);
                          
                          if (isCustomProject) {
                            return (
                              <div className="flex items-center gap-1.5 w-full">
                                <input 
                                  type="text"
                                  value={selectedDoc.projectName || ""}
                                  placeholder="اسم المشروع الجديد..."
                                  onChange={(e) => handleUpdateDrawerField('projectName', e.target.value)}
                                  className="flex-grow min-w-[120px] text-right bg-white border border-slate-300 focus:ring-1 focus:ring-sky-500 font-extrabold text-slate-800 text-xs px-2.5 py-1.5 rounded-xl shadow-2xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateDrawerField('projectName', 'عام')}
                                  title="العودة للاختيار من القائمة"
                                  className="p-1 px-2 border border-slate-200 hover:border-red-200 bg-white hover:bg-red-50 text-red-600 rounded-lg text-[10px] font-bold cursor-pointer transition-all shrink-0"
                                >
                                  إلغاء ❌
                                </button>
                              </div>
                            );
                          } else {
                            return (
                              <select
                                value={currentProjValue}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "custom") {
                                    handleUpdateDrawerField('projectName', "");
                                  } else {
                                    handleUpdateDrawerField('projectName', val === "عام" ? "عام" : val);
                                  }
                                }}
                                className="bg-white border border-slate-300 text-slate-700 text-xs px-2 py-1.5 rounded-xl font-bold focus:outline-hidden cursor-pointer w-full shadow-2xs"
                              >
                                {uniqueProjects.map(p => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                                <option value="custom">✍️ إضافة مشروع جديد...</option>
                              </select>
                            );
                          }
                        })()}
                      </div>
                    </div>
                    <div className="border-b lg:border-b-0 lg:border-r border-slate-250 p-4 flex items-center justify-between gap-4 text-right">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
                        <CircleDot className="w-4 h-4 text-amber-500" />
                        حالة المشروع (Status):
                      </span>
                      <select
                        value={selectedDoc.projectStatus || 'in_progress'}
                        onChange={(e) => handleUpdateDrawerField('projectStatus', e.target.value)}
                        className="bg-white border border-slate-300 text-slate-700 text-xs px-3 py-1.5 rounded-xl font-bold focus:outline-hidden cursor-pointer w-full max-w-[200px] shadow-2xs"
                      >
                        <option value="in_progress">⏳ قيد التنفيذ (In Progress)</option>
                        <option value="completed">✔️ مكتمل (Completed)</option>
                        <option value="deferred">💤 مؤجل (Deferred)</option>
                      </select>
                    </div>
                    <div className="lg:border-r border-slate-250 p-4 flex items-center justify-between gap-4 text-right">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
                        <PlusCircle className="w-4 h-4 text-emerald-600" />
                        الرقم التسلسلي التالي للمشروع:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-black rounded-lg text-xs font-mono shadow-2xs">
                          {selectedDoc.docType === 'po' ? (selectedDoc.docNumber || '1') : 'N/A'}
                        </span>
                        {expectedPoNumbers[selectedDoc.projectName || "عام"] && (
                          <span className="text-[9px] text-emerald-600 font-bold bg-emerald-500/10 px-1 py-0.5 rounded-sm whitespace-nowrap" title="تم التحقق من قاعدة البيانات">
                            (مؤكد بالخلفية ⚡)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* VIRTUAL EXCEL SHEET CONTAINER */}
                  <div 
                    id="playable-excel-sheet-delta"
                    dir={printDirection}
                    className={`border border-slate-300 bg-white font-sans text-xs select-none print-me ${
                      printDirection === 'rtl' ? 'print-rtl' : 'print-ltr'
                    }`}
                  >
                    
                    {/* Header Banner Block with dark blue top bar */}
                    <div className="excel-header-banner border-t-[5px] border-[#0000FF] border-b border-black py-4 px-4 flex justify-between items-center bg-[#B2B2B2]">
                      <div className="text-left font-sans">
                        <div className="text-xl font-bold text-black tracking-tight leading-none">DELTA</div>
                        <div className="text-[10px] md:text-xs font-bold text-black mt-1.5 tracking-wider uppercase">FOR ROAD CONSTRUCTION</div>
                      </div>
                      <div className="text-right font-sans">
                        <div className="text-base font-bold text-black tracking-wider leading-none uppercase">
                          PURCHASE
                        </div>
                        <div className="text-base font-bold text-black tracking-wider leading-none mt-1 uppercase">
                          ORDER
                        </div>
                      </div>
                    </div>

                    {/* Metadata Box styled as Excel Rows */}
                    <div className="hidden md:grid grid-cols-12 border-b border-slate-300 text-black font-sans bg-white select-text">
                      {/* Meta Labels */}
                      <div className="col-span-4 bg-[#F3F4F6] border-e border-slate-200 p-2 font-bold text-black text-[11px] text-center whitespace-normal leading-tight">
                        {printDirection === 'rtl' ? 'اسم البائع (Vendor)' : 'Vendor'}
                      </div>
                      <div className="col-span-2 bg-[#F3F4F6] border-e border-slate-200 p-2 font-bold text-black text-[11px] text-center whitespace-normal leading-tight">
                        {printDirection === 'rtl' ? 'اسم المشروع' : 'Ship to'}
                      </div>
                      <div className="col-span-2 bg-[#F3F4F6] border-e border-slate-200 p-2 font-bold text-black text-[11px] text-center whitespace-normal leading-tight">PO No:</div>
                      <div className="col-span-2 bg-[#F3F4F6] border-e border-slate-200 p-2 font-bold text-black text-[11px] text-center whitespace-normal leading-tight">
                        Order Date
                      </div>
                      <div className="col-span-2 bg-[#F3F4F6] p-2 font-bold text-black text-[11px] text-center whitespace-normal leading-tight">
                        {selectedDoc.docType === 'quote' ? 'PO Total' : 'PO Total'}
                      </div>

                      {/* Meta Values Editable Fields */}
                      <div className="col-span-4 border-e border-slate-300 p-1.5 text-center bg-white min-h-[36px] flex items-center justify-center overflow-hidden">
                        <input 
                          type="text"
                          value={selectedDoc.clientName || ""}
                          onChange={(e) => handleUpdateDrawerField('clientName', e.target.value)}
                          list="learned-vendors-list"
                          className="w-full text-center bg-transparent border-0 focus:ring-1 focus:ring-sky-500 font-bold text-black text-xs px-1 outline-hidden whitespace-nowrap overflow-hidden text-ellipsis"
                          dir="auto"
                        />
                      </div>
                      <div className="col-span-2 border-e border-slate-300 p-1.5 text-center bg-white flex items-center justify-center font-mono overflow-hidden">
                        <input 
                          type="text"
                          value={selectedDoc.projectName || "عام"}
                          onChange={(e) => handleUpdateDrawerField('projectName', e.target.value)}
                          className="w-full text-center bg-transparent border-0 focus:ring-1 focus:ring-sky-500 font-bold text-black text-xs px-1 outline-hidden whitespace-nowrap overflow-hidden text-ellipsis"
                          dir="auto"
                        />
                      </div>
                      <div className="col-span-2 border-e border-slate-300 p-1.5 text-center bg-white flex items-center justify-center font-mono overflow-hidden">
                        <input 
                          type="text"
                          value={selectedDoc.docNumber || "31"}
                          onChange={(e) => handleUpdateDrawerField('docNumber', e.target.value)}
                          className="w-full text-center bg-transparent border-0 focus:ring-1 focus:ring-sky-500 font-bold text-black text-xs px-1 outline-hidden whitespace-nowrap overflow-hidden text-ellipsis"
                        />
                      </div>
                      <div className="col-span-2 border-e border-slate-300 p-1.5 text-center bg-white flex items-center justify-center font-mono overflow-hidden">
                        <input 
                          type="text"
                          value={selectedDoc.receiptDate || ""}
                          onChange={(e) => handleUpdateDrawerField('receiptDate', e.target.value)}
                          className="w-full text-center bg-transparent border-0 focus:ring-1 focus:ring-sky-500 font-bold text-black text-xs px-1 outline-hidden whitespace-nowrap overflow-hidden text-ellipsis"
                        />
                      </div>
                      <div className="col-span-2 p-1.5 text-center bg-white flex items-center justify-center font-mono font-black text-[#DC2626] text-xs select-text overflow-hidden whitespace-nowrap text-ellipsis font-black">
                        {(() => {
                          const pricesIncludeTax = selectedDoc.pricesIncludeTax !== false;
                          const taxAddPercentEnabled = !pricesIncludeTax && !!selectedDoc.taxAddPercentEnabled;
                          const taxAddPercentRate = selectedDoc.taxAddPercentRate ?? 14;
                          const originalSubtotal = selectedDoc.items && selectedDoc.items.length > 0
                            ? selectedDoc.items.reduce((sum, item) => sum + (item.total ? item.total : ((item.quantity || 0) * (item.unitPrice || 0))), 0)
                            : (selectedDoc.totalAmount || 0);
                          const itemsSubtotal = taxAddPercentEnabled ? originalSubtotal * (1 + taxAddPercentRate / 100) : originalSubtotal;
                          return itemsSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
                        })()}
                      </div>
                    </div>

                    {/* Mobile-Friendly Metadata View for drawer spreadsheet (Screen only, hidden on md) */}
                    <div className="md:hidden border-b border-slate-200 bg-slate-50 p-4 space-y-3 font-sans text-right" dir="rtl">
                      <div className="grid grid-cols-2 gap-2.5 text-xs">
                        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                          <span className="block text-[10px] text-slate-450 font-bold mb-1 col-span-1">
                            {printDirection === 'rtl' ? 'اسم البائع (Vendor)' : 'Vendor'}
                          </span>
                          <input 
                            type="text"
                            value={selectedDoc.clientName || ""}
                            onChange={(e) => handleUpdateDrawerField('clientName', e.target.value)}
                            list="learned-vendors-list"
                            className="w-full bg-transparent border-0 p-0 focus:ring-0 font-extrabold text-slate-800 text-xs text-right outline-hidden"
                            dir="auto"
                          />
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                          <span className="block text-[10px] text-slate-450 font-bold mb-1 col-span-1">
                            {printDirection === 'rtl' ? 'اسم المشروع' : 'Ship to'}
                          </span>
                          <input 
                            type="text"
                            value={selectedDoc.projectName || "عام"}
                            onChange={(e) => handleUpdateDrawerField('projectName', e.target.value)}
                            className="w-full bg-transparent border-0 p-0 focus:ring-0 font-extrabold text-slate-800 text-xs text-right outline-hidden"
                            dir="auto"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2.5 text-xs">
                        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                          <span className="block text-[10px] text-slate-450 font-bold mb-1">PO No / المرجع</span>
                          <input 
                            type="text"
                            value={selectedDoc.docNumber || "31"}
                            onChange={(e) => handleUpdateDrawerField('docNumber', e.target.value)}
                            className="w-full bg-transparent border-0 p-0 focus:ring-0 font-extrabold text-[#DC2626] text-xs text-center outline-hidden"
                          />
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                          <span className="block text-[10px] text-slate-450 font-bold mb-1">تاريخ المستند</span>
                          <input 
                            type="text"
                            value={selectedDoc.receiptDate || ""}
                            onChange={(e) => handleUpdateDrawerField('receiptDate', e.target.value)}
                            className="w-full bg-transparent border-0 p-0 focus:ring-0 font-extrabold text-slate-805 text-xs text-center outline-hidden"
                          />
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                          <span className="block text-[10px] text-slate-450 font-bold mb-1">القيمة الإجمالية</span>
                          <span className="font-mono font-black text-[#DC2626] text-[11px] block text-center leading-none mt-1">
                            {(() => {
                              const pricesIncludeTax = selectedDoc.pricesIncludeTax !== false;
                              const taxAddPercentEnabled = !pricesIncludeTax && !!selectedDoc.taxAddPercentEnabled;
                              const taxAddPercentRate = selectedDoc.taxAddPercentRate ?? 14;
                              const originalSubtotal = selectedDoc.items && selectedDoc.items.length > 0
                                ? selectedDoc.items.reduce((sum, item) => sum + (item.total ? item.total : ((item.quantity || 0) * (item.unitPrice || 0))), 0)
                                : (selectedDoc.totalAmount || 0);
                              const itemsSubtotal = taxAddPercentEnabled ? originalSubtotal * (1 + taxAddPercentRate / 100) : originalSubtotal;
                              return itemsSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sheet Grid Items Table */}
                    <div className="relative overflow-x-auto">
                      <table className="w-full border-collapse table-fixed">
                        <thead>
                          {/* Row A-F Column Index Labels */}
                          {showExcelGrid && (
                            <tr className="bg-[#EFEFEF] border-b border-slate-300 text-[10px] font-mono text-slate-500 text-center select-none">
                              <th className="border-e border-slate-300 w-12 min-w-[48px] max-w-[48px] py-0.5 bg-[#DEDEDE] text-slate-800 font-bold">
                                {printDirection === 'ltr' ? 'Row' : 'الصف'}
                              </th>
                              <th className="border-e border-slate-300 w-12 min-w-[48px] max-w-[48px] py-0.5">A</th>
                              <th className="border-e border-slate-300 py-0.5">B</th>
                              <th className="border-e border-slate-300 w-16 min-w-[64px] max-w-[64px] py-0.5">C</th>
                              <th className="border-e border-slate-300 w-16 min-w-[64px] max-w-[64px] py-0.5">D</th>
                              <th className="border-e border-slate-300 w-24 min-w-[96px] max-w-[96px] py-0.5">E</th>
                              <th className={`py-0.5 w-32 min-w-[128px] max-w-[128px] ${printDirection === 'rtl' ? 'pr-3 text-left' : 'pl-3 text-right'}`}>F</th>
                            </tr>
                          )}
                          {/* Actual Visual Labels Row matching Excel exactly */}
                          <tr className="bg-[#F4F4F4] border-b border-slate-300 text-[11px] text-slate-800 font-bold text-center select-none">
                            {showExcelGrid && (
                              <th className="border-e border-[#B0B0B0] bg-[#DEDEDE] text-slate-600 font-bold w-12 min-w-[48px] max-w-[48px]">8</th>
                            )}
                            <th className="border-e border-[#B0B0B0] py-2 w-12 min-w-[48px] max-w-[48px] text-center">No</th>
                            <th className={`border-e border-[#B0B0B0] py-2 px-3 ${printDirection === 'rtl' ? 'text-right' : 'text-left'}`}>Describtion</th>
                            <th className="border-e border-[#B0B0B0] py-2 w-16 min-w-[64px] max-w-[64px]">Unit</th>
                            <th className="border-e border-[#B0B0B0] py-2 w-16 min-w-[64px] max-w-[64px]">Qty</th>
                            <th className="border-e border-[#B0B0B0] py-2 w-28 min-w-[112px] max-w-[112px]">Price</th>
                            <th className={`py-2 w-28 min-w-[112px] max-w-[112px] ${printDirection === 'rtl' ? 'pr-3 text-left' : 'pl-3 text-right'}`}>Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {selectedDoc.items && selectedDoc.items.length > 0 ? (
                            selectedDoc.items.map((item, idx) => (
                              <tr key={idx} className="bg-white hover:bg-slate-50/50 transition-colors">
                                {/* Excel Row Indicator Column */}
                                {showExcelGrid && (
                                  <td className="border-e border-slate-200 bg-[#F4F4F4] text-center text-[10px] font-mono font-bold text-slate-500 py-3 w-12 min-w-[48px] max-w-[48px]">
                                    {9 + idx}
                                  </td>
                                )}
                                
                                {/* No. */}
                                <td className="border-e border-slate-200 text-center font-semibold text-slate-700 py-3 font-mono w-12 min-w-[48px] max-w-[48px]">
                                  {idx + 1}
                                </td>

                                {/* Description with brand combined cleanly */}
                                <td className={`border-e border-slate-200 py-2 px-3 ${printDirection === 'rtl' ? 'text-right' : 'text-left'}`}>
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                      <button 
                                        type="button"
                                        onClick={() => handleRemoveDrawerItem(idx)}
                                        title="حذف هذا البند"
                                        className="text-red-400 hover:text-red-600 mr-1 p-0.5 hover:bg-red-50 rounded-sm cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                      <input 
                                        type="text"
                                        value={item.description || ""}
                                        onChange={(e) => handleUpdateDrawerItem(idx, 'description', e.target.value)}
                                        list="learned-items-list"
                                        className={`w-full bg-transparent border-0 focus:ring-1 focus:ring-sky-500 font-semibold text-slate-800 text-xs p-1 rounded-sm outline-hidden ${
                                          printDirection === 'rtl' ? 'text-right' : 'text-left'
                                        }`}
                                        placeholder={printDirection === 'rtl' ? "وصف البند التفصيلي" : "Detail Description"}
                                        dir="auto"
                                      />
                                    </div>
                                    <div className={`flex items-center gap-3 text-[10px] flex-wrap ${printDirection === 'rtl' ? 'justify-end pr-5' : 'justify-start pl-5'}`}>
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-400 font-medium">
                                          {printDirection === 'rtl' ? 'ماركة البند:' : 'Brand:'}
                                        </span>
                                        <input 
                                          type="text"
                                          value={item.brand || ""}
                                          placeholder={printDirection === 'rtl' ? "(ماركة البند)" : "(Brand Name)"}
                                          onChange={(e) => handleUpdateDrawerItem(idx, 'brand', e.target.value)}
                                          list="learned-brands-list"
                                          className={`bg-transparent border-0 text-slate-500 font-medium text-[10px] p-0 w-24 outline-hidden hover:text-sky-600 focus:text-sky-600 ${
                                            printDirection === 'rtl' ? 'text-right' : 'text-left'
                                          }`}
                                          dir="auto"
                                        />
                                      </div>
                                      <label className="flex items-center gap-1 cursor-pointer select-none no-print">
                                        <input 
                                          type="checkbox"
                                          checked={!!item.pageBreakBefore}
                                          onChange={(e) => handleUpdateDrawerItem(idx, 'pageBreakBefore', e.target.checked)}
                                          className="rounded-sm border-slate-300 text-sky-600 focus:ring-sky-500 w-3 h-3 cursor-pointer"
                                        />
                                        <span className="text-[9px] font-bold text-slate-400 hover:text-sky-605 transition-colors">
                                          {printDirection === 'rtl' ? 'صفحة جديدة 📄' : 'New Page 📄'}
                                        </span>
                                      </label>
                                    </div>
                                  </div>
                                </td>

                                {/* Unit */}
                                <td className="border-e border-slate-200 py-2 text-center text-slate-700 w-16 min-w-[64px] max-w-[64px]">
                                  <input 
                                    type="text"
                                    value={item.unit || "عدد"}
                                    onChange={(e) => handleUpdateDrawerItem(idx, 'unit', e.target.value)}
                                    list="learned-units-list"
                                    className="w-full text-center bg-transparent border-0 focus:ring-1 focus:ring-sky-500 font-medium text-slate-655 text-xs p-1 rounded-sm outline-hidden"
                                    dir="auto"
                                  />
                                </td>

                                {/* Qty */}
                                <td className="border-e border-slate-200 py-2 text-center font-mono w-16 min-w-[64px] max-w-[64px]">
                                  <input 
                                    type="number"
                                    value={item.quantity || 0}
                                    onChange={(e) => handleUpdateDrawerItem(idx, 'quantity', e.target.value)}
                                    className="w-full text-center bg-transparent border-0 focus:ring-1 focus:ring-sky-500 font-semibold text-slate-700 text-xs p-1 rounded-sm outline-hidden"
                                  />
                                </td>

                                {/* Price */}
                                <td className="border-e border-slate-200 py-2 text-center font-mono w-28 min-w-[112px] max-w-[112px]">
                                  <input 
                                    type="number"
                                    value={item.unitPrice || 0}
                                    onChange={(e) => handleUpdateDrawerItem(idx, 'unitPrice', e.target.value)}
                                    className="w-full text-center bg-transparent border-0 focus:ring-1 focus:ring-sky-500 font-semibold text-slate-700 text-xs p-1 rounded-sm outline-hidden"
                                  />
                                </td>

                                {/* Amount */}
                                <td className={`py-3 w-28 min-w-[112px] max-w-[112px] select-text font-bold text-slate-900 font-mono ${printDirection === 'rtl' ? 'pr-3 text-left' : 'pl-3 text-right'}`}>
                                  {(() => {
                                    const baseTotal = (item.quantity || 0) * (item.unitPrice || 0);
                                    const pricesIncludeTax = selectedDoc.pricesIncludeTax !== false;
                                    const taxAddPercentEnabled = !pricesIncludeTax && !!selectedDoc.taxAddPercentEnabled;
                                    const taxAddPercentRate = selectedDoc.taxAddPercentRate ?? 14;
                                    const displayedTotal = taxAddPercentEnabled ? baseTotal * (1 + taxAddPercentRate / 100) : baseTotal;
                                    return displayedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
                                  })()}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-slate-400 italic">لا توجد بنود في هذا السجل حالياً.</td>
                            </tr>
                          )}

                          {/* Dynamic Spacer Items to reach at least 5 rows like Excel template - Disabled per user request */}
                          {false && Array.from({ length: Math.max(0, 5 - (selectedDoc.items?.length || 0)) }).map((_, emptyIdx) => {
                            const actualIndex = (selectedDoc.items?.length || 0) + emptyIdx;
                            return (
                              <tr key={`empty-${emptyIdx}`} className="bg-slate-50/10">
                                {showExcelGrid && (
                                  <td className="border-e border-slate-200 bg-[#F4F4F4] text-center text-[10px] font-mono font-bold text-slate-400 py-3 w-12">
                                    {9 + actualIndex}
                                  </td>
                                )}
                                <td className="border-e border-slate-200 text-center py-3 text-slate-300 font-semibold w-12">-</td>
                                <td className="border-e border-slate-200 py-3 text-slate-300 px-3">-</td>
                                <td className="border-e border-slate-200 py-3 text-center text-slate-300 w-16">-</td>
                                <td className="border-e border-slate-200 py-3 text-center text-slate-300 w-16">-</td>
                                <td className="border-e border-slate-200 py-3 text-center text-slate-300 w-24">-</td>
                                <td className={`py-3 w-28 font-mono font-semibold text-slate-300 ${printDirection === 'rtl' ? 'pr-3 text-left' : 'pl-3 text-right'}`}>-</td>
                              </tr>
                            );
                          })}

                          {/* Total Row */}
                          <tr className="bg-[#F3F4F6] border-t border-slate-300 font-bold text-slate-900 text-center select-none">
                            {/* Row number indicator */}
                            {showExcelGrid && (
                              <td className="border-e border-slate-200 bg-[#DEDEDE] text-center text-[10px] font-mono font-bold text-slate-500 py-2.5 w-12">
                                {10 + (selectedDoc.items?.length || 0)}
                              </td>
                            )}
                            {/* Centered Total Label Spanning Column A-E */}
                            <td colSpan={5} className="border-e border-slate-200 text-center align-middle py-2 font-bold text-slate-800 uppercase tracking-wide" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              {selectedDoc.withholdingTaxEnabled 
                                ? (printDirection === 'rtl' ? 'الإجمالي قبل الخصم (Total)' : 'Total Before Tax')
                                : 'Total'
                              }
                            </td>
                            {/* Total Amount in Column F */}
                            <td className="py-2 w-28 font-extrabold text-[#DC2626] font-mono text-xs select-text whitespace-nowrap text-center align-middle px-3" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              {(() => {
                                const pricesIncludeTax = selectedDoc.pricesIncludeTax !== false;
                                const taxAddPercentEnabled = !pricesIncludeTax && !!selectedDoc.taxAddPercentEnabled;
                                const taxAddPercentRate = selectedDoc.taxAddPercentRate ?? 14;
                                const originalSubtotal = selectedDoc.items && selectedDoc.items.length > 0
                                  ? selectedDoc.items.reduce((sum, item) => sum + (item.total ? item.total : ((item.quantity || 0) * (item.unitPrice || 0))), 0)
                                  : (selectedDoc.totalAmount || 0);
                                const itemsSubtotal = taxAddPercentEnabled ? originalSubtotal * (1 + taxAddPercentRate / 100) : originalSubtotal;
                                return itemsSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2 });
                              })()} {selectedDoc.currency || 'EGP'}
                            </td>
                          </tr>

                          {/* Conditional withholding tax row */}
                          {selectedDoc.withholdingTaxEnabled && (
                            <>
                              <tr className="bg-[#FFFDF3] border-t border-slate-200 text-slate-700 text-center select-none font-semibold text-xs">
                                {showExcelGrid && (
                                  <td className="border-e border-slate-150 bg-[#E8E8E8] text-center text-[10px] font-mono font-bold text-slate-400 py-2 w-12" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                    {11 + (selectedDoc.items?.length || 0)}
                                  </td>
                                )}
                                <td colSpan={5} className="border-e border-slate-200 text-center align-middle py-2 text-red-700 font-medium whitespace-nowrap" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                  {printDirection === 'rtl' 
                                    ? `خصم ضريبة الأرباح التجارية والصناعية (${selectedDoc.withholdingTaxRate || 1}%)` 
                                    : `Commercial & Industrial Profits Tax Discount (${selectedDoc.withholdingTaxRate || 1}%)`
                                  }
                                </td>
                                <td className="py-2 w-28 font-bold text-red-600 font-mono text-xs select-text whitespace-nowrap text-center align-middle px-3" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                  -{(() => {
                                    const originalSubtotal = selectedDoc.items && selectedDoc.items.length > 0
                                      ? selectedDoc.items.reduce((sum, item) => sum + (item.total ? item.total : ((item.quantity || 0) * (item.unitPrice || 0))), 0)
                                      : (selectedDoc.totalAmount || 0);
                                    const whtRate = selectedDoc.withholdingTaxRate || 1;
                                    const whtAmount = (originalSubtotal * whtRate) / 100;
                                    return whtAmount.toLocaleString('en-US', { minimumFractionDigits: 2 });
                                  })()} {selectedDoc.currency || 'EGP'}
                                </td>
                              </tr>

                              <tr className="bg-[#E5E7EB] border-t-2 border-slate-350 font-bold text-slate-950 text-center select-none">
                                {showExcelGrid && (
                                  <td className="border-e border-slate-200 bg-[#DEDEDE] text-center text-[10px] font-mono font-bold text-slate-500 py-2.5 w-12" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                    {12 + (selectedDoc.items?.length || 0)}
                                  </td>
                                )}
                                <td colSpan={5} className="border-e border-slate-200 text-center align-middle py-2 font-bold text-[#DC2626] uppercase tracking-wide" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                  Net Payable
                                </td>
                                <td className="py-2.5 w-28 font-extrabold text-[#DC2626] bg-amber-50/20 font-mono text-xs select-text whitespace-nowrap text-center align-middle px-3" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                  {(() => {
                                    const pricesIncludeTax = selectedDoc.pricesIncludeTax !== false;
                                    const taxAddPercentEnabled = !pricesIncludeTax && !!selectedDoc.taxAddPercentEnabled;
                                    const taxAddPercentRate = selectedDoc.taxAddPercentRate ?? 14;
                                    const originalSubtotal = selectedDoc.items && selectedDoc.items.length > 0
                                      ? selectedDoc.items.reduce((sum, item) => sum + (item.total ? item.total : ((item.quantity || 0) * (item.unitPrice || 0))), 0)
                                      : (selectedDoc.totalAmount || 0);
                                    const itemsSubtotal = taxAddPercentEnabled ? originalSubtotal * (1 + taxAddPercentRate / 100) : originalSubtotal;
                                    const whtRate = selectedDoc.withholdingTaxRate || 1;
                                    const whtAmount = (originalSubtotal * whtRate) / 100;
                                    const netPayable = itemsSubtotal - whtAmount;
                                    return netPayable.toLocaleString('en-US', { minimumFractionDigits: 2 });
                                  })()} {selectedDoc.currency || 'EGP'}
                                </td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Terms and conditions block styled as Sheet Cells with strict LTR alignment */}
                    <div className="bg-[#FCFCFC] border-t-2 border-dashed border-slate-200 p-5 space-y-4 text-xs font-sans text-left select-text ltr-print-force" dir="ltr">
                      <div>
                        <div className="font-extrabold text-slate-900 mb-2.5 uppercase select-none tracking-wide text-[11px] text-[#0000C8]">
                          Terms & conditions
                        </div>
                        <div className="space-y-2 text-slate-700 font-medium">
                          <div className="flex items-center gap-2 flex-wrap w-full border-b border-dashed border-slate-100 pb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                            <span className="text-slate-500 font-bold shrink-0 text-[10px] uppercase">VAT:</span>
                            <input 
                              type="text"
                              value={selectedDoc.vatTerms ?? "Prices include 14% VAT."}
                              onChange={(e) => handleUpdateDrawerField('vatTerms', e.target.value)}
                              className="font-extrabold text-slate-850 bg-slate-100/50 hover:bg-slate-200 border-0 focus:ring-1 focus:ring-sky-500 text-xs px-2 py-0.5 rounded-md flex-1 max-w-sm outline-hidden font-sans"
                              placeholder="Prices include 14% VAT."
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap w-full border-b border-dashed border-slate-100 pb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                            <span className="text-slate-500 font-bold shrink-0 text-[10px] uppercase">Logistic Terms:</span>
                            <input 
                              type="text"
                              value={selectedDoc.deliveryTerms ?? "Prices include Transportation."}
                              onChange={(e) => handleUpdateDrawerField('deliveryTerms', e.target.value)}
                              className="font-extrabold text-slate-850 bg-slate-100/50 hover:bg-slate-200 border-0 focus:ring-1 focus:ring-sky-500 text-xs px-2 py-0.5 rounded-md flex-1 max-w-sm outline-hidden font-sans"
                              placeholder="Prices include Transportation."
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap border-b border-dashed border-slate-100 pb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                            <span className="text-slate-600">Place of delivery:</span>
                            <span className="font-bold text-slate-800 px-1 border-b border-slate-200 bg-slate-50 italic">
                              {selectedDoc.projectName ? selectedDoc.projectName : (selectedDoc.shipToAddress || "عام")}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap border-b border-dashed border-slate-100 pb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                            <span className="text-slate-600">Date of delivery at site:</span>
                            <input 
                              type="text"
                              value={selectedDoc.deliveryDate || "15-06-2026"}
                              onChange={(e) => handleUpdateDrawerField('deliveryDate', e.target.value)}
                              className="font-bold text-slate-800 bg-slate-100/50 hover:bg-slate-200 border-0 focus:ring-1 focus:ring-sky-500 text-xs px-1.5 py-0.5 rounded-sm max-w-xs font-mono outline-hidden"
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-amber-900 font-bold bg-amber-50/70 p-1.5 rounded-lg border border-amber-200/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span className="text-amber-800 text-[11px] font-bold">تاريخ الاستحقاق (Due Date):</span>
                            <input 
                              type="text"
                              value={selectedDoc.dueDate || ""}
                              placeholder="YYYY-MM-DD"
                              onChange={(e) => handleUpdateDrawerField('dueDate', e.target.value)}
                              className="font-bold text-amber-955 bg-white hover:bg-amber-50 border border-amber-300 focus:ring-1 focus:ring-amber-500 text-xs px-2 py-0.5 rounded-md max-w-xs font-mono outline-hidden"
                            />
                            {selectedDoc.dueDate && (
                              <span className={getDueDateWarningStyle(selectedDoc.dueDate)}>
                                {new Date(selectedDoc.dueDate) < new Date() ? "⚠️ متأخر" : "⏳ غير مستحق"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/50">
                        <div className="font-extrabold text-slate-900 mb-2.5 uppercase select-none tracking-wide text-[11px] text-[#0000C8]">
                          Payment Terms :
                        </div>
                        <div className="space-y-2 text-slate-700 font-medium">
                          <div className="flex items-start gap-2">
                            <span className="font-bold text-slate-500 shrink-0 w-3 text-[11px]">1.</span>
                            <span>Payment by check in the name of the company as shown in your commercial register.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="font-bold text-slate-500 shrink-0 w-3 text-[11px]">2.</span>
                            <span>Or in the name of the authorized person through your company.</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-500 shrink-0 w-3 text-[11px]">3.</span>
                            <span>Or by bank transfer to your company account within</span>
                            <input 
                              type="text"
                              value={selectedDoc.paymentDays || "10"}
                              onChange={(e) => handleUpdateDrawerField('paymentDays', e.target.value)}
                              className="font-bold text-center bg-slate-100 rounded-md border-0 text-slate-800 text-xs px-1 py-0.5 focus:ring-1 focus:ring-sky-500 w-12 font-mono outline-hidden"
                            />
                            <span>days of the delivery date.</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap border-t border-dashed border-slate-200/60 pt-2 pb-1 no-print">
                            <span className="font-bold text-[#0000C8] shrink-0 w-3 text-[11px]">4.</span>
                            <span className="text-[#0000C8] font-bold text-[10px] uppercase">Advanced Payment:</span>
                            <input 
                              type="text"
                              value={selectedDoc.advancePayment || ""}
                              onChange={(e) => handleUpdateDrawerField('advancePayment', e.target.value)}
                              className="font-extrabold text-slate-850 bg-amber-50/50 hover:bg-amber-100/70 border border-amber-200 focus:ring-1 focus:ring-amber-500 text-xs px-2.5 py-1 rounded-md flex-1 max-w-sm outline-hidden font-sans"
                              placeholder="مثال: دفعة مقدمة 20% (Advanced Payment of 20%)"
                            />
                          </div>
                          {(() => {
                            const pctDetails = getAdvancePercentageDetails(selectedDoc.advancePayment, selectedDoc.totalAmount);
                            if (!pctDetails) return null;
                            return (
                              <div className="text-[11px]" style={{ direction: 'ltr' }}>
                                <div className="flex items-start gap-2 pt-1">
                                  <span className="font-bold text-slate-500 shrink-0 w-3 border-t border-slate-100 mt-1">4.</span>
                                  <span className="font-bold text-slate-900 mt-1">
                                    Advanced Payment: {pctDetails.advanceStr}
                                  </span>
                                </div>
                                {pctDetails.deliveryStr && (
                                  <div className="flex items-start gap-2 pt-1 text-emerald-950 font-bold bg-emerald-50/30 p-1 rounded-md mt-1">
                                    <span className="w-3 text-[11px]">5.</span>
                                    <span>
                                      Upon Delivery: {pctDetails.deliveryStr}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Signatures block side-by-side matching the Excel image layout */}
                    <div className="border-t border-[#B0B0B0] grid grid-cols-3 bg-transparent text-center select-text pt-2 pb-2">
                      
                      {/* Column 1: Procurement */}
                      <div className="border-e border-[#B0B0B0] p-2 flex flex-col justify-between min-h-[72px]">
                        <span className="font-extrabold text-[#0000C8] text-[13px] uppercase leading-normal font-sans whitespace-normal block tracking-tight max-w-full mx-auto text-center">
                          Head of Procurement and Contracts
                        </span>
                        <input 
                          type="text"
                          value={selectedDoc.signatureProcurement || "Mr. Mohamed Al-Daly"}
                          onChange={(e) => handleUpdateDrawerField('signatureProcurement', e.target.value)}
                          className="w-full text-center bg-transparent border-0 focus:ring-1 focus:ring-sky-500 font-bold text-slate-900 text-sm p-1 mt-2 outline-hidden"
                        />
                      </div>

                      {/* Column 2: Tech Manager */}
                      <div className="border-e border-[#B0B0B0] p-2 flex flex-col justify-between min-h-[72px]">
                        <span className="font-extrabold text-[#0000C8] text-[13px] uppercase leading-normal font-sans whitespace-normal block tracking-tight max-w-full mx-auto text-center">
                          Technical Office Manager
                        </span>
                        <input 
                          type="text"
                          value={selectedDoc.signatureTechnical || "Eng. Nasr Mahmoud"}
                          onChange={(e) => handleUpdateDrawerField('signatureTechnical', e.target.value)}
                          className="w-full text-center bg-transparent border-0 focus:ring-1 focus:ring-sky-500 font-bold text-slate-900 text-sm p-1 mt-2 outline-hidden"
                        />
                      </div>

                      {/* Column 3: General Manager */}
                      <div className="p-2 flex flex-col justify-between min-h-[72px]">
                        <span className="font-extrabold text-[#0000C8] text-[13px] uppercase leading-normal font-sans whitespace-normal block tracking-tight max-w-full mx-auto text-center">
                          General Manager
                        </span>
                        <input 
                          type="text"
                          value={selectedDoc.signatureManager || "Eng. Sherif Mahmoud"}
                          onChange={(e) => handleUpdateDrawerField('signatureManager', e.target.value)}
                          className="w-full text-center bg-transparent border-0 focus:ring-1 focus:ring-sky-500 font-bold text-slate-900 text-sm p-1 mt-2 outline-hidden"
                        />
                      </div>

                    </div>

                  </div>

                  {/* Bottom details helper banner in drawer */}
                  <div className="mt-6 flex flex-col gap-3">
                    <div className="p-4 bg-sky-50/15 border border-sky-100 rounded-2xl">
                      <span className="text-xs font-bold text-sky-850 block mb-1">💡 ملخص الـ AI وتحليل محتوى الملف الأصلي:</span>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium select-text">
                        {selectedDoc.summary || 'تم تسجيل هذه المعاملة بنجاح وتصنيف البنود وتطويرها في نسق الجداول النظيرة لشركة DELTA.'}
                      </p>
                    </div>
                  </div>

                  {/* Storage file metadata log */}
                  <div className="pt-4 mt-6 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 font-mono select-none">
                    <span>الملف الأصلي: {selectedDoc.originalFilename}</span>
                    <span>تاريخ الحفظ والتحليل: {new Date(selectedDoc.processedAt).toLocaleString('ar-EG')}</span>
                  </div>

                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* 8. DOCUMENT COMPARISON OVERLAY */}
      <AnimatePresence>
        {isComparing && (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-250 font-sans"
            >
              {/* Header Box */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                    <GitCompare className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">مقارنة بنود ومطابقة الفروق بين مستندين</h3>
                    <p className="text-xs text-slate-400 mt-0.5" id="desc-comp-1">مقارنة وتحديد المبالغ والفروق بين عرض السعر وأمر الشراء.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsComparing(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer border-0 outline-hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Selection Bar */}
              <div className="p-4 bg-white border-b border-slate-100 grid grid-cols-1 md:grid-cols-5 gap-4 items-center shrink-0 text-right">
                {/* Selector A */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">المستند الأول المقارن (أ) - عرض السعر لشركة DELTA:</label>
                  <select
                    value={compareDocAId || ""}
                    onChange={(e) => setCompareDocAId(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-250 p-2 rounded-xl focus:border-indigo-500 text-right outline-hidden font-sans"
                  >
                    <option value="">-- اختر المستند الأول --</option>
                    {documents.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.clientName} | أمر شراء ({d.docNumber || 'بدون رقم'}) - {d.projectName || 'عام'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Arrow Icon Indicator */}
                <div className="flex justify-center text-slate-300 col-span-1">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>

                {/* Selector B */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 block">المستند الثاني المقارن (ب) - مثلاً أمر الشراء المستخرج:</label>
                  <select
                    value={compareDocBId || ""}
                    onChange={(e) => setCompareDocBId(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-250 p-2 rounded-xl focus:border-indigo-500 text-right outline-hidden font-sans"
                  >
                    <option value="">-- اختر المستند الثاني --</option>
                    {documents.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.clientName} | أمر شراء ({d.docNumber || 'بدون رقم'}) - {d.projectName || 'عام'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Side-by-Side Table content */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-100/55">
                {(!compareDocAId || !compareDocBId) ? (
                  <div className="py-24 text-center">
                    <GitCompare className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <h3 className="text-base font-bold text-slate-700">الرجاء اختيار مستندين لبدء المطابقة ومقارنة الفروق</h3>
                    <p className="text-xs text-slate-400 mt-1 font-semibold">يجب اختيار ملفين (مثال: عرض السعر الأصلي لشركة DELTA مقابل أمر التوريد الصادر) لمقارنة البنود تلقائياً.</p>
                  </div>
                ) : (() => {
                  const docA = documents.find(d => d.id === compareDocAId);
                  const docB = documents.find(d => d.id === compareDocBId);
                  
                  if (!docA || !docB) return null;

                  // Run compilation algorithm
                  const itemsA = docA.items || [];
                  const itemsB = [...(docB.items || [])];
                  const compiledPairs: Array<{
                    descA: string;
                    qtyA: number;
                    priceA: number;
                    totalA: number;
                    descB: string;
                    qtyB: number;
                    priceB: number;
                    totalB: number;
                    isMatched: boolean;
                    qtyDiff: number;
                    priceDiff: number;
                    totalDiff: number;
                  }> = [];

                  itemsA.forEach(itemA => {
                    const matchIdx = itemsB.findIndex(itemB => 
                      itemB.description.trim().toLowerCase() === itemA.description.trim().toLowerCase()
                    );

                    if (matchIdx > -1) {
                      const itemB = itemsB[matchIdx];
                      const qtyA = itemA.quantity || 0;
                      const qtyB = itemB.quantity || 0;
                      const priceA = itemA.unitPrice || 0;
                      const priceB = itemB.unitPrice || 0;
                      const totalA = qtyA * priceA;
                      const totalB = qtyB * priceB;

                      compiledPairs.push({
                        descA: itemA.description,
                        qtyA,
                        priceA,
                        totalA,
                        descB: itemB.description,
                        qtyB,
                        priceB,
                        totalB,
                        isMatched: true,
                        qtyDiff: qtyB - qtyA,
                        priceDiff: priceB - priceA,
                        totalDiff: totalB - totalA
                      });
                      itemsB.splice(matchIdx, 1);
                    } else {
                      const qtyA = itemA.quantity || 0;
                      const priceA = itemA.unitPrice || 0;
                      const totalA = qtyA * priceA;

                      compiledPairs.push({
                        descA: itemA.description,
                        qtyA,
                        priceA,
                        totalA,
                        descB: '',
                        qtyB: 0,
                        priceB: 0,
                        totalB: 0,
                        isMatched: false,
                        qtyDiff: -qtyA,
                        priceDiff: -priceA,
                        totalDiff: -totalA
                      });
                    }
                  });

                  itemsB.forEach(itemB => {
                    const qtyB = itemB.quantity || 0;
                    const priceB = itemB.unitPrice || 0;
                    const totalB = qtyB * priceB;

                    compiledPairs.push({
                      descA: '',
                      qtyA: 0,
                      priceA: 0,
                      totalA: 0,
                      descB: itemB.description,
                      qtyB,
                      priceB,
                      totalB,
                      isMatched: false,
                      qtyDiff: qtyB,
                      priceDiff: priceB,
                      totalDiff: totalB
                    });
                  });

                  // Sum total deltas
                  const totalAAmount = docA.totalAmount;
                  const totalBAmount = docB.totalAmount;
                  const totalDelta = totalBAmount - totalAAmount;

                  return (
                    <div className="space-y-6">
                      
                      {/* Documents comparison summary metadata */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        {/* Doc A Mini metadata */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right">
                          <span className="text-[10px] font-bold text-sky-600 block mb-1">المستند الأساسي (أ)</span>
                          <h4 className="text-xs font-bold text-slate-800">{docA.clientName}</h4>
                          <div className="mt-2 text-xs space-y-1 text-slate-500">
                            <div>المرجع: <span className="font-mono font-bold text-slate-755">{docA.docNumber || 'X'}</span></div>
                            <div>القيمة: <span className="font-mono font-bold text-[#0000C8]">{docA.totalAmount.toLocaleString()} {docA.currency}</span></div>
                            <div>المشروع: <span className="font-bold text-slate-700">{docA.projectName || 'عام'}</span></div>
                          </div>
                        </div>

                        {/* Doc B Mini metadata */}
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right">
                          <span className="text-[10px] font-bold text-violet-605 block mb-1">المستند المقارن (ب)</span>
                          <h4 className="text-xs font-bold text-slate-800">{docB.clientName}</h4>
                          <div className="mt-2 text-xs space-y-1 text-slate-550">
                            <div>المرجع: <span className="font-mono font-bold text-slate-700">{docB.docNumber || 'X'}</span></div>
                            <div>القيمة: <span className="font-mono font-bold text-[#0000C8]">{docB.totalAmount.toLocaleString()} {docB.currency}</span></div>
                            <div>المشروع: <span className="font-bold text-slate-700">{docB.projectName || 'عام'}</span></div>
                          </div>
                        </div>

                        {/* Summary Compliance Verdict */}
                        <div className="bg-white border-2 border-indigo-100 rounded-2xl p-4 flex flex-col justify-between text-right">
                          <div>
                            <span className="text-[10px] font-bold text-indigo-700 block mb-1">حالة تطابق البنود الإجمالية</span>
                            <div className="mt-2 text-xs">
                              {Math.abs(totalDelta) < 1 ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 font-extrabold rounded-lg border border-green-100">
                                  ✅ المستندين متطابقان تماماً في السعر الإجمالي
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 font-extrabold rounded-lg border border-amber-100">
                                  ⚠️ يوجد فروق مالية بقيمة {Math.abs(totalDelta).toLocaleString()} {docA.currency}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-[11px] text-slate-400 mt-2 font-bold select-all">
                            {totalDelta > 0 ? (
                              <span className="text-rose-600">المستند (ب) أعلى سعراً بمقدار +{totalDelta.toLocaleString()}</span>
                            ) : totalDelta < 0 ? (
                              <span className="text-emerald-700">المستند (ب) أوفر بمقدار {totalDelta.toLocaleString()}</span>
                            ) : (
                              <span className="text-slate-400">تطابق مالي 100%</span>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* Side-by-side Table */}
                      <div className="bg-white border border-slate-205 rounded-2xl overflow-hidden shadow-xs">
                        
                        <div className="p-4 bg-[#FAFBFD] flex flex-col sm:flex-row justify-between items-center border-b border-slate-150 gap-3 text-right">
                          <span className="text-xs font-extrabold text-slate-850">التوزيع المقارن لبنود التسعير والتوريد</span>
                          <button
                            onClick={() => {
                              const excelData = compiledPairs.map((item, idx) => ({
                                "الرقم": idx + 1,
                                "بند المستند الأول الأساسي (أ)": item.descA || "غير مسجل",
                                "الكمية (أ)": item.qtyA,
                                "سعر الوحدة (أ)": item.priceA,
                                "الإجمالي (أ)": item.totalA,
                                "بند المستند المقارن (ب)": item.descB || "غير مسجل",
                                "الكمية (ب)": item.qtyB,
                                "سعر الوحدة (ب)": item.priceB,
                                "الإجمالي (ب)": item.totalB,
                                "فرق الكمية (ب - أ)": item.qtyDiff,
                                "فرق سعر الوحدة (ب - أ)": item.priceDiff,
                                "فرق الرصيد الإجمالي": item.totalDiff,
                                "حالة المطابقة": item.isMatched ? "متطابق بالوصف" : "بند زائد بالملف"
                              }));

                              const ws = XLSX.utils.json_to_sheet(excelData);
                              const wb = XLSX.utils.book_new();
                              XLSX.utils.book_append_sheet(wb, ws, "فروق عروض الأسعار والـ POs");

                              // Defined custom column sizes for high quality visual alignment
                              ws['!cols'] = [
                                { wch: 6 },   // الرقم
                                { wch: 30 },  // بند المستند الأول الأساسي (أ)
                                { wch: 12 },  // الكمية (أ)
                                { wch: 14 },  // سعر الوحدة (أ)
                                { wch: 16 },  // الإجمالي (أ)
                                { wch: 30 },  // بند المستند المقارن (ب)
                                { wch: 12 },  // الكمية (ب)
                                { wch: 14 },  // سعر الوحدة (ب)
                                { wch: 16 },  // الإجمالي (ب)
                                { wch: 14 },  // فرق الكمية
                                { wch: 15 },  // فرق سعر الوحدة
                                { wch: 18 },  // فرق الرصيد الإجمالي
                                { wch: 18 }   // حالة المطابقة
                              ];

                              // Style every cell inside the comparison sheet
                              for (const cellRef in ws) {
                                if (cellRef.startsWith('!')) continue;
                                const cell = ws[cellRef];
                                if (!cell) continue;

                                const match = cellRef.match(/^([A-Z]+)([0-9]+)$/);
                                if (!match) continue;
                                const colStr = match[1];
                                const rowStr = match[2];
                                const r = parseInt(rowStr) - 1; // 0-indexed row

                                if (r === 0) {
                                  // Styled Header
                                  // @ts-ignore
                                  cell.s = {
                                    font: { name: "Segoe UI", sz: 10.5, bold: true, color: { rgb: "FFFFFF" } },
                                    fill: { patternType: "solid", fgColor: { rgb: "4F46E5" } }, // Indigo Theme style for comparative audits
                                    alignment: { horizontal: "center", vertical: "center", wrapText: true },
                                    border: {
                                      top: { style: "thin", color: { rgb: "4F46E5" } },
                                      bottom: { style: "medium", color: { rgb: "4F46E5" } },
                                      left: { style: "thin", color: { rgb: "CBD5E1" } },
                                      right: { style: "thin", color: { rgb: "CBD5E1" } }
                                    }
                                  };
                                } else {
                                  // Alternating body row zebra-striping
                                  const isOdd = r % 2 !== 0;
                                  const bgRgb = isOdd ? "F8FAFC" : "FFFFFF";

                                  let alignmentHoriz = "center";
                                  if (colStr === 'B' || colStr === 'F') {
                                    alignmentHoriz = "right"; // Arabic text descriptions aligned right
                                  } else if (['C', 'D', 'E', 'G', 'H', 'I', 'J', 'K', 'L'].includes(colStr)) {
                                    alignmentHoriz = "right"; // Numeric values formatted left to right / right aligned
                                  }

                                  // Highlight rows or cells with actual differences in yellow/red warning tints
                                  let fgColorCustom = bgRgb;
                                  let textColorCustom = "1E293B";
                                  let fontBold = false;

                                  // If there is an actual difference in the row (column L), paint with soft warning color
                                  if (colStr === 'L' && cell.v && Number(cell.v) !== 0) {
                                    fgColorCustom = "FEE2E2"; // Light red alert background
                                    textColorCustom = "991B1B"; // Deep red text
                                    fontBold = true;
                                  } else if (colStr === 'M' && cell.v && String(cell.v).includes("زائد")) {
                                    fgColorCustom = "FEF3C7"; // Amber highlight
                                    textColorCustom = "92400E";
                                  }

                                  // @ts-ignore
                                  cell.s = {
                                    font: { name: "Segoe UI", sz: 10, bold: fontBold, color: { rgb: textColorCustom } },
                                    fill: { patternType: "solid", fgColor: { rgb: fgColorCustom } },
                                    alignment: { horizontal: alignmentHoriz, vertical: "center" },
                                    border: {
                                      top: { style: "thin", color: { rgb: "E2E8F0" } },
                                      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                                      left: { style: "thin", color: { rgb: "E2E8F0" } },
                                      right: { style: "thin", color: { rgb: "E2E8F0" } }
                                    }
                                  };

                                  // Appropriate number formats
                                  if (['D', 'E', 'H', 'I', 'K', 'L'].includes(colStr)) {
                                    cell.z = "#,##0.00";
                                  } else if (['C', 'G', 'J'].includes(colStr)) {
                                    cell.z = "#,##0";
                                  }
                                }
                              }

                              XLSX.writeFile(wb, `DELTA_Comparison_${docA.docNumber}_vs_${docB.docNumber}.xlsx`);
                              triggerNotificationToast('success', 'تم تصدير شيت فروق المطابقة', 'بشكل لابل إلكترونية مرنة');
                            }}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer border border-emerald-500 shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>تصدير تقرير فروق الأسعار لابل (.xlsx)</span>
                          </button>
                        </div>

                        <div className="overflow-x-auto text-right">
                          <table className="w-full text-right text-xs border-collapse">
                            <thead>
                              <tr className="bg-[#FAFBFD] text-slate-500 border-b border-slate-150 text-[10px] font-bold uppercase tracking-wider select-none">
                                <th className="py-3 px-4 border-l border-slate-150 text-center w-12 bg-[#F5F5F5] text-slate-600">م</th>
                                <th className="py-3 px-4 border-l border-slate-150 text-sky-700 bg-sky-50/20 text-right">بند المستند الأساسي (أ)</th>
                                <th className="py-3 px-3 text-center border-l border-slate-150 text-sky-700 w-16 bg-sky-50/20">كمية (أ)</th>
                                <th className="py-3 px-3 text-center border-l border-slate-150 text-sky-700 w-24 bg-sky-50/20">سعر الوحدة (أ)</th>
                                <th className="py-3 px-4 border-l border-slate-150 text-violet-700 bg-violet-50/20 text-right">بند المستند المقارن (ب)</th>
                                <th className="py-3 px-3 text-center border-l border-slate-150 text-violet-700 w-16 bg-violet-50/20">كمية (ب)</th>
                                <th className="py-3 px-3 text-center border-l border-slate-150 text-violet-700 w-24 bg-violet-50/20">سعر الوحدة (ب)</th>
                                <th className="py-3 px-4 border-l border-slate-150 font-bold bg-amber-50/40 text-amber-800 text-center w-28">فروق الأسعار والكمية</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150 font-semibold text-slate-700">
                              {compiledPairs.map((item, idx) => {
                                const hasPriceDiff = item.priceDiff !== 0;
                                const hasQtyDiff = item.qtyDiff !== 0;
                                const anyDiff = hasPriceDiff || hasQtyDiff;

                                return (
                                  <tr key={idx} className={`hover:bg-slate-50/30 transition-colors ${anyDiff ? 'bg-amber-50/10' : ''}`}>
                                    {/* Number */}
                                    <td className="py-3 px-4 text-center border-l border-slate-150 text-slate-400 font-mono bg-[#FAF9F5]">{idx + 1}</td>

                                    {/* Item Desc A */}
                                    <td className="py-3 px-4 border-l border-slate-150 font-semibold text-slate-800 text-right whitespace-normal break-words max-w-xs">
                                      {item.descA || (
                                        <span className="text-rose-500 italic font-normal">بند غير موجود في (أ)</span>
                                      )}
                                    </td>

                                    {/* Qty A */}
                                    <td className="py-3 px-3 text-center border-l border-slate-150 font-mono text-slate-600">
                                      {item.descA ? item.qtyA : '-'}
                                    </td>

                                    {/* Unit Price A */}
                                    <td className="py-3 px-3 text-center border-l border-slate-150 font-mono text-slate-600">
                                      {item.descA ? `${item.priceA.toLocaleString()} ${docA.currency}` : '-'}
                                    </td>

                                    {/* Item Desc B */}
                                    <td className="py-3 px-4 border-l border-slate-150 font-semibold text-slate-800 text-right whitespace-normal break-words max-w-xs">
                                      {item.descB || (
                                        <span className="text-amber-600 italic font-normal">بند غائب في أمر التوريد</span>
                                      )}
                                    </td>

                                    {/* Qty B */}
                                    <td className={`py-3 px-3 text-center border-l border-slate-150 font-mono font-bold ${
                                      hasQtyDiff ? (item.qtyDiff > 0 ? 'bg-sky-50 text-sky-800' : 'bg-rose-50 text-rose-800') : 'text-slate-650'
                                    }`}>
                                      {item.descB ? item.qtyB : '-'}
                                    </td>

                                    {/* Unit Price B */}
                                    <td className={`py-3 px-3 text-center border-l border-slate-150 font-mono font-extrabold ${
                                      hasPriceDiff ? (item.priceDiff > 0 ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-emerald-50 text-emerald-800') : 'text-slate-650'
                                    }`}>
                                      {item.descB ? `${item.priceB.toLocaleString()} ${docB.currency}` : '-'}
                                    </td>

                                    {/* Comparison Verdict badge Cell */}
                                    <td className="py-3 px-4 border-l border-slate-150 text-center font-mono">
                                      {(!item.descA || !item.descB) ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-black border border-rose-100">
                                          ⚠️ بند مفقود بالطرف الآخر
                                        </span>
                                      ) : item.priceDiff === 0 && item.qtyDiff === 0 ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-black border border-green-100">
                                          ✅ متطابق تماماً
                                        </span>
                                      ) : (
                                        <div className="flex flex-col gap-1 items-center justify-center">
                                          {hasPriceDiff && (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black ${
                                              item.priceDiff > 0 ? 'bg-amber-50 text-amber-800 border border-amber-150' : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                            }`}>
                                              سعر الوحدة: {item.priceDiff > 0 ? '+' : ''}{item.priceDiff.toLocaleString()}
                                            </span>
                                          )}
                                          {hasQtyDiff && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[10px] font-black border border-indigo-150">
                                              الكمية: {item.qtyDiff > 0 ? '+' : ''}{item.qtyDiff.toLocaleString()}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </td>

                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                      </div>

                    </div>
                  );
                })()}
              </div>

              {/* Close Panel Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsComparing(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-705 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                  الرجوع للوحة المتابعة الرئيسية
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. BOTTOM CORNER REAL-TIME INSTANT FLOATING NOTIFICATION SLIDER */}
      <AnimatePresence>
        {showNotificationToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white rounded-3xl p-5 shadow-2xl max-w-sm border border-slate-800 flex items-start gap-3.5"
          >
            <div className="p-2 bg-sky-950 text-sky-400 rounded-xl mt-0.5 flex-shrink-0 animate-pulse">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-extrabold text-white">{showNotificationToast.title}</h4>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{showNotificationToast.message}</p>
              <span className="text-[9px] text-slate-500 font-mono block mt-2">
                تنبيه قبل: {new Date(showNotificationToast.timestamp).toLocaleTimeString('ar-EG')}
              </span>
            </div>
            <button 
              onClick={() => setShowNotificationToast(null)}
              className="text-slate-500 hover:text-slate-350 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 9b. POTENTIAL DUPLICATE VALIDATION MODAL */}
      <AnimatePresence>
        {duplicateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-2xl w-full border border-slate-150 relative text-right"
              dir="rtl"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setDuplicateModalOpen(false);
                  setExistingDuplicateDoc(null);
                  setProposedDuplicateDoc(null);
                }}
                className="absolute top-4 left-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4 text-rose-600 border-b border-rose-100 pb-3">
                <AlertCircle className="w-6 h-6 shrink-0 animate-bounce" />
                <h3 className="text-base font-black text-slate-900">
                  تنبيه: تم كشف مستند مكرر محتمل! ⚠️
                </h3>
              </div>

              <p className="text-xs text-slate-600 mb-4 leading-relaxed font-bold">
                لقد قمت للتو برفع مستند يحتوي على نفس <span className="text-rose-600">اسم المورد</span>، ونفس <span className="text-rose-600">القيمة الإجمالية</span>، ونفس <span className="text-rose-600">تاريخ الاستلام</span> كالمستند الموجود بالفعل لدينا في النظام. يرجى مراجعة التفاصيل أدناه واختيار الإجراء المناسب:
              </p>

              {/* Side by side comparison cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                
                {/* Existing Document */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right relative">
                  <div className="absolute top-3 left-3 px-2 py-0.5 bg-sky-100 text-sky-800 rounded-md text-[10px] font-bold">المستند الحالي في السجل</div>
                  <h4 className="text-xs font-bold text-slate-500 mb-1">المستند الحالي الموجود:</h4>
                  <div className="text-xs font-black text-slate-800 mb-3">{existingDuplicateDoc?.clientName || 'غير محدد'}</div>
                  
                  <div className="space-y-1.5 text-[11px] text-slate-550">
                    <div>المرجع: <span className="font-mono font-bold text-slate-700">{existingDuplicateDoc?.docNumber || 'X'}</span></div>
                    <div>تاريخ الاستلام: <span className="font-mono font-bold text-slate-700">{existingDuplicateDoc?.receiptDate || 'X'}</span></div>
                    <div>الإجمالي: <span className="font-mono font-bold text-[#0000C8]">{existingDuplicateDoc?.totalAmount.toLocaleString()} {existingDuplicateDoc?.currency}</span></div>
                    <div>عدد البنود: <span className="font-bold text-slate-700">({existingDuplicateDoc?.items?.length || 0}) بند</span></div>
                  </div>
                  
                  {existingDuplicateDoc?.items && existingDuplicateDoc.items.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-200 max-h-[100px] overflow-y-auto">
                      <p className="text-[10px] font-bold text-slate-400 mb-1">البنود الحالية:</p>
                      <ul className="space-y-1 text-[10px] text-slate-600 font-semibold list-disc list-inside">
                        {existingDuplicateDoc.items.map((it: any, i: number) => (
                          <li key={i} className="truncate">
                            {it.description} ({it.quantity || 1} × {it.unitPrice || 0})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Proposed Document */}
                <div className="bg-rose-50/20 border border-rose-100 rounded-2xl p-4 text-right relative">
                  <div className="absolute top-3 left-3 px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md text-[10px] font-bold">المستند الذي تحاول رفعه</div>
                  <h4 className="text-xs font-bold text-rose-500 mb-1">المستند الجديد المرفوع:</h4>
                  <div className="text-xs font-black text-slate-800 mb-3">{proposedDuplicateDoc?.clientName || 'غير محدد'}</div>
                  
                  <div className="space-y-1.5 text-[11px] text-slate-550">
                    <div>المرجع: <span className="font-mono font-bold text-slate-700">{proposedDuplicateDoc?.docNumber || 'X'}</span></div>
                    <div>تاريخ الاستلام: <span className="font-mono font-bold text-slate-700">{proposedDuplicateDoc?.receiptDate || 'X'}</span></div>
                    <div>الإجمالي: <span className="font-mono font-bold text-[#0000C8]">{proposedDuplicateDoc?.totalAmount.toLocaleString()} {proposedDuplicateDoc?.currency}</span></div>
                    <div>عدد البنود: <span className="font-bold text-slate-700">({proposedDuplicateDoc?.items?.length || 0}) بند</span></div>
                  </div>

                  {proposedDuplicateDoc?.items && proposedDuplicateDoc.items.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-rose-200/50 max-h-[100px] overflow-y-auto">
                      <p className="text-[10px] font-bold text-slate-400 mb-1">البنود الجديدة:</p>
                      <ul className="space-y-1 text-[10px] text-rose-800 font-semibold list-disc list-inside">
                        {proposedDuplicateDoc.items.map((it: any, i: number) => (
                          <li key={i} className="truncate">
                            {it.description} ({it.quantity || 1} × {it.unitPrice || 0})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

              </div>

              {/* Selection Options and buttons */}
              <div className="flex flex-col sm:flex-row-reverse sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 mt-4">
                
                <div className="flex flex-wrap gap-2">
                  {/* Action 1: Proceed */}
                  <button
                    disabled={confirmingAction}
                    onClick={() => handleConfirmDuplicateAction('proceed')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-350 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    {confirmingAction ? 'جاري الحفظ...' : 'استمرار الرفع وتكرار الملف 📂'}
                  </button>

                  {/* Action 2: Merge Items */}
                  <button
                    disabled={confirmingAction}
                    onClick={() => handleConfirmDuplicateAction('merge')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-350 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    {confirmingAction ? 'جاري الدمج...' : 'دمج البنود مع المستند الحالي 🔗'}
                  </button>
                </div>

                {/* Action 3: Cancel */}
                <button
                  disabled={confirmingAction}
                  onClick={() => {
                    setDuplicateModalOpen(false);
                    setExistingDuplicateDoc(null);
                    setProposedDuplicateDoc(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                >
                  إلغاء الرفع وإهماله ❌
                </button>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 9c. PREMIUM CUSTOM PROJECTS & DOCUMENTS OPERATIONS MODALS */}
      <AnimatePresence>
        {customProjectRenameModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-150 relative text-right"
              dir="rtl"
            >
              <div className="flex items-center gap-3 mb-4 text-amber-600 border-b border-amber-100 pb-3">
                <Edit className="w-5.5 h-5.5 shrink-0" />
                <h3 className="text-base font-black text-slate-900">
                  تعديل اسم المشروع / المجلد
                </h3>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 mb-2">الاسم الحالي للمشروع:</label>
                <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold mb-4">
                  {customProjectRenameModal.projectName}
                </div>

                <label className="block text-xs font-bold text-slate-500 mb-2">الاسم الجديد للمشروع:</label>
                <input
                  type="text"
                  autoFocus
                  value={customProjectRenameModal.inputValue}
                  onChange={(e) => setCustomProjectRenameModal(prev => ({ ...prev, inputValue: e.target.value }))}
                  placeholder="ادخل الاسم الجديد هنا..."
                  className="w-full px-4 py-2 text-sm text-slate-800 bg-[#FCFDFE] border border-slate-200 rounded-xl focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-100 placeholder-slate-400 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  onClick={() => {
                    if (customProjectRenameModal.inputValue.trim()) {
                      handleRenameProject(customProjectRenameModal.projectName, customProjectRenameModal.inputValue.trim());
                      setCustomProjectRenameModal({ isOpen: false, projectName: '', inputValue: '' });
                    }
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  حفظ الاسم الجديد ✅
                </button>
                <button
                  onClick={() => setCustomProjectRenameModal({ isOpen: false, projectName: '', inputValue: '' })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                >
                  إلغاء ❌
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {customProjectDeleteModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full border border-slate-150 relative text-right"
              dir="rtl"
            >
              <div className="flex items-center gap-3 mb-4 text-rose-600 border-b border-rose-100 pb-3">
                <AlertCircle className="w-5.5 h-5.5 shrink-0" />
                <h3 className="text-base font-black text-slate-900">
                  إجراء حذف مشروع: "{customProjectDeleteModal.projectName}"
                </h3>
              </div>

              <p className="text-xs text-slate-600 mb-5 leading-relaxed font-bold">
                لقد طالبت بإزالة المشروع <span className="text-rose-600">"{customProjectDeleteModal.projectName}"</span> من قائمة المشاريع النشطة. يرجى اختيار أحد الخيارين التاليين للتعامل مع المستندات المرفوعة مسبقاً والمنسوبة لهذا المشروع:
              </p>

              <div className="grid grid-cols-1 gap-3 mb-4">
                <button
                  onClick={() => {
                    handleDeleteProject(customProjectDeleteModal.projectName, false, true);
                    setCustomProjectDeleteModal({ isOpen: false, projectName: '' });
                  }}
                  className="p-4 bg-amber-50/50 hover:bg-amber-50 text-slate-800 border border-amber-150 hover:border-amber-300 rounded-2xl text-right transition-all flex items-start gap-3 cursor-pointer group"
                >
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 group-hover:bg-amber-200 transition-colors">
                    <Folder className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 mb-0.5 font-sans">حذف عنوان المشروع ونقل ملفاته إلى مجلد "عام" 📁</h4>
                    <p className="text-[11px] text-slate-500 font-medium font-sans">سيتم تحويل ارتباط جميع الفواتير وعروض الأسعار المعلقة لهذا المشروع إلى المجلد العام للمحافظة على بياناتك المالية مجمعة.</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleDeleteProject(customProjectDeleteModal.projectName, true, true);
                    setCustomProjectDeleteModal({ isOpen: false, projectName: '' });
                  }}
                  className="p-4 bg-rose-50/40 hover:bg-rose-50 text-slate-800 border border-rose-150 hover:border-rose-300 rounded-2xl text-right transition-all flex items-start gap-3 cursor-pointer group"
                >
                  <div className="p-2 bg-rose-100 text-rose-700 rounded-xl shrink-0 group-hover:bg-rose-200 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-rose-800 mb-0.5 font-sans">حذف المشروع مع جميع ملفاته المعلقة نهائياً ⚠️</h4>
                    <p className="text-[11px] text-slate-500 font-medium font-sans">سيتم حذف هذا السجل نهائياً بالإضافة للقيام بعملية تدمير فعلية لكل المعاملات والمستندات الورقية والملفات المرفوعة المرتبطة به.</p>
                  </div>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setCustomProjectDeleteModal({ isOpen: false, projectName: '' })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                >
                  إلغاء التراجع ❌
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {customDocDeleteModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-150 relative text-right"
              dir="rtl"
            >
              <div className="flex items-center gap-3 mb-4 text-rose-600 border-b border-rose-100 pb-3">
                <Trash2 className="w-5.5 h-5.5 shrink-0" />
                <h3 className="text-base font-black text-slate-900">
                  تأكيد حذف المستند / السجل
                </h3>
              </div>

              <p className="text-xs text-slate-600 mb-5 leading-relaxed font-bold">
                هل أنت متأكد تماماً من رغبتك في حذف هذا السجل والمستند المرتبط به نهائياً وبدون تراجع؟ لا يمكن استعراض البيانات المفقودة مرة أخرى بمجرد الحفظ.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  onClick={() => {
                    handleDeleteDoc(customDocDeleteModal.docId, null, true);
                    setCustomDocDeleteModal({ isOpen: false, docId: '' });
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  حذف السجل نهائياً 🗑️
                </button>
                <button
                  onClick={() => setCustomDocDeleteModal({ isOpen: false, docId: '' })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                >
                  إلغاء ❌
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {customSupplierRenameModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-150 relative text-right"
              dir="rtl"
            >
              <div className="flex items-center gap-3 mb-4 text-amber-600 border-b border-amber-100 pb-3">
                <Edit className="w-5.5 h-5.5 shrink-0" />
                <h3 className="text-base font-black text-slate-900">
                  تعديل اسم المورد
                </h3>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 mb-2">الاسم الحالي للمورد:</label>
                <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold mb-4">
                  {customSupplierRenameModal.supplierName}
                </div>

                <label className="block text-xs font-bold text-slate-500 mb-2">الاسم الجديد للمورد:</label>
                <input
                  type="text"
                  autoFocus
                  value={customSupplierRenameModal.inputValue}
                  onChange={(e) => setCustomSupplierRenameModal(prev => ({ ...prev, inputValue: e.target.value }))}
                  placeholder="ادخل اسم المورد الجديد هنا..."
                  className="w-full px-4 py-2 text-sm text-slate-800 bg-[#FCFDFE] border border-slate-200 rounded-xl focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-100 placeholder-slate-400 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  onClick={() => {
                    if (customSupplierRenameModal.inputValue.trim()) {
                      handleRenameSupplier(customSupplierRenameModal.supplierName, customSupplierRenameModal.inputValue.trim());
                      setCustomSupplierRenameModal({ isOpen: false, supplierName: '', inputValue: '' });
                    }
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  حفظ الاسم الجديد ✅
                </button>
                <button
                  onClick={() => setCustomSupplierRenameModal({ isOpen: false, supplierName: '', inputValue: '' })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                >
                  إلغاء ❌
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {customSupplierDeleteModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full border border-slate-150 relative text-right"
              dir="rtl"
            >
              <div className="flex items-center gap-3 mb-4 text-rose-600 border-b border-rose-100 pb-3">
                <AlertCircle className="w-5.5 h-5.5 shrink-0" />
                <h3 className="text-base font-black text-slate-900">
                  إجراء حذف المورد: "{customSupplierDeleteModal.supplierName}"
                </h3>
              </div>

              <p className="text-xs text-slate-600 mb-5 leading-relaxed font-bold">
                لقد طالبت بإزالة المورد <span className="text-rose-600">"{customSupplierDeleteModal.supplierName}"</span> من قائمة الموردين النشطة. يرجى اختيار أحد الخيارين للتعامل مع الفواتير وعروض الأسعار المرتبطة به:
              </p>

              <div className="grid grid-cols-1 gap-3 mb-4">
                <button
                  onClick={() => {
                    handleDeleteSupplier(customSupplierDeleteModal.supplierName, false);
                    setCustomSupplierDeleteModal({ isOpen: false, supplierName: '' });
                  }}
                  className="p-4 bg-amber-50/50 hover:bg-amber-50 text-slate-800 border border-amber-150 hover:border-amber-300 rounded-2xl text-right transition-all flex items-start gap-3 cursor-pointer group"
                >
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 group-hover:bg-amber-200 transition-colors">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 mb-0.5 font-sans">حذف المورد وتحويل ارتباط ملفاته إلى "غير محدد" 📁</h4>
                    <p className="text-[11px] text-slate-500 font-medium font-sans">سيتم سحب ارتباط الفواتير من هذا المورد لتصبح مصنفة ضمن "غير محدد" للحفاظ على سجلاتك المالية آمنة.</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    handleDeleteSupplier(customSupplierDeleteModal.supplierName, true);
                    setCustomSupplierDeleteModal({ isOpen: false, supplierName: '' });
                  }}
                  className="p-4 bg-rose-50/40 hover:bg-rose-50 text-slate-800 border border-rose-150 hover:border-rose-300 rounded-2xl text-right transition-all flex items-start gap-3 cursor-pointer group"
                >
                  <div className="p-2 bg-rose-100 text-rose-700 rounded-xl shrink-0 group-hover:bg-rose-200 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-rose-800 mb-0.5 font-sans">حذف المورد بشكل نهائي وتدمير كافة ملفاته ⚠️</h4>
                    <p className="text-[11px] text-slate-500 font-medium font-sans">سيتم حذف هذا المورد وتدمير كافة الأوراق وعروض الأسعار والبنود المستخرجة المنسوبة له نهائياً ولا يمكن التراجع.</p>
                  </div>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setCustomSupplierDeleteModal({ isOpen: false, supplierName: '' })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                >
                  إلغاء التراجع ❌
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {customUnitRenameModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-150 relative text-right"
              dir="rtl"
            >
              <div className="flex items-center gap-3 mb-4 text-sky-600 border-b border-sky-100 pb-3">
                <Edit className="w-5.5 h-5.5 shrink-0" />
                <h3 className="text-base font-black text-slate-900">
                  تعديل اسم الوحدة المرجعية
                </h3>
              </div>

              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                تعديل اسم هذه الوحدة سيقوم بتحديثها بشكل فوري وشامل في كافة تفاصيل المعاملات والفواتير وعروض الأسعار المخزنة في النظام.
              </p>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 mb-2">اسم الوحدة الحالي:</label>
                <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold mb-4">
                  {customUnitRenameModal.unitName}
                </div>

                <label className="block text-xs font-bold text-slate-500 mb-2">الاسم البديل والجديد للوحدة:</label>
                <input
                  type="text"
                  autoFocus
                  value={customUnitRenameModal.inputValue}
                  onChange={(e) => setCustomUnitRenameModal(prev => ({ ...prev, inputValue: e.target.value }))}
                  placeholder="مثال: عدد، متر، كرتونة، طن..."
                  className="w-full px-4 py-2 text-sm text-slate-800 bg-[#FCFDFE] border border-slate-200 rounded-xl focus:outline-hidden focus:border-sky-500 focus:ring-2 focus:ring-sky-100 placeholder-slate-400 font-semibold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  onClick={() => {
                    if (customUnitRenameModal.inputValue.trim()) {
                      handleRenameUnit(customUnitRenameModal.unitName, customUnitRenameModal.inputValue.trim());
                      setCustomUnitRenameModal({ isOpen: false, unitName: '', inputValue: '' });
                    }
                  }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  تعديل وتعميم الوحدة الجديدة ✅
                </button>
                <button
                  onClick={() => setCustomUnitRenameModal({ isOpen: false, unitName: '', inputValue: '' })}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                >
                  إلغاء ❌
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 10. SELF-LEARNING AUTOCOMPLETE DATALISTS */}
      <datalist id="learned-vendors-list">
        {uniqueClientsList.map((client, idx) => (
          <option key={`client-opt-${idx}`} value={client} />
        ))}
      </datalist>

      <datalist id="learned-items-list">
        {uniqueItemNames.map((item, idx) => (
          <option key={`item-opt-${idx}`} value={item} />
        ))}
      </datalist>

      <datalist id="learned-brands-list">
        {uniqueItemBrands.map((brand, idx) => (
          <option key={`brand-opt-${idx}`} value={brand} />
        ))}
      </datalist>

      <datalist id="learned-units-list">
        {uniqueItemUnits.map((unit, idx) => (
          <option key={`unit-opt-${idx}`} value={unit} />
        ))}
      </datalist>

    </div>
  );
}

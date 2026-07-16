import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabaseClient: any = null;
let supabaseAdminClient: any = null;

let lastSupabaseUrl = "";
let lastSupabaseKey = "";
let lastSupabaseAdminUrl = "";
let lastSupabaseAdminKey = "";

function getJwtPayload(token: string): any {
  try {
    const parts = token.trim().split('.');
    if (parts.length !== 3) return null;
    const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(payloadJson);
  } catch (e) {
    return null;
  }
}

export function checkSupabaseKeysConfig(): { isValid: boolean; error?: string } {
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseServiceRoleKey || "").trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || supabaseAnonKey || "").trim();

  if (!serviceKey) {
    return {
      isValid: false,
      error: "المتغير البيئي SUPABASE_SERVICE_ROLE_KEY غير موجود أو فارغ على السيرفر."
    };
  }

  const servicePayload = getJwtPayload(serviceKey);
  if (servicePayload) {
    const role = servicePayload.role || "";
    if (role === "anon") {
      return {
        isValid: false,
        error: "تنبيه هام: لقد قمت بوضع مفتاح الـ ANON_KEY (المفتاح العام) في خانة مفتاح الخدمة SUPABASE_SERVICE_ROLE_KEY. يرجى الذهاب إلى إعدادات السيرفر واستبداله بمفتاح الـ service_role السري الخاص بـ Supabase لتفعيل صلاحيات الأدمن."
      };
    }
  }

  const anonPayload = getJwtPayload(anonKey);
  if (anonPayload) {
    const role = anonPayload.role || "";
    if (role === "service_role") {
      return {
        isValid: false,
        error: "تنبيه هام: لقد قمت بوضع مفتاح الأدمن service_role السري في خانة مفتاح الـ SUPABASE_ANON_KEY (المفتاح العام). هذا يشكل خطراً أمنياً على مشروعك."
      };
    }
  }

  return { isValid: true };
}

function maskKey(key: string | undefined): string {
  if (!key) return "undefined/empty";
  const cleanKey = key.trim();
  const len = cleanKey.length;
  if (len <= 8) return `[length: ${len}, too short]`;
  return `${cleanKey.slice(0, 4)}...${cleanKey.slice(-4)} (length: ${len})`;
}

export function getSupabaseClient() {
  const url = (process.env.SUPABASE_URL || supabaseUrl || "").trim();
  const key = (process.env.SUPABASE_ANON_KEY || supabaseAnonKey || "").trim();
  
  if (!url || !key) {
    return null;
  }

  if (!supabaseClient || lastSupabaseUrl !== url || lastSupabaseKey !== key) {
    try {
      supabaseClient = createClient(url, key);
      lastSupabaseUrl = url;
      lastSupabaseKey = key;
      console.log(`[Supabase Debug] Supabase Client initialized successfully! URL: ${url.substring(0, 20)}..., Key: ${maskKey(key)}`);
    } catch (err: any) {
      console.error("[Supabase Debug] Failed to initialize Supabase client:", err.message);
      return null;
    }
  }
  return supabaseClient;
}

export function getSupabaseAdminClient() {
  const url = (process.env.SUPABASE_URL || supabaseUrl || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseServiceRoleKey || "").trim();
  
  if (!url || !key) {
    console.warn("[Supabase Admin Debug] Cannot initialize: URL or SERVICE_ROLE_KEY is missing/empty.");
    return null;
  }

  if (!supabaseAdminClient || lastSupabaseAdminUrl !== url || lastSupabaseAdminKey !== key) {
    try {
      supabaseAdminClient = createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      lastSupabaseAdminUrl = url;
      lastSupabaseAdminKey = key;
      console.log(`[Supabase Admin Debug] Supabase Admin Client (Service Role) initialized successfully! URL: ${url.substring(0, 20)}..., Key: ${maskKey(key)}`);
    } catch (err: any) {
      console.error("[Supabase Admin Debug] Failed to initialize Supabase admin client:", err.message);
      return null;
    }
  }
  return supabaseAdminClient;
}

// Database directories
export const DATA_DIR = "/tmp";
export const ORGANIZED_DIR = path.join(DATA_DIR, "organized");
export const DB_FILE = path.join(DATA_DIR, "db.json");
export const ORIGINAL_DB_FILE = path.join(process.cwd(), "data", "db.json");

export const defaultProjects = [
  "عام",
  "Al Burouj - Sitewide",
  "EDNC",
  "June - Main Gate",
  "June - Main Gate Landscape",
  "June - Parcel 2",
  "Al Burouj - Buffer Zone",
  "Al Burouj - Parcel 1.14",
  "HP - Sport Club",
  "The Estates",
  "Seoudi Market",
  "June - Parcel 1 & MainTrunk",
  "June - Parcel 6",
  "HP - Sea Shore",
  "HP - Road Works"
];
export const defaultSuppliers: string[] = [];

export const defaultDb = {
  documents: [] as any[],
  telegramConfig: {
    botToken: "",
    isWebhookSet: false,
    botUsername: null,
    webhookUrl: ""
  },
  notifications: [] as any[],
  projects: defaultProjects,
  suppliers: defaultSuppliers,
  users: [] as any[],
  engineers: [] as any[],
  pettyCashBoxDays: [] as any[]
};

export let memoryDb: any = null;

export const dbVersionHistory = new Map<number, any>();

export function addToVersionHistory(db: any) {
  if (db && typeof db === "object" && typeof db.version === "number") {
    dbVersionHistory.set(db.version, JSON.parse(JSON.stringify(db)));
    if (dbVersionHistory.size > 50) {
      const keys = Array.from(dbVersionHistory.keys()).sort((a, b) => a - b);
      dbVersionHistory.delete(keys[0]);
    }
  }
}

export function mapProjectNameToStandard(name: any): string {
  if (!name || typeof name !== "string") return "عام";
  const str = name.trim().toLowerCase();
  
  if (str.includes("hp") || str.includes("hyde park") || str.includes("هايد بارك") || str.includes("هايدبارك")) {
    if (str.includes("sea shore") || str.includes("seashore") || str.includes("sea") || str.includes("shore") || str.includes("سي شور") || str.includes("شاطئ")) {
      return "HP - Sea Shore";
    }
    if (str.includes("road") || str.includes("طرق") || str.includes("طريق") || str.includes("أعمال الطرق")) {
      return "HP - Road Works";
    }
    if (str.includes("sport") || str.includes("club") || str.includes("نادي") || str.includes("رياضي")) {
      return "HP - Sport Club";
    }
    return "HP - Sport Club";
  }
  if (str.includes("seoudi") || str.includes("سعودي") || str.includes("سعودى") || str.includes("ماركت سعودي")) {
    return "Seoudi Market";
  }
  if (str.includes("june") || str.includes("جون") || str.includes("يونيو")) {
    if (str.includes("parcel 1") || str.includes("بند 1") || str.includes("طرد 1") || str.includes("مجموعه 1") || str.includes("trunk") || str.includes("main") || str.includes("رئيسي")) {
      return "June - Parcel 1 & MainTrunk";
    }
    if (str.includes("parcel 6") || str.includes("بند 6") || str.includes("طرد 6") || str.includes("مجموعه 6")) {
      return "June - Parcel 6";
    }
  }
  return "عام";
}

export function convertEasternToWesternNumerals(str: any): string {
  if (str === null || str === undefined) return "";
  const text = String(str);
  const easternDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  let result = text;
  for (let i = 0; i < 10; i++) {
    result = result.replace(easternDigits[i], String(i)).replace(persianDigits[i], String(i));
  }
  return result;
}

export function cleanBidiText(str: string): string {
  if (str === null || str === undefined) return "";
  let text = String(str).trim();
  text = text.replace(/\)\s*([A-Za-z0-9_\-\s.&]+)\s*\(/gi, " ($1) ");
  text = text.replace(/\(\s*([A-Za-z0-9_\-\s.&]+)\s*\(/gi, " ($1) ");
  text = text.replace(/\)\s*([A-Za-z0-9_\-\s.&]+)\s*\)/gi, " ($1) ");
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export function parseSafePrecisionNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    return val;
  }
  
  let str = String(val).trim();
  str = convertEasternToWesternNumerals(str);
  str = str.replace(/[^0-9.,\-]/g, '');
  
  if ((str.match(/\./g) || []).length > 1) {
    const parts = str.split('.');
    const lastPart = parts[parts.length - 1];
    if (lastPart.length === 2 || lastPart.length === 1) {
      const integerPart = parts.slice(0, parts.length - 1).join('');
      str = integerPart + '.' + lastPart;
    } else {
      str = parts.join('');
    }
  } else if (str.includes('.') && str.includes(',')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      str = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    const lastPart = parts[parts.length - 1];
    if (parts.length === 2 && lastPart.length <= 2) {
      str = parts[0] + '.' + lastPart;
    } else {
      str = str.replace(/,/g, '');
    }
  }
  
  if (str.includes('.') && (str.match(/\.\d{3}$/) !== null)) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[0].length >= 2) {
      str = parts.join('');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function sanitizeAndExtractBrands(docs: any[]): any[] {
  if (!docs) return [];
  
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

  const brandRules = [...dynamicRules, ...baseBrandRules];

  return docs.map(doc => {
    if (!doc.items || !Array.isArray(doc.items)) return doc;
    
    const updatedItems = doc.items.map((item: any) => {
      let desc = convertEasternToWesternNumerals(item.description || "");
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
      
      const q = parseSafePrecisionNumber(item.quantity);
      const p = parseSafePrecisionNumber(item.unitPrice);
      const tot = Number((q * p).toFixed(2));

      let clean = desc;
      clean = clean.replace(/[\(\[\{\/]\s*[\)\]\}/]/g, " ");
      clean = clean.replace(/(ماركة|ماركه|براند|نوع|صنع|بجوزا|هوزا|برند)\s+/gi, ' ');
      clean = clean.trim().replace(/\s+/g, ' ');
      clean = clean.replace(/^[-\s,\.\/—\|_]+/, '').replace(/[-\s,\.\/—\|_]+$/, '').trim();
      
      const brandVal = item.brand && item.brand.trim() !== "" ? item.brand : foundBrand;
      const finalBrand = cleanBidiText(convertEasternToWesternNumerals(brandVal || ""));
      const rawFinalDesc = brandVal ? (clean || desc) : desc;
      const finalDesc = cleanBidiText(convertEasternToWesternNumerals(rawFinalDesc));
      
      return {
        ...item,
        brand: finalBrand,
        description: finalDesc,
        unit: convertEasternToWesternNumerals(item.unit || "عدد"),
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
}

export let lastSupabaseSyncTime = 0;
export let syncInProgress = false;
export let currentSyncPromise: Promise<any> | null = null;

export class TaskQueue {
  private currentPromise: Promise<any> = Promise.resolve();
  
  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const nextPromise = this.currentPromise.then(task);
    this.currentPromise = nextPromise.catch(() => {});
    return nextPromise;
  }
}

export const dbWriteQueue = new TaskQueue();

export function structuredLog(action: string, status: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARN', details: any) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] [DB_SYSTEM] [${action.toUpperCase()}] [${status}] ${typeof details === "string" ? details : JSON.stringify(details)}`;
  console.log(logMsg);
  try {
    fs.appendFileSync(path.join(DATA_DIR, "system_audit.log"), logMsg + "\n", "utf-8");
  } catch (e) {}
}

export function cleanDatabaseDiagnosticsInternal(db: any) {
  try {
    if (!db) return;
    let changed = false;

    if (db.projects && Array.isArray(db.projects)) {
      const originalCount = db.projects.length;
      for (const name of defaultProjects) {
        if (!db.projects.includes(name)) {
          db.projects.push(name);
          changed = true;
        }
      }
      const mappedProjects = db.projects.map((p: any) => mapProjectNameToStandard(p));
      const uniqueProjects = Array.from(new Set(mappedProjects));
      if (uniqueProjects.length !== originalCount) {
        db.projects = uniqueProjects;
        changed = true;
      }
    }

    if (db.documents && Array.isArray(db.documents)) {
      db.documents.forEach((doc: any) => {
        if (doc && doc.projectName) {
          const standard = mapProjectNameToStandard(doc.projectName);
          if (doc.projectName !== standard) {
            console.log(`[Auto-Clean] Mapping doc ${doc.id} project from "${doc.projectName}" to standard "${standard}"`);
            doc.projectName = standard;
            changed = true;
          }
        }
      });
    }

    if (changed) {
      console.log("[Auto-Clean] Database diagnostics cleaned up and mapped successfully.");
    }
  } catch (err) {
    console.error("[Auto-Clean] Error cleaning database diagnostics:", err);
  }
}

export function sanitizeDeletedRecords(db: any) {
  if (!db || typeof db !== "object") return db;
  db.deletedEngineerIds = db.deletedEngineerIds || [];
  db.deletedSubcontractorIds = db.deletedSubcontractorIds || [];
  db.deletedLaborTimesheetIds = db.deletedLaborTimesheetIds || [];
  db.deletedCostAnalysisIds = db.deletedCostAnalysisIds || [];

  if (db.subcontractorContracts) {
    db.subcontractorContracts = db.subcontractorContracts.filter((c: any) => !db.deletedSubcontractorIds.includes(c.id));
  }
  if (db.laborTimesheets) {
    db.laborTimesheets = db.laborTimesheets.filter((ts: any) => !db.deletedLaborTimesheetIds.includes(ts.id));
  }
  if (db.costAnalysisEntries) {
    db.costAnalysisEntries = db.costAnalysisEntries.filter((item: any) => !db.deletedCostAnalysisIds.includes(item.id));
  }
  if (db.engineers) {
    db.engineers = db.engineers.filter((eng: any) => !db.deletedEngineerIds.includes(eng.id));
  }

  db.pettyCashBoxDays = db.pettyCashBoxDays || [];
  db.engineerLedgers = db.engineerLedgers || {};

  const nowStr = new Date().toISOString();

  db.pettyCashBoxDays.forEach((day: any) => {
    if (!day.updatedAt) day.updatedAt = nowStr;
    if (day.transactions && Array.isArray(day.transactions)) {
      day.transactions.forEach((tx: any) => {
        if (!tx.updatedAt) tx.updatedAt = nowStr;
      });
    }
  });

  for (const [engName, days] of Object.entries(db.engineerLedgers)) {
    if (Array.isArray(days)) {
      days.forEach((day: any) => {
        if (!day.updatedAt) day.updatedAt = nowStr;
        if (day.transactions && Array.isArray(day.transactions)) {
          day.transactions.forEach((tx: any) => {
            if (!tx.updatedAt) tx.updatedAt = nowStr;
          });
        }
      });
    }
  }

  for (const [engineerName, ledgerDays] of Object.entries(db.engineerLedgers)) {
    if (Array.isArray(ledgerDays)) {
      for (const ledgerDay of ledgerDays) {
        if (!ledgerDay || !ledgerDay.date) continue;
        let pDay = db.pettyCashBoxDays.find((d: any) => d.date === ledgerDay.date && (d.engineer || "عام") === engineerName);
        if (pDay) {
          const pDayTime = pDay.updatedAt ? new Date(pDay.updatedAt).getTime() : 0;
          const ledgerDayTime = ledgerDay.updatedAt ? new Date(ledgerDay.updatedAt).getTime() : 0;
          
          if (ledgerDayTime > pDayTime) {
            pDay.updatedAt = ledgerDay.updatedAt;
            pDay.transactions = ledgerDay.transactions || [];
            pDay.startingBalanceOverride = ledgerDay.startingBalanceOverride;
          } else {
            ledgerDay.updatedAt = pDay.updatedAt;
            ledgerDay.transactions = pDay.transactions || [];
            ledgerDay.startingBalanceOverride = pDay.startingBalanceOverride;
          }
        } else {
          db.pettyCashBoxDays.push({
            date: ledgerDay.date,
            engineer: engineerName,
            startingBalanceOverride: ledgerDay.startingBalanceOverride,
            transactions: ledgerDay.transactions || [],
            updatedAt: ledgerDay.updatedAt || nowStr
          });
        }
      }
    }
  }

  db.engineerLedgers = {};
  for (const day of db.pettyCashBoxDays) {
    const engineer = day.engineer || "عام";
    if (!db.engineerLedgers[engineer]) {
      db.engineerLedgers[engineer] = [];
    }
    const { engineer: _, ...dayWithoutEngineer } = day;
    db.engineerLedgers[engineer].push(dayWithoutEngineer);
  }

  return db;
}

export function initializeDbVersion(db: any) {
  if (db && typeof db === "object") {
    if (db.version === undefined) {
      db.version = 1;
    }
    if (!db.updatedAt) {
      db.updatedAt = new Date().toISOString();
    }
    if (!db.lastModified) {
      db.lastModified = new Date().toISOString();
    }
    addToVersionHistory(db);
  }
  return db;
}

export function setMemoryDb(db: any) {
  memoryDb = db;
}

export function getDb() {
  let dbResult;
  if (memoryDb) {
    cleanDatabaseDiagnosticsInternal(memoryDb);
    dbResult = initializeDbVersion(memoryDb);
  } else {
    const fallback = { ...defaultDb, projects: [...defaultProjects], suppliers: [...defaultSuppliers] };
    memoryDb = fallback;
    cleanDatabaseDiagnosticsInternal(memoryDb);
    dbResult = initializeDbVersion(fallback);
  }
  return JSON.parse(JSON.stringify(dbResult));
}

export function mergeDbChanges(currentDb: any, persistedState: any) {
  const baseVer = currentDb.version || 1;
  const originalDb = dbVersionHistory.get(baseVer) || currentDb;
  
  if (originalDb.version === persistedState.version) {
    return currentDb;
  }

  const merged = JSON.parse(JSON.stringify(persistedState));
  
  function mergeObjectArray(key: string | ((item: any) => string), collectionName: string) {
    const origList = originalDb[collectionName] || [];
    const currList = currentDb[collectionName] || [];
    const persList = persistedState[collectionName] || [];

    const getKey = typeof key === "function" ? key : (item: any) => item[key];

    const origMap = new Map(origList.map((item: any) => [getKey(item), item]));
    const currMap = new Map(currList.map((item: any) => [getKey(item), item]));
    const persMap = new Map(persList.map((item: any) => [getKey(item), item]));

    const added: any[] = [];
    const updated: any[] = [];
    const deleted = new Set<any>();

    for (const [id, currItem] of currMap.entries()) {
      const origItem = origMap.get(id);
      if (!origItem) {
        added.push(currItem);
      } else if (JSON.stringify(origItem) !== JSON.stringify(currItem)) {
        updated.push(currItem);
      }
    }
    for (const id of origMap.keys()) {
      if (!currMap.has(id)) {
        deleted.add(id);
      }
    }

    function mergeTwoItems(itemA: any, itemB: any, colName: string = "") {
      if (!itemA) return itemB;
      if (!itemB) return itemA;

      const dateA = itemA.updatedAt ? new Date(itemA.updatedAt).getTime() : 0;
      const dateB = itemB.updatedAt ? new Date(itemB.updatedAt).getTime() : 0;

      const newerItem = dateB >= dateA ? itemB : itemA;
      const olderItem = dateB >= dateA ? itemA : itemB;

      const merged = { ...newerItem };

      if (Array.isArray(olderItem.transactions) || Array.isArray(newerItem.transactions)) {
        const mergedTx = [...(olderItem.transactions || [])];
        const newerTx = newerItem.transactions || [];
        for (const nTx of newerTx) {
          const eIdx = mergedTx.findIndex((e: any) => e.id === nTx.id);
          if (eIdx >= 0) {
            const date1 = nTx.updatedAt ? new Date(nTx.updatedAt).getTime() : 0;
            const date2 = mergedTx[eIdx].updatedAt ? new Date(mergedTx[eIdx].updatedAt).getTime() : 0;
            if (date1 >= date2) mergedTx[eIdx] = nTx;
          } else {
            mergedTx.push(nTx);
          }
        }
        merged.transactions = mergedTx;
      }
      return merged;
    }

    const mergedUpdated: any[] = [];
    for (const item of updated) {
      const id = getKey(item);
      const persItem = persMap.get(id);
      const origItem = origMap.get(id);
      if (persItem && JSON.stringify(persItem) !== JSON.stringify(origItem)) {
        const resolved = mergeTwoItems(persItem, item, collectionName);
        mergedUpdated.push(resolved);
      } else {
        mergedUpdated.push(item);
      }
    }

    const resultList = persList.filter((x: any) => !deleted.has(getKey(x)));
    for (const item of mergedUpdated) {
      const idx = resultList.findIndex((x: any) => getKey(x) === getKey(item));
      if (idx !== -1) {
        resultList[idx] = item;
      }
    }
    const filteredList = resultList.filter((x: any) => !deleted.has(getKey(x)));
    
    for (const item of added) {
      if (!filteredList.some((x: any) => getKey(x) === getKey(item))) {
        filteredList.push(item);
      }
    }

    merged[collectionName] = filteredList;
  }

  function mergePrimitiveArray(collectionName: string) {
    const origList: string[] = originalDb[collectionName] || [];
    const currList: string[] = currentDb[collectionName] || [];
    const persList: string[] = persistedState[collectionName] || [];

    const origSet = new Set(origList);

    const added = currList.filter(x => !origSet.has(x));
    const deleted = origList.filter(x => !origSet.has(x));

    const resultList = persList.filter(x => !deleted.includes(x));
    for (const item of added) {
      if (!resultList.includes(item)) {
        resultList.push(item);
      }
    }
    merged[collectionName] = resultList;
  }

  const objectCollections = [
    { name: "documents", key: "id" },
    { name: "users", key: "id" },
    { name: "allowedDevices", key: "id" },
    { name: "notifications", key: "id" },
    { name: "subcontractorContracts", key: "id" },
    { name: "laborTimesheets", key: "id" },
    { name: "costAnalysisEntries", key: "id" },
    { name: "engineers", key: "id" },
    { name: "pendingTransactions", key: "id" },
    { name: "archives", key: "id" },
    { name: "pettyCashBoxDays", key: (item: any) => `${item.engineer || "عام"}_${item.date}` }
  ];

  for (const col of objectCollections) {
    if (originalDb[col.name] || currentDb[col.name] || persistedState[col.name]) {
      mergeObjectArray(col.key, col.name);
    }
  }

  if (currentDb.engineerLedgers || persistedState.engineerLedgers) {
    merged.engineerLedgers = JSON.parse(JSON.stringify(persistedState.engineerLedgers || {}));
    const currLedger = currentDb.engineerLedgers || {};
    for (const [engName, currDays] of Object.entries(currLedger)) {
      if (!merged.engineerLedgers[engName]) {
        merged.engineerLedgers[engName] = [];
      }
      const persDays = merged.engineerLedgers[engName];
      for (const cDay of (currDays as any[])) {
        const pIdx = persDays.findIndex((p: any) => p.date === cDay.date);
        if (pIdx >= 0) {
          const pDay = persDays[pIdx];
          const cDate = cDay.updatedAt ? new Date(cDay.updatedAt).getTime() : 0;
          const pDate = pDay.updatedAt ? new Date(pDay.updatedAt).getTime() : 0;
          if (cDate > pDate) {
            persDays[pIdx] = cDay;
          } else if (cDate === pDate) {
            persDays[pIdx] = cDay;
          }
        } else {
          persDays.push(cDay);
        }
      }
    }
  }

  const primitiveCollections = ["projects", "suppliers", "deletedEngineerIds", "deletedSubcontractorIds", "deletedLaborTimesheetIds", "deletedCostAnalysisIds", "costAnalysisCategories"];

  for (const col of primitiveCollections) {
    if (originalDb[col] || currentDb[col] || persistedState[col]) {
      mergePrimitiveArray(col);
    }
  }

  if (JSON.stringify(originalDb.telegramConfig) !== JSON.stringify(currentDb.telegramConfig)) {
    if (JSON.stringify(originalDb.telegramConfig) !== JSON.stringify(persistedState.telegramConfig)) {
      throw new Error("Conflict detected: Telegram configuration was modified by another request.");
    }
    merged.telegramConfig = currentDb.telegramConfig;
  }

  return merged;
}

export async function saveDb(data: any) {
  return dbWriteQueue.enqueue(async () => {
    structuredLog("update", "INFO", "Initiating atomic database write transaction in Supabase...");
    
    if (data && data.documents) {
      data.documents = sanitizeAndExtractBrands(data.documents);
    }

    let persistedState: any = null;
    const adminClient = getSupabaseAdminClient();
    
    // 1. Fetch latest persisted state from Supabase app_state table
    if (adminClient) {
      try {
        let { data: row, error: fetchErr } = await adminClient
          .from('app_state')
          .select('data')
          .eq('key', 'global_state')
          .maybeSingle();

        if (fetchErr || !row) {
          const { data: row2, error: err2 } = await adminClient
            .from('app_state')
            .select('data')
            .eq('id', 'global_state')
            .maybeSingle();
          if (row2) row = row2;
        }

        if (fetchErr && !row) {
          console.warn('[DB_SYSTEM] Could not find row with key/id=global_state:', fetchErr?.message);
        }

        let engineersRows: any[] = [];
        let boxRows: any[] = [];
        try {
          const [engRes, boxRes] = await Promise.all([
            adminClient.from('engineers').select('*'),
            adminClient.from('petty_cash_box_days').select('*')
          ]);
          engineersRows = engRes.data || [];
          boxRows = boxRes.data || [];
        } catch (e: any) {
          console.warn('[DB_SYSTEM] Failed to fetch separate tables for merge in saveDb:', e.message);
        }

        if (row && row.data) {
          persistedState = row.data;

          if (engineersRows.length > 0) {
            persistedState.engineers = engineersRows.map(e => {
              const existing = (persistedState.engineers || []).find((old: any) => old.id === e.id || old.name === e.name) || {};
              return {
                ...existing,
                id: e.id,
                name: e.name,
                project: e.project,
                initialBalance: e.initial_balance,
                updatedAt: e.updated_at
              };
            });
          }
          if (boxRows.length > 0) {
            persistedState.pettyCashBoxDays = boxRows.map(b => {
              const existing = (persistedState.pettyCashBoxDays || []).find((old: any) => (old.id === b.id) || (old.date === b.date && old.engineer === b.engineer)) || {};
              return {
                ...existing,
                id: b.id,
                engineer: b.engineer,
                date: b.date,
                startingBalanceOverride: b.starting_balance,
                transactions: typeof b.transactions === 'string' ? JSON.parse(b.transactions) : (b.transactions || []),
                updatedAt: b.updated_at
              };
            });
          }
        }
      } catch (err: any) {
        console.warn("[DB_SYSTEM] Failed to load persisted state from Supabase during saveDb:", err.message);
      }
    }

    if (!persistedState) {
      persistedState = memoryDb || { ...defaultDb, projects: [...defaultProjects], suppliers: [...defaultSuppliers] };
    }

    if (persistedState.version === undefined) {
      persistedState.version = 1;
    }
    if (data.version === undefined) {
      data.version = 1;
    }

    let mergedData = { ...persistedState, ...data };
    
    // Protect critical arrays from being accidentally wiped by empty arrays from the client
    if (data.engineers && data.engineers.length > 0) mergedData.engineers = data.engineers;
    else mergedData.engineers = persistedState.engineers || data.engineers || [];
    
    if (data.pettyCashBoxDays && data.pettyCashBoxDays.length > 0) mergedData.pettyCashBoxDays = data.pettyCashBoxDays;
    else mergedData.pettyCashBoxDays = persistedState.pettyCashBoxDays || data.pettyCashBoxDays || [];
    
    // Accept write directly without complex version merging
    structuredLog("update", "INFO", `Accepting write directly to Supabase. Version moving from ${persistedState.version || 1} to next.`);

    const newVersion = (persistedState?.version || 1) + 1;
    mergedData.version = newVersion;
    mergedData.updatedAt = new Date().toISOString();
    mergedData.lastModified = new Date().toISOString();

    const sanitizedData = sanitizeDeletedRecords(mergedData);
    let writeSucceeded = false;

    // 2. Save to Supabase (Single Source of Truth)
    if (adminClient) {
      try {
        // A. Upsert global state to app_state
        let { error: upsertErr } = await adminClient
          .from('app_state')
          .upsert({ id: 'global_state', data: sanitizedData, updated_at: new Date().toISOString() }, { onConflict: 'id' });
        
        if (upsertErr) {
           console.warn("Upsert with id failed:", upsertErr.message);
        }

        // B. Parallel upsert into users table
        if (sanitizedData.users && Array.isArray(sanitizedData.users)) {
          const mappedUsers = sanitizedData.users.map((u: any) => ({
            id: u.id || `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            email: u.email,
            name: u.name,
            role: u.role || "user",
            status: u.status || "active",
            allowed_departments: u.allowed_departments || [],
            is_system: u.isSystem || u.is_system || false,
            updated_at: u.createdAt || new Date().toISOString()
          }));
          if (mappedUsers.length > 0) {
            await adminClient.from('users').upsert(mappedUsers, { onConflict: 'email' });
          }
        }

        // C. Parallel upsert into engineers table
        if (sanitizedData.engineers && Array.isArray(sanitizedData.engineers)) {
          const mappedEngineers = sanitizedData.engineers.map((e: any) => ({
            id: e.id || `eng_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: e.name,
            project: e.project || "",
            initial_balance: parseSafePrecisionNumber(e.initialBalance || e.initial_balance || 0),
            updated_at: e.updatedAt || new Date().toISOString()
          }));
          if (mappedEngineers.length > 0) {
            await adminClient.from('engineers').upsert(mappedEngineers);
          }
        }
        
        if (sanitizedData.deletedEngineerIds && sanitizedData.deletedEngineerIds.length > 0) {
           await adminClient.from('engineers').delete().in('id', sanitizedData.deletedEngineerIds);
        }

        // D. Parallel upsert into petty_cash_box_days table
        if (sanitizedData.pettyCashBoxDays && Array.isArray(sanitizedData.pettyCashBoxDays)) {
          const mappedPettyCash = sanitizedData.pettyCashBoxDays.map((day: any) => ({
            id: `${day.engineer || "عام"}_${day.date}`,
            engineer: day.engineer || "عام",
            date: day.date,
            starting_balance: parseSafePrecisionNumber(day.startingBalanceOverride || day.starting_balance || day.startingBalance || 0),
            transactions: day.transactions || [],
            updated_at: day.updatedAt || new Date().toISOString()
          }));
          if (mappedPettyCash.length > 0) {
            await adminClient.from('petty_cash_box_days').upsert(mappedPettyCash, { onConflict: 'id' });
          }
        }

        writeSucceeded = true;
      } catch (err: any) {
        console.error("Could not write AppState to Supabase:", err.message);
        throw new Error(`فشل حفظ البيانات في قاعدة البيانات Supabase: ${err.message}`);
      }
    } else {
      console.warn("[DB_SYSTEM] Supabase admin client not initialized, writing locally only.");
      writeSucceeded = true;
    }

    if (writeSucceeded) {
      memoryDb = sanitizedData;
      addToVersionHistory(sanitizedData);
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(sanitizedData, null, 2), "utf-8");
      } catch (err) {
        console.warn("Could not save to local fallback DB file:", err);
      }
    }

    lastSupabaseSyncTime = Date.now() + 1000;
    return sanitizedData;
  });
}

export async function fetchAndSyncDbFromSupabase(force: boolean = false) {
  const shouldForce = force;

  if (syncInProgress) {
    if (currentSyncPromise) {
      structuredLog("sync", "INFO", "Sync already in progress. Sharing active sync execution.");
      return currentSyncPromise;
    }
    return getDb();
  }

  syncInProgress = true;
  currentSyncPromise = (async () => {
    try {
      structuredLog("sync", "INFO", "Database synchronization started via Supabase...");

      const adminClient = getSupabaseAdminClient();

      if (adminClient) {
        try {
          let { data: row, error: fetchErr } = await adminClient
            .from('app_state')
            .select('data')
            .eq('key', 'global_state')
            .maybeSingle();

          if (fetchErr || !row) {
            const { data: row2, error: err2 } = await adminClient
              .from('app_state')
              .select('data')
              .eq('id', 'global_state')
              .maybeSingle();
            if (row2) row = row2;
          }

          if (fetchErr && !row) {
            console.warn('[DB_SYSTEM] Could not find row with key/id=global_state:', fetchErr?.message);
          }

          let engineersRows: any[] = [];
          let boxRows: any[] = [];
          try {
            const [engRes, boxRes] = await Promise.all([
              adminClient.from('engineers').select('*'),
              adminClient.from('petty_cash_box_days').select('*')
            ]);
            engineersRows = engRes.data || [];
            boxRows = boxRes.data || [];
          } catch (e: any) {
            console.warn('[DB_SYSTEM] Failed to fetch engineers/pettyCashBoxDays separate tables:', e.message);
          }

          if (row && row.data) {
            const parsed = sanitizeDeletedRecords(row.data);
            
            console.log('[DB READ] engineers rows:', engineersRows?.length || 0);
            console.log('[DB READ] petty_cash_box_days rows:', boxRows?.length || 0);
            console.log('[DB READ] app_state engineers:', parsed?.engineers?.length || 0);

            // Merge separate tables if they exist
            if (engineersRows.length > 0) {
              parsed.engineers = engineersRows.map(e => {
                const existing = (parsed.engineers || []).find((old: any) => old.id === e.id || old.name === e.name) || {};
                return {
                  ...existing,
                  id: e.id,
                  name: e.name,
                  project: e.project,
                  initialBalance: e.initial_balance,
                  updatedAt: e.updated_at
                };
              });
            }
            if (boxRows.length > 0) {
              parsed.pettyCashBoxDays = boxRows.map(b => {
                const existing = (parsed.pettyCashBoxDays || []).find((old: any) => (old.id === b.id) || (old.date === b.date && old.engineer === b.engineer)) || {};
                return {
                  ...existing,
                  id: b.id,
                  engineer: b.engineer,
                  date: b.date,
                  startingBalanceOverride: b.starting_balance,
                  transactions: typeof b.transactions === 'string' ? JSON.parse(b.transactions) : (b.transactions || []),
                  updatedAt: b.updated_at
                };
              });
            }

            memoryDb = parsed;
            try {
              fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), "utf-8");
            } catch {}
            console.log("Successfully loaded database state from Supabase (Primary Source of Truth)!");
            lastSupabaseSyncTime = Date.now();
            structuredLog("sync", "SUCCESS", "Database synchronization completed successfully from Supabase.");
            return memoryDb;

          } else {
            // First run: No data in Supabase.
            console.log("No data found in Supabase. Using defaultDb without writing it back.");
            const fallback = { ...defaultDb, projects: [...defaultProjects], suppliers: [...defaultSuppliers] };
            memoryDb = fallback;
            lastSupabaseSyncTime = Date.now();
            return memoryDb;
          }

        } catch (err: any) {
          console.warn("Could not load AppState from Supabase, using default fallback:", err.message);
        }
      }

      const fallback = { ...defaultDb, projects: [...defaultProjects], suppliers: [...defaultSuppliers] };
      memoryDb = fallback;
      return memoryDb;
    } catch (err: any) {
      structuredLog("sync", "ERROR", `Database synchronization failed: ${err.message}`);
      return getDb();
    } finally {
      syncInProgress = false;
      currentSyncPromise = null;
    }
  })();

  return currentSyncPromise;
}

// Populate initial DB on disk from committed repository template if available
try {
  if (!fs.existsSync(DB_FILE)) {
    if (fs.existsSync(ORIGINAL_DB_FILE)) {
      fs.copyFileSync(ORIGINAL_DB_FILE, DB_FILE);
      console.log("Successfully copied original committed db.json to /tmp/db.json");
    }
  }
} catch (e) {
  console.warn("Could not write initial default DB file (expected in read-only environments):", e);
}

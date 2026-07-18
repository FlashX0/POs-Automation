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
          .eq('id', 'global_state')
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
            // استبعاد المهندسين المحذوفين من إعادة البناء لمنع إحيائهم
            const deletedIds = new Set(data.deletedEngineerIds || []);
            persistedState.engineers = engineersRows
              .filter(e => !deletedIds.has(e.id))
              .map(e => {
              const existing = (persistedState.engineers || []).find((old: any) => old.id === e.id || old.name === e.name) || {};
              return {
                ...existing,
                id: e.id,
                name: e.name,
                project: (e.allowed_projects && e.allowed_projects.length > 0) ? e.allowed_projects[0] : "",
                  initialBalance: e.initial_balance,
                updatedAt: e.updated_at
              };
            });
          }
          if (boxRows.length > 0) {
            persistedState.pettyCashBoxDays = boxRows.map(b => {
              const existing = (persistedState.pettyCashBoxDays || []).find((old: any) => (old.id === b.id) || (old.date === b.date && (old.engineer || "عام") === (b.engineer || "عام"))) || {};
              return {
                ...existing,
                id: b.id,
                engineer: b.engineer,
                date: b.date,
                startingBalanceOverride: b.initial_balance,
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
    
    // Protect arrays from stale overwrites (Timestamp Protection)
    if (data.engineers && Array.isArray(data.engineers)) {
      const oldEngineers = persistedState.engineers || [];
      mergedData.engineers = data.engineers.map((newEng: any) => {
        const oldEng = oldEngineers.find((e: any) => e.id === newEng.id);
        if (oldEng) {
          const oldTime = new Date(oldEng.updatedAt || 0).getTime();
          const newTime = new Date(newEng.updatedAt || 0).getTime();
          if (newTime < oldTime) return oldEng;
        }
        return newEng;
      });
    }

    if (data.pettyCashBoxDays && Array.isArray(data.pettyCashBoxDays)) {
      const oldDays = persistedState.pettyCashBoxDays || [];
      mergedData.pettyCashBoxDays = data.pettyCashBoxDays.map((newDay: any) => {
        const oldDay = oldDays.find((d: any) => 
          (d.id && d.id === newDay.id) || (d.date === newDay.date && (d.engineer || "عام") === (newDay.engineer || "عام"))
        );
        if (oldDay) {
          const oldTime = new Date(oldDay.updatedAt || 0).getTime();
          const newTime = new Date(newDay.updatedAt || 0).getTime();
          if (newTime < oldTime) return oldDay;
        }
        return newDay;
      });
    }

    if (data.laborTimesheets && Array.isArray(data.laborTimesheets)) {
      const oldTs = persistedState.laborTimesheets || [];
      mergedData.laborTimesheets = data.laborTimesheets.map((newTs: any) => {
        const oldT = oldTs.find((t: any) => t.id === newTs.id);
        if (oldT) {
          const oldTime = new Date(oldT.updatedAt || 0).getTime();
          const newTime = new Date(newTs.updatedAt || 0).getTime();
          if (newTime < oldTime) return oldT;
        }
        return newTs;
      });
    }

    if (data.subcontractorContracts && Array.isArray(data.subcontractorContracts)) {
      const oldCont = persistedState.subcontractorContracts || [];
      mergedData.subcontractorContracts = data.subcontractorContracts.map((newCont: any) => {
        const oldC = oldCont.find((c: any) => c.id === newCont.id);
        if (oldC) {
          const oldTime = new Date(oldC.updatedAt || 0).getTime();
          const newTime = new Date(newCont.updatedAt || 0).getTime();
          if (newTime < oldTime) return oldC;
        }
        return newCont;
      });
    }

    if (data.costAnalysisEntries && Array.isArray(data.costAnalysisEntries)) {
      const oldEntries = persistedState.costAnalysisEntries || [];
      mergedData.costAnalysisEntries = data.costAnalysisEntries.map((newEntry: any) => {
        const oldE = oldEntries.find((e: any) => e.id === newEntry.id);
        if (oldE) {
          const oldTime = new Date(oldE.updatedAt || 0).getTime();
          const newTime = new Date(newEntry.updatedAt || 0).getTime();
          if (newTime < oldTime) return oldE;
        }
        return newEntry;
      });
    }

    mergedData.deletedEngineerIds = [...new Set([...(persistedState.deletedEngineerIds || []), ...(data.deletedEngineerIds || [])])];
    mergedData.deletedSubcontractorIds = [...new Set([...(persistedState.deletedSubcontractorIds || []), ...(data.deletedSubcontractorIds || [])])];
    mergedData.deletedLaborTimesheetIds = [...new Set([...(persistedState.deletedLaborTimesheetIds || []), ...(data.deletedLaborTimesheetIds || [])])];
    mergedData.deletedCostAnalysisIds = [...new Set([...(persistedState.deletedCostAnalysisIds || []), ...(data.deletedCostAnalysisIds || [])])];

    if (mergedData.engineers) mergedData.engineers = mergedData.engineers.filter((eng: any) => !mergedData.deletedEngineerIds.includes(eng.id));
    if (mergedData.subcontractorContracts) mergedData.subcontractorContracts = mergedData.subcontractorContracts.filter((c: any) => !mergedData.deletedSubcontractorIds.includes(c.id));
    if (mergedData.laborTimesheets) mergedData.laborTimesheets = mergedData.laborTimesheets.filter((ts: any) => !mergedData.deletedLaborTimesheetIds.includes(ts.id));
    if (mergedData.costAnalysisEntries) mergedData.costAnalysisEntries = mergedData.costAnalysisEntries.filter((item: any) => !mergedData.deletedCostAnalysisIds.includes(item.id));
    
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
        console.log('[DB WRITE] Target table: app_state, Payload size:', JSON.stringify(sanitizedData).length, 'bytes, PK: global_state');
        let { data: upsertData, error: upsertErr } = await adminClient
          .from('app_state')
          .upsert({ id: 'global_state', data: sanitizedData, updated_at: new Date().toISOString() }, { onConflict: 'id' })
          .select();
        
        if (upsertErr) {
           console.error('[DB WRITE FAILED] app_state:', upsertErr.message);
           throw upsertErr;
        }
        console.log('[DB WRITE OK] app_state, rows written:', Array.isArray(upsertData) ? upsertData.length : (upsertData ? 1 : 0));

        // B. Parallel upsert into users table
        if (sanitizedData.users && Array.isArray(sanitizedData.users)) {
          const uniqueUsersMap = new Map();
          sanitizedData.users.forEach((u: any) => {
             if (u.email && !uniqueUsersMap.has(u.email)) {
                uniqueUsersMap.set(u.email, {
                   id: u.id && u.id.length === 36 ? u.id : globalThis.crypto.randomUUID(),
                   email: u.email,
                   name: u.name,
                   role: u.role || "user",
                   status: u.status || "active",
                   allowed_departments: u.allowed_departments || [],
                   updated_at: u.createdAt || new Date().toISOString()
                });
             }
          });
          const mappedUsers = Array.from(uniqueUsersMap.values());
          if (mappedUsers.length > 0) {
            console.log('[DB WRITE] Target table: users, Rows:', mappedUsers.length);
            const { data, error } = await adminClient.from('users').upsert(mappedUsers, { onConflict: 'email' }).select();
            if (error) {
              console.error('[DB WRITE FAILED] users:', error.message);
              throw error;
            }
            console.log('[DB WRITE OK] users, rows written:', data?.length ?? 0);
          }
        }

        // C. Parallel upsert into engineers table
        if (sanitizedData.engineers && Array.isArray(sanitizedData.engineers)) {
          const uniqueEngineersMap = new Map();
          sanitizedData.engineers.forEach((e: any) => {
             // استخدم نفس ID من البيانات دائماً — لا تُنشئ ID عشوائي مختلف
             const id = e.id || crypto.randomUUID();
             if (!uniqueEngineersMap.has(id)) {
                uniqueEngineersMap.set(id, {
                   id,
                   name: e.name,
                   allowed_projects: e.project ? [e.project] : [],
                   initial_balance: parseSafePrecisionNumber(e.initialBalance !== undefined ? e.initialBalance : (e.initial_balance !== undefined ? e.initial_balance : 0)),
                   updated_at: e.updatedAt || new Date().toISOString()
                });
             }
          });
          const mappedEngineers = Array.from(uniqueEngineersMap.values());
          if (mappedEngineers.length > 0) {
            console.log('[DB WRITE] Target table: engineers, Rows:', mappedEngineers.length);
            const { data, error } = await adminClient.from('engineers').upsert(mappedEngineers, { onConflict: 'id' }).select();
            if (error) {
              console.error('[DB WRITE FAILED] engineers:', error.message);
              throw error;
            }
            console.log('[DB WRITE OK] engineers, rows written:', data?.length ?? 0);
          }
        }
        
        if (sanitizedData.deletedEngineerIds && sanitizedData.deletedEngineerIds.length > 0) {
           console.log('[DB WRITE] Target table: engineers (DELETE), Rows:', sanitizedData.deletedEngineerIds.length);
           const { data, error } = await adminClient.from('engineers').delete().in('id', sanitizedData.deletedEngineerIds).select();
           if (error) {
             console.error('[DB WRITE FAILED] engineers (DELETE):', error.message);
             throw error;
           }
           console.log('[DB WRITE OK] engineers (DELETE), rows removed:', data?.length ?? 0);
           // بعد نجاح الحذف، أفّرغ القائمة لمنع محاولة حذف صفوف غير موجودة في كل مرة
           sanitizedData.deletedEngineerIds = [];
        }

        // D. Parallel upsert into petty_cash_box_days table
        if (sanitizedData.pettyCashBoxDays && Array.isArray(sanitizedData.pettyCashBoxDays)) {
          
          const mappedPettyCash = sanitizedData.pettyCashBoxDays.map((day: any) => ({
            id: day.id || `${day.engineer || "عام"}_${day.date}`,
            engineer: day.engineer || "عام",
            date: day.date,
            initial_balance: parseSafePrecisionNumber(day.startingBalanceOverride !== undefined ? day.startingBalanceOverride : (day.starting_balance !== undefined ? day.starting_balance : (day.startingBalance !== undefined ? day.startingBalance : 0))),
            transactions: day.transactions || [],
            updated_at: day.updatedAt || new Date().toISOString()
          }));
          const _ignored = sanitizedData.pettyCashBoxDays.map((day: any) => ({
  
            id: day.id || `${day.engineer || "عام"}_${day.date}`,
            engineer: day.engineer || "عام",
            date: day.date,
            initial_balance: parseSafePrecisionNumber(day.startingBalanceOverride !== undefined ? day.startingBalanceOverride : (day.starting_balance !== undefined ? day.starting_balance : (day.startingBalance !== undefined ? day.startingBalance : 0))),
            transactions: day.transactions || [],
            updated_at: day.updatedAt || new Date().toISOString()
          }));
          
          const idSet = new Set();
          let hasDuplicates = false;
          mappedPettyCash.forEach(p => {
             if (idSet.has(p.id)) {
                 console.error("[CRITICAL ERROR] Duplicate conflict key found for upsert payload: " + p.id);
                 hasDuplicates = true;
             }
             idSet.add(p.id);
          });
          if (hasDuplicates) {
             throw new Error("ABORT: duplicate conflict keys inside the same petty_cash_box_days UPSERT payload");
          }

          if (mappedPettyCash.length > 0) {
            console.log('[DB WRITE] Target table: petty_cash_box_days, Rows:', mappedPettyCash.length);
            console.log('--- DEBUG PETTY CASH BEFORE UPSERT ---');
            mappedPettyCash.forEach(p => {
               console.log(`ID: ${p.id} | Engineer: ${p.engineer} | Date: ${p.date} | Bal: ${p.initial_balance} | Tx: ${p.transactions.length}`);
            });
            const dupCheck = new Set();
            for (let p of mappedPettyCash) {
              if (dupCheck.has(p.id)) {
                 console.log(`ABORTING: DUPLICATE ID FOUND IN MAPPED ARRAY: ${p.id}`);
                 throw new Error("Duplicate ID in petty_cash_box_days: " + p.id);
              }
              dupCheck.add(p.id);
            }
            console.log('--------------------------------------');
            const { data, error } = await adminClient.from('petty_cash_box_days').upsert(mappedPettyCash, { onConflict: 'id' }).select();
            if (error) {
              console.error('[DB WRITE FAILED] petty_cash_box_days:', error.message);
              throw error;
            }
            console.log('[DB WRITE OK] petty_cash_box_days, rows written:', data?.length ?? 0);
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
            .eq('id', 'global_state')
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
            parsed.projects = Array.from(new Set([...defaultProjects, ...(parsed.projects || [])]));
            
            console.log('[DB READ] engineers rows:', engineersRows?.length || 0);
            console.log('[DB READ] petty_cash_box_days rows:', boxRows?.length || 0);
            console.log('[DB READ] app_state engineers:', parsed?.engineers?.length || 0);

            // Merge separate tables if they exist — exclude already-deleted engineers to prevent resurrection
            if (engineersRows.length > 0) {
              const deletedIds = new Set(parsed.deletedEngineerIds || []);
              parsed.engineers = engineersRows
                .filter(e => !deletedIds.has(e.id))
                .map(e => {
                const existing = (parsed.engineers || []).find((old: any) => old.id === e.id || old.name === e.name) || {};
                return {
                  ...existing,
                  id: e.id,
                  name: e.name,
                  project: (e.allowed_projects && e.allowed_projects.length > 0) ? e.allowed_projects[0] : "",
                  initialBalance: e.initial_balance,
                  updatedAt: e.updated_at
                };
              });
            }
            if (boxRows.length > 0) {
              parsed.pettyCashBoxDays = boxRows.map(b => {
                const existing = (parsed.pettyCashBoxDays || []).find((old: any) => (old.id === b.id) || (old.date === b.date && (old.engineer || "عام") === (b.engineer || "عام"))) || {};
                return {
                  ...existing,
                  id: b.id,
                  engineer: b.engineer,
                  date: b.date,
                  startingBalanceOverride: b.initial_balance,
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

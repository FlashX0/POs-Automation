import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import mongoose from "mongoose";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

let supabaseClient: any = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    console.log("Supabase Client initialized successfully!");
  } catch (err: any) {
    console.error("Failed to initialize Supabase client:", err.message);
  }
} else {
  console.warn("Supabase URL or Anon Key is missing! File uploads will automatically fallback to local storage simulation.");
}

// دالة صارمة لتنظيف الأسماء من أي رموز خاصة أو مسافات زائدة
function sanitizeStorageName(text: any, fallback: string = 'unnamed'): string {
  if (!text) return fallback;
  const cleaned = text
    .toString()
    .trim()
    .replace(/[\s_/\-\\–—]+/g, '-') // تحويل أي مسافات أو عواض أو سلاشات إلى عارضة واحدة
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\-]/g, ''); // حذف أي رموز غريبة مع الحفاظ على الحروف العربية والإنجليزية والأرقام
  return cleaned || fallback;
}

function cleanFolderName(name: any): string {
  if (!name) return 'unnamed';
  return name
    .toString()
    .trim()
    .replace(/[\s_/\-\\–—]+/g, '-') // تحويل المسافات والعواض المزدوجة إلى عارضة مفردة
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\-]/g, ''); // الحفاظ فقط على الحروف العربية والإنجليزية والأرقام والعواض
}

function sanitizeName(name: string, fallback: string = "unnamed"): string {
  return sanitizeStorageName(name, fallback);
}

function sanitizePath(name: string, fallback: string = "unnamed"): string {
  return sanitizeStorageName(name, fallback);
}

/**
 * Image compressor using sharp to compress image files below 300KB
 */
async function compressImageIfNeed(buffer: Buffer, mimetype: string): Promise<{ buffer: Buffer; mimetype: string }> {
  if (mimetype.startsWith("image/")) {
    try {
      console.log(`Starting image compression. Original size: ${(buffer.length / 1024).toFixed(2)} KB`);
      let sharpInstance = sharp(buffer);
      const metadata = await sharpInstance.metadata();
      
      // Resize if image is too wide
      if (metadata.width && metadata.width > 1200) {
        sharpInstance = sharpInstance.resize(1200, null, { withoutEnlargement: true });
      }
      
      // Convert to progressive jpeg with 75% quality for excellent compression
      let compressedBuffer = await sharpInstance
        .jpeg({ quality: 75, progressive: true })
        .toBuffer();
        
      console.log(`Compressed image size: ${(compressedBuffer.length / 1024).toFixed(2)} KB`);
      
      // If it still exceeds 300KB, resize further or reduce quality
      if (compressedBuffer.length > 300 * 1024) {
        console.log("Image still exceeds 300KB, applying heavier compression...");
        compressedBuffer = await sharp(compressedBuffer)
          .resize(800, null, { withoutEnlargement: true })
          .jpeg({ quality: 60, progressive: true })
          .toBuffer();
        console.log(`Heavily compressed image size: ${(compressedBuffer.length / 1024).toFixed(2)} KB`);
      }
      
      return {
        buffer: compressedBuffer,
        mimetype: "image/jpeg"
      };
    } catch (err: any) {
      console.error("Error during image compression:", err.message);
      return { buffer, mimetype }; // fallback on error
    }
  }
  return { buffer, mimetype };
}

// مجلدات تخزين البيانات وحل أخطاء البناء السحابي وإعادة توجيه مجلدات الملفات
const DATA_DIR = "/tmp";
const ORGANIZED_DIR = path.join(DATA_DIR, "organized");
const DB_FILE = path.join(DATA_DIR, "db.json");
const ORIGINAL_DB_FILE = path.join(process.cwd(), "data", "db.json");

const app = express();
const PORT = 3000;

// التأكد من تهيئة المجلدات حتى لا تضرب الـ Routes المسؤولة عن معالجة الفواتير
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ORGANIZED_DIR)) fs.mkdirSync(ORGANIZED_DIR, { recursive: true });
} catch (e) {
  console.warn("Could not create directories in /tmp:", e);
}

// 1. الاتصال بقاعدة البيانات السحابية مباشرة باستخدام رابط الاتصال الموفر
const MONGODB_URI = "mongodb+srv://narutoluffy201_db_user:016135@cluster0.zlje0ku.mongodb.net/?appName=Cluster0";
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000, // حد أقصى للاتصال 5 ثوانٍ لمنع تعليق المشروع في حالة عدم إضافة الـ IP الصحيح لقائمة السماح
  socketTimeoutMS: 10000,
})
  .then(() => console.log("Connected to MongoDB Atlas successfully!"))
  .catch((err) => {
    console.warn("⚠️ لم نتمكن من الاتصال بـ MongoDB Atlas (قد يكون سبب ذلك عدم إضافة عنوان IP إلى قائمة المسموح بهم):");
    console.warn(err.message);
    console.warn("📌 لا تقلق! الخدمة مبرمجة لتعمل تلقائياً وبكفاءة كاملة على التخزين المحلي الآمن (local db.json /tmp).");
  });

// 2. إنشاء الـ Schema والـ Model بدلاً من ملف db.json القديم
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});
const Project = mongoose.model("Project", projectSchema);

const appStateSchema = new mongoose.Schema({
  key: { type: String, default: "global_state", unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }
});
const AppState = mongoose.model("AppState", appStateSchema);

// 3. مصفوفة المشاريع الافتراضية الخاصة بك بالكامل دون أي نقص
const defaultProjects: string[] = [];

// 4. تم إيقاف الدالة التلقائية لملء قاعدة البيانات بناءً على طلب المستخدم لعدم تكرار المشاريع الافتراضية
/*
async function seedDatabase() {
  try {
    if (mongoose.connection.readyState === 1) {
      // حذف المشاريع المكررة التي طلبها المستخدم نهائياً من MongoDB Atlas
      const duplicatesToRemove = ["Al-brouj - New Buffer", "strip 2 Mall", "THE ESTATE"];
      await Project.deleteMany({ name: { $in: duplicatesToRemove } });
      console.log("Successfully removed duplicate projects from MongoDB Atlas.");

      for (const name of defaultProjects) {
        const exists = await Project.findOne({ name });
        if (!exists) {
          await Project.create({ name });
          console.log(`Successfully added project to MongoDB: ${name}`);
        }
      }
      console.log("Database projects synchronized with default projects successfully.");
    }
  } catch (err) {
    console.error("Error seeding database:", err);
  }
}
*/

// تشغيل الدالة بمجرد تمام الاتصال والمزامنة لضمان استرجاع كل المشاريع من أطلس
mongoose.connection.once("open", async () => {
  try {
    // 1. تنظيف المشاريع الافتراضية الثلاثة والمستندات الافتراضية من MongoDB Atlas نهائياً لتبدأ لوحة التحكم فارغة 100%
    const targetDocIds = ["doc_1781725768123", "doc_1781722362282", "doc_1781722025253"];
    
    // تنظيف المستندات المحفوظة مسبقاً في الـ AppState ضمن السحابة
    const dbDoc = await AppState.findOne({ key: "global_state" });
    if (dbDoc && dbDoc.data) {
      let updatedState = false;
      
      // إزالة الفواتير والمستندات الافتراضية القديمة
      if (Array.isArray(dbDoc.data.documents)) {
        const prevLen = dbDoc.data.documents.length;
        dbDoc.data.documents = dbDoc.data.documents.filter((d: any) => d && !targetDocIds.includes(d.id));
        if (dbDoc.data.documents.length !== prevLen) {
          updatedState = true;
        }
      }
      
      // تصفية التنبيهات أيضاً
      if (Array.isArray(dbDoc.data.notifications)) {
        const prevLen = dbDoc.data.notifications.length;
        dbDoc.data.notifications = dbDoc.data.notifications.filter((n: any) => n && !targetDocIds.some(id => n.id && n.id.includes(id)));
        if (dbDoc.data.notifications.length !== prevLen) {
          updatedState = true;
        }
      }

      // تصفية المشاريع الافتراضية القديمة من القائمة المدمجة في db
      const oldProjectsList = [
        "Villette A&B", "Villette C&D", "Azalia", "Block 39", "EDNC", 
        "June - Main Gate Landscape", "June - Main Gate", "Al-brouj", "June", 
        "City Stars Al Sahel", "Allegria", "ETAPA", "Strip 2 Mall", 
        "Training Pool", "Al Brouj - New Buffer", "Hyde Park", 
        "Al-Brouj - CGP 1.14A", "JUNE Parcel 01 - Maintrunk", "THE ESTATES"
      ];
      if (Array.isArray(dbDoc.data.projects)) {
        const prevLen = dbDoc.data.projects.length;
        dbDoc.data.projects = dbDoc.data.projects.filter((p: string) => !oldProjectsList.includes(p));
        if (dbDoc.data.projects.length !== prevLen) {
          updatedState = true;
        }
      }

      // تصفية الموردين الافتراضيين القدامى لتبدأ فارغة أيضاً
      if (Array.isArray(dbDoc.data.suppliers)) {
        dbDoc.data.suppliers = [];
        updatedState = true;
      }

      if (updatedState) {
        await AppState.updateOne({ key: "global_state" }, { data: dbDoc.data });
        console.log("Successfully cleaned up all target default documents and metrics from Mongo global_state!");
      }
    }

    // 2. تنظيف الـ collection الخاص بالمشاريع الفردية
    const oldProjectsList = [
      "Villette A&B", "Villette C&D", "Azalia", "Block 39", "EDNC", 
      "June - Main Gate Landscape", "June - Main Gate", "Al-brouj", "June", 
      "City Stars Al Sahel", "Allegria", "ETAPA", "Strip 2 Mall", 
      "Training Pool", "Al Brouj - New Buffer", "Hyde Park", 
      "Al-Brouj - CGP 1.14A", "JUNE Parcel 01 - Maintrunk", "THE ESTATES"
    ];
    await Project.deleteMany({ name: { $in: oldProjectsList } });
    console.log("Successfully deleted individual old default projects from MongoDB Collection!");
  } catch (err: any) {
    console.error("Error executing custom clean-up script on MongoDB Atlas:", err.message);
  }

  // تم تعطيل seedDatabase لتجنب رفع مشاريع افتراضية تلقائياً بقاعدة البيانات
  // await seedDatabase();
  await fetchAndSyncDbFromMongo();
  try {
    const dbProjects = await Project.find({}, "name");
    const names = dbProjects.map(p => p.name);
    if (names.length > 0) {
      const db = getDb();
      let changed = false;

      // تهيئة وحذف المشاريع المكررة من قائمة المشاريع الفعالة الحالية ونقل وثائقها للأسماء النظيفة المقابلة
      const duplicatesMap: { [key: string]: string } = {
        "Al-brouj - New Buffer": "Al Brouj - New Buffer",
        "strip 2 Mall": "Strip 2 Mall",
        "THE ESTATE": "THE ESTATES"
      };

      if (db.projects) {
        const originalLength = db.projects.length;
        db.projects = db.projects.filter((p: string) => !["Al-brouj - New Buffer", "strip 2 Mall", "THE ESTATE"].includes(p));
        if (db.projects.length !== originalLength) {
          changed = true;
        }
      }

      if (db.documents && Array.isArray(db.documents)) {
        db.documents.forEach((doc: any) => {
          if (doc.projectName && duplicatesMap[doc.projectName]) {
            console.log(`Mapping document ${doc.id} project name from "${doc.projectName}" to "${duplicatesMap[doc.projectName]}"`);
            doc.projectName = duplicatesMap[doc.projectName];
            changed = true;
          }
        });
      }

      for (const name of names) {
        if (!db.projects.includes(name)) {
          db.projects.push(name);
          changed = true;
        }
      }
      if (changed) {
        saveDb(db);
        console.log("Synchronized missing projects from MongoDB Atlas to active local DB and cleaned duplicates.");
      }
    }
  } catch (err) {
    console.error("Error syncing projects from Atlas to active DB:", err);
  }
});

const defaultSuppliers: string[] = [];

const defaultDb = {
  documents: [] as any[],
  telegramConfig: {
    botToken: "",
    isWebhookSet: false,
    botUsername: null,
    webhookUrl: ""
  },
  notifications: [] as any[],
  projects: defaultProjects,
  suppliers: defaultSuppliers
};

// Populate initial DB on disk from committed repository template if available
try {
  if (!fs.existsSync(DB_FILE)) {
    if (fs.existsSync(ORIGINAL_DB_FILE)) {
      fs.copyFileSync(ORIGINAL_DB_FILE, DB_FILE);
      console.log("Successfully copied original committed db.json to /tmp/db.json");
    } else {
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), "utf-8");
    }
  }
} catch (e) {
  console.warn("Could not write initial default DB file (expected in read-only environments):", e);
}

// In-memory database state fallback to avoid crashing on read-only environments
let memoryDb: any = null;

// Helpers to read/write database state
function cleanDatabaseDiagnosticsInternal(db: any) {
  if (!db) return;
  let changed = false;

  const duplicatesMap: { [key: string]: string } = {
    "Al-brouj - New Buffer": "Al Brouj - New Buffer",
    "Al-Brouj - New Buffer": "Al Brouj - New Buffer",
    "al-brouj - new buffer": "Al Brouj - New Buffer",
    "strip 2 Mall": "Strip 2 Mall",
    "strip 2 mall": "Strip 2 Mall",
    "THE ESTATE": "THE ESTATES",
    "the estate": "THE ESTATES",
    "THE ESTATES": "THE ESTATES"
  };

  const duplicatesToRemove = [
    "Al-brouj - New Buffer", 
    "Al-Brouj - New Buffer",
    "al-brouj - new buffer",
    "strip 2 Mall", 
    "strip 2 mall",
    "THE ESTATE",
    "the estate"
  ];

  if (db.projects && Array.isArray(db.projects)) {
    const originalCount = db.projects.length;
    // 1. Filter out known duplicate names
    db.projects = db.projects.filter((p: string) => {
      if (!p) return false;
      const trimmed = p.trim();
      return !duplicatesToRemove.includes(trimmed);
    });

    // 2. Case-insensitive deduplication of existing projects:
    const seen = new Set<string>();
    const uniqueProjects: string[] = [];
    db.projects.forEach((p: string) => {
      if (!p) return;
      const lowercase = p.trim().toLowerCase();
      if (!seen.has(lowercase)) {
        seen.add(lowercase);
        uniqueProjects.push(p.trim());
      }
    });
    db.projects = uniqueProjects;

    if (db.projects.length !== originalCount) {
      changed = true;
    }
  }

  // 3. Update documents that might be assigned to duplicate names
  if (db.documents && Array.isArray(db.documents)) {
    db.documents.forEach((doc: any) => {
      if (doc.projectName) {
        const trimmed = doc.projectName.trim();
        if (duplicatesMap[trimmed]) {
          console.log(`[Auto-Clean] Redirecting doc ${doc.id} from "${doc.projectName}" to "${duplicatesMap[trimmed]}"`);
          doc.projectName = duplicatesMap[trimmed];
          changed = true;
        }
      }
    });
  }

  if (changed) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
      console.log("[Auto-Clean] Database duplicates cleaned up and synchronized successfully.");
    } catch (e) {
      console.warn("Could not save auto-cleaned DB:", e);
    }
  }
}

function getDb() {
  if (memoryDb) {
    cleanDatabaseDiagnosticsInternal(memoryDb);
    return memoryDb;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    let changed = false;
    if (!parsed.projects) {
      parsed.projects = [...defaultProjects];
      changed = true;
    } else {
      for (const p of defaultProjects) {
        if (!parsed.projects.includes(p)) {
          parsed.projects.push(p);
          changed = true;
        }
      }
    }
    if (!parsed.suppliers) {
      parsed.suppliers = [...defaultSuppliers];
      changed = true;
    }
    if (changed) {
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), "utf-8");
      } catch (e) {}
    }
    memoryDb = parsed;
    cleanDatabaseDiagnosticsInternal(memoryDb);
    return parsed;
  } catch (err) {
    const fallback = { ...defaultDb, projects: [...defaultProjects], suppliers: [...defaultSuppliers] };
    memoryDb = fallback;
    cleanDatabaseDiagnosticsInternal(memoryDb);
    return fallback;
  }
}

function convertEasternToWesternNumerals(str: any): string {
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

function cleanBidiText(str: string): string {
  if (str === null || str === undefined) return "";
  let text = String(str).trim();
  
  // Rule 1: Replace common reversed or misplaced brackets often extracted by OCR in Arabic/English bidi layouts.
  // When an English term (e.g., Chevron, Sign) is surrounded by mismatched brackets:
  // E.g., ")Chevron(" or "(Chevron" or ")Chevron)" -> should safely become "(Chevron)".
  text = text.replace(/\)\s*([A-Za-z0-9_\-\s.&]+)\s*\(/gi, " ($1) ");
  text = text.replace(/\(\s*([A-Za-z0-9_\-\s.&]+)\s*\(/gi, " ($1) ");
  text = text.replace(/\)\s*([A-Za-z0-9_\-\s.&]+)\s*\)/gi, " ($1) ");
  
  // Rule 2: General cleanup of double or stray brackets/parentheses
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

function parseSafePrecisionNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    return val;
  }
  
  let str = String(val).trim();
  str = convertEasternToWesternNumerals(str);
  
  // Remove spaces and keep only numbers, dots, commas, negative signs
  str = str.replace(/[^0-9.,\-]/g, '');
  
  // If there are multiple dots, e.g., "285.600.00"
  if ((str.match(/\./g) || []).length > 1) {
    const parts = str.split('.');
    const lastPart = parts[parts.length - 1];
    if (lastPart.length === 2 || lastPart.length === 1) {
      // Last dot is the decimal point, other dots are thousands
      const integerPart = parts.slice(0, parts.length - 1).join('');
      str = integerPart + '.' + lastPart;
    } else {
      // All dots are thousands, e.g. "285.600" becomes "285600"
      str = parts.join('');
    }
  }
  
  // Standard bidi/european number notation handling
  if (str.includes('.') && str.includes(',')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      // Dot is thousands, comma is decimal: "285.600,00" -> "285600.00"
      str = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // Comma is thousands, dot is decimal: "285,600.00" -> "285600.00"
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Check if the comma is a decimal or thousand separator. E.g., "285,600" vs "1500,50"
    const parts = str.split(',');
    const lastPart = parts[parts.length - 1];
    if (parts.length === 2 && lastPart.length <= 2) {
      str = parts[0] + '.' + lastPart;
    } else {
      str = str.replace(/,/g, '');
    }
  }
  
  // Special case: Single dot with exactly 3 digits after it at the end of the string in large financial numbers
  // Example: "285.600" often is typed instead of "285600" (two hundred eighty-five thousand).
  // If it's a number >= 100 with a dot followed by exactly three digits, e.g. "285.600", and no other dot is present
  // we check if we should treat it as 285600.
  if (str.includes('.') && (str.match(/\.\d{3}$/) !== null)) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[0].length >= 2) {
      // It's likely a thousands separator dot masquerading as a decimal point!
      str = parts.join('');
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Helper to extract brands from description and recalculate math-accurate totalAmount
function sanitizeAndExtractBrands(docs: any[]): any[] {
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

function saveDb(data: any) {
  if (data && data.documents) {
    data.documents = sanitizeAndExtractBrands(data.documents);
  }
  memoryDb = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not save to database file (expected in read-only Vercel serverless environments):", err);
  }

  // Push to MongoDB Atlas asynchronously to keep all instances entirely in sync
  if (mongoose.connection.readyState === 1) {
    AppState.updateOne(
      { key: "global_state" },
      { data: data },
      { upsert: true }
    ).catch((err) => {
      console.error("Could not background save AppState to MongoDB:", err.message);
    });
  }
}

async function fetchAndSyncDbFromMongo() {
  if (mongoose.connection.readyState === 1) {
    try {
      const dbDoc = await AppState.findOne({ key: "global_state" });
      if (dbDoc && dbDoc.data) {
        memoryDb = dbDoc.data;
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), "utf-8");
        } catch {}
        console.log("Successfully loaded database state from MongoDB Atlas!");
        return memoryDb;
      } else {
        // First run: save current local db.json/getDb state to Atlas
        const localDb = getDb();
        if (localDb) {
          await AppState.updateOne(
            { key: "global_state" },
            { data: localDb },
            { upsert: true }
          );
          console.log("Seeded empty MongoDB Atlas with active local db.json data!");
        }
      }
    } catch (err: any) {
      console.warn("Could not load AppState from MongoDB Atlas, using fallback:", err.message);
    }
  }
  return getDb();
}

// Initialize Gemini Client
const geminiApiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: geminiApiKey || "MOCK_KEY_FOR_BUILD",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Configure Multer for processing file uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// JSON middleware
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Express helper to add custom server-sent notification
function triggerNotification(type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) {
  const db = getDb();
  const rawDate = new Date();
  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    type,
    title,
    message,
    timestamp: rawDate.toISOString(),
    read: false
  };
  
  db.notifications = [notification, ...(db.notifications || [])].slice(0, 15);
  saveDb(db);
  return notification;
}

// REST API HELPER: Check for documents with due dates within the next 48 hours and add warnings
function checkForUpcomingDueDates() {
  try {
    const db = getDb();
    const now = new Date();
    const documents = db.documents || [];
    let notificationsAdded = false;

    documents.forEach((doc: any) => {
      if (doc.dueDate) {
        const due = new Date(doc.dueDate);
        if (isNaN(due.getTime())) return;

        const diffMs = due.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours >= -24 && diffHours <= 48) {
          const notifIdPrefix = `due_${doc.id}`;
          const alreadyNotified = (db.notifications || []).some((n: any) => n.id.startsWith(notifIdPrefix));
          if (!alreadyNotified) {
            const rawDate = new Date();
            const hoursLeft = Math.ceil(diffHours);
            const daysLabel = hoursLeft > 0 
              ? `خلال ${hoursLeft} ساعة` 
              : hoursLeft === 0 
                ? "اليوم" 
                : `منذ ${Math.abs(hoursLeft)} ساعة`;
            
            const notification = {
              id: `${notifIdPrefix}_${rawDate.getTime()}`,
              type: "warning" as const,
              title: "تنبيه استحقاق دفعة / مستند ⚠️",
              message: `المستند رقم ${doc.docNumber || "بدون رقم"} للعميل "${doc.clientName}" يستحق الدفع ${daysLabel} (تاريخ الاستحقاق: ${doc.dueDate}).`,
              timestamp: rawDate.toISOString(),
              read: false
            };
            db.notifications = [notification, ...(db.notifications || [])].slice(0, 15);
            notificationsAdded = true;
          }
        }
      }
    });

    if (notificationsAdded) {
      saveDb(db);
    }
  } catch (err) {
    console.error("Error checking upcoming due dates:", err);
  }
}

/**
 * CORE SERVICE: Extract structured data from any Quote or PO document using Gemini API.
 */
async function extractDataFromDocument(fileBuffer: Buffer, mimeType: string, filename: string, userInstructions?: string): Promise<any> {
  if (!geminiApiKey) {
    throw new Error("لم يتم تكوين مفتاح API لجيميني (GEMINI_API_KEY). الرجاء إضافته في الإعدادات.");
  }

  let learnedSuppliers: string[] = [];
  let learnedItems: string[] = [];
  let learnedBrands: string[] = [];
  let learnedUnits: string[] = [];
  let learnedProjects: string[] = [];
  try {
    const db = getDb();
    learnedProjects = db.projects || [];
    const dbSuppliers = db.suppliers || [];
    const suppliers = new Set<string>(dbSuppliers);
    const items = new Set<string>();
    const brands = new Set<string>();
    const units = new Set<string>();
    if (db && Array.isArray(db.documents)) {
      db.documents.forEach((d: any) => {
        if (d.clientName) suppliers.add(d.clientName.trim());
        if (Array.isArray(d.items)) {
          d.items.forEach((it: any) => {
            if (it.description) items.add(it.description.trim());
            if (it.brand) brands.add(it.brand.trim());
            if (it.unit) units.add(it.unit.trim());
          });
        }
      });
    }
    learnedSuppliers = Array.from(suppliers);
    learnedItems = Array.from(items).slice(0, 100);
    learnedBrands = Array.from(brands).slice(0, 50);
    learnedUnits = Array.from(units).slice(0, 30);
  } catch (err) {
    console.warn("Self-learning prior loading failed (non-blocking):", err);
  }

  const base64Data = fileBuffer.toString("base64");
  const todayStr = new Date().toISOString().split('T')[0];

  const systemInstruction = `You are an elite professional AI accountant, multimodal visual processor, and billing OCR expert.
Analyze the provided document (which is a scanned or digital PDF, a JPEG/PNG photo of a Purchase Order [PO - أمر شراء], or a purchase document written in Arabic, English, or a bidi combination of both).

You MUST perform advanced visual OCR and document structure analysis, extracting key structural items and header meta-data accurately as JSON. Since the system handles everything as a Purchase Order (PO), you must treat and classify the document strictly as a PO.

Core Extraction & Parsing Guidelines:

1. Support Scanned Documents & Images (دعم كامل وكامل للملفات الممسوحة والصور والموديلات البصرية):
   - You act as a high-fidelity Vision Model and Advanced OCR engine. You can read, map, and align tabular content from skewed photos, scanned PDFs, or low-quality screenshots of POs/Invoices.
   - Detect grid cells, horizontal rows, line lines, and field columns, keeping the alignment between description, quantity, unit price, and total intact.

2. Merge Split & Hanging Lines (منع تقطيع الوصف ودمج الأسطر المتتالية):
   - In financial documents and PO tables, long description cells often stretch over multiple physical lines, or single table rows may be split across pages.
   - Often, technical extensions, dimensions (e.g., "مقاس " or "60x60 سم"), colors (e.g., "خلفية صفراء..."), or technical specifications stream onto successive lines immediately under the main item name.
   - You MUST intelligently MERGE all consecutive/hanging lines that belong to the same item into a single, continuous, logical "description" field!
   - You are STRICTLY FORBIDDEN from creating separate/blank rows in the items array representing these hanging specifications/extensions. Every line item MUST have a physical row representing the actual item, with its full description compiled and joined with spaces.

3. Complete Visual OCR & Absolute Rich Description (الاستخراج الكامل والدقيق للوصف):
   - Read and extract every word, detail, dimension, technical type, spec, and code printed in the description section.
   - Do not summarize, truncate, or omit any visual text under the "description" field.

4. Clear Header Layout Segregation (تنظيف وفصل بيانات الهيدر):
   - Isolate the true Supplying Supplier/Vendor name from receiver/ship-to names.
   - Vendor Name (clientName): Select ONLY the actual third-party company selling/supplying the items (e.g., '3BROTHERS', 'Huda Lighting', 'النيل للتوريدات'). Do NOT use the company address of the recipient (e.g., Delta Group or our construction site addresses) as the clientName.
   - Project/Site Name (projectName): Look for target site indicators, project fields, or ship-to keywords. Prioritize known projects.
   - PO/Doc Number (docNumber): Extract the clean document identifier. Strip any nearby overlapping lines or label remnants.

5. Bilingual Bracket Alignment & Text Direction (إصلاح اتجاه النصوص العربية والإنجليزية والأقواس):
   - For items with mixed Arabic and English terms (such as: 'لوحة إرشادية (Chevron)' or 'يافطة (Sign)'), ensure parenthesis/bracket characters are balanced, correctly opened/closed, and not scrambled in order. E.g. Output standard parenthesized words '(Chevron)' directly adjacent to the Arabic text without reversed characters.

6. Strict Mathematical Number Formats (توحيد صيغ الأرقام):
   - Extract numerical properties ("quantity", "unitPrice", "total", "totalAmount") strictly as JS/JSON numbers.
   - Never inject periods/dots as thousand separators inside JSON numbers. Ensure the numbers keep standard precision decimals (e.g., output 285600.00 instead of 285.600.00).

7. Identify Project Name: Look for indicators like Project, المشروع, عملية, موقع العمل. Fallback to 'عام' if not found.
8. Extract list of items: Each item must contain:
   - description (Clean, merged full description text)
   - quantity (number)
   - unitPrice (number)
   - total (number, qty * unitPrice)
   - brand (Manufacturer/brand name of the item. 'اليزية' / 'اليزيه' / 'Elysee' is a brand, extract it in the brand field rather than description)
   - unit (default 'عدد' if missing)
9. Extract totalAmount and currency (e.g., EGP, USD, SAR, AED, EUR).
10. Return a brief 1-sentence Arabic summary of the document.

CRITICAL ADAPTIVE / SELF-LEARNING RULE:
To prevent duplication and maintain pristine catalog nomenclature, prioritize matching previous data:
- Known Client/Supplier names: ${JSON.stringify(learnedSuppliers)}
- Known common item descriptions: ${JSON.stringify(learnedItems)}
- Known Brands: ${JSON.stringify(learnedBrands)}
- Known Units: ${JSON.stringify(learnedUnits)}
- Known Projects: ${JSON.stringify(learnedProjects)}

If any extracted term matches or strongly resembles a known term, use its EXACT catalog spelling.`;;

  try {
    const documentPart = {
      inlineData: {
        mimeType: mimeType || "application/pdf",
        data: base64Data,
      },
    };

    const userInstructionText = userInstructions && userInstructions.trim() !== ''
      ? `\n\nCRITICAL USER INSTRUCTIONS TO OBSERVE FOR THIS DOCUMENT EXTRACTION:\n"${userInstructions.trim()}"\nYou MUST strictly follow, apply, and prioritize these custom instructions over other heuristic extraction options. For example, if the user specifies a specific supplier/vendor name or brand, use that exact value for the extraction!`
      : '';

    const textPart = {
      text: `Analyze the document named "${filename}" received on date ${todayStr}.${userInstructionText}\nReturn values in JSON format matching the schema rules exactly.`,
    };

    let response: any;
    const maxRetries = 4;
    let delayMs = 2000;
    const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const currentModel = modelsToTry[(attempt - 1) % modelsToTry.length];
      try {
        console.log(`[Attempt ${attempt}/${maxRetries}] Processing extraction using model: ${currentModel}`);
        response = await ai.models.generateContent({
          model: currentModel,
          contents: { parts: [documentPart, textPart] },
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                clientName: {
                  type: Type.STRING,
                  description: "Clean name of the vendor, seller, or supplier company (اسم البائع أو المورد). Write in clean Arabic if written in Arabic. Format gracefully and prioritize exact matches from Known Client/Supplier names."
                },
                projectName: {
                  type: Type.STRING,
                  description: "The name of the project or construction site. Look for Project:, المشروع:, عملية:, بخصوص:. Default to 'عام' if not found or unclear."
                },
                receiptDate: {
                  type: Type.STRING,
                  description: "The official document or issue date in YYYY-MM-DD standard format. Use today's date if missing."
                },
                docType: {
                  type: Type.STRING,
                  description: "Must be exactly 'po'."
                },
                docNumber: {
                  type: Type.STRING,
                  description: "The PO number, Quote ID, or invoice number. Use 'N/A' if not found."
                },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      description: { type: Type.STRING, description: "Item or service description" },
                      quantity: { type: Type.NUMBER, description: "Quantity of items" },
                      unitPrice: { type: Type.NUMBER, description: "Price per unit" },
                      total: { type: Type.NUMBER, description: "Total line item price (qty * unitPrice)" },
                      brand: { type: Type.STRING, description: "Brand / manufacturer of the item, default to empty string if not found" },
                      unit: { type: Type.STRING, description: "Unit of measurement (e.g., عدد, متر, طن, لتر, علبة, Pcs, Unit). Default to 'عدد' if not found." }
                    },
                    required: ["description", "quantity", "unitPrice", "total"]
                  },
                  description: "List of rows or line items inside."
                },
                totalAmount: {
                  type: Type.NUMBER,
                  description: "Final invoice or quotation total sum."
                },
                currency: {
                  type: Type.STRING,
                  description: "Currency sign or code. E.g., EGP, USD, SAR"
                },
                notes: {
                  type: Type.STRING,
                  description: "Optional notes, terms, validity conditions, or payment schedules."
                },
                summary: {
                  type: Type.STRING,
                  description: "A very brief 1-sentence Arabic summary of what this is (e.g., 'أمر شراء لتوريد مستلزمات مكتبية وتجهيزات'."
                },
                dueDate: {
                  type: Type.STRING,
                  description: "The due date or payment deadline of the document in YYYY-MM-DD. Leave as empty string if not found."
                }
              },
              required: ["clientName", "projectName", "receiptDate", "docType", "docNumber", "items", "totalAmount", "currency", "summary"]
            }
          }
        });
        break;
      } catch (err: any) {
        const errorMsg = err.message || "";
        const isTransient = 
          err.status === 503 || 
          err.statusCode === 503 ||
          errorMsg.includes("503") ||
          errorMsg.includes("UNAVAILABLE") ||
          errorMsg.includes("high demand") ||
          errorMsg.includes("429") ||
          errorMsg.includes("ResourceExhausted") ||
          errorMsg.includes("rate limit") ||
          errorMsg.includes("overloaded") ||
          errorMsg.includes("temporary");

        if (isTransient && attempt < maxRetries) {
          console.warn(`[Warning] Gemini API transient error with model ${currentModel} (Attempt ${attempt}/${maxRetries}): ${errorMsg}. Retrying with next model in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          delayMs *= 2.0;
        } else {
          throw err;
        }
      }
    }

    const parsedText = response?.text || "{}";
    const data = JSON.parse(parsedText.trim());
    if (data) {
      if (data.clientName) {
        data.clientName = cleanBidiText(data.clientName);
      }
      if (data.projectName) {
        data.projectName = cleanBidiText(data.projectName);
      }
      if (data.docNumber) {
        data.docNumber = cleanBidiText(data.docNumber).replace(/^(PO|Quote|أمر شراء|عرض سعر|No\.?|Num\.?)\s*[:-]?\s*/i, '');
      }
      if (data.totalAmount !== undefined && data.totalAmount !== null) {
        data.totalAmount = parseSafePrecisionNumber(data.totalAmount);
      }
      
      if (Array.isArray(data.items)) {
        data.items.forEach((item: any) => {
          if (item.description) {
            item.description = cleanBidiText(item.description);
          }
          if (item.brand) {
            item.brand = cleanBidiText(item.brand);
          }
          
          item.quantity = parseSafePrecisionNumber(item.quantity);
          item.unitPrice = parseSafePrecisionNumber(item.unitPrice);
          item.total = parseSafePrecisionNumber(item.total || (item.quantity * item.unitPrice));
          
          if (item.unit) {
            const trimmed = String(item.unit).trim();
            if (trimmed === 'عئد' || trimmed === 'عئد.' || trimmed.includes('عئد')) {
              item.unit = 'عدد';
            } else {
              item.unit = trimmed;
            }
          } else {
            item.unit = 'عدد';
          }
        });
      }
    }
    return data;
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    throw new Error(`تعذر استخراج البيانات بواسطة الذكاء الاصطناعي: ${error.message}`);
  }
}

/**
 * SAVE AND CLASSIFY FILE ON DISK
 */
function classifyAndStoreFile(fileBuffer: Buffer, parsedData: any, originalName: string): { relativePath: string; absolutePath: string } {
  const sanitize = (name: string) => name.replace(/[\/\\?%*:|"<>\s]/g, "_").trim();
  
  const clientFolderName = sanitize(parsedData.clientName || "Unknown_Client");
  const projectFolderName = sanitize(parsedData.projectName || "عام");
  const dateStr = parsedData.receiptDate || new Date().toISOString().split("T")[0];
  const docTypeLabel = "PO";
  const docNumLabel = sanitize(parsedData.docNumber && parsedData.docNumber !== "N/A" ? parsedData.docNumber : "Ref_" + Math.random().toString(36).substr(2, 4));
  const fileExtension = path.extname(originalName) || ".pdf";
  
  const finalFilename = `${docTypeLabel}_${docNumLabel}__${clientFolderName}__${dateStr}${fileExtension}`;
  
  // Create and save to Project Directory (Primary directory and database index pointer)
  const projectDir = path.join(ORGANIZED_DIR, projectFolderName);
  if (!fs.existsSync(projectDir)) {
    try {
      fs.mkdirSync(projectDir, { recursive: true });
    } catch (e) {}
  }
  const projectPath = path.join(projectDir, finalFilename);
  try {
    fs.writeFileSync(projectPath, fileBuffer);
  } catch (err) {
    console.warn("Could not write file to primary project folder (read-only system):", err);
  }

  // In addition, also save to Client/Supplier Directory for local browsing options
  const clientDir = path.join(ORGANIZED_DIR, clientFolderName);
  if (!fs.existsSync(clientDir)) {
    try {
      fs.mkdirSync(clientDir, { recursive: true });
    } catch (e) {}
  }
  const clientPath = path.join(clientDir, finalFilename);
  try {
    fs.writeFileSync(clientPath, fileBuffer);
  } catch (err) {
    console.warn("Could not copy file to additional client directory (read-only system):", err);
  }
  
  const relativePath = `/data/organized/${projectFolderName}/${finalFilename}`;
  return {
    relativePath,
    absolutePath: projectPath
  };
}

/**
 * Uploads a file to Supabase inside "POs Files" bucket, raising strict errors on failure.
 */
async function uploadToSupabaseStorage(
  fileBuffer: Buffer,
  mimetype: string,
  parsedData: any,
  originalName: string
): Promise<{ path: string; isCloud: boolean }> {
  // Compress if image first
  const { buffer: processedBuffer, mimetype: processedMimetype } = await compressImageIfNeed(fileBuffer, mimetype);
  
  // Determine file extension
  let fileExtension = path.extname(originalName) || ".pdf";
  if (mimetype.startsWith("image/") && processedMimetype === "image/jpeg") {
    fileExtension = ".jpg";
  }

  // 1. استخراج رقم الـ PO الفعلي وتحويله لرقم نظيف (مثال: 11)
  const poNo = parsedData.docNumber;
  const poNumber = (poNo && poNo.toString().replace(/[^0-9]/g, '')) || '11'; 

  // 2. توليد طابع زمني فريد بالملي ثانية لمنع تكرار الأسماء
  const timestamp = Date.now();

  // 3. بناء اسم ملف رقمي وإنجليزي نظيف تماماً وخالٍ من أي تعقيدات
  const finalStoragePath = `PO-${poNumber}-${timestamp}${fileExtension}`;
  const supabasePath = finalStoragePath;
  
  if (!supabaseClient) {
    const errMsg = "Supabase Client is not initialized! Please make sure SUPABASE_URL and SUPABASE_ANON_KEY env variables are provided.";
    console.error(errMsg);
    throw new Error(errMsg);
  }
  
  try {
    const bucketName = "POs Files";
    console.log(`Uploading file ${supabasePath} to Supabase bucket "${bucketName}"...`);
    
    // Convert Buffer to real Blob as requested
    const fileBlob = new globalThis.Blob([processedBuffer], { type: processedMimetype });
    
    // Ensure content type is explicitly specified
    let finalMimetype = processedMimetype;
    if (fileExtension.toLowerCase() === '.pdf') {
      finalMimetype = 'application/pdf';
    }
    
    const { data, error } = await supabaseClient.storage
      .from(bucketName)
      .upload(supabasePath, fileBlob, {
        contentType: finalMimetype,
        upsert: true
      });
      
    if (error) {
      console.error(`Supabase Client upload API returned an error for path [${supabasePath}]:`, error);
      throw error;
    }
    
    // Get Public URL
    const { data: publicUrlData } = supabaseClient.storage
      .from(bucketName)
      .getPublicUrl(supabasePath);
      
    console.log(`Successfully uploaded to Supabase Storage inside bucket "${bucketName}"! Public URL: ${publicUrlData.publicUrl}`);
    return {
      path: publicUrlData.publicUrl,
      isCloud: true
    };
  } catch (err: any) {
    const failedMsg = `فشل رفع الملف إلى المخزن السحابي (Supabase Storage): ${err.message || 'فشل غير متوقع'}`;
    console.error(failedMsg, err);
    throw new Error(failedMsg);
  }
}

// REST API ENDPOINTS

// 1. Fetch system statistics & document list
app.get("/api/documents", async (req, res) => {
  try {
    await fetchAndSyncDbFromMongo();
    checkForUpcomingDueDates();
    const db = getDb();
    res.json({
      documents: db.documents || [],
      notifications: db.notifications || [],
      telegramConfig: db.telegramConfig || { botToken: "", isWebhookSet: false, botUsername: null, webhookUrl: "" },
      projects: db.projects || [],
      suppliers: db.suppliers || []
    });
  } catch (err: any) {
    console.error("Fetch documents error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/projects/add", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "اسم المشروع مطلوب" });
    }
    const cleanName = name.trim();
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    const projects = db.projects || [];
    if (!projects.some((p: string) => p.toLowerCase() === cleanName.toLowerCase())) {
      db.projects = [...projects, cleanName];
      saveDb(db);

      // Add to MongoDB Atlas as well if connected
      if (mongoose.connection.readyState === 1) {
        try {
          const exists = await Project.findOne({ name: cleanName });
          if (!exists) {
            await Project.create({ name: cleanName });
            console.log(`Successfully auto-added project to MongoDB: ${cleanName}`);
          }
        } catch (mErr: any) {
          console.warn("MongoDB auto-update on project add failed:", mErr.message);
        }
      }
    }
    res.json({ success: true, projects: db.projects });
  } catch (error: any) {
    console.error("Add project error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/projects/rename", async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName || typeof oldName !== "string" || typeof newName !== "string") {
      return res.status(400).json({ error: "الاسم القديم والجديد مطلوبان" });
    }
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanOld || !cleanNew) {
      return res.status(400).json({ error: "الأسماء غير صالحة" });
    }
    
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    // Rename in list
    if (db.projects) {
      db.projects = db.projects.map((p: string) => p === cleanOld ? cleanNew : p);
    }
    
    // Rename in documents
    if (db.documents && Array.isArray(db.documents)) {
      db.documents.forEach((doc: any) => {
        if (doc.projectName === cleanOld) {
          doc.projectName = cleanNew;
        }
      });
    }
    
    saveDb(db);
    
    // Update in MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await Project.updateOne({ name: cleanOld }, { name: cleanNew });
      } catch (err) {
        console.error("MongoDB Project update error:", err);
      }
    }
    
    res.json({ success: true, projects: db.projects });
  } catch (error: any) {
    console.error("Rename project error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/projects/delete", async (req, res) => {
  try {
    const { name, deleteDocuments } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "اسم المشروع مطلوب" });
    }
    const cleanName = name.trim();
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    // Remove from projects list
    if (db.projects) {
      db.projects = db.projects.filter((p: string) => p !== cleanName);
    }
    
    // Handle associated documents
    if (db.documents && Array.isArray(db.documents)) {
      if (deleteDocuments === true) {
        db.documents.forEach((doc: any) => {
          if (doc.projectName === cleanName && doc.classifiedPath) {
            try {
              const absPath = path.join(DATA_DIR, doc.classifiedPath.replace(/^\/data\//, ""));
              if (fs.existsSync(absPath)) {
                fs.unlinkSync(absPath);
              }
            } catch (err) {
              console.warn("Could not delete file associated with project:", err);
            }
          }
        });
        db.documents = db.documents.filter((doc: any) => doc.projectName !== cleanName);
      } else {
        db.documents.forEach((doc: any) => {
          if (doc.projectName === cleanName) {
            doc.projectName = "عام";
          }
        });
      }
    }
    
    saveDb(db);
    
    // Delete in MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await Project.deleteOne({ name: cleanName });
      } catch (err) {
        console.error("MongoDB Project delete error:", err);
      }
    }
    
    res.json({ success: true, projects: db.projects });
  } catch (error: any) {
    console.error("Delete project error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/suppliers/add", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "اسم المورد مطلوب" });
    }
    const cleanName = name.trim();
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    const suppliers = db.suppliers || [];
    if (!suppliers.some((s: string) => s.toLowerCase() === cleanName.toLowerCase())) {
      db.suppliers = [...suppliers, cleanName];
      saveDb(db);
    }
    res.json({ success: true, suppliers: db.suppliers });
  } catch (error: any) {
    console.error("Add supplier error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/suppliers/rename", async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName || typeof oldName !== "string" || typeof newName !== "string") {
      return res.status(400).json({ error: "الاسم القديم والجديد مطلوبان" });
    }
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanOld || !cleanNew) {
      return res.status(400).json({ error: "الأسماء غير صالحة" });
    }
    
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    // Rename in suppliers list
    if (db.suppliers) {
      // replace or filter out oldName and insert newName if not already present
      let updated = db.suppliers.map((s: string) => s === cleanOld ? cleanNew : s);
      // Ensure uniqueness
      updated = updated.filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
      db.suppliers = updated;
    } else {
      db.suppliers = [cleanNew];
    }
    
    // Rename clientName in documents
    if (db.documents && Array.isArray(db.documents)) {
      db.documents.forEach((doc: any) => {
        if (doc.clientName === cleanOld) {
          doc.clientName = cleanNew;
        }
      });
    }
    
    saveDb(db);
    res.json({ success: true, suppliers: db.suppliers });
  } catch (error: any) {
    console.error("Rename supplier error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/suppliers/delete", async (req, res) => {
  try {
    const { name, deleteDocuments } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "اسم المورد مطلوب" });
    }
    const cleanName = name.trim();
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    // Remove from suppliers list
    if (db.suppliers) {
      db.suppliers = db.suppliers.filter((s: string) => s !== cleanName);
    }
    
    // Handle associated documents
    if (db.documents && Array.isArray(db.documents)) {
      if (deleteDocuments === true) {
        db.documents.forEach((doc: any) => {
          if (doc.clientName === cleanName && doc.classifiedPath) {
            try {
              const absPath = path.join(DATA_DIR, doc.classifiedPath.replace(/^\/data\//, ""));
              if (fs.existsSync(absPath)) {
                fs.unlinkSync(absPath);
              }
            } catch (err) {
              console.warn("Could not delete file associated with supplier:", err);
            }
          }
        });
        db.documents = db.documents.filter((doc: any) => doc.clientName !== cleanName);
      } else {
        db.documents.forEach((doc: any) => {
          if (doc.clientName === cleanName) {
            doc.clientName = "غير محدد";
          }
        });
      }
    }
    
    saveDb(db);
    res.json({ success: true, suppliers: db.suppliers });
  } catch (error: any) {
    console.error("Delete supplier error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/units/rename", async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName || typeof oldName !== "string" || typeof newName !== "string") {
      return res.status(400).json({ error: "الاسم القديم والجديد مطلوبان" });
    }
    const cleanOld = oldName.trim();
    let cleanNew = newName.trim();
    if (cleanNew === 'عئد' || cleanNew === 'عئد.' || cleanNew.includes('عئد')) {
      cleanNew = 'عدد';
    }
    if (!cleanOld || !cleanNew) {
      return res.status(400).json({ error: "الأسماء غير صالحة" });
    }
    
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    // Rename unit in all items of documents
    let updatedCount = 0;
    if (db.documents && Array.isArray(db.documents)) {
      db.documents.forEach((doc: any) => {
        if (Array.isArray(doc.items)) {
          doc.items.forEach((item: any) => {
            const itemUnit = (item.unit || "").trim();
            if (itemUnit === cleanOld || itemUnit === 'عئد' || itemUnit === 'عئد.' || itemUnit.includes('عئد')) {
              item.unit = cleanNew;
              updatedCount++;
            }
          });
        }
      });
    }
    
    saveDb(db);
    res.json({ success: true, updatedCount });
  } catch (error: any) {
    console.error("Rename unit error:", error);
    res.status(500).json({ error: error.message });
  }
});

function getNextPoNumberForProject(db: any, projectName: string): string {
  const cleanProj = (projectName || "عام").trim();
  const projectPos = (db.documents || []).filter(
    (d: any) => d.docType === 'po' && (d.projectName || 'عام').trim() === cleanProj
  );
  
  let maxNum = 0;
  projectPos.forEach((d: any) => {
    if (d.docNumber) {
      const cleanStr = d.docNumber.replace(/[^\d]/g, '');
      const num = parseInt(cleanStr, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });

  if (maxNum > 0) {
    return String(maxNum + 1);
  }

  let globalMax = 0;
  (db.documents || []).filter((d: any) => d.docType === 'po').forEach((d: any) => {
    if (d.docNumber) {
      const cleanStr = d.docNumber.replace(/[^\d]/g, '');
      const num = parseInt(cleanStr, 10);
      if (!isNaN(num) && num > globalMax) {
        globalMax = num;
      }
    }
  });

  if (globalMax > 0) {
    return String(globalMax + 1);
  }

  return "11";
}

// 2. Direct client file upload & parsing
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم تحديد أي ملف للرفع." });
    }

    await fetchAndSyncDbFromMongo();
    const { buffer, mimetype, originalname } = req.file;
    const userInstructions = req.body.instructions || req.body.notes || "";
    
    let extractedData: any;
    let extractionFailed = false;
    try {
      extractedData = await extractDataFromDocument(buffer, mimetype, originalname, userInstructions);
    } catch (err: any) {
      console.warn("Gemini extraction failed, creating a manual draft document instead:", err);
      extractionFailed = true;

      const clientNameFromFilename = originalname.replace(/\.[^/.]+$/, "").split(/[._-]/)[0] || "عميل غير محدد";

      extractedData = {
        clientName: clientNameFromFilename,
        projectName: "عام",
        receiptDate: new Date().toISOString().split("T")[0],
        docType: "po",
        docNumber: "DRAFT-" + Math.floor(Math.random() * 9000 + 1000),
        items: [] as any[],
        totalAmount: 0,
        currency: "EGP",
        notes: "تم تحويل هذا المستند تلقائياً إلى مسودة فارغة بسبب توقف مؤقت أو ضغط عالٍ على خدمة الذكاء الاصطناعي (Gemini 503). يرجى النقر على زر تعديل الصفوف لتعبئة البنود يدوياً.",
        summary: "تم الرفع كمسودة يدوية بسبب توقف مؤقت لخدمة جيميني.",
        dueDate: ""
      };
    }
    
    const db = getDb();
    
    let resolvedDocNumber = extractedData.docNumber;
    if (extractedData.docType === 'po') {
      resolvedDocNumber = getNextPoNumberForProject(db, extractedData.projectName || "عام");
    }
    
    const fileStorage = await uploadToSupabaseStorage(buffer, mimetype, { ...extractedData, docNumber: resolvedDocNumber }, originalname);

    const finalNotes = extractedData.notes || "";
    const resolvedNotes = userInstructions 
      ? `${finalNotes}\n[توجيهات الرفع والملحوظات]: ${userInstructions}`.trim()
      : finalNotes;

    const newDoc = {
      id: `doc_${Date.now()}`,
      clientName: extractedData.clientName,
      projectName: extractedData.projectName || "عام",
      receiptDate: extractedData.receiptDate,
      docType: extractedData.docType,
      docNumber: resolvedDocNumber,
      items: extractedData.items || [],
      totalAmount: extractedData.totalAmount || 0,
      currency: extractedData.currency || "EGP",
      originalFilename: originalname,
      classifiedPath: fileStorage.path,
      status: "processed" as const,
      processedAt: new Date().toISOString(),
      telegramUser: null,
      notes: resolvedNotes,
      summary: extractedData.summary || "",
      dueDate: extractedData.dueDate || "",
      extractionFailed: extractionFailed
    };

    const force = req.query.force === "true";
    if (!force) {
      const isDuplicate = (db.documents || []).find((d: any) => {
        const nameMatch = (d.clientName || "").trim().toLowerCase() === (extractedData.clientName || "").trim().toLowerCase();
        const amountMatch = Math.abs(parseFloat(String(d.totalAmount || 0)) - parseFloat(String(extractedData.totalAmount || 0))) < 0.01;
        const dateMatch = (d.receiptDate || "").trim().substring(0, 10) === (extractedData.receiptDate || "").trim().substring(0, 10);
        return nameMatch && amountMatch && dateMatch;
      });

      if (isDuplicate) {
        return res.json({
          success: true,
          duplicateDetected: true,
          existingDocument: isDuplicate,
          proposedDocument: newDoc
        });
      }
    }
    
    db.documents = [newDoc, ...(db.documents || [])];
    saveDb(db);
    
    if (extractionFailed) {
      triggerNotification(
        "warning",
        "تنبيه: تم الرفع كمسودة يدوية",
        `تعذر تحليل المستند "${originalname}" تلقائياً بسبب ضغط الخدمة. تم حفظه كمسودة قابلة للتعديل.`
      );
    } else {
      triggerNotification(
        "success",
        "مستند جديد: أمر شراء",
        `تم استلام مستند من العميل "${extractedData.clientName}" بقيمة ${extractedData.totalAmount} ${extractedData.currency} وتصنيفه بنجاح!`
      );
    }

    res.json({ success: true, document: newDoc });
  } catch (error: any) {
    console.error("Upload handler error:", error);
    try {
      triggerNotification("error", "فشل رفع المستند", `حدث خطأ أثناء محاولة رفع الملف: ${error.message}`);
    } catch (e) {}
    res.status(500).json({ error: error.message });
  }
});

// 2a. Direct upload for generated pdf copies from front-end
app.post("/api/documents/upload-generated-pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم تحديد أي ملف." });
    }
    const { documentId, projectName, vendorName, docNumber } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: "مُعرّف المستند مطلوب." });
    }

    const { buffer, mimetype, originalname } = req.file;

    await fetchAndSyncDbFromMongo();
    const db = getDb();

    // 1. استخراج رقم الـ PO الفعلي وتحويله لرقم نظيف (مثال: 11)
    const poNo = docNumber;
    const poNumber = (poNo && poNo.toString().replace(/[^0-9]/g, '')) || '11'; 

    // 2. تنظيف وبناء المجلدات المتداخلة بشكل صارم (Nested Folders Fix)
    const folderProject = cleanFolderName(projectName || "عام");
    const folderVendor = cleanFolderName(vendorName || "Unknown-Client");
    const finalZipPath = `${folderProject}/${folderVendor}/PO-${poNumber}-${Date.now()}.zip`;
    const supabasePath = finalZipPath;

    if (!supabaseClient) {
      const errMsg = "Supabase Client is not initialized! Please make sure SUPABASE_URL and SUPABASE_ANON_KEY are set.";
      console.error(errMsg);
      throw new Error(errMsg);
    }

    const bucketName = "POs Files";
    console.log(`Uploading generated ZIP to path "${supabasePath}" in bucket "${bucketName}"...`);

    // Create a real Blob for Supabase as requested
    const fileBlob = new globalThis.Blob([buffer], { type: "application/zip" });

    const { data, error } = await supabaseClient.storage
      .from(bucketName)
      .upload(supabasePath, fileBlob, {
        contentType: 'application/zip',
        upsert: true
      });

    if (error) {
      console.error(`Supabase Client upload API error for generated ZIP:`, error);
      throw error;
    }

    // Get Public URL
    const { data: publicUrlData } = supabaseClient.storage
      .from(bucketName)
      .getPublicUrl(supabasePath);

    const publicUrl = publicUrlData.publicUrl;
    console.log(`Successfully uploaded generated ZIP to ${publicUrl}`);

    // Update document record in database
    const docIdx = (db.documents || []).findIndex((d: any) => d.id === documentId);
    if (docIdx !== -1) {
      db.documents[docIdx].classifiedPath = publicUrl;
      db.documents[docIdx].status = "processed";
      saveDb(db);
    } else {
      console.warn(`Could not find document with ID ${documentId} to update its classifiedPath.`);
    }

    res.json({ success: true, publicUrl });
  } catch (err: any) {
    const failedMsg = `فشل رفع نسخة الـ PDF إلى المخزن السحابي (Supabase Storage): ${err.message || 'فشل غير متوقع'}`;
    console.error(failedMsg, err);
    res.status(500).json({ error: failedMsg });
  }
});

// 2b. Confirm potential duplicate (proceed or merge)
app.post("/api/upload/confirm", async (req, res) => {
  try {
    const { action, proposedDocument, existingId } = req.body;
    if (!action || !proposedDocument) {
      return res.status(400).json({ error: "البيانات المدخلة غير كاملة للتأكيد." });
    }

    await fetchAndSyncDbFromMongo();
    const db = getDb();

    if (action === "proceed") {
      db.documents = [proposedDocument, ...(db.documents || [])];
      saveDb(db);

      triggerNotification(
        "success",
        `تم حفظ المستند كنسخة مكررة`,
        `تم تأكيد حفظ المستند من العميل "${proposedDocument.clientName}" بقيمة ${proposedDocument.totalAmount} ${proposedDocument.currency} رغم تكراره.`
      );

      return res.json({ success: true, document: proposedDocument });
    } else if (action === "merge") {
      if (!existingId) {
        return res.status(400).json({ error: "معرف المستند الحالي مطلوب للدمج." });
      }

      const existingDocIdx = (db.documents || []).findIndex((d: any) => d.id === existingId);
      if (existingDocIdx === -1) {
        return res.status(404).json({ error: "المستند الأصلي غير موجود لدمج البيانات فيه." });
      }

      const existingDoc = db.documents[existingDocIdx];
      
      const mergedItems = [...(existingDoc.items || []), ...(proposedDocument.items || [])];
      const newTotalAmount = parseFloat(String(existingDoc.totalAmount || 0)) + parseFloat(String(proposedDocument.totalAmount || 0));
      const mergeNote = `\n[تحديث]: تم دمج بنود من الملف المرفق: ${proposedDocument.originalFilename} بتاريخ ${new Date().toLocaleDateString('ar-EG')}.`;
      
      db.documents[existingDocIdx] = {
        ...existingDoc,
        items: mergedItems,
        totalAmount: newTotalAmount,
        notes: (existingDoc.notes || "") + mergeNote,
        summary: (existingDoc.summary || "تم دمج البنود تلقائياً") + ` (تم دمج بنود ملف ${proposedDocument.originalFilename})`
      };

      saveDb(db);

      triggerNotification(
        "success",
        `تم دمج بنود المستند بنجاح`,
        `تم دمج بنود المستند الجديد مع المستند الحالي للعميل "${existingDoc.clientName}".`
      );

      return res.json({ success: true, document: db.documents[existingDocIdx], merged: true });
    } else {
      return res.status(400).json({ error: "إجراء غير معروف." });
    }
  } catch (error: any) {
    console.error("Confirm upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Serve physical categorized files for browser downloads/preview
app.get("/api/documents/download", (req, res) => {
  const filePathStr = req.query.path as string;
  if (!filePathStr) {
    return res.status(400).json({ error: "مسار الملف مطلوب" });
  }
  
  if (filePathStr.startsWith("http://") || filePathStr.startsWith("https://")) {
    return res.redirect(filePathStr);
  }
  
  const normalizedRequestedPath = path.normalize(filePathStr).replace(/^(\.\.(\/|\\|$))+/, '');
  const cleanPath = path.join(DATA_DIR, normalizedRequestedPath.replace(/^\/data\//, ""));
  
  if (fs.existsSync(cleanPath) && fs.statSync(cleanPath).isFile()) {
    return res.sendFile(cleanPath);
  } else {
    return res.status(404).json({ error: "المستند غير موجود في مخزن التصنيف." });
  }
});

// 4. Manual database edits (Add/Update/Delete rows inline like Excel)
app.post("/api/documents/update", async (req, res) => {
  try {
    const { documents } = req.body;
    if (!Array.isArray(documents)) {
      return res.status(400).json({ error: "تنسيق البيانات غير صحيح." });
    }
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    const oldDocs = db.documents || [];
    
    const updatedDocs = documents.map((doc: any) => {
      const oldDoc = oldDocs.find((d: any) => d.id === doc.id);
      if (!oldDoc) return doc;
      if (!oldDoc.classifiedPath) return doc;

      const clientChanged = (oldDoc.clientName || "").trim() !== (doc.clientName || "").trim();
      const projectChanged = (oldDoc.projectName || "").trim() !== (doc.projectName || "").trim();
      const dateChanged = (oldDoc.receiptDate || "").trim() !== (doc.receiptDate || "").trim();
      const docTypeChanged = (oldDoc.docType || "").trim() !== (doc.docType || "").trim();
      const docNumChanged = (oldDoc.docNumber || "").trim() !== (doc.docNumber || "").trim();

      if (clientChanged || projectChanged || dateChanged || docTypeChanged || docNumChanged) {
        const sanitize = (name: string) => name.replace(/[\/\\?%*:|"<>\s]/g, "_").trim();
        const oldRelative = oldDoc.classifiedPath;
        const oldCleanProjectFilePath = path.join(DATA_DIR, oldRelative.replace(/^\/data\//, ""));

        const clientFolderName = sanitize(doc.clientName || "Unknown_Client");
        const projectFolderName = sanitize(doc.projectName || "عام");
        const dateStr = doc.receiptDate || new Date().toISOString().split("T")[0];
        const docTypeLabel = "PO";
        const docNumLabel = sanitize(doc.docNumber && doc.docNumber !== "N/A" ? doc.docNumber : "Ref_" + Math.random().toString(36).substr(2, 4));
        const fileExtension = path.extname(doc.originalFilename || oldDoc.originalFilename || ".pdf") || ".pdf";

        const newFilename = `${docTypeLabel}_${docNumLabel}__${clientFolderName}__${dateStr}${fileExtension}`;

        const newProjectDir = path.join(ORGANIZED_DIR, projectFolderName);
        if (!fs.existsSync(newProjectDir)) {
          try {
            fs.mkdirSync(newProjectDir, { recursive: true });
          } catch (e) {}
        }
        const newProjectFilePath = path.join(newProjectDir, newFilename);

        const newClientDir = path.join(ORGANIZED_DIR, clientFolderName);
        if (!fs.existsSync(newClientDir)) {
          try {
            fs.mkdirSync(newClientDir, { recursive: true });
          } catch (e) {}
        }
        const newClientFilePath = path.join(newClientDir, newFilename);

        if (fs.existsSync(oldCleanProjectFilePath) && fs.statSync(oldCleanProjectFilePath).isFile()) {
          try {
            const fileBuffer = fs.readFileSync(oldCleanProjectFilePath);

            try {
              fs.unlinkSync(oldCleanProjectFilePath);
            } catch (err) {
              console.warn("Could not delete old project file:", err);
            }

            const oldClientFolderName = sanitize(oldDoc.clientName || "Unknown_Client");
            const oldFilename = path.basename(oldCleanProjectFilePath);
            const oldClientFilePath = path.join(ORGANIZED_DIR, oldClientFolderName, oldFilename);
            if (fs.existsSync(oldClientFilePath)) {
              try {
                fs.unlinkSync(oldClientFilePath);
              } catch (err) {
                console.warn("Could not delete old client file copy:", err);
              }
            }

            try {
              fs.writeFileSync(newProjectFilePath, fileBuffer);
              fs.writeFileSync(newClientFilePath, fileBuffer);
            } catch (writeErr) {
              console.warn("Could not write renamed files (expected in read-only setups):", writeErr);
            }

            doc.classifiedPath = `/data/organized/${projectFolderName}/${newFilename}`;
          } catch (renameErr) {
            console.error("Physical rename failed:", renameErr);
          }
        }
      }

      return doc;
    });

    db.documents = updatedDocs;
    saveDb(db);
    res.json({ success: true, documents: updatedDocs });
  } catch (error: any) {
    console.error("Update documents database error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Clear notifications
app.post("/api/notifications/clear", async (req, res) => {
  try {
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    db.notifications = [];
    saveDb(db);
    res.json({ success: true, notifications: [] });
  } catch (error: any) {
    console.error("Clear notifications error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Export the app
export default app;

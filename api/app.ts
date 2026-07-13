import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import mongoose from "mongoose";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let supabaseClient: any = null;
let supabaseAdminClient: any = null;
let isSupabaseDevicesDisabled = false;

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

function checkSupabaseKeysConfig(): { isValid: boolean; error?: string } {
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
        error: "تنبيه هام: لقد قمت بوضع مفتاح الـ ANON_KEY (المفتاح العام) في خانة مفتاح الخدمة SUPABASE_SERVICE_ROLE_KEY. يرجى الذهاب إلى إعدادات السيرفر واستبداله بمفتاح الـ service_role السري الخاص بـ Supabase (Settings -> API -> service_role) لتفعيل صلاحيات الأدمن."
      };
    }
  }

  const anonPayload = getJwtPayload(anonKey);
  if (anonPayload) {
    const role = anonPayload.role || "";
    if (role === "service_role") {
      return {
        isValid: false,
        error: "تنبيه هام: لقد قمت بوضع مفتاح الأدمن service_role السري في خانة مفتاح الـ SUPABASE_ANON_KEY (المفتاح العام). هذا يشكل خطراً أمنياً على مشروعك. يرجى تبديل المفاتيح ووضع كل مفتاح في خانته الصحيحة."
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

function getSupabaseClient() {
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

function getSupabaseAdminClient() {
  const url = (process.env.SUPABASE_URL || supabaseUrl || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseServiceRoleKey || "").trim();
  
  console.log(`[Supabase Admin Debug] getSupabaseAdminClient called. Current env URL: ${url ? url.substring(0, 20) + "..." : "empty"}, Key: ${maskKey(key)}`);

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

// Initial checks at startup
getSupabaseClient();
getSupabaseAdminClient();

// دالة صارمة لتنظيف الأسماء من أي رموز خاصة أو مسافات زائدة
function transliteratedArabic(text: string): string {
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
}

function sanitizeStorageName(name: any): string {
  if (!name) return 'unnamed';
  const nameStr = name.toString().trim();
  const cleanStr = transliteratedArabic(nameStr);
  let sanitized = cleanStr
    .replace(/[\s_/\-\\–—]+/g, '-') // تحويل المسافات والعواض المزدوجة إلى عارضة مفردة
    .replace(/[^a-zA-Z0-9\-]/g, '') // الحفاظ فقط على الحروف والأرقام والعواض الإنجليزية النظيفة لمنع مشاكل الـ Invalid key
    .replace(/-+/g, '-') // منع تكرار العوارض المتتالية
    .replace(/^-+|-+$/g, ''); // إزالة العوارض الطرفية
    
  if (!sanitized) {
    sanitized = Buffer.from(nameStr).toString('hex').substring(0, 8);
  }
  return sanitized || 'unnamed';
}

const translationCache: { [key: string]: string } = {};
const commonTranslations: { [key: string]: string } = {
  'عام': 'general',
  'الشركة': 'company',
  'رواد للتوكيلات التجارية': 'Rowad-Commercial-Agencies',
  'رواد': 'Rowad',
  'الرواد': 'Al-Rowad'
};

async function getEnglishSlug(arabicName: any): Promise<string> {
  if (!arabicName) return 'unnamed';
  const trimmed = arabicName.toString().trim();
  if (!trimmed) return 'unnamed';

  if (commonTranslations[trimmed]) {
    return commonTranslations[trimmed];
  }

  if (translationCache[trimmed]) {
    return translationCache[trimmed];
  }

  const isEnglishOrNumbers = /^[a-zA-Z0-9\s_\-\.\(\)]+$/.test(trimmed);
  if (isEnglishOrNumbers) {
    const slug = trimmed
      .replace(/[\s_/\-\\–—]+/g, '-')
      .replace(/[^a-zA-Z0-9\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    translationCache[trimmed] = slug || 'unnamed';
    return translationCache[trimmed];
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && ai) {
    try {
      console.log(`[Translation] Translating "${trimmed}" to English using Gemini...`);
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are an expert translator translating Arabic company, vendor, and project names to their professional, direct English counterparts.
Translate the following Arabic name to its proper English business or project name equivalent:
"${trimmed}"

Guidelines:
- Do NOT use phonetic transliteration (e.g. do NOT write 'Rwad' for 'رواد'). Instead, write the actual English meaning/equivalent (e.g. 'Rowad Commercial Agencies').
- Ensure it sounds professional and standard.
- Return ONLY the clean translated English name. No markdown, no explanations, no punctuation.`,
      });

      const text = response.text || "";
      const cleanedTranslation = text.trim();
      if (cleanedTranslation) {
        const slug = cleanedTranslation
          .replace(/[\s_/\-\\–—]+/g, '-')
          .replace(/[^a-zA-Z0-9\-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '');
          
        if (slug) {
          console.log(`[Translation] Successfully translated "${trimmed}" -> "${slug}"`);
          translationCache[trimmed] = slug;
          return slug;
        }
      }
    } catch (err: any) {
      console.warn(`[Translation] Gemini translation failed for "${trimmed}", falling back to transliteration:`, err.message);
    }
  }

  const cleanStr = transliteratedArabic(trimmed);
  let sanitized = cleanStr
    .replace(/[\s_/\-\\–—]+/g, '-')
    .replace(/[^a-zA-Z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!sanitized) {
    sanitized = Buffer.from(trimmed).toString('hex').substring(0, 8);
  }
  
  translationCache[trimmed] = sanitized || 'unnamed';
  return translationCache[trimmed];
}

function cleanFolderName(name: any): string {
  return sanitizeStorageName(name);
}

function sanitizeName(name: string, fallback: string = "unnamed"): string {
  return sanitizeStorageName(name) || fallback;
}

function sanitizePath(name: string, fallback: string = "unnamed"): string {
  return sanitizeStorageName(name) || fallback;
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

const allowedDeviceSchema = new mongoose.Schema({
  device_fingerprint: { type: String, required: true, unique: true },
  ip_address: { type: String },
  device_info: { type: String },
  status: { type: String, default: "pending" },
  role: { type: String, default: "user" },
  nickname: { type: String },
  device_name: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const AllowedDevice = mongoose.model("AllowedDevice", allowedDeviceSchema);

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, default: "user" }, // admin or user
  status: { type: String, default: "active" }, // active, blocked, etc.
  allowed_departments: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model("User", userSchema);

// 3. مصفوفة المشاريع الافتراضية الخاصة بك بالكامل دون أي نقص
const defaultProjects = [
  "Al Burouj - Sitewide",
  "Azailya",
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

let memoryDb: any = null;

function mapProjectNameToStandard(name: any): string {
  if (!name || typeof name !== "string") return "عام";
  const str = name.trim().toLowerCase();
  
  // HP / Hyde Park / هايد بارك
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

  // Al Burouj / البروج
  if (str.includes("burouj") || str.includes("brouj") || str.includes("البروج") || str.includes("بروج")) {
    if (str.includes("buffer") || str.includes("بفر") || str.includes("بافر") || str.includes("عازل") || str.includes("منطقة عازلة")) {
      return "Al Burouj - Buffer Zone";
    }
    if (str.includes("1.14") || str.includes("cgp") || str.includes("بارسل") || str.includes("parcel")) {
      return "Al Burouj - Parcel 1.14";
    }
    return "Al Burouj - Sitewide";
  }

  // June / جون
  if (str.includes("june") || str.includes("جون")) {
    if (str.includes("landscape") || str.includes("لاندسكيب") || str.includes("لاند سكيب") || str.includes("تجميل")) {
      return "June - Main Gate Landscape";
    }
    if (str.includes("gate") || str.includes("بوابة") || str.includes("البوابة") || str.includes("الرئيسية")) {
      return "June - Main Gate";
    }
    if (str.includes("parcel 2") || str.includes("2") || str.includes("٢")) {
      return "June - Parcel 2";
    }
    if (str.includes("parcel 1") || str.includes("maintrunk") || str.includes("main trunk") || str.includes("1") || str.includes("١")) {
      return "June - Parcel 1 & MainTrunk";
    }
    if (str.includes("parcel 6") || str.includes("6") || str.includes("٦")) {
      return "June - Parcel 6";
    }
    return "June - Main Gate";
  }

  // Azailya / ازيليا / Azalia
  if (str.includes("azailya") || str.includes("azalia") || str.includes("azelya") || str.includes("ازيليا") || str.includes("أزيليا")) {
    return "Azailya";
  }

  // EDNC
  if (str.includes("ednc") || str.includes("اي دي ان سي") || str.includes("إي دي إن سي")) {
    return "EDNC";
  }

  // The Estates / الاستيت
  if (str.includes("estates") || str.includes("الاستيت") || str.includes("ألايستيت") || str.includes("استيت")) {
    return "The Estates";
  }

  // Seoudi / سعودي
  if (str.includes("seoudi") || str.includes("سعودي")) {
    return "Seoudi Market";
  }

  const standardProjects = [
    "Al Burouj - Sitewide",
    "Azailya",
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

  const foundExact = standardProjects.find(p => p.toLowerCase() === str);
  if (foundExact) return foundExact;

  const foundPartial = standardProjects.find(p => str.includes(p.toLowerCase()));
  if (foundPartial) return foundPartial;

  return name;
}

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

async function seedAllRequiredUsers() {
  try {
    const db = getDb();
    const changed = ensureLocalUsersSeeded(db);
    if (changed) {
      saveDb(db);
      console.log("[Seeder] Local users successfully verified & seeded.");
    }

    const adminEmail = "khaled@delta.com";
    const userEmail = "user@delta.com";
    const hashedAdmin = bcrypt.hashSync("016135", 10);
    const hashedUser = bcrypt.hashSync("DeltaUser2026", 10);

    // MongoDB User Collection seed
    if (mongoose.connection.readyState === 1) {
      try {
        const mongoAdminExists = await User.findOne({ email: adminEmail });
        if (!mongoAdminExists) {
          await User.create({
            _id: "c45b9915-e6a3-4c65-81c5-b3206c6f3144",
            name: "خالد",
            email: adminEmail,
            password: hashedAdmin,
            role: "admin",
            status: "active"
          });
          console.log("[Seeder] Seeded Admin (Khaled) to MongoDB Atlas.");
        } else {
          let mongoChanged = false;
          if (mongoAdminExists.role !== "admin") {
            mongoAdminExists.role = "admin";
            mongoChanged = true;
          }
          if (mongoChanged) {
            await mongoAdminExists.save();
            console.log("[Seeder] Updated Admin (Khaled) role to 'admin' in MongoDB Atlas.");
          }
        }
        
        const mongoUserExists = await User.findOne({ email: userEmail });
        if (!mongoUserExists) {
          await User.create({
            name: "موظف عادي",
            email: userEmail,
            password: hashedUser,
            role: "user",
            status: "active"
          });
          console.log("[Seeder] Seeded standard user to MongoDB Atlas.");
        }
      } catch (mongoErr: any) {
        console.error("[Seeder] MongoDB user collection seed failed:", mongoErr.message);
      }
    }

    // Supabase Auth and database synchronization (Purge & Align)
    const adminClient = getSupabaseAdminClient();
    const publicClient = getSupabaseClient();

    if (adminClient) {
      try {
        console.log("[Seeder] Syncing database with Supabase Auth users using Admin Client...");
        const { data: { users: sbUsers }, error: listError } = await adminClient.auth.admin.listUsers();
        if (listError) {
          throw listError;
        }

        console.log(`[Seeder] Found ${sbUsers.length} users in Supabase Auth.`);

        // 1. Ensure Khaled exists in Supabase Auth with ID c45b9915-e6a3-4c65-81c5-b3206c6f3144
        const khaledSb = sbUsers.find((u: any) => u.email && u.email.toLowerCase() === adminEmail);
        if (!khaledSb) {
          console.log("[Seeder] Creating Khaled in Supabase Auth with exact ID...");
          const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
            id: "c45b9915-e6a3-4c65-81c5-b3206c6f3144",
            email: adminEmail,
            password: "016135",
            email_confirm: true,
            user_metadata: { name: "خالد", role: "admin" }
          });
          if (createErr) {
            console.error("[Seeder] Failed to create Khaled in Supabase Auth:", createErr.message);
          } else {
            console.log("[Seeder] Khaled successfully created in Supabase Auth!");
          }
        }

        // 2. Perform database purging of users that do not exist in Supabase Auth
        // As requested: "قم بمسح أي حسابات عشوائية زائدة في جدول قاعدة البيانات لا تملك حساباً حقيقياً في الـ Supabase Auth (مثل حساب daly@delta.com الظاهر في الجدول وغير موجود في الـ Auth)."
        const localDb = getDb();
        localDb.users = localDb.users || [];
        const originalCount = localDb.users.length;

        // Collect all valid emails from Supabase Auth
        const sbEmails = new Set<string>();
        sbUsers.forEach((u: any) => {
          if (u.email) sbEmails.add(u.email.toLowerCase());
        });
        // Always allow khaled
        sbEmails.add(adminEmail);
        // Also allow the default user@delta.com just in case Supabase is running locally/mocked
        sbEmails.add(userEmail);

        const initialLength = localDb.users.length;
        localDb.users = localDb.users.filter((u: any) => {
          if (!u.email) return false;
          const lowerEmail = u.email.toLowerCase();
          const existsInSb = sbEmails.has(lowerEmail);
          if (!existsInSb) {
            console.log(`[Seeder] Purging unsynced user from local database: ${u.email}`);
          }
          return existsInSb;
        });

        // 3. Keep local user IDs in sync with UIDs in Supabase Auth
        localDb.users.forEach((u: any) => {
          if (u.email && u.email.toLowerCase() === adminEmail) {
            u.id = "c45b9915-e6a3-4c65-81c5-b3206c6f3144";
            return;
          }
          const matchedSb = sbUsers.find((sb: any) => sb.email && sb.email.toLowerCase() === u.email.toLowerCase());
          if (matchedSb && u.id !== matchedSb.id) {
            console.log(`[Seeder] Syncing ID for ${u.email} to match Supabase Auth UID: ${matchedSb.id}`);
            u.id = matchedSb.id;
          }
        });

        if (localDb.users.length !== initialLength || originalCount !== localDb.users.length) {
          saveDb(localDb);
        }

        // Also purge from MongoDB
        if (mongoose.connection.readyState === 1) {
          try {
            const allMongoUsers = await User.find({});
            for (const mUser of allMongoUsers) {
              const mEmail = mUser.email.toLowerCase();
              if (mEmail !== adminEmail && mEmail !== userEmail && !sbEmails.has(mEmail)) {
                console.log(`[Seeder] Purging unsynced user from MongoDB: ${mUser.email}`);
                await User.deleteOne({ _id: mUser._id });
              }
            }
          } catch (mongoErr) {
            console.error("[Seeder] MongoDB purge failed:", mongoErr);
          }
        }
      } catch (sbErr: any) {
        console.warn("[Seeder] Supabase Admin sync error:", sbErr.message);
      }
    } else if (publicClient) {
      try {
        console.log("[Seeder] Attempting to verify/seed admin user in Supabase Auth (Anon)...");
        const { data: adminSb, error: adminSbError } = await publicClient.auth.signUp({
          email: adminEmail,
          password: "016135",
          options: {
            data: { name: "خالد", role: "admin" }
          }
        });
        if (adminSbError) {
          console.log(`[Seeder] Supabase Admin signup notice: ${adminSbError.message}`);
        } else {
          console.log("[Seeder] Supabase Admin signed up successfully!");
        }

        console.log("[Seeder] Attempting to verify/seed standard user in Supabase Auth (Anon)...");
        const { data: userSb, error: userSbError } = await publicClient.auth.signUp({
          email: userEmail,
          password: "DeltaUser2026",
          options: {
            data: { name: "موظف عادي", role: "user" }
          }
        });
        if (userSbError) {
          console.log(`[Seeder] Supabase standard user signup notice: ${userSbError.message}`);
        } else {
          console.log("[Seeder] Supabase standard user signed up successfully!");
        }
      } catch (sbErr: any) {
        console.warn("[Seeder] Supabase Auth seed failed:", sbErr.message);
      }
    }
  } catch (err: any) {
    console.error("[Seeder] General error seeding users:", err.message);
  }
}

// Run immediate background seed
seedAllRequiredUsers();

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

    // 2. تنظيف الـ collection الخاص بالمشاريع الفردية في أطلس ليتطابق تماماً مع القائمة المعتمدة
    await Project.deleteMany({ name: { $nin: defaultProjects } });
    console.log("Successfully cleaned up individual non-standard projects from MongoDB Collection!");
    
    // 3. بذر (Seed) المشاريع المعتمدة الجديدة في MongoDB Atlas
    for (const name of defaultProjects) {
      const exists = await Project.findOne({ name });
      if (!exists) {
        await Project.create({ name });
        console.log(`Successfully seeded project to MongoDB Atlas: ${name}`);
      }
    }
  } catch (err: any) {
    console.error("Error executing custom clean-up & seed script on MongoDB Atlas:", err.message);
  }

  // 4. One-time security reset: force logout of all devices on startup to satisfy request
  try {
    console.log("[Security Startup] Resetting all devices to 'pending' and 'user' to force them to log in again.");
    // 1. Local JSON DB
    const db = getDb();
    if (db.allowed_devices && Array.isArray(db.allowed_devices)) {
      db.allowed_devices = db.allowed_devices.map((d: any) => ({
        ...d,
        status: 'pending',
        role: 'user'
      }));
      saveDb(db);
    }

    // 2. MongoDB
    await AllowedDevice.updateMany({}, { status: 'pending', role: 'user' });

    // 3. Supabase
    if (supabaseClient && !isSupabaseDevicesDisabled) {
      try {
        const { data } = await supabaseClient.from('allowed_devices').select('device_fingerprint');
        if (data && data.length > 0) {
          for (const dev of data) {
            await supabaseClient
              .from('allowed_devices')
              .update({ status: 'pending', role: 'user' })
              .eq('device_fingerprint', dev.device_fingerprint);
          }
        }
      } catch (ex) {
        console.error("Supabase device reset error on startup:", ex);
      }
    }
    console.log("[Security Startup] All devices successfully reset to pending.");
  } catch (err: any) {
    console.error("[Security Startup] Error during device status reset:", err.message);
  }

  await fetchAndSyncDbFromMongo();

  // 5. Seed Users with Email/Password and Role (admin/user)
  await seedAllRequiredUsers();

  try {
    const db = getDb();
    let changed = false;

    // تهيئة القائمة بالكامل بالمشاريع المعتمدة الـ 15 دون تكرار
    db.projects = [...defaultProjects];
    changed = true;

    // تحديث وتصنيف كافة المستندات السابقة تلقائياً بالاعتماد على دالة الربط الذكية (Alias Mapping) لمنع التكرار البصري
    if (db.documents && Array.isArray(db.documents)) {
      db.documents.forEach((doc: any) => {
        if (doc.projectName) {
          const standard = mapProjectNameToStandard(doc.projectName);
          if (doc.projectName !== standard) {
            console.log(`[Auto-Mapping] Updating document ${doc.id} project from "${doc.projectName}" to standard "${standard}"`);
            doc.projectName = standard;
            changed = true;
          }
        }
      });
    }

    if (changed) {
      saveDb(db);
      console.log("Successfully mapped existing documents and seeded approved standard projects list.");
    }
  } catch (err) {
    console.error("Error syncing and seeding standard projects:", err);
  }
});

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

// Helpers to read/write database state
function cleanDatabaseDiagnosticsInternal(db: any) {
  try {
    if (!db) return;
    let changed = false;

    // 1. Ensure all standard projects are in db.projects and map them
    if (db.projects && Array.isArray(db.projects)) {
      const originalCount = db.projects.length;
      
      // Seed standard projects if missing
      for (const name of defaultProjects) {
        if (!db.projects.includes(name)) {
          db.projects.push(name);
          changed = true;
        }
      }
      
      // Map existing names
      const mappedProjects = db.projects.map((p: any) => mapProjectNameToStandard(p));
      // Deduplicate
      const uniqueProjects = Array.from(new Set(mappedProjects));
      if (uniqueProjects.length !== originalCount) {
        db.projects = uniqueProjects;
        changed = true;
      }
    }

    // 2. Update documents to use standard names using mapProjectNameToStandard
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
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
        console.log("[Auto-Clean] Database diagnostics cleaned up and mapped successfully.");
      } catch (e) {
        console.warn("Could not save auto-cleaned DB:", e);
      }
    }
  } catch (err) {
    console.error("[Auto-Clean] Error cleaning database diagnostics:", err);
  }
}

function ensureLocalUsersSeeded(db: any): boolean {
  if (!db) return false;
  db.users = db.users || [];
  let changed = false;

  const adminEmail = "khaled@delta.com";
  const userEmail = "user@delta.com";

  let adminUser = db.users.find((u: any) => u.email && u.email.toLowerCase() === adminEmail);
  if (!adminUser) {
    db.users.push({
      id: "c45b9915-e6a3-4c65-81c5-b3206c6f3144",
      name: "خالد",
      email: adminEmail,
      password: bcrypt.hashSync("016135", 10),
      role: "admin",
      status: "active",
      createdAt: new Date().toISOString()
    });
    changed = true;
  } else {
    if (adminUser.id !== "c45b9915-e6a3-4c65-81c5-b3206c6f3144") {
      adminUser.id = "c45b9915-e6a3-4c65-81c5-b3206c6f3144";
      changed = true;
    }
    if (adminUser.role !== "admin") {
      adminUser.role = "admin";
      changed = true;
    }
  }

  let userExists = db.users.some((u: any) => u.email && u.email.toLowerCase() === userEmail);
  if (!userExists) {
    db.users.push({
      id: "usr_user_1",
      name: "موظف عادي",
      email: userEmail,
      password: bcrypt.hashSync("DeltaUser2026", 10),
      role: "user",
      status: "active",
      createdAt: new Date().toISOString()
    });
    changed = true;
  }

  // Deduplicate user IDs to ensure strict uniqueness
  const seenIds = new Set<string>();
  db.users.forEach((u: any, idx: number) => {
    if (u.email && u.email.toLowerCase() === adminEmail) {
      u.id = "c45b9915-e6a3-4c65-81c5-b3206c6f3144";
      seenIds.add(u.id);
      return;
    }
    if (!u.id || seenIds.has(u.id)) {
      const generatedId = "usr_" + Date.now() + "_" + Math.floor(Math.random() * 1000) + "_" + idx;
      u.id = generatedId;
      changed = true;
    }
    seenIds.add(u.id);
  });

  return changed;
}

function getDb() {
  if (memoryDb) {
    const usersChanged = ensureLocalUsersSeeded(memoryDb);
    if (usersChanged) {
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), "utf-8");
      } catch (e) {}
    }
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

    const usersChanged = ensureLocalUsersSeeded(parsed);
    if (usersChanged) {
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
    ensureLocalUsersSeeded(fallback);
    memoryDb = fallback;
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(fallback, null, 2), "utf-8");
    } catch (e) {}
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

let lastMongoSyncTime = 0;

async function saveDbToSupabase(data: any) {
  const supabase = getSupabaseAdminClient() || getSupabaseClient();
  if (!supabase) {
    console.warn("[Supabase Sync] Cannot saveDb to Supabase: clients not initialized.");
    return;
  }
  try {
    const bucketName = "POs Files";
    const supabasePath = "db_backup/db.json";
    const jsonStr = JSON.stringify(data, null, 2);
    const buffer = Buffer.from(jsonStr, "utf-8");
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(supabasePath, buffer, {
        contentType: "application/json",
        upsert: true
      });
    if (error) {
      console.error("[Supabase Sync] Error uploading db.json backup to Supabase Storage:", error);
    } else {
      console.log("[Supabase Sync] Successfully backed up database to Supabase Storage: db_backup/db.json");
    }
  } catch (err: any) {
    console.error("[Supabase Sync] Exception uploading db.json backup:", err.message);
  }
}

async function saveDb(data: any) {
  if (data && data.documents) {
    data.documents = sanitizeAndExtractBrands(data.documents);
  }
  memoryDb = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not save to database file (expected in read-only Vercel serverless environments):", err);
  }

  // Prevent subsequent reads from Atlas or Supabase for the next 15 seconds to let this write fully propagate
  lastMongoSyncTime = Date.now() + 15000;

  // 1. Push backup to Supabase Storage
  try {
    await saveDbToSupabase(data);
  } catch (err: any) {
    console.error("[Supabase Sync] Background save to Supabase failed:", err.message);
  }

  // 2. Push to MongoDB Atlas asynchronously to keep all instances entirely in sync
  if (mongoose.connection.readyState === 1) {
    try {
      await AppState.updateOne(
        { key: "global_state" },
        { data: data },
        { upsert: true }
      );
    } catch (err: any) {
      console.error("Could not background save AppState to MongoDB:", err.message);
    }
  }
}

async function fetchAndSyncDbFromMongo() {
  // If we synced successfully recently (or wrote to it recently), use local memory cache to avoid unnecessary slow queries
  if (Date.now() - lastMongoSyncTime < 15000 && memoryDb) {
    return getDb();
  }

  // 1. Try loading from Supabase Storage (Primary Cloud Persistent State)
  const supabase = getSupabaseAdminClient() || getSupabaseClient();
  if (supabase) {
    try {
      const bucketName = "POs Files";
      const supabasePath = "db_backup/db.json";
      console.log(`[Supabase Sync] Attempting to download db.json from Supabase bucket "${bucketName}"...`);
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(supabasePath);
      
      if (!error && data) {
        const text = await data.text();
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          memoryDb = parsed;
          try {
            fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), "utf-8");
          } catch {}
          console.log("[Supabase Sync] Successfully loaded database state from Supabase Storage!");
          lastMongoSyncTime = Date.now();
          return memoryDb;
        }
      } else {
        console.warn("[Supabase Sync] db_backup/db.json not found in Supabase Storage, trying MongoDB Atlas fallback...");
      }
    } catch (err: any) {
      console.error("[Supabase Sync] Exception downloading db.json backup from Supabase:", err.message);
    }
  }

  // 2. Try loading from MongoDB Atlas (Fallback)
  if (mongoose.connection.readyState === 1) {
    try {
      const dbDoc = await AppState.findOne({ key: "global_state" });
      if (dbDoc && dbDoc.data) {
        memoryDb = dbDoc.data;
        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), "utf-8");
        } catch {}
        console.log("Successfully loaded database state from MongoDB Atlas!");
        lastMongoSyncTime = Date.now();
        
        // Push state to Supabase to keep them aligned
        await saveDbToSupabase(memoryDb);
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
          lastMongoSyncTime = Date.now();
          
          // Seed Supabase state
          await saveDbToSupabase(localDb);
        }
      }
    } catch (err: any) {
      console.warn("Could not load AppState from MongoDB Atlas, using fallback:", err.message);
    }
  }
  return getDb();
}

async function moveProjectStorageFolder(oldProjName: string, newProjName: string) {
  if (!supabaseClient) return;
  const bucketName = "POs Files";
  const oldProjFolder = await getEnglishSlug(oldProjName);
  const newProjFolder = await getEnglishSlug(newProjName);
  
  if (oldProjFolder === newProjFolder) return;
  
  try {
    console.log(`[Storage Move] Starting project folder rename from "${oldProjFolder}" to "${newProjFolder}"...`);
    
    // 1. List everything under oldProjFolder
    const { data: vendorFolders, error: listError } = await supabaseClient.storage
      .from(bucketName)
      .list(oldProjFolder);
      
    if (listError) {
      console.warn(`[Storage Move] Could not list subfolders in old project folder ${oldProjFolder}:`, listError.message);
      return;
    }
    
    if (!vendorFolders || vendorFolders.length === 0) {
      console.log(`[Storage Move] No files found inside old project folder ${oldProjFolder}`);
      return;
    }
    
    // For each vendor folder or file inside oldProjFolder
    for (const item of vendorFolders) {
      const folderName = item.name;
      const { data: files, error: filesError } = await supabaseClient.storage
        .from(bucketName)
        .list(`${oldProjFolder}/${folderName}`);
        
      if (filesError) {
        console.warn(`[Storage Move] Could not list files in ${oldProjFolder}/${folderName}:`, filesError.message);
        continue;
      }
      
      if (files && files.length > 0) {
        for (const file of files) {
          const fileName = file.name;
          // Skip placeholder
          if (fileName === '.emptyFolderPlaceholder') continue;
          
          const oldPath = `${oldProjFolder}/${folderName}/${fileName}`;
          const newPath = `${newProjFolder}/${folderName}/${fileName}`;
          
          console.log(`[Storage Move] Moving file from "${oldPath}" to "${newPath}"...`);
          const { error: moveError } = await supabaseClient.storage
            .from(bucketName)
            .move(oldPath, newPath);
            
          if (moveError) {
            console.error(`[Storage Move] Error moving ${oldPath} to ${newPath}:`, moveError.message);
          } else {
            const { data: publicUrlData } = supabaseClient.storage
              .from(bucketName)
              .getPublicUrl(newPath);
              
            const newUrl = publicUrlData.publicUrl;
            
            const db = getDb();
            let changed = false;
            if (db.documents && Array.isArray(db.documents)) {
              db.documents.forEach((doc: any) => {
                if (doc.projectName === newProjName && doc.classifiedPath && decodeURIComponent(doc.classifiedPath).includes(oldPath)) {
                  console.log(`[Storage Move] Updating doc ${doc.id} url to: ${newUrl}`);
                  doc.classifiedPath = newUrl;
                  changed = true;
                }
              });
            }
            if (changed) {
              saveDb(db);
            }
          }
        }
      }
    }
    console.log(`[Storage Move] Project folder rename from "${oldProjFolder}" to "${newProjFolder}" completed!`);
  } catch (err: any) {
    console.error("[Storage Move] Project rename storage move failed:", err.message);
  }
}

async function moveVendorStorageFolder(oldVendorName: string, newVendorName: string) {
  if (!supabaseClient) return;
  const bucketName = "POs Files";
  const oldVendorFolder = await getEnglishSlug(oldVendorName);
  const newVendorFolder = await getEnglishSlug(newVendorName);
  
  if (oldVendorFolder === newVendorFolder) return;
  
  try {
    console.log(`[Storage Move] Starting vendor folder rename from "${oldVendorFolder}" to "${newVendorFolder}"...`);
    
    const db = getDb();
    const projects = db.projects || [];
    
    for (const projName of projects) {
      const projFolder = await getEnglishSlug(projName);
      const oldVendorPath = `${projFolder}/${oldVendorFolder}`;
      const newVendorPath = `${projFolder}/${newVendorFolder}`;
      
      const { data: files, error: listError } = await supabaseClient.storage
        .from(bucketName)
        .list(oldVendorPath);
        
      if (listError) {
        // Folder doesn't exist for this project, ignore
        continue;
      }
      
      if (files && files.length > 0) {
        for (const file of files) {
          const fileName = file.name;
          if (fileName === '.emptyFolderPlaceholder') continue;
          
          const oldPath = `${oldVendorPath}/${fileName}`;
          const newPath = `${newVendorPath}/${fileName}`;
          
          console.log(`[Storage Move] Moving file from "${oldPath}" to "${newPath}"...`);
          const { error: moveError } = await supabaseClient.storage
            .from(bucketName)
            .move(oldPath, newPath);
            
          if (moveError) {
            console.error(`[Storage Move] Error moving ${oldPath} to ${newPath}:`, moveError.message);
          } else {
            const { data: publicUrlData } = supabaseClient.storage
              .from(bucketName)
              .getPublicUrl(newPath);
              
            const newUrl = publicUrlData.publicUrl;
            
            let changed = false;
            if (db.documents && Array.isArray(db.documents)) {
              db.documents.forEach((doc: any) => {
                if (doc.clientName === newVendorName && doc.classifiedPath && decodeURIComponent(doc.classifiedPath).includes(oldPath)) {
                  console.log(`[Storage Move] Updating doc ${doc.id} url to: ${newUrl}`);
                  doc.classifiedPath = newUrl;
                  changed = true;
                }
              });
            }
            if (changed) {
              saveDb(db);
            }
          }
        }
      }
    }
    console.log(`[Storage Move] Vendor folder rename from "${oldVendorFolder}" to "${newVendorFolder}" completed!`);
  } catch (err: any) {
    console.error("[Storage Move] Vendor rename storage move failed:", err.message);
  }
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
        data.projectName = mapProjectNameToStandard(cleanBidiText(data.projectName));
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
 * SPECIALIZED FINANCIAL DOCUMENT EXTRACTION HELPER
 */
async function extractFinancialFile(fileBuffer: Buffer, mimeType: string, filename: string, type: 'labor' | 'petty_cash' | 'subcontractor', userInstructions?: string): Promise<any> {
  if (!geminiApiKey) {
    throw new Error("لم يتم تكوين مفتاح API لجيميني (GEMINI_API_KEY). الرجاء إضافته في الإعدادات.");
  }

  const base64Data = fileBuffer.toString("base64");
  const todayStr = new Date().toISOString().split('T')[0];
  const db = getDb();
  const knownProjects = db.projects || ["June - Main Gate", "Al Burouj - Sitewide", "EDNC", "عام"];

  const documentPart = {
    inlineData: {
      mimeType: mimeType || "application/pdf",
      data: base64Data,
    },
  };

  let systemInstruction = "";
  let schemaProperties: any = {};
  let requiredFields: string[] = [];

  if (type === 'labor') {
    systemInstruction = `You are an expert AI accountant and timesheet/attendance processor.
Analyze the provided document (which is a timesheet, labor attendance sheet, or manual log in Arabic or English) and extract worker details.
Extract:
1. weekStartDate: The start date of the week in YYYY-MM-DD.
2. workerName: The daily wage worker's name (اسم العامل).
3. dailyRate: Daily wage rate (الفئة اليومية) as a number if mentioned.
4. overtimeRate: Overtime day or hour rate (فئة الإضافي) as a number if mentioned.
5. sohraRate: Sohra (evening) rate (فئة السهرة) as a number if mentioned.
6. days: An array of 7 objects representing the days of the week starting from Wednesday (الأربعاء) to Tuesday (الثلاثاء) in sequence. Each day object must contain:
   - dayName: Standard Arabic name (الأربعاء, الخميس, الجمعة, السبت, الأحد, الإثنين, الثلاثاء)
   - date: Calculated date in YYYY-MM-DD (extrapolated from weekStartDate + offset of the day)
   - attendance: Number of days worked (e.g., 0, 0.5, 1, 1.5, 2)
   - overtime: Number of overtime hours worked (number)
   - sohra: Number of sohra hours worked (number)
   - project: Project name. Map to one of known projects: ${JSON.stringify(knownProjects)} or default to 'الساحل' or 'البروج' or 'هايد بارك' if appropriate.`;

    schemaProperties = {
      weekStartDate: { type: Type.STRING, description: "Start date of the week in YYYY-MM-DD format." },
      workerName: { type: Type.STRING, description: "Full name of the worker." },
      dailyRate: { type: Type.NUMBER, description: "Daily wage rate if mentioned, default to 300." },
      overtimeRate: { type: Type.NUMBER, description: "Overtime day/hour rate if mentioned, default to 300." },
      sohraRate: { type: Type.NUMBER, description: "Sohra rate if mentioned, default to 45." },
      days: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            dayName: { type: Type.STRING, description: "Day name: الأربعاء, الخميس, الجمعة, السبت, الأحد, الإثنين, الثلاثاء" },
            date: { type: Type.STRING, description: "Date in YYYY-MM-DD format." },
            attendance: { type: Type.NUMBER, description: "Days attended: 0, 0.5, 1, 2 etc." },
            overtime: { type: Type.NUMBER, description: "Overtime hours: e.g. 0, 1, 2, 4" },
            sohra: { type: Type.NUMBER, description: "Sohra evening hours: e.g. 0, 1, 2" },
            project: { type: Type.STRING, description: "Project name mapped to known projects." }
          },
          required: ["dayName", "attendance", "overtime", "sohra", "project"]
        },
        description: "Must contain exactly 7 objects for the 7 days (Wednesday to Tuesday)."
      }
    };
    requiredFields = ["weekStartDate", "workerName", "days"];

  } else if (type === 'petty_cash') {
    systemInstruction = `You are an expert AI forensic accountant and petty cash OCR extractor.
Analyze this invoice, cash receipt, or transfer screenshot (e.g. Instapay receipt) and extract:
1. date: The payment or transaction date in YYYY-MM-DD format. Default to today if not found.
2. inflow: Inflow / received amount (المستلم / المدين) if this is a funding or cash-in transaction (number, else 0).
3. outflow: Outflow / spent amount (المصروفات / الدائن) if this is an expense or cash-out invoice/receipt (number, else 0).
4. description: A clear, complete Arabic explanation of what this payment represents (e.g. 'شراء مواسير حديد لموقع الساحل', 'تحويل رصيد نقدي عهدة للمهندس').
5. method: Payment method in Arabic, e.g., 'انستاباي', 'نقدي', 'شيك'.
6. project: Current project associated with this transaction. Map to one of known projects: ${JSON.stringify(knownProjects)}. Default to 'عام' if not clear.
7. engineer: Name of the engineer (اسم المهندس) if mentioned as recipient or payer or requester on the document. Choose from known engineers or extract the printed name.`;

    schemaProperties = {
      date: { type: Type.STRING, description: "Date in YYYY-MM-DD format." },
      inflow: { type: Type.NUMBER, description: "Inflow cash-in amount (number)." },
      outflow: { type: Type.NUMBER, description: "Outflow cash-out amount (number)." },
      description: { type: Type.STRING, description: "Arabic transaction description." },
      method: { type: Type.STRING, description: "Payment method: انستاباي, نقدي, شيك, إلخ." },
      project: { type: Type.STRING, description: "Project name matching known projects." },
      engineer: { type: Type.STRING, description: "Engineer name if found, default to empty string." }
    };
    requiredFields = ["date", "inflow", "outflow", "description", "method", "project"];

  } else if (type === 'subcontractor') {
    systemInstruction = `You are an expert AI civil engineering quantity surveyor and subcontractor certificate auditor.
Analyze this subcontractor contract, work statement, or measurement sheet (مستخلص مقاولين) and extract:
1. subcontractor: Name of the subcontractor (اسم المقاول الباطن).
2. project: Name of the project. Map to known projects: ${JSON.stringify(knownProjects)}.
3. statementNo: Number of this statement / invoice (رقم المستخلص, e.g. '01', '02').
4. supervisor: Name of the supervisor / supervising engineer (المهندس المشرف).
5. accountant: Name of the accountant (المحاسب).
6. items: Array of work items. For each item:
   - description: Item/work description (وصف البند بالكامل باللغة العربية)
   - unit: Unit of measurement (الوحدة, e.g. يومية, متر, متر مكعب, طن, مقطوعية, عدد)
   - rate: Unit price/rate (الفئة) as a number
   - previousQty: Previous quantity completed (number, default 0)
   - currentQty: Current quantity completed in this period (الكمية الحالية) as a number
   - completionPercent: Progress percent, e.g. 100, 80, 50 (number)`;

    schemaProperties = {
      subcontractor: { type: Type.STRING, description: "Subcontractor name in Arabic." },
      project: { type: Type.STRING, description: "Project name matching known projects." },
      statementNo: { type: Type.STRING, description: "Certificate statement number (e.g. 01, 02)." },
      supervisor: { type: Type.STRING, description: "Supervising engineer name." },
      accountant: { type: Type.STRING, description: "Accountant name." },
      items: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "Work description." },
            unit: { type: Type.STRING, description: "Unit of measurement." },
            rate: { type: Type.NUMBER, description: "Unit rate in EGP." },
            previousQty: { type: Type.NUMBER, description: "Previous quantity." },
            currentQty: { type: Type.NUMBER, description: "Current quantity." },
            completionPercent: { type: Type.NUMBER, description: "Completion percentage (e.g. 100)." }
          },
          required: ["description", "unit", "rate", "currentQty"]
        }
      }
    };
    requiredFields = ["subcontractor", "project", "statementNo", "items"];
  }

  const userInstructionText = userInstructions && userInstructions.trim() !== ''
    ? `\n\nCRITICAL USER INSTRUCTIONS TO OBSERVE FOR THIS DOCUMENT EXTRACTION:\n"${userInstructions.trim()}"\nYou MUST strictly follow, apply, and prioritize these custom instructions over other heuristic extraction options.`
    : '';

  const textPart = {
    text: `Analyze the document named "${filename}" received on date ${todayStr}.${userInstructionText}\nReturn values in JSON format matching the schema rules exactly.`,
  };

  let response: any;
  const maxRetries = 3;
  const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const currentModel = modelsToTry[(attempt - 1) % modelsToTry.length];
    try {
      console.log(`[AI Financial Extraction Attempt ${attempt}] Using model: ${currentModel} for type: ${type}`);
      response = await ai.models.generateContent({
        model: currentModel,
        contents: { parts: [documentPart, textPart] },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: schemaProperties,
            required: requiredFields
          }
        }
      });
      break;
    } catch (err: any) {
      if (attempt === maxRetries) throw err;
      console.warn(`Transient extraction error with ${currentModel}: ${err.message}. Retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  const parsedText = response?.text || "{}";
  return JSON.parse(parsedText.trim());
}

/**
 * POST ROUTE FOR MULTI-SECTION AI OCR & EXTRACTION
 */
app.post("/api/ai/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم تحديد أي ملف للرفع." });
    }
    const type = req.body.type || "petty_cash"; // 'labor' | 'petty_cash' | 'subcontractor'
    const userInstructions = req.body.instructions || "";
    const { buffer, mimetype, originalname } = req.file;

    const extracted = await extractFinancialFile(buffer, mimetype, originalname, type, userInstructions);

    // Save temporary upload
    const sanitize = (name: string) => name.replace(/[\/\\?%*:|"<>\s]/g, "_").trim();
    const tempFilename = `temp_${Date.now()}_${sanitize(originalname)}`;
    const tempDir = path.join(ORGANIZED_DIR, "temp_uploads");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempPath = path.join(tempDir, tempFilename);
    fs.writeFileSync(tempPath, buffer);

    const relativeTempPath = `/data/organized/temp_uploads/${tempFilename}`;

    res.json({
      success: true,
      data: extracted,
      tempPath: relativeTempPath,
      originalFilename: originalname
    });
  } catch (err: any) {
    console.error("AI OCR error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DYNAMIC FOLDER ARCHITECTURE MANAGER
 */
app.post("/api/ai/organize-file", async (req, res) => {
  try {
    const { tempPath, engineer, date, subcontractor, project, type, metadata } = req.body;
    if (!tempPath) {
      return res.json({ success: true, path: "" }); // Non-blocking if no attachment uploaded
    }

    const absTempPath = path.join(DATA_DIR, tempPath.replace(/^\/data\//, ""));
    if (!fs.existsSync(absTempPath)) {
      return res.status(404).json({ error: "الملف المؤقت غير موجود." });
    }

    const sanitize = (name: string) => name.replace(/[\/\\?%*:|"<>\s]/g, "_").trim();
    const filename = path.basename(absTempPath).replace(/^temp_\d+_/, "");
    
    // Resolve date, year, month
    const resolvedDate = date || (metadata && metadata.date) || new Date().toISOString().split("T")[0];
    const dateStr = resolvedDate;
    const yearStr = dateStr.split("-")[0] || "2026";
    const monthStr = dateStr.split("-")[1] || "06";

    // Resolve engineer name
    const resolvedEngineer = engineer || (metadata && metadata.engineer) || (metadata && metadata.supervisor) || subcontractor || "عام";
    const engName = sanitize(resolvedEngineer);

    // Dynamic folder structure: [اسم المهندس] / [السنة] / [الشهر]
    const targetDir = path.join(ORGANIZED_DIR, "engineers_folders", engName, yearStr, monthStr);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const finalAbsPath = path.join(targetDir, filename);
    fs.renameSync(absTempPath, finalAbsPath);
    const finalRelativePath = `/data/organized/engineers_folders/${engName}/${yearStr}/${monthStr}/${filename}`;

    res.json({
      success: true,
      path: finalRelativePath,
      organizedPath: finalRelativePath
    });
  } catch (err: any) {
    console.error("Organize file error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

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

  // 2. تنظيف وبناء المجلدات المتداخلة بشكل صارم (Nested Folders Fix)
  const folderProject = await getEnglishSlug(parsedData.projectName || "عام");
  const folderVendor = await getEnglishSlug(parsedData.clientName || "Unknown-Client");
  const finalPdfPath = `${folderProject}/${folderVendor}/PO-${poNumber}-${Date.now()}${fileExtension}`;
  // تأكيد إزالة الـ Leading Slash لتجنب مشاكل الـ Invalid key في Supabase
  const supabasePath = finalPdfPath.replace(/^\/+/, '');
  
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
    
    // Rename folders in Supabase Storage and update URLs automatically
    await moveProjectStorageFolder(cleanOld, cleanNew);
    
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
    
    // Rename folders in Supabase Storage and update URLs automatically
    await moveVendorStorageFolder(cleanOld, cleanNew);
    
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

async function getNextPoNumberForProject(db: any, projectName: string): Promise<string> {
  const cleanProj = (projectName || "عام").trim();
  
  if (supabaseClient) {
    try {
      let current_project_id = cleanProj;
      if (mongoose.connection.readyState === 1) {
        try {
          const mongoProj = await Project.findOne({ name: cleanProj });
          if (mongoProj) {
            current_project_id = mongoProj._id.toString();
          }
        } catch (err) {
          console.warn("[PO Serial] Error finding project ID in MongoDB:", err);
        }
      }

      console.log(`[PO Serial] Querying Supabase 'pos_table' for project_id: "${current_project_id}"`);
      const { data: lastPO, error: poError } = await supabaseClient
        .from('pos_table')
        .select('po_number')
        .eq('project_id', current_project_id)
        .order('po_number', { ascending: false })
        .limit(1);

      if (poError) {
        console.warn(`[PO Serial] Supabase pos_table query error (table might not exist yet):`, poError.message);
      } else if (lastPO && lastPO.length > 0) {
        const lastNum = parseInt(lastPO[0].po_number, 10);
        if (!isNaN(lastNum)) {
          const nextPoNumber = lastNum + 1;
          console.log(`[PO Serial] Supabase resolved next PO number: ${nextPoNumber} (last was ${lastNum})`);
          return String(nextPoNumber);
        }
      } else {
        // إذا كان هذا هو أول PO يتم إنشاؤه للمشروع على الإطلاق، يبدأ الترقيم تلقائياً من رقم 1.
        console.log(`[PO Serial] No PO found in Supabase for project_id: "${current_project_id}". First PO, starting from 1.`);
        return "1";
      }
    } catch (err: any) {
      console.warn("[PO Serial] Exception during Supabase query:", err.message);
    }
  }

  // Fallback to local DB and MongoDB
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

  // إذا كان هذا هو أول PO يتم إنشاؤه للمشروع على الإطلاق، يبدأ الترقيم تلقائياً من رقم 1.
  return "1";
}

app.get("/api/projects/next-po-number", async (req, res) => {
  try {
    const { projectName } = req.query;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "اسم المشروع مطلوب" });
    }
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    const nextNum = await getNextPoNumberForProject(db, projectName);
    res.json({ success: true, nextPoNumber: nextNum });
  } catch (err: any) {
    console.error("Error getting next PO number:", err);
    res.status(500).json({ error: err.message });
  }
});

async function getDeviceStatus(fingerprint: string, ipAddress: string, deviceInfo: string) {
  let supabaseStatus: string | null = null;
  let supabaseRole: string | null = null;
  let supabaseRecord: any = null;
  
  // 1. Query Supabase
  if (supabaseClient && !isSupabaseDevicesDisabled) {
    try {
      const { data, error } = await supabaseClient
        .from('allowed_devices')
        .select('*')
        .eq('device_fingerprint', fingerprint)
        .maybeSingle();

      if (error) {
        if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.message.includes("relation") || error.code === 'PGRST116')) {
          isSupabaseDevicesDisabled = true;
          console.log("[Device Auth] Supabase 'allowed_devices' table is missing. Gracefully falling back to MongoDB/Local DB.");
        } else {
          console.log("[Device Auth] Supabase check status query error:", error.message);
        }
      } else if (data) {
        supabaseStatus = data.status;
        supabaseRole = data.role || null;
        supabaseRecord = data;
      }
    } catch (e: any) {
      // Bypassed silently
    }
  }

  // 2. Query MongoDB
  let mongoStatus: string | null = null;
  let mongoRole: string | null = null;
  let mongoRecord: any = null;
  if (mongoose.connection.readyState === 1) {
    try {
      const doc = await AllowedDevice.findOne({ device_fingerprint: fingerprint });
      if (doc) {
        mongoStatus = doc.status;
        mongoRole = doc.role || null;
        mongoRecord = doc;
      }
    } catch (err: any) {
      console.error("[Device Auth] MongoDB error during check:", err.message);
    }
  }

  // 3. Query Local JSON
  let localStatus: string | null = null;
  let localRole: string | null = null;
  let localRecord: any = null;
  const db = getDb();
  if (!db.allowed_devices) {
    db.allowed_devices = [];
  }
  const localDev = db.allowed_devices.find((d: any) => d.device_fingerprint === fingerprint);
  if (localDev) {
    localStatus = localDev.status;
    localRole = localDev.role || null;
    localRecord = localDev;
  }

  // Live Sync & Hard Delete Check:
  // If Supabase client is configured and active, but the record is NOT found in Supabase
  // (supabaseRecord is null) AND the device was found in Mongo or Local, this means 
  // the device has been deleted from Supabase by an Admin! We must sync this deletion 
  // immediately to MongoDB and Local JSON and return 'deleted'.
  if (supabaseClient && !isSupabaseDevicesDisabled && !supabaseRecord) {
    if (mongoRecord || localRecord) {
      console.log(`[Device Auth Live Sync] Device ${fingerprint} was deleted from Supabase. Cleaning up MongoDB and Local DB.`);
      if (mongoose.connection.readyState === 1) {
        try {
          await AllowedDevice.deleteOne({ device_fingerprint: fingerprint });
        } catch (e) {}
      }
      db.allowed_devices = db.allowed_devices.filter((d: any) => d.device_fingerprint !== fingerprint);
      saveDb(db);

      return {
        device_fingerprint: fingerprint,
        status: 'deleted',
        role: 'user',
        isDeleted: true,
        ip_address: ipAddress,
        device_info: deviceInfo,
        nickname: ''
      };
    }
  }

  // 4. Resolve Status using weight logic (blocked: 3 > approved: 2 > pending: 1 > none: 0)
  const getWeight = (status: string | null | undefined) => {
    if (status === 'deleted') return 4;
    if (status === 'blocked') return 3;
    if (status === 'approved') return 2;
    if (status === 'pending') return 1;
    return 0;
  };

  let sWeight = getWeight(supabaseStatus);
  let mWeight = getWeight(mongoStatus);
  let lWeight = getWeight(localStatus);

  let maxWeight = Math.max(sWeight, mWeight, lWeight);
  let resolvedStatus = 'pending';
  let resolvedRole = 'user';
  let matchedFingerprint: string | null = null;
  let matchedRecord: any = null;

  if (maxWeight === 0) {
    // No IP-based automatic device adoption as requested. Each device fingerprint (UUID) is checked strictly independently.
  }

  // Now resolve the status and role
  if (maxWeight === 4) resolvedStatus = 'deleted';
  else if (maxWeight === 3) resolvedStatus = 'blocked';
  else if (maxWeight === 2) resolvedStatus = 'approved';
  else if (maxWeight === 1) resolvedStatus = 'pending';
  else resolvedStatus = 'pending';

  // Resolve Role
  if (resolvedStatus === 'deleted') {
    resolvedRole = 'user';
  } else if (supabaseRole === 'admin' || mongoRole === 'admin' || localRole === 'admin') {
    resolvedRole = 'admin';
  } else {
    resolvedRole = 'user';
  }

  // 5. Apply & Sync changes across all databases
  if (maxWeight === 0) {
    // Brand new device: insert as pending in all active databases
    resolvedStatus = 'pending';
    resolvedRole = 'user';
    
    if (supabaseClient && !isSupabaseDevicesDisabled) {
      try {
        const newDev = {
          device_fingerprint: fingerprint,
          ip_address: ipAddress,
          device_info: deviceInfo,
          status: 'pending',
          role: 'user'
        };
        const { error } = await supabaseClient.from('allowed_devices').upsert(newDev, { onConflict: 'device_fingerprint' });
        if (error) {
          if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.message.includes("relation"))) {
            isSupabaseDevicesDisabled = true;
          }
        }
      } catch (e) {}
    }

    if (mongoose.connection.readyState === 1) {
      try {
        await AllowedDevice.findOneAndUpdate(
          { device_fingerprint: fingerprint },
          { ip_address: ipAddress, device_info: deviceInfo, status: 'pending', role: 'user' },
          { upsert: true }
        );
      } catch (e) {}
    }

    const db2 = getDb();
    if (!db2.allowed_devices) db2.allowed_devices = [];
    db2.allowed_devices.push({
      device_fingerprint: fingerprint,
      ip_address: ipAddress,
      device_info: deviceInfo,
      status: 'pending',
      role: 'user',
      createdAt: new Date().toISOString()
    });
    saveDb(db2);
  } else {
    // Existing device: Sync resolved status, role, IP address, and Device Info to all active databases
    
    // Sync Supabase
    if (supabaseClient && !isSupabaseDevicesDisabled) {
      try {
        if (!supabaseRecord || supabaseStatus !== resolvedStatus || supabaseRole !== resolvedRole || supabaseRecord.ip_address !== ipAddress || supabaseRecord.device_info !== deviceInfo) {
          const { error } = await supabaseClient
            .from('allowed_devices')
            .upsert({
              device_fingerprint: fingerprint,
              status: resolvedStatus,
              role: resolvedRole,
              ip_address: ipAddress,
              device_info: deviceInfo
            }, { onConflict: 'device_fingerprint' });
          if (error) {
            if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.message.includes("relation"))) {
              isSupabaseDevicesDisabled = true;
            }
          }
        }
      } catch (e) {}
    }

    // Sync MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        if (!mongoRecord || mongoStatus !== resolvedStatus || mongoRole !== resolvedRole || mongoRecord.ip_address !== ipAddress || mongoRecord.device_info !== deviceInfo) {
          await AllowedDevice.findOneAndUpdate(
            { device_fingerprint: fingerprint },
            { status: resolvedStatus, role: resolvedRole, ip_address: ipAddress, device_info: deviceInfo },
            { upsert: true }
          );
        }
      } catch (e) {}
    }

    // Sync Local JSON
    const db3 = getDb();
    if (!db3.allowed_devices) db3.allowed_devices = [];
    let devIdx = db3.allowed_devices.findIndex((d: any) => d.device_fingerprint === fingerprint);
    if (devIdx >= 0) {
      const current = db3.allowed_devices[devIdx];
      if (current.status !== resolvedStatus || current.role !== resolvedRole || current.ip_address !== ipAddress || current.device_info !== deviceInfo) {
        db3.allowed_devices[devIdx] = {
          ...current,
          status: resolvedStatus,
          role: resolvedRole,
          ip_address: ipAddress,
          device_info: deviceInfo
        };
        saveDb(db3);
      }
    } else {
      db3.allowed_devices.push({
        device_fingerprint: fingerprint,
        status: resolvedStatus,
        role: resolvedRole,
        ip_address: ipAddress,
        device_info: deviceInfo,
        createdAt: new Date().toISOString()
      });
      saveDb(db3);
    }
  }

  const resolvedNickname = 
    (supabaseRecord?.nickname || supabaseRecord?.device_name) ||
    (mongoRecord?.nickname || mongoRecord?.device_name) ||
    (localRecord?.nickname || localRecord?.device_name) ||
    (matchedRecord?.nickname || matchedRecord?.device_name) ||
    "";

  return {
    device_fingerprint: fingerprint,
    status: resolvedStatus === 'deleted' ? 'blocked' : resolvedStatus,
    role: resolvedRole,
    ip_address: ipAddress,
    device_info: deviceInfo,
    nickname: resolvedNickname
  };
}

// ==========================================
// 1. Traditional Role-Based Authentication APIs
// ==========================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "البريد الإلكتروني وكلمة المرور مطلوبان" });
    }

    const lowerEmail = email.toLowerCase().trim();

    // Dynamically ensure required users are verified and seeded on every login attempt
    await seedAllRequiredUsers();

    let matchedUser: any = null;
    let authUid: string | null = null;
    let loggedInViaSupabase = false;

    // 1. Try Supabase Auth first to verify credentials and fetch UID
    const publicClient = getSupabaseClient();
    if (publicClient) {
      try {
        const { data: sbData, error: sbError } = await publicClient.auth.signInWithPassword({
          email: lowerEmail,
          password: password
        });
        if (sbError) {
          console.warn("[Supabase Auth] signInWithPassword notice:", sbError.message);
        } else if (sbData && sbData.user) {
          authUid = sbData.user.id;
          loggedInViaSupabase = true;
          console.log("[Supabase Auth] signInWithPassword successful. UID:", authUid);
        }
      } catch (ex: any) {
        console.warn("[Supabase Auth] login exception caught:", ex.message);
      }
    }

    const db = getDb();
    db.users = db.users || [];

    // 2. Fetch matchedUser based on the source of truth
    if (loggedInViaSupabase && authUid) {
      // Find by exact Supabase UID
      matchedUser = db.users.find((u: any) => u.id === authUid);

      // If not found by ID but found by email, link them and update DB
      if (!matchedUser) {
        matchedUser = db.users.find((u: any) => u.email.toLowerCase() === lowerEmail);
        if (matchedUser) {
          console.log(`[Auth] Matching user by email to sync ID to Supabase UID: ${authUid}`);
          matchedUser.id = authUid;
          saveDb(db);
        }
      }

      // Check MongoDB if still not found
      if (!matchedUser && mongoose.connection.readyState === 1) {
        try {
          const mongoUser = await User.findOne({ $or: [{ _id: authUid }, { email: lowerEmail }] });
          if (mongoUser) {
            matchedUser = {
              id: authUid,
              name: mongoUser.name,
              email: mongoUser.email,
              password: mongoUser.password,
              role: mongoUser.role || "user",
              status: mongoUser.status || "active",
              allowed_departments: mongoUser.allowed_departments || [],
              createdAt: mongoUser.createdAt ? mongoUser.createdAt.toISOString() : new Date().toISOString()
            };
            db.users.push(matchedUser);
            saveDb(db);
          }
        } catch (mongoErr) {
          console.warn("[Login] MongoDB lookup by UID failed:", mongoErr);
        }
      }

      // Auto-create local user entry if they are in Supabase Auth but not in our permissions DB
      if (!matchedUser) {
        const adminEmail = "khaled@delta.com";
        const isKhaled = lowerEmail === adminEmail;
        matchedUser = {
          id: authUid,
          name: isKhaled ? "خالد" : "موظف جديد",
          email: lowerEmail,
          password: await bcrypt.hash(password, 10),
          role: isKhaled ? "admin" : "user",
          status: "active",
          createdAt: new Date().toISOString()
        };
        db.users.push(matchedUser);
        saveDb(db);
        console.log(`[Auth] Auto-created database entry for authenticated user: ${lowerEmail}`);
      }
    } else {
      // Fallback: Authenticate locally if Supabase Client is not initialized or failed to connect
      matchedUser = db.users.find((u: any) => u.email.toLowerCase() === lowerEmail);

      // Check MongoDB if not found or to sync
      if (!matchedUser && mongoose.connection.readyState === 1) {
        try {
          const mongoUser = await User.findOne({ email: lowerEmail });
          if (mongoUser) {
            matchedUser = {
              id: mongoUser._id.toString(),
              name: mongoUser.name,
              email: mongoUser.email,
              password: mongoUser.password,
              role: mongoUser.role || "user",
              status: mongoUser.status || "active",
              allowed_departments: mongoUser.allowed_departments || [],
              createdAt: mongoUser.createdAt ? mongoUser.createdAt.toISOString() : new Date().toISOString()
            };
            // Sync to local db
            db.users.push(matchedUser);
            saveDb(db);
          }
        } catch (err) {
          console.warn("[Login] MongoDB check failed:", err);
        }
      }

      if (!matchedUser) {
        return res.status(401).json({ success: false, error: "عذراً، البريد الإلكتروني غير مسجل في النظام" });
      }

      // Compare passwords using bcrypt
      const passwordIsValid = await bcrypt.compare(password, matchedUser.password);
      if (!passwordIsValid) {
        return res.status(401).json({ success: false, error: "كلمة المرور غير صحيحة" });
      }
    }

    if (matchedUser.status === "blocked") {
      return res.status(403).json({ success: false, error: "تم تعطيل حسابك من قبل الإدارة. يرجى التواصل مع المسؤول." });
    }

    // Dynamic Sync with Supabase DB (profiles) on login
    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin && matchedUser) {
      try {
        let sbUserRecord: any = null;
        const { data: pData } = await supabaseAdmin.from('profiles').select('*').eq('email', lowerEmail);
        if (pData && pData.length > 0) {
          sbUserRecord = pData[0];
        }
        
        if (sbUserRecord) {
          const updatedRole = sbUserRecord.role || matchedUser.role;
          let updatedDeps = (sbUserRecord.allowed_departments && sbUserRecord.allowed_departments.length > 0)
            ? sbUserRecord.allowed_departments
            : (sbUserRecord.allowed_sections && sbUserRecord.allowed_sections.length > 0)
              ? sbUserRecord.allowed_sections
              : matchedUser.allowed_departments || [];
          
          if (updatedRole === 'admin') {
            updatedDeps = ['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis', 'engineers'];
          }
          
          const updatedName = sbUserRecord.display_name || sbUserRecord.name || matchedUser.name;
          
          matchedUser.role = updatedRole;
          matchedUser.allowed_departments = updatedDeps;
          matchedUser.name = updatedName;
          
          const idx = db.users.findIndex((u: any) => u.email.toLowerCase() === lowerEmail);
          if (idx !== -1) {
            db.users[idx].role = updatedRole;
            db.users[idx].allowed_departments = updatedDeps;
            db.users[idx].name = updatedName;
            saveDb(db);
          }
        }
      } catch (sbSyncErr) {
        console.warn("[Login Sync] Supabase profile sync failed:", sbSyncErr);
      }
    }

    if (matchedUser.role === 'admin') {
      matchedUser.allowed_departments = ['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis', 'engineers'];
    }

    // Login success
    console.log(`[Auth] User ${matchedUser.name} (${matchedUser.email}) logged in successfully as [${matchedUser.role}]`);
    return res.json({
      success: true,
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        role: matchedUser.role,
        status: matchedUser.status,
        allowed_departments: matchedUser.role === 'admin'
          ? ['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis', 'engineers']
          : matchedUser.allowed_departments || []
      }
    });
  } catch (err: any) {
    console.error("[Auth] Login error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint to verify the active session on app startup or navigation
app.post("/api/auth/verify-session", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(401).json({ success: false, error: "جلسة غير صالحة" });
    }

    const lowerEmail = email.toLowerCase().trim();
    const db = getDb();
    db.users = db.users || [];
    let matchedUser = db.users.find((u: any) => u.email.toLowerCase() === lowerEmail);

    if (!matchedUser && mongoose.connection.readyState === 1) {
      try {
        const mongoUser = await User.findOne({ email: lowerEmail });
        if (mongoUser) {
          matchedUser = {
            id: mongoUser._id.toString(),
            name: mongoUser.name,
            email: mongoUser.email,
            password: mongoUser.password,
            role: mongoUser.role || "user",
            status: mongoUser.status || "active",
            allowed_departments: mongoUser.allowed_departments || [],
            createdAt: mongoUser.createdAt ? mongoUser.createdAt.toISOString() : new Date().toISOString()
          };
          // Sync to local
          db.users.push(matchedUser);
          saveDb(db);
        }
      } catch (err) {
        console.warn("[Session verification] MongoDB check failed:", err);
      }
    }

    if (!matchedUser || matchedUser.status === "blocked") {
      return res.status(401).json({ success: false, error: "جلسة غير صالحة أو تم حظر الحساب" });
    }

    // Dynamic Sync with Supabase DB (profiles)
    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin && matchedUser) {
      try {
        let sbUserRecord: any = null;
        const { data: pData } = await supabaseAdmin.from('profiles').select('*').eq('email', lowerEmail);
        if (pData && pData.length > 0) {
          sbUserRecord = pData[0];
        }
        
        if (sbUserRecord) {
          const updatedRole = sbUserRecord.role || matchedUser.role;
          let updatedDeps = (sbUserRecord.allowed_departments && sbUserRecord.allowed_departments.length > 0)
            ? sbUserRecord.allowed_departments
            : (sbUserRecord.allowed_sections && sbUserRecord.allowed_sections.length > 0)
              ? sbUserRecord.allowed_sections
              : matchedUser.allowed_departments || [];
          
          if (updatedRole === 'admin') {
            updatedDeps = ['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis', 'engineers'];
          }
          
          const updatedName = sbUserRecord.display_name || sbUserRecord.name || matchedUser.name;
          
          matchedUser.role = updatedRole;
          matchedUser.allowed_departments = updatedDeps;
          matchedUser.name = updatedName;
          
          const idx = db.users.findIndex((u: any) => u.email.toLowerCase() === lowerEmail);
          if (idx !== -1) {
            db.users[idx].role = updatedRole;
            db.users[idx].allowed_departments = updatedDeps;
            db.users[idx].name = updatedName;
            saveDb(db);
          }
        }
      } catch (sbSyncErr) {
        console.warn("[Session Verify] Supabase profile sync failed:", sbSyncErr);
      }
    }

    if (matchedUser.role === 'admin') {
      matchedUser.allowed_departments = ['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis', 'engineers'];
    }

    return res.json({
      success: true,
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        role: matchedUser.role,
        status: matchedUser.status,
        allowed_departments: matchedUser.role === 'admin'
          ? ['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis', 'engineers']
          : matchedUser.allowed_departments || []
      }
    });
  } catch (err: any) {
    console.error("[Session verification] Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Route: Get Users List
app.get("/api/admin/users", async (req, res) => {
  try {
    const db = getDb();
    db.users = db.users || [];
    let usersList = [...db.users];

    // Try fetching from Supabase DB (profiles table)
    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin) {
      try {
        console.log("[Users Fetch] Checking Supabase 'profiles' table...");
        let profs: any[] | null = null;
        let profsErr: any = null;
        
        const { data: pData, error: pErr } = await supabaseAdmin.from('profiles').select('*');
        if (!pErr && pData) {
          profs = pData;
        } else {
          profsErr = pErr;
        }

        if (!profsErr && profs) {
          profs.forEach((p: any) => {
            const emailLower = p.email?.toLowerCase().trim();
            if (emailLower && !usersList.some((u: any) => u.email.toLowerCase() === emailLower)) {
              const mapped = {
                id: p.id,
                name: p.display_name || p.name || "موظف جديد",
                email: emailLower,
                role: p.role || "user",
                status: p.status || "active",
                allowed_departments: (p.allowed_departments && p.allowed_departments.length > 0)
                  ? p.allowed_departments
                  : (p.allowed_sections && p.allowed_sections.length > 0)
                    ? p.allowed_sections
                    : (p.user_metadata?.allowed_departments && p.user_metadata?.allowed_departments.length > 0)
                      ? p.user_metadata.allowed_departments
                      : (p.user_metadata?.allowed_sections && p.user_metadata?.allowed_sections.length > 0)
                        ? p.user_metadata.allowed_sections
                        : [],
                createdAt: p.created_at || p.createdAt || new Date().toISOString()
              };
              usersList.push(mapped);
              db.users.push({ ...mapped, password: "" });
            } else if (emailLower) {
              const existing = usersList.find((u: any) => u.email.toLowerCase() === emailLower);
              if (existing) {
                existing.allowed_departments = (p.allowed_departments && p.allowed_departments.length > 0)
                  ? p.allowed_departments
                  : (p.allowed_sections && p.allowed_sections.length > 0)
                    ? p.allowed_sections
                    : (p.user_metadata?.allowed_departments && p.user_metadata?.allowed_departments.length > 0)
                      ? p.user_metadata.allowed_departments
                      : (p.user_metadata?.allowed_sections && p.user_metadata?.allowed_sections.length > 0)
                        ? p.user_metadata.allowed_sections
                        : existing.allowed_departments || [];
              }
            }
          });
          saveDb(db);
        }
      } catch (sbErr: any) {
        console.warn("[Users Fetch] Supabase DB fetch failed:", sbErr.message);
      }
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const mongoUsers = await User.find({});
        mongoUsers.forEach((mUser: any) => {
          if (!usersList.some((u: any) => u.email.toLowerCase() === mUser.email.toLowerCase())) {
            const mapped = {
              id: mUser._id.toString(),
              name: mUser.name,
              email: mUser.email,
              role: mUser.role || "user",
              status: mUser.status || "active",
              allowed_departments: (mUser.allowed_departments && mUser.allowed_departments.length > 0)
                ? mUser.allowed_departments
                : (mUser.allowed_sections && mUser.allowed_sections.length > 0)
                  ? mUser.allowed_sections
                  : [],
              createdAt: mUser.createdAt ? mUser.createdAt.toISOString() : new Date().toISOString()
            };
            usersList.push(mapped);
          } else {
            const existing = usersList.find((u: any) => u.email.toLowerCase() === mUser.email.toLowerCase());
            if (existing) {
              existing.allowed_departments = (mUser.allowed_departments && mUser.allowed_departments.length > 0)
                ? mUser.allowed_departments
                : (mUser.allowed_sections && mUser.allowed_sections.length > 0)
                  ? mUser.allowed_sections
                  : existing.allowed_departments || [];
            }
          }
        });
      } catch (err) {
        console.warn("[Users Fetch] MongoDB error:", err);
      }
    }

    // Clean sensitive fields out of response
    const sanitizedUsers = usersList.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      allowed_departments: u.allowed_departments || [],
      createdAt: u.createdAt
    }));

    return res.json({ success: true, users: sanitizedUsers });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Route: Create User
app.post("/api/admin/users/create", async (req, res) => {
  try {
    const { name, email, password, role, allowed_departments } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "الرجاء إدخال الاسم، البريد الإلكتروني وكلمة المرور" });
    }

    const lowerEmail = email.toLowerCase().trim();
    const finalDeps = allowed_departments || [];

    // Check duplicate
    const db = getDb();
    db.users = db.users || [];
    const localExists = db.users.some((u: any) => u.email.toLowerCase() === lowerEmail);

    let mongoExists = false;
    if (mongoose.connection.readyState === 1) {
      mongoExists = !!(await User.findOne({ email: lowerEmail }));
    }

    if (localExists || mongoExists) {
      return res.status(400).json({ success: false, error: "عذراً، البريد الإلكتروني مسجل بالفعل لمستخدم آخر" });
    }

    // Validate Supabase keys configuration
    const configCheck = checkSupabaseKeysConfig();
    if (!configCheck.isValid) {
      console.error("[Auth] Supabase configuration check failed:", configCheck.error);
      return res.status(400).json({
        success: false,
        error: configCheck.error
      });
    }

    // 1. Get dynamic Supabase Admin Client
    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      console.error("[Auth] SUPABASE_SERVICE_ROLE_KEY is missing or invalid on the server.");
      return res.status(500).json({ 
        success: false, 
        error: "فشل إنشاء الحساب: مفتاح الخدمة SUPABASE_SERVICE_ROLE_KEY غير مهيأ على السيرفر. يرجى ضبط المتغيرات البيئية للمشروع." 
      });
    }

    let finalUserId = "";

    // 2. Create in Supabase Auth
    try {
      const { data: sbData, error: sbError } = await supabaseAdmin.auth.admin.createUser({
        email: lowerEmail,
        password: password,
        email_confirm: true,
        user_metadata: { name, role: role || "user", allowed_departments: finalDeps }
      });
      if (sbError) {
        console.warn("[Supabase Admin Auth] User creation failed:", sbError.message);
        return res.status(400).json({ 
          success: false, 
          error: `فشل إنشاء الحساب في Supabase Auth: ${sbError.message}` 
        });
      } else if (sbData && sbData.user) {
        finalUserId = sbData.user.id;
        console.log("[Supabase Admin Auth] User created successfully. UID:", finalUserId);
      } else {
        return res.status(400).json({ 
          success: false, 
          error: "فشل إنشاء الحساب في Supabase Auth: لم يتم إرجاع بيانات المستخدم." 
        });
      }
    } catch (ex: any) {
      console.error("[Supabase Admin Auth] Exception caught during user creation:", ex.message);
      return res.status(500).json({ 
        success: false, 
        error: `خطأ استثنائي أثناء إنشاء الحساب في Supabase Auth: ${ex.message}` 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 2.5 Save to Supabase DB (profiles table only)
    let sbDbSuccess = false;
    let sbDbErrorMsg = "";
    
    const tryInsertOnTable = async (tableName: string): Promise<{ success: boolean; errorMsg: string }> => {
      try {
        console.log(`[Supabase DB] Attempting insert into '${tableName}' table for UID: ${finalUserId}...`);
        const { error: insertErr } = await supabaseAdmin
          .from(tableName)
          .insert([
            { 
              id: finalUserId, 
              email: lowerEmail, 
              display_name: name.trim(), 
              role: role || "user",
              allowed_departments: finalDeps
            }
          ]);
        
        if (!insertErr) {
          console.log(`[Supabase DB] Successfully inserted into '${tableName}' table.`);
          return { success: true, errorMsg: "" };
        }
        
        console.error(`[Supabase DB] '${tableName}' first insert failed:`, insertErr);
        
        if (insertErr.message?.includes("allowed_departments") || insertErr.code === "PGRST204" || insertErr.code === "42703") {
          console.warn(`[Supabase DB] allowed_departments missing on '${tableName}', retrying with allowed_sections...`);
          const { error: retrySectErr } = await supabaseAdmin
            .from(tableName)
            .insert([
              { 
                id: finalUserId, 
                email: lowerEmail, 
                display_name: name.trim(), 
                role: role || "user",
                allowed_sections: finalDeps
              }
            ]);
          if (!retrySectErr) {
            console.log(`[Supabase DB] Successfully inserted into '${tableName}' with allowed_sections!`);
            return { success: true, errorMsg: "" };
          }
          
          console.warn(`[Supabase DB] allowed_sections also missing on '${tableName}', retrying without departments column...`);
          const { error: retryProfErr } = await supabaseAdmin
            .from(tableName)
            .insert([
              { 
                id: finalUserId, 
                email: lowerEmail, 
                display_name: name.trim(), 
                role: role || "user"
              }
            ]);
          if (!retryProfErr) {
            console.log(`[Supabase DB] Successfully inserted into '${tableName}' without departments.`);
            return { success: true, errorMsg: "" };
          }
          
          return { success: false, errorMsg: retryProfErr.message };
        }
        
        return { success: false, errorMsg: insertErr.message };
      } catch (ex: any) {
        return { success: false, errorMsg: ex.message };
      }
    };

    try {
      const pRes = await tryInsertOnTable('profiles');
      if (pRes.success) {
        sbDbSuccess = true;
      } else {
        sbDbErrorMsg = pRes.errorMsg;
      }
    } catch (dbErr: any) {
      console.error("[Supabase DB] Exception during Supabase insert (console.log dbError):", dbErr);
      sbDbErrorMsg = dbErr.message;
    }

    if (!sbDbSuccess) {
      console.error(`[Supabase DB] Database insert failed: ${sbDbErrorMsg}. Returning error to prevent un-synchronized state.`);
      return res.status(400).json({
        success: false,
        error: `فشل إدخال الموظف في قاعدة البيانات: ${sbDbErrorMsg || "يرجى التحقق من لوحة تحكم Supabase والـ Schema الخاص بجداول المستخدمين"}`
      });
    }

    // 3. Save locally only after 100% success in Supabase Auth & Database
    const newUser = {
      id: finalUserId,
      name: name.trim(),
      email: lowerEmail,
      password: hashedPassword,
      role: role || "user",
      status: "active",
      allowed_departments: finalDeps,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    saveDb(db);

    // 4. Save to MongoDB Atlas
    if (mongoose.connection.readyState === 1) {
      try {
        await User.create({
          _id: finalUserId,
          name: name.trim(),
          email: lowerEmail,
          password: hashedPassword,
          role: role || "user",
          status: "active",
          allowed_departments: finalDeps
        });
      } catch (mongoErr: any) {
        console.error("[Auth] Failed to write user to MongoDB:", mongoErr.message);
      }
    }

    console.log(`[Auth] User ${name} successfully created by Admin as [${role || "user"}] with departments:`, finalDeps);
    return res.json({ success: true, message: "تم إنشاء حساب الموظف الجديد بنجاح!" });
  } catch (err: any) {
    console.error("[Auth] Create user error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Route: Update User (Edit Role or status or name or email or password or departments)
app.post("/api/admin/users/update", async (req, res) => {
  try {
    const { id, email, name, role, status, password, newEmail, allowed_departments } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "البريد الإلكتروني للموظف مطلوب" });
    }

    const lowerEmail = email.toLowerCase().trim();
    const db = getDb();
    db.users = db.users || [];

    let userIndex = -1;
    if (id) {
      userIndex = db.users.findIndex((u: any) => u.id === id);
    }
    if (userIndex === -1) {
      userIndex = db.users.findIndex((u: any) => u.email.toLowerCase() === lowerEmail);
    }

    if (userIndex === -1 && mongoose.connection.readyState !== 1) {
      return res.status(404).json({ success: false, error: "الموظف غير موجود" });
    }

    let lowerNewEmail = "";
    if (newEmail && newEmail.toLowerCase().trim() !== lowerEmail) {
      lowerNewEmail = newEmail.toLowerCase().trim();
      // Check if new email is already taken
      const isTaken = db.users.some((u: any) => u.email.toLowerCase() === lowerNewEmail);
      if (isTaken) {
        return res.status(400).json({ success: false, error: "البريد الإلكتروني الجديد مستخدم بالفعل من قبل موظف آخر" });
      }
    }

    let hashedPassword = "";
    if (password && password.trim().length > 0) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const targetUserId = id || (userIndex !== -1 ? db.users[userIndex].id : null);

    // 1. Update in Supabase Auth and Database
    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin && targetUserId) {
      try {
        const authUpdateObj: any = {};
        if (lowerNewEmail) {
          authUpdateObj.email = lowerNewEmail;
          authUpdateObj.email_confirm = true;
        }
        if (password && password.trim().length > 0) {
          authUpdateObj.password = password;
        }
        
        authUpdateObj.user_metadata = authUpdateObj.user_metadata || {};
        if (name) {
          authUpdateObj.user_metadata.name = name.trim();
        }
        if (role) {
          authUpdateObj.user_metadata.role = role;
        }
        if (allowed_departments) {
          authUpdateObj.user_metadata.allowed_departments = allowed_departments;
        }

        console.log(`[Supabase Admin Auth] Updating user ${targetUserId} in Auth...`, authUpdateObj);
        const { error: sbUpdateErr } = await supabaseAdmin.auth.admin.updateUserById(
          targetUserId,
          authUpdateObj
        );
        
        let proceedToDbUpdate = true;
        if (sbUpdateErr) {
          if (sbUpdateErr.message?.includes("User not found") || sbUpdateErr.message?.includes("not found")) {
            console.warn(`[Supabase Admin Auth] User ${targetUserId} not found in Supabase Auth. Skipping database profile updates.`);
            proceedToDbUpdate = false;
          } else {
            console.error("[Supabase Admin Auth] Failed to update user Auth:", sbUpdateErr.message);
          }
        }

        if (proceedToDbUpdate) {
          // Update in DB Tables
          console.log(`[Supabase DB] Updating details for UID: ${targetUserId}`);
          const dbUpdateObj: any = {};
          if (name) dbUpdateObj.display_name = name.trim();
          if (role) dbUpdateObj.role = role;
          if (allowed_departments) dbUpdateObj.allowed_departments = allowed_departments;

          if (Object.keys(dbUpdateObj).length > 0) {
            const tryUpdateOnTable = async (tableName: string): Promise<{ success: boolean; error: any }> => {
               console.log(`[Supabase DB] Updating details for UID: ${targetUserId} in table '${tableName}'`);
               let { error: updateErr } = await supabaseAdmin
                 .from(tableName)
                 .update(dbUpdateObj)
                 .eq('id', targetUserId);

               if (!updateErr) {
                 console.log(`[Supabase DB] Successfully updated profile details in '${tableName}' table.`);
                 return { success: true, error: null };
               }

               console.warn(`[Supabase DB] '${tableName}' update raw error:`, updateErr);
               console.log(`[Supabase DB] Attempting granular update for '${tableName}' table...`);
               let succeededAny = false;
               for (const [key, val] of Object.entries(dbUpdateObj)) {
                 let { error: singleErr } = await supabaseAdmin
                   .from(tableName)
                   .update({ [key]: val })
                   .eq('id', targetUserId);
                 
                 if (singleErr && key === 'display_name') {
                   console.log(`[Supabase DB] '${tableName}' display_name update failed, trying fallback to 'name' column...`);
                   const { error: nameErr } = await supabaseAdmin
                     .from(tableName)
                     .update({ name: val })
                     .eq('id', targetUserId);
                   if (!nameErr) {
                     console.log(`[Supabase DB] Successfully updated 'name' column in '${tableName}' table.`);
                     succeededAny = true;
                   }
                 } else if (singleErr && key === 'allowed_departments') {
                   console.log(`[Supabase DB] '${tableName}' allowed_departments update failed, trying fallback to 'allowed_sections' column...`);
                   const { error: sectErr } = await supabaseAdmin
                     .from(tableName)
                     .update({ allowed_sections: val })
                     .eq('id', targetUserId);
                   if (!sectErr) {
                     console.log(`[Supabase DB] Successfully updated 'allowed_sections' column in '${tableName}' table.`);
                     succeededAny = true;
                   }
                 } else if (!singleErr) {
                   console.log(`[Supabase DB] Successfully updated column '${key}' in '${tableName}' table.`);
                   succeededAny = true;
                 }
               }
               return { success: succeededAny, error: updateErr };
            };

            await tryUpdateOnTable('profiles');
          }
        }
      } catch (ex: any) {
        console.error("[Supabase Admin Auth/DB] Exception updating user:", ex.message);
      }
    }

    // 2. Update locally
    if (userIndex !== -1) {
      if (name) db.users[userIndex].name = name.trim();
      if (lowerNewEmail) db.users[userIndex].email = lowerNewEmail;
      if (role) db.users[userIndex].role = role;
      if (status) db.users[userIndex].status = status;
      if (hashedPassword) db.users[userIndex].password = hashedPassword;
      if (allowed_departments) db.users[userIndex].allowed_departments = allowed_departments;
      saveDb(db);
    }

    // 3. Update in MongoDB
    if (mongoose.connection.readyState === 1) {
      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (lowerNewEmail) updateData.email = lowerNewEmail;
      if (role) updateData.role = role;
      if (status) updateData.status = status;
      if (hashedPassword) updateData.password = hashedPassword;
      if (allowed_departments) updateData.allowed_departments = allowed_departments;

      await User.findOneAndUpdate({ email: lowerEmail }, { $set: updateData });
    }

    return res.json({ success: true, message: "تم تحديث بيانات ورتبة الموظف بنجاح!" });
  } catch (err: any) {
    console.error("[Auth] Update user error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Route: Delete User (or de-activate)
app.post("/api/admin/users/delete", async (req, res) => {
  try {
    const { id, email } = req.body;
    if (!id && !email) {
      return res.status(400).json({ success: false, error: "البريد الإلكتروني أو المعرف الفريد مطلوب" });
    }

    const lowerEmail = email ? email.toLowerCase().trim() : "";
    const db = getDb();
    db.users = db.users || [];

    // Find user ID and email FIRST before deleting from db.users
    let targetUserId = id;
    let userEmailForDeletion = lowerEmail;

    const userToDelete = db.users.find((u: any) => 
      (id && u.id === id) || 
      (lowerEmail && u.email?.toLowerCase().trim() === lowerEmail)
    );

    if (userToDelete) {
      targetUserId = userToDelete.id;
      userEmailForDeletion = userToDelete.email?.toLowerCase().trim() || lowerEmail;
    }

    // Delete locally from low db
    if (targetUserId) {
      db.users = db.users.filter((u: any) => u.id !== targetUserId);
    } else if (userEmailForDeletion) {
      db.users = db.users.filter((u: any) => u.email.toLowerCase() !== userEmailForDeletion.toLowerCase());
    }
    saveDb(db);

    // Delete from MongoDB
    if (mongoose.connection.readyState === 1) {
      if (targetUserId) {
        await User.deleteOne({ _id: targetUserId });
      } else if (userEmailForDeletion) {
        await User.deleteOne({ email: userEmailForDeletion });
      }
    }

    // Delete from Supabase Auth and Tables using Admin Client
    const supabaseAdmin = getSupabaseAdminClient();
    if (supabaseAdmin) {
      try {
        let authUserId = targetUserId;
        if (!authUserId && userEmailForDeletion) {
          console.log(`[Supabase Delete] UID not found in local db. Trying Direct Supabase Auth lookup for: ${userEmailForDeletion}`);
          const { data: { users: authUsers }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
          if (!listErr && authUsers) {
            const matchedAuthUser = authUsers.find((u: any) => u.email?.toLowerCase().trim() === userEmailForDeletion);
            if (matchedAuthUser) {
              authUserId = matchedAuthUser.id;
              console.log(`[Supabase Delete] Found Auth UID from email: ${authUserId}`);
            }
          }
        }

        // Determine email if we only have id
        if (!userEmailForDeletion && authUserId) {
          const { data: { user: authUser }, error: getErr } = await supabaseAdmin.auth.admin.getUserById(authUserId);
          if (!getErr && authUser) {
            userEmailForDeletion = authUser.email?.toLowerCase().trim() || "";
          }
        }

        console.log(`[Supabase Delete] Deleting user profiles/auth for email: ${userEmailForDeletion}, UID: ${authUserId}`);
        
        // Delete from profiles table by email and id
        if (userEmailForDeletion) {
          const { error: profDelEmailErr } = await supabaseAdmin.from('profiles').delete().eq('email', userEmailForDeletion);
          if (profDelEmailErr) console.warn("[Supabase Delete] Delete profiles by email error:", profDelEmailErr.message);
        }

        if (authUserId) {
          const { error: profDelIdErr } = await supabaseAdmin.from('profiles').delete().eq('id', authUserId);
          if (profDelIdErr) console.warn("[Supabase Delete] Delete profiles by id error:", profDelIdErr.message);
        }
        
        if (authUserId) {
          // Delete from Auth
          const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
          if (authDelErr) {
            console.error("[Supabase Delete Auth] Auth deletion failed:", authDelErr.message);
          } else {
            console.log("[Supabase Delete Auth] Successfully deleted user from Supabase Auth.");
          }
        }
      } catch (sbErr: any) {
        console.error("[Supabase Delete] Supabase deletion failed:", sbErr.message);
      }
    }

    return res.json({ success: true, message: "تم حذف حساب الموظف بالكامل من قواعد البيانات بنجاح" });
  } catch (err: any) {
    console.error("[Auth] Delete user error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/device/check", async (req, res) => {
  try {
    const { fingerprint, deviceInfo } = req.body;
    if (!fingerprint) {
      return res.status(400).json({ error: "بصمة الجهاز مطلوبة" });
    }
    const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
    const device = await getDeviceStatus(fingerprint, ipAddress, deviceInfo || "Unknown Device");
    res.json({ success: true, device });
  } catch (err: any) {
    console.error("[Device Auth] Check Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/verify-password", (req, res) => {
  try {
    const { password } = req.body;
    const currentDb = getDb();
    const currentPassword = currentDb.adminPassword || "DeltaAdmin2026";
    if (password === currentPassword) {
      return res.json({ success: true });
    } else {
      return res.status(400).json({ success: false, error: "كلمة المرور غير صحيحة" });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/change-password", (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.trim().length < 4) {
      return res.status(400).json({ success: false, error: "كلمة المرور الجديدة يجب أن تكون من 4 أحرف أو أكثر" });
    }
    const currentDb = getDb();
    const currentPassword = currentDb.adminPassword || "DeltaAdmin2026";
    if (oldPassword !== currentPassword) {
      return res.status(400).json({ success: false, error: "كلمة المرور القديمة غير صحيحة" });
    }
    currentDb.adminPassword = newPassword.trim();
    saveDb(currentDb);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/reset", async (req, res) => {
  try {
    const { password } = req.body;
    if (password !== "016135") {
      return res.status(400).json({ success: false, error: "كلمة المرور غير صحيحة" });
    }
    
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    // Clear financial modules and engineers (keep users and metadata intact)
    db.pettyCashBoxDays = [];
    db.subcontractorContracts = [];
    db.laborTimesheets = [];
    db.costAnalysisEntries = [];
    db.pendingTransactions = [];
    db.engineerLedgers = {};
    db.archives = [];
    db.engineers = [];
    
    saveDb(db);

    // Hard delete from live Supabase tables to keep them fully synced
    const supabase = getSupabaseAdminClient() || getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('petty_cash_box_days').delete().neq('id', 'placeholder_force_delete_all');
        await supabase.from('subcontractor_contracts').delete().neq('id', 'placeholder_force_delete_all');
        await supabase.from('labor_timesheets').delete().neq('id', 'placeholder_force_delete_all');
        await supabase.from('cost_analysis_entries').delete().neq('id', 'placeholder_force_delete_all');
        await supabase.from('engineers').delete().neq('id', 'placeholder_force_delete_all');
      } catch (sbErr: any) {
        console.warn("[Admin Reset] Direct Supabase tables delete bypassed or failed:", sbErr.message);
      }
    }
    
    return res.json({ success: true, message: "تمت إعادة تعيين قاعدة البيانات والمسح نهائياً من السيرفر بنجاح" });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/admin/devices", async (req, res) => {
  try {
    const devicesMap = new Map<string, any>();

    // Helper to merge device
    const mergeDevice = (dev: any) => {
      if (!dev || !dev.device_fingerprint) return;
      const fp = dev.device_fingerprint;
      const existing = devicesMap.get(fp);

      const getWeight = (status: string) => {
        if (status === 'deleted') return 4;
        if (status === 'blocked') return 3;
        if (status === 'approved') return 2;
        if (status === 'pending') return 1;
        return 0;
      };

      if (!existing) {
        devicesMap.set(fp, {
          device_fingerprint: fp,
          ip_address: dev.ip_address || "0.0.0.0",
          device_info: dev.device_info || "Unknown Device",
          status: dev.status || "pending",
          role: dev.role || "user",
          nickname: dev.nickname || dev.device_name || "",
          createdAt: dev.createdAt || dev.created_at || new Date().toISOString()
        });
      } else {
        const currentWeight = getWeight(existing.status);
        const newWeight = getWeight(dev.status);
        if (newWeight > currentWeight) {
          existing.status = dev.status;
        }
        if (dev.role === 'admin') {
          existing.role = 'admin';
        } else if (!existing.role) {
          existing.role = dev.role || 'user';
        }
        // Prefer non-empty IP/info
        if (dev.ip_address && dev.ip_address !== "0.0.0.0" && dev.ip_address !== "127.0.0.1") {
          existing.ip_address = dev.ip_address;
        }
        if (dev.device_info && dev.device_info !== "Unknown Device" && dev.device_info !== "Admin Approved") {
          existing.device_info = dev.device_info;
        }
        if (dev.nickname || dev.device_name) {
          existing.nickname = dev.nickname || dev.device_name;
        }
      }
    };

    // 1. Local db.json
    try {
      const db = getDb();
      if (db.allowed_devices) {
        db.allowed_devices.forEach(mergeDevice);
      }
    } catch (e) {}

    // 2. MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        const mongoDevs = await AllowedDevice.find({});
        mongoDevs.forEach((doc: any) => {
          mergeDevice({
            device_fingerprint: doc.device_fingerprint,
            ip_address: doc.ip_address,
            device_info: doc.device_info,
            status: doc.status,
            role: doc.role,
            nickname: doc.nickname || doc.device_name,
            createdAt: doc.createdAt
          });
        });
      } catch (e) {}
    }

    // 3. Supabase
    if (supabaseClient && !isSupabaseDevicesDisabled) {
      try {
        const { data, error } = await supabaseClient
          .from('allowed_devices')
          .select('*');
        if (!error && data) {
          data.forEach((row: any) => {
            mergeDevice({
              device_fingerprint: row.device_fingerprint,
              ip_address: row.ip_address,
              device_info: row.device_info,
              status: row.status,
              role: row.role,
              nickname: row.nickname || row.device_name,
              createdAt: row.created_at || row.createdAt
            });
          });
        } else if (error) {
          if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.message.includes("relation"))) {
            isSupabaseDevicesDisabled = true;
            console.log("[Device Auth] Supabase 'allowed_devices' table is missing during listing. Falling back silently.");
          }
        }
      } catch (e) {}
    }

    const mergedDevices = Array.from(devicesMap.values())
      .filter((d: any) => d.status !== 'deleted')
      .sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    res.json({ success: true, devices: mergedDevices });
  } catch (err: any) {
    console.error("[Device Auth] Admin Devices Get Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/devices/update", async (req, res) => {
  try {
    const { fingerprint, status, role, nickname, device_name } = req.body;
    if (!fingerprint) {
      return res.status(400).json({ error: "بيانات ناقصة" });
    }

    if (role === 'admin') {
      const dbCheck = getDb();
      const currentAdmins = (dbCheck.allowed_devices || []).filter(
        (d: any) => d.role === 'admin' && d.device_fingerprint !== fingerprint && d.status !== 'deleted'
      );
      if (currentAdmins.length >= 20) {
        return res.status(400).json({ error: "عذراً، تم الوصول إلى الحد الأقصى للأجهزة المشرفة (20 جهازاً). يرجى إلغاء إشراف جهاز آخر أولاً." });
      }
    }

    let updated = false;
    const updatePayload: any = {};
    if (status !== undefined) updatePayload.status = status;
    if (role !== undefined) updatePayload.role = role;

    const valNickname = nickname !== undefined ? nickname : device_name;
    if (valNickname !== undefined) {
      updatePayload.nickname = valNickname;
      updatePayload.device_name = valNickname;
    }

    // 1. Supabase
    if (supabaseClient && !isSupabaseDevicesDisabled) {
      try {
        let { data, error } = await supabaseClient
          .from('allowed_devices')
          .update(updatePayload)
          .eq('device_fingerprint', fingerprint)
          .select();
        
        if (error) {
          if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.message.includes("relation"))) {
            isSupabaseDevicesDisabled = true;
            console.log("[Device Auth] Supabase 'allowed_devices' table is missing during update.");
          } else if (valNickname !== undefined) {
            const fallbackPayload = { ...updatePayload };
            delete fallbackPayload.nickname;
            delete fallbackPayload.device_name;

            const retryRes = await supabaseClient
              .from('allowed_devices')
              .update(fallbackPayload)
              .eq('device_fingerprint', fingerprint)
              .select();
            data = retryRes.data;
            error = retryRes.error;

            if (error) {
              if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.message.includes("relation"))) {
                isSupabaseDevicesDisabled = true;
              }
            } else {
              updated = true;
            }
          }
        }

        if (error) {
          if (!isSupabaseDevicesDisabled) {
            const upsertData = { device_fingerprint: fingerprint, ip_address: '0.0.0.0', device_info: 'Admin Approved', ...updatePayload };
            const { error: upsertError } = await supabaseClient
              .from('allowed_devices')
              .upsert(upsertData, { onConflict: 'device_fingerprint' });
            if (!upsertError) updated = true;
          }
        } else if (!data || data.length === 0) {
          if (!isSupabaseDevicesDisabled) {
            const upsertData = { device_fingerprint: fingerprint, ip_address: '0.0.0.0', device_info: 'Admin Approved', ...updatePayload };
            const { error: upsertError } = await supabaseClient
              .from('allowed_devices')
              .upsert(upsertData, { onConflict: 'device_fingerprint' });
            if (!upsertError) updated = true;
          }
        } else {
          updated = true;
        }
      } catch (e) {
        console.error("[Device Auth] Supabase update exception:", e);
      }
    }

    // 2. MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        await AllowedDevice.findOneAndUpdate(
          { device_fingerprint: fingerprint },
          updatePayload,
          { upsert: true }
        );
        updated = true;
      } catch (e) {
        console.error("[Device Auth] MongoDB update error:", e);
      }
    }

    // 3. Local JSON
    const db = getDb();
    if (db.deleted_devices) {
      db.deleted_devices = db.deleted_devices.filter((f: string) => f !== fingerprint);
    }
    if (!db.allowed_devices) db.allowed_devices = [];
    const dev = db.allowed_devices.find((d: any) => d.device_fingerprint === fingerprint);
    if (dev) {
      if (status !== undefined) dev.status = status;
      if (role !== undefined) dev.role = role;
      if (valNickname !== undefined) {
        dev.nickname = valNickname;
        dev.device_name = valNickname;
      }
      saveDb(db);
      updated = true;
    } else {
      db.allowed_devices.push({
        device_fingerprint: fingerprint,
        status: status || 'pending',
        role: role || 'user',
        nickname: valNickname || '',
        device_name: valNickname || '',
        createdAt: new Date().toISOString()
      });
      saveDb(db);
      updated = true;
    }

    res.json({ success: updated || true });
  } catch (err: any) {
    console.error("[Device Auth] Admin Device Update Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/devices/delete", async (req, res) => {
  try {
    const { fingerprint } = req.body;
    if (!fingerprint) {
      return res.status(400).json({ error: "بيانات ناقصة" });
    }

    let deleted = false;

    // 1. Supabase - Hard delete from DB table
    if (supabaseClient && !isSupabaseDevicesDisabled) {
      try {
        const { error } = await supabaseClient
          .from('allowed_devices')
          .delete()
          .eq('device_fingerprint', fingerprint);
        if (error) {
          if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.message.includes("relation"))) {
            isSupabaseDevicesDisabled = true;
            console.log("[Device Auth] Supabase 'allowed_devices' table is missing during delete.");
          }
        } else {
          deleted = true;
        }
      } catch (e) {
        // Handled silently
      }
    }

    // 2. MongoDB - Hard delete document
    if (mongoose.connection.readyState === 1) {
      try {
        await AllowedDevice.deleteOne({ device_fingerprint: fingerprint });
        deleted = true;
      } catch (e) {
        console.error("[Device Auth] MongoDB delete error:", e);
      }
    }

    // 3. Local JSON - Complete removal from array
    try {
      const db = getDb();
      if (db.allowed_devices) {
        db.allowed_devices = db.allowed_devices.filter((d: any) => d.device_fingerprint !== fingerprint);
      }
      if (db.deleted_devices) {
        db.deleted_devices = db.deleted_devices.filter((f: string) => f !== fingerprint);
      }
      saveDb(db);
      deleted = true;
    } catch (e) {
      console.error("[Device Auth] Local JSON DB delete error:", e);
    }

    res.json({ success: true, message: "تم حذف الجهاز بنجاح من كافة قواعد البيانات" });
  } catch (err: any) {
    console.error("[Device Auth] Admin Device Delete Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/devices/logout-all", async (req, res) => {
  try {
    const { fingerprint } = req.body;
    
    // 1. Local JSON DB
    const db = getDb();
    if (db.allowed_devices && Array.isArray(db.allowed_devices)) {
      db.allowed_devices = db.allowed_devices.map((d: any) => {
        if (fingerprint && d.device_fingerprint === fingerprint) {
          return d;
        }
        return {
          ...d,
          status: 'pending',
          role: 'user'
        };
      });
      saveDb(db);
    }

    // 2. MongoDB
    if (mongoose.connection.readyState === 1) {
      const query = fingerprint ? { device_fingerprint: { $ne: fingerprint } } : {};
      await AllowedDevice.updateMany(query, { status: 'pending', role: 'user' });
    }

    // 3. Supabase
    if (supabaseClient && !isSupabaseDevicesDisabled) {
      try {
        const { data, error } = await supabaseClient.from('allowed_devices').select('device_fingerprint');
        if (data && data.length > 0) {
          for (const dev of data) {
            if (fingerprint && dev.device_fingerprint === fingerprint) {
              continue;
            }
            await supabaseClient
              .from('allowed_devices')
              .update({ status: 'pending', role: 'user' })
              .eq('device_fingerprint', dev.device_fingerprint);
          }
        }
      } catch (e) {
        console.error("Supabase mass update error:", e);
      }
    }

    res.json({ success: true, message: "تم تسجيل خروج وإلغاء صلاحية جميع الأجهزة الأخرى بنجاح!" });
  } catch (err: any) {
    console.error("[Device Auth] Admin Devices Logout-All Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/device/request-reconnect", async (req, res) => {
  try {
    const { fingerprint } = req.body;
    if (!fingerprint) {
      return res.status(400).json({ error: "بصمة الجهاز مطلوبة" });
    }

    const ipAddress = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

    // 1. Remove from deleted_devices in local JSON DB
    const db = getDb();
    if (db.deleted_devices) {
      db.deleted_devices = db.deleted_devices.filter((f: string) => f !== fingerprint);
    }

    // 2. Set status to 'pending' in Local JSON DB
    if (!db.allowed_devices) db.allowed_devices = [];
    const dev = db.allowed_devices.find((d: any) => d.device_fingerprint === fingerprint);
    if (dev) {
      dev.status = 'pending';
      dev.role = 'user';
      dev.ip_address = ipAddress;
    } else {
      db.allowed_devices.push({
        device_fingerprint: fingerprint,
        status: 'pending',
        role: 'user',
        ip_address: ipAddress,
        device_info: 'Reconnected Device',
        createdAt: new Date().toISOString()
      });
    }
    saveDb(db);

    // 3. Update in Supabase
    if (supabaseClient && !isSupabaseDevicesDisabled) {
      try {
        const { error } = await supabaseClient
          .from('allowed_devices')
          .upsert({
            device_fingerprint: fingerprint,
            status: 'pending',
            role: 'user',
            ip_address: ipAddress,
            device_info: 'Reconnected Device'
          }, { onConflict: 'device_fingerprint' });
        if (error) {
          if (error.message && (error.message.includes("Could not find the table") || error.message.includes("does not exist") || error.message.includes("relation"))) {
            isSupabaseDevicesDisabled = true;
          }
        }
      } catch (e) {}
    }

    // 4. Update in MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        await AllowedDevice.findOneAndUpdate(
          { device_fingerprint: fingerprint },
          { status: 'pending', role: 'user', ip_address: ipAddress, device_info: 'Reconnected Device' },
          { upsert: true }
        );
      } catch (e) {}
    }

    res.json({ success: true, message: "تم إعادة إرسال طلب الاتصال بنجاح" });
  } catch (err: any) {
    console.error("[Device Auth] Request Reconnect Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// AI OCR Extraction Endpoint
app.post("/api/ai/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "لم يتم رفع أي ملف." });
    }
    const { buffer, mimetype, originalname } = req.file;
    const base64Data = buffer.toString("base64");

    if (!geminiApiKey) {
      return res.status(500).json({
        success: false,
        error: "لم يتم تكوين مفتاح API لجيميني (GEMINI_API_KEY). الرجاء إضافته في الإعدادات لتفعيل الذكاء الاصطناعي."
      });
    }

    const systemInstruction = `You are an advanced visual AI OCR engine optimized for Egyptian and Arabic construction, engineering, and petty cash documents.
Analyze the provided document (can be an invoice, receipt, InstaPay transaction screenshot/receipt, attendance sheet, or subcontractor statement).
Extract the following information:
1. Names (الأسماء): Any employee names, site engineer names, subcontractor names, client/vendor names, or labor names mentioned in the document. Return as an array of strings in Arabic.
2. Dates (التواريخ): Any official dates, transaction dates, or period dates in YYYY-MM-DD format. Return as an array of strings.
3. Amounts (المبالغ): Any monetary amounts, totals, petty cash values, or daily wages. Extract them as standard numbers. Return as an array of numbers.
4. Description/Statement (البيان): A concise, rich description in Arabic summarizing what this receipt/document is for (e.g., 'شراء خامات سباكة وكهرباء للموقع' or 'إيصال تحويل بنكي إنستاباي للمهندس' or 'كشف حضور وغياب العمالة اليومية').
5. Summary (ملخص): A brief, complete visual summary of the document in professional Arabic.

Return values in JSON format matching the schema rules exactly.`;

    const documentPart = {
      inlineData: {
        mimeType: mimetype || "image/jpeg",
        data: base64Data
      }
    };

    const textPart = {
      text: `Process this document "${originalname}" and extract names, dates, amounts, description, and summary in JSON format.`
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [documentPart, textPart] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            names: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "All person/company/labor names found in the document."
            },
            dates: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "All dates found in the document, formatted as YYYY-MM-DD."
            },
            amounts: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description: "All monetary values/amounts found."
            },
            description: {
              type: Type.STRING,
              description: "Comprehensive Arabic description/statement of the document."
            },
            summary: {
              type: Type.STRING,
              description: "Short visual summary/conclusion of the document."
            }
          },
          required: ["names", "dates", "amounts", "description", "summary"]
        }
      }
    });

    const resultText = response.text || "{}";
    const parsed = JSON.parse(resultText.trim());

    return res.json({
      success: true,
      data: parsed
    });

  } catch (err: any) {
    console.error("[AI OCR] Error during Gemini extraction:", err);
    return res.status(500).json({ success: false, error: err.message || "حدث خطأ أثناء معالجة المستند بالذكاء الاصطناعي." });
  }
});

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
      resolvedDocNumber = await getNextPoNumberForProject(db, extractedData.projectName || "عام");
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
    const folderProject = await getEnglishSlug(projectName || "عام");
    const folderVendor = await getEnglishSlug(vendorName || "Unknown-Client");
    const finalPdfPath = `${folderProject}/${folderVendor}/PO-${poNumber}-${Date.now()}.pdf`;
    // تأكيد إزالة الـ Leading Slash لتجنب مشاكل الـ Invalid key في Supabase
    const supabasePath = finalPdfPath.replace(/^\/+/, '');

    if (!supabaseClient) {
      const errMsg = "Supabase Client is not initialized! Please make sure SUPABASE_URL and SUPABASE_ANON_KEY are set.";
      console.error(errMsg);
      throw new Error(errMsg);
    }

    const bucketName = "POs Files";
    console.log(`Uploading generated PDF to path "${supabasePath}" in bucket "${bucketName}"...`);

    // Create a real Blob for Supabase as requested
    const fileBlob = new globalThis.Blob([buffer], { type: "application/pdf" });

    const { data, error } = await supabaseClient.storage
      .from(bucketName)
      .upload(supabasePath, fileBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.error(`Supabase Client upload API error for generated PDF:`, error);
      throw error;
    }

    // Get Public URL
    const { data: publicUrlData } = supabaseClient.storage
      .from(bucketName)
      .getPublicUrl(supabasePath);

    const publicUrl = publicUrlData.publicUrl;
    console.log(`Successfully uploaded generated PDF to ${publicUrl}`);

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
app.get("/api/documents/download", async (req, res) => {
  const filePathStr = req.query.path as string;
  if (!filePathStr) {
    return res.status(400).json({ error: "مسار الملف مطلوب" });
  }
  
  // Set CORS and frame download headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  
  if (filePathStr.startsWith("http://") || filePathStr.startsWith("https://")) {
    // 1. Try generating a signed URL from Supabase storage (the best and recommended way)
    if (supabaseClient && filePathStr.includes(".supabase.co/storage/v1/object/")) {
      try {
        const decodedUrl = decodeURIComponent(filePathStr);
        // Find public/ or sign/
        const parts = decodedUrl.split("/storage/v1/object/public/");
        const privateParts = decodedUrl.split("/storage/v1/object/sign/");
        let bucketAndPath = "";
        if (parts.length > 1) {
          bucketAndPath = parts[1];
        } else if (privateParts.length > 1) {
          bucketAndPath = privateParts[1];
        }
        
        if (bucketAndPath) {
          const firstSlashIdx = bucketAndPath.indexOf("/");
          if (firstSlashIdx !== -1) {
            const bucketName = bucketAndPath.substring(0, firstSlashIdx);
            const storagePath = bucketAndPath.substring(firstSlashIdx + 1);
            
            console.log(`Generating signed URL for: bucket="${bucketName}", path="${storagePath}"`);
            
            const { data: signedData, error: signedError } = await supabaseClient.storage
              .from(bucketName)
              .createSignedUrl(storagePath, 60); // 60 seconds
              
            if (signedError) {
              console.error("Supabase Storage signed URL generation failed, falling back to download proxy:", signedError);
            } else if (signedData && signedData.signedUrl) {
              console.log("Successfully generated signed URL, redirecting directly to grant direct access without RLS...");
              return res.redirect(signedData.signedUrl);
            }
            
            // If signed URL failed, fall back to downloading via the server client
            console.log(`Downloading private/public file from Supabase via server-client proxy: bucket="${bucketName}", path="${storagePath}"`);
            
            const { data: fileBlob, error } = await supabaseClient.storage
              .from(bucketName)
              .download(storagePath);
              
            if (error) {
              console.error("Supabase Storage server download failed, falling back to fetch:", error);
            } else if (fileBlob) {
              const arrayBuffer = await fileBlob.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const filename = path.basename(storagePath);
              
              res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
              res.setHeader("Content-Type", fileBlob.type || "application/pdf");
              res.setHeader("Content-Length", buffer.length);
              return res.send(buffer);
            }
          }
        }
      } catch (e: any) {
        console.error("Supabase Client signed URL/download failed, attempting standard fetch:", e);
      }
    }
    
    // 2. Generic HTTP proxy fetch fallback (bypasses browser CORS & iframe limitations)
    try {
      console.log(`Proxying file download from URL: ${filePathStr}`);
      const response = await fetch(filePathStr);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const parsedUrl = new URL(filePathStr);
        const filename = path.basename(parsedUrl.pathname) || "document.pdf";
        
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
        const contentType = response.headers.get("content-type") || "application/pdf";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", buffer.length);
        return res.send(buffer);
      }
    } catch (fetchErr: any) {
      console.error("Universal proxy fetch failed, falling back to redirect:", fetchErr);
    }
    
    // 3. Absolute fallback
    return res.redirect(filePathStr);
  }
  
  const normalizedRequestedPath = path.normalize(filePathStr).replace(/^(\.\.(\/|\\|$))+/, '');
  const cleanPath = path.join(DATA_DIR, normalizedRequestedPath.replace(/^\/data\//, ""));
  
  if (fs.existsSync(cleanPath) && fs.statSync(cleanPath).isFile()) {
    const filename = path.basename(cleanPath);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
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
    
    const updatedDocs = await Promise.all(documents.map(async (doc: any) => {
      const oldDoc = oldDocs.find((d: any) => d.id === doc.id);
      if (!oldDoc) return doc;
      if (!oldDoc.classifiedPath) return doc;

      // Ensure edited project name is mapped to a standard project name
      if (doc.projectName) {
        doc.projectName = mapProjectNameToStandard(doc.projectName);
      }

      const clientChanged = (oldDoc.clientName || "").trim() !== (doc.clientName || "").trim();
      const projectChanged = (oldDoc.projectName || "").trim() !== (doc.projectName || "").trim();
      const dateChanged = (oldDoc.receiptDate || "").trim() !== (doc.receiptDate || "").trim();
      const docTypeChanged = (oldDoc.docType || "").trim() !== (doc.docType || "").trim();
      const docNumChanged = (oldDoc.docNumber || "").trim() !== (doc.docNumber || "").trim();

      if (clientChanged || projectChanged || dateChanged || docTypeChanged || docNumChanged) {
        // Check if file is stored in Supabase Storage
        if (oldDoc.classifiedPath.includes(".supabase.co") && supabaseClient) {
          try {
            const decodedPath = decodeURIComponent(oldDoc.classifiedPath);
            const bucketKeyword = "/public/POs Files/";
            const index = decodedPath.indexOf(bucketKeyword);
            if (index !== -1) {
              const relativeSupabasePath = decodedPath.substring(index + bucketKeyword.length);
              
              const newFolderProject = await getEnglishSlug(doc.projectName || "عام");
              const newFolderVendor = await getEnglishSlug(doc.clientName || "Unknown-Client");
              
              const fileName = relativeSupabasePath.split("/").pop();
              if (fileName) {
                const newSupabasePath = `${newFolderProject}/${newFolderVendor}/${fileName}`;
                
                if (relativeSupabasePath !== newSupabasePath) {
                  console.log(`[Storage Move] Moving edited document in Supabase from "${relativeSupabasePath}" to "${newSupabasePath}"`);
                  const { error: moveError } = await supabaseClient.storage
                    .from("POs Files")
                    .move(relativeSupabasePath, newSupabasePath);
                    
                  if (moveError) {
                    console.error("[Storage Move] Error moving document in Supabase:", moveError.message);
                  } else {
                    const { data: publicUrlData } = supabaseClient.storage
                      .from("POs Files")
                      .getPublicUrl(newSupabasePath);
                    doc.classifiedPath = publicUrlData.publicUrl;
                    console.log(`[Storage Move] Successfully updated edited document URL in Supabase to: ${doc.classifiedPath}`);
                  }
                }
              }
            }
          } catch (supMoveErr: any) {
            console.error("[Storage Move] Exception moving edited document in Supabase:", supMoveErr.message);
          }
        } else {
          // Fallback to local file rename
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
      }

      return doc;
    }));

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

// ========================================================
// 6. Quotation Comparisons API
// ========================================================

// Get all comparisons
app.get("/api/comparisons", async (req, res) => {
  try {
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    db.quotation_comparisons = db.quotation_comparisons || [];
    res.json({ success: true, comparisons: db.quotation_comparisons });
  } catch (error: any) {
    console.error("Fetch comparisons error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI Smart Quotations Analysis & Comparison
app.post("/api/comparisons/analyze", upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: "لم يتم رفع أي ملفات لعروض الأسعار." });
    }

    const { prId, fallbackMaterial, fallbackQuantity } = req.body;

    // Load original PR if provided
    let prDetails = "";
    if (prId) {
      await fetchAndSyncDbFromMongo();
      const db = getDb();
      const prDoc = (db.documents || []).find((d: any) => d.id === prId);
      if (prDoc) {
        const prItems = (prDoc.items || []).map((it: any) => `- ${it.description} (الكمية: ${it.quantity} ${it.unit || ''}, الفئة: ${it.unitPrice || 0})`).join("\n");
        prDetails = `
تفاصيل طلب الشراء الداخلي المرجعي (PR) رقم ${prDoc.docNumber || 'غير محدد'}:
المشروع: ${prDoc.projectName || 'عام'}
المورد المبدئي المذكور بالطلب: ${prDoc.clientName || 'غير محدد'}
البنود المطلوبة:
${prItems}
ملاحظات طلب الشراء الأصلي: ${prDoc.notes || ''}
        `;
      }
    }

    if (!prDetails && fallbackMaterial) {
      prDetails = `
تفاصيل البند المرجعي المطلوب للمقارنة:
البند: ${fallbackMaterial}
الكمية المطلوبة: ${fallbackQuantity || 1}
      `;
    }

    const parts: any[] = [];
    // Convert files to Gemini parts
    for (const file of files) {
      parts.push({
        inlineData: {
          data: file.buffer.toString("base64"),
          mimeType: file.mimetype,
        }
      });
    }

    const promptText = `
أنت خبير مشتريات وتحليل مالي وفني لدى شركة "دلتا لإنشاء الطرق والمقاولات" (Delta Road Construction).
لديك عروض أسعار مرفقة لعدة موردين (الملفات المرفقة بالترتيب).
مهمتك هي تحليل عروض الأسعار هذه ومقارنتها بدقة، ومطابقتها مع طلب الشراء الداخلي (PR) إن وجد.

${prDetails ? `فيما يلي تفاصيل طلب الشراء الداخلي المرجعي الذي يجب مطابقة العروض معه:\n${prDetails}` : ''}

قم بقراءة عروض الأسعار المرفقة واستخلاص البيانات التالية لكل عرض أسعار:
1. اسم المورد (supplierName) باللغة العربية.
2. المواصفات الفنية للخدمات أو المواد المقدمة في العرض (specs) باللغة العربية بالتفصيل.
3. مدى مطابقة المواصفات الفنية لعرض المورد مع متطلبات طلب الشراء (isTechnicalMatching) كقيمة منطقية (true/false). إذا كان هناك نقص أو عدم تطابق، حدده في حقل التحذير (technicalWarning) باللغة العربية، وإلا اتركه فارغاً.
4. سعر الوحدة المعروض (unitPrice) كرقم.
5. السعر الإجمالي المعروض (totalPrice) كرقم (سعر الوحدة مضروباً في الكمية).
6. مدة أو فترة التوريد (deliveryTime) باللغة العربية (مثال: "3 أيام"، "فوري"، "أسبوعين").
7. شروط الدفع والتحصيل (paymentTerms) باللغة العربية (مثال: "مقدم 100%"، "آجل 30 يوم"، "دفعات بعد التوريد").
8. تقييم أثر شروط الدفع على السيولة والتدفقات النقدية للشركة (cashFlowImpactScore) باللغة العربية (مثال: "ممتاز - يمنح مرونة عالية بدون دفعة مقدمة"، "سلبي - يضغط على السيولة بطلب دفع كامل ومقدماً").

قم بتحديد العرض الفائز (isWinner: true) بناءً على المعادلة المتوازنة: الأقل سعراً شريطة أن يكون مطابقاً فنياً ويوفر شروط دفع وتوريد مناسبة. إذا كان هناك عرض رخيص جداً ولكنه غير مطابق للمواصفات الفنية (isTechnicalMatching is false)، فلا تختره كعرض فائز، بل اختر العرض الفني الأفضل والأرخص المطابق واكتب تحذيراً فنياً واضحاً للمورد الأرخص غير المطابق.

بعد تحديد الفائز والمقارنة، اكتب "مذكرة ترسية" واحترافية بالكامل باللغة العربية (recommendationMemo) موجهة لمدير المشروع أو صاحب الصلاحية في شركة دلتا لإنشاء الطرق والمقاولات، توضح بوضوح أسباب اختيار هذا المورد تحديداً مع تفاصيل المقارنة المالية والفنية وأثر التدفقات النقدية. يجب أن تبدو كمذكرة رسمية جاهزة للطباعة والاعتماد.

يجب أن تكون الاستجابة بصيغة JSON مطابقة تماماً للمواصفات والمفاتيح التالية:
{
  "title": "عنوان مقارنة عروض الأسعار باللغة العربية (مثلاً: مقارنة عروض أسعار توريد حديد تسليح لعملية طريق...)",
  "material": "اسم البند أو المادة الأساسية للمقارنة باللغة العربية",
  "quantity": 1, // الكمية المطلوبة (مستنتجة من طلب الشراء أو المدخلات)
  "offers": [
    {
      "supplierName": "اسم المورد",
      "specs": "المواصفات الفنية المعروضة",
      "isTechnicalMatching": true,
      "technicalWarning": "تحذير عدم مطابقة المواصفات الفنية أو فارغ",
      "unitPrice": 100,
      "totalPrice": 100,
      "deliveryTime": "فترة التوريد",
      "paymentTerms": "شروط الدفع",
      "cashFlowImpactScore": "تقييم أثر التدفقات النقدية",
      "isWinner": false
    }
  ],
  "recommendationMemo": "نص مذكرة الترسية الرسمية الموصى بها باللغة العربية بالكامل..."
}
    `;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are an elite procurement manager and financial analyst for a major construction company in the Middle East. Always reply in clean Arabic. Output strict JSON only.",
      }
    });

    const resultText = response.text || "{}";
    const resultJson = JSON.parse(resultText.trim());

    res.json({ success: true, data: resultJson });
  } catch (error: any) {
    console.error("AI Quotation Analysis Error:", error);
    res.status(500).json({ success: false, error: "فشل تحليل عروض الأسعار بالذكاء الاصطناعي: " + error.message });
  }
});

// Save or update a comparison
app.post("/api/comparisons", express.json(), async (req, res) => {
  try {
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    db.quotation_comparisons = db.quotation_comparisons || [];

    const { id, title, poId, material, quantity, offers, notes, recommendationMemo } = req.body;
    if (!title || !offers || !Array.isArray(offers)) {
      return res.status(400).json({ success: false, error: "الرجاء إدخال عنوان المقارنة والعروض بشكل صحيح" });
    }

    const comparisonId = id || "comp_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const date = new Date().toISOString();

    const newComparison = {
      id: comparisonId,
      title,
      poId: poId || "",
      material: material || "",
      quantity: Number(quantity) || 1,
      offers: offers.map((offer: any) => ({
        supplierName: offer.supplierName || "",
        specs: offer.specs || "",
        unitPrice: Number(offer.unitPrice) || 0,
        totalPrice: (Number(offer.unitPrice) || 0) * (Number(quantity) || 1),
        deliveryTime: offer.deliveryTime || "",
        paymentTerms: offer.paymentTerms || "",
        isTechnicalMatching: offer.isTechnicalMatching !== undefined ? !!offer.isTechnicalMatching : true,
        technicalWarning: offer.technicalWarning || "",
        cashFlowImpactScore: offer.cashFlowImpactScore || "",
        isWinner: !!offer.isWinner
      })),
      notes: notes || "",
      recommendationMemo: recommendationMemo || "",
      updatedAt: date,
      createdAt: date
    };

    const idx = db.quotation_comparisons.findIndex((c: any) => c.id === comparisonId);
    if (idx > -1) {
      newComparison.createdAt = db.quotation_comparisons[idx].createdAt || date;
      db.quotation_comparisons[idx] = newComparison;
    } else {
      db.quotation_comparisons.push(newComparison);
    }

    saveDb(db);
    res.json({ success: true, comparison: newComparison });
  } catch (error: any) {
    console.error("Save comparison error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a comparison
app.delete("/api/comparisons/:id", async (req, res) => {
  try {
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    db.quotation_comparisons = db.quotation_comparisons || [];

    const { id } = req.params;
    db.quotation_comparisons = db.quotation_comparisons.filter((c: any) => c.id !== id);
    saveDb(db);

    res.json({ success: true, message: "تم حذف المقارنة بنجاح" });
  } catch (error: any) {
    console.error("Delete comparison error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Financial & Accounting Endpoints (Petty Cash, Subcontractors, Labor Timesheets, Cost Analysis) ---
app.get("/api/supabase-config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || supabaseUrl || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || supabaseAnonKey || ""
  });
});

app.post("/api/engineers/delete", async (req, res) => {
  try {
    const { id, name } = req.body;
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    // 1. Delete engineer from engineers list
    if (db.engineers) {
      db.engineers = db.engineers.filter((eng: any) => eng.id !== id);
    }
    
    // 2. Cascade delete: delete engineer's ledger
    if (db.engineerLedgers) {
      delete db.engineerLedgers[String(name)];
    }
    
    // 3. Cascade delete: delete engineer's transactions in pettyCashBoxDays
    if (db.pettyCashBoxDays) {
      db.pettyCashBoxDays = db.pettyCashBoxDays.filter((d: any) => d.engineer !== name);
    }
    
    await saveDb(db);
    
    // Try to delete from Supabase Database if tables exist
    const supabase = getSupabaseAdminClient() || getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('petty_cash_box_days').delete().eq('engineer', name);
        await supabase.from('engineers').delete().eq('id', id);
      } catch (sbErr) {
        console.warn("[Supabase Table Sync] Skip direct table delete because tables might not exist:", sbErr);
      }
    }
    
    res.json({ success: true, message: "تم حذف المهندس وكافة سجلاته وحركاته المالية بنجاح بالتبعية (Cascade Delete)" });
  } catch (err: any) {
    console.error("Delete engineer error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/subcontractors/delete", async (req, res) => {
  try {
    const { id } = req.body;
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    if (db.subcontractorContracts) {
      db.subcontractorContracts = db.subcontractorContracts.filter((c: any) => c.id !== id);
    }
    
    await saveDb(db);
    
    // Try to delete from Supabase Database if tables exist
    const supabase = getSupabaseAdminClient() || getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('subcontractor_contracts').delete().eq('id', id);
      } catch (sbErr) {
        console.warn("[Supabase Table Sync] Skip direct table delete because tables might not exist:", sbErr);
      }
    }
    
    res.json({ success: true, message: "تم حذف المستخلص بالكامل بنجاح" });
  } catch (err: any) {
    console.error("Delete subcontractor error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/labor-timesheets/delete", async (req, res) => {
  try {
    const { id } = req.body;
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    if (db.laborTimesheets) {
      db.laborTimesheets = db.laborTimesheets.filter((ts: any) => ts.id !== id);
    }
    
    await saveDb(db);
    
    // Try to delete from Supabase Database if tables exist
    const supabase = getSupabaseAdminClient() || getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('labor_timesheets').delete().eq('id', id);
      } catch (sbErr) {
        console.warn("[Supabase Table Sync] Skip direct table delete because tables might not exist:", sbErr);
      }
    }
    
    res.json({ success: true, message: "تم حذف الكشف بالكامل بنجاح" });
  } catch (err: any) {
    console.error("Delete labor timesheet error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/cost-analysis/delete", async (req, res) => {
  try {
    const { id } = req.body;
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    if (db.costAnalysisEntries) {
      db.costAnalysisEntries = db.costAnalysisEntries.filter((item: any) => item.id !== id);
    }
    
    await saveDb(db);
    
    // Try to delete from Supabase Database if tables exist
    const supabase = getSupabaseAdminClient() || getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('cost_analysis_entries').delete().eq('id', id);
      } catch (sbErr) {
        console.warn("[Supabase Table Sync] Skip direct table delete because tables might not exist:", sbErr);
      }
    }
    
    res.json({ success: true, message: "تم حذف القيد التحليلي بنجاح" });
  } catch (err: any) {
    console.error("Delete cost analysis error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/financial-data", async (req, res) => {
  try {
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    res.json({
      success: true,
      pettyCashBoxDays: db.pettyCashBoxDays || [],
      subcontractorContracts: db.subcontractorContracts || [],
      laborTimesheets: db.laborTimesheets || [],
      costAnalysisEntries: db.costAnalysisEntries || [],
      costAnalysisCategories: db.costAnalysisCategories || [],
      pendingTransactions: db.pendingTransactions || [],
      archives: db.archives || [],
      engineers: db.engineers || []
    });
  } catch (err: any) {
    console.error("Fetch financial data error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/financial-data/update", async (req, res) => {
  try {
    const { pettyCashBoxDays, subcontractorContracts, laborTimesheets, costAnalysisEntries, costAnalysisCategories, pendingTransactions, archives, engineers } = req.body;
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    if (pettyCashBoxDays !== undefined) db.pettyCashBoxDays = pettyCashBoxDays;
    if (subcontractorContracts !== undefined) db.subcontractorContracts = subcontractorContracts;
    if (laborTimesheets !== undefined) db.laborTimesheets = laborTimesheets;
    if (costAnalysisEntries !== undefined) db.costAnalysisEntries = costAnalysisEntries;
    if (costAnalysisCategories !== undefined) db.costAnalysisCategories = costAnalysisCategories;
    if (pendingTransactions !== undefined) db.pendingTransactions = pendingTransactions;
    if (archives !== undefined) db.archives = archives;
    if (engineers !== undefined) db.engineers = engineers;
    
    await saveDb(db);
    res.json({ success: true, message: "تم حفظ البيانات المالية المحاسبية بنجاح" });
  } catch (err: any) {
    console.error("Save financial data error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/engineers/ledger", async (req, res) => {
  try {
    const { engineerName } = req.query;
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    if (!db.engineerLedgers) db.engineerLedgers = {};
    const ledgerData = db.engineerLedgers[String(engineerName)] || [];
    res.json({ success: true, ledgerData });
  } catch (err: any) {
    console.error("Get engineer ledger error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/engineers/ledger", async (req, res) => {
  try {
    const { engineerName, ledgerData } = req.body;
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    if (!db.engineerLedgers) db.engineerLedgers = {};
    db.engineerLedgers[String(engineerName)] = ledgerData || [];
    
    // Also merge these ledgerData back to db.pettyCashBoxDays so the general sync matches
    if (!db.pettyCashBoxDays) db.pettyCashBoxDays = [];
    // Remove old boxDays for this engineer
    db.pettyCashBoxDays = db.pettyCashBoxDays.filter((d: any) => d.engineer !== engineerName);
    // Add the new ones
    if (Array.isArray(ledgerData)) {
      ledgerData.forEach((day: any) => {
        db.pettyCashBoxDays.push({
          ...day,
          engineer: engineerName
        });
      });
    }
    
    saveDb(db);
    res.json({ success: true, message: "تم ترحيل واعتماد العهدة للمهندس بنجاح" });
  } catch (err: any) {
    console.error("Save engineer ledger error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/engineers/ledger/reset", async (req, res) => {
  try {
    const { engineerName } = req.body;
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    if (!db.engineerLedgers) db.engineerLedgers = {};
    
    if (engineerName) {
      db.engineerLedgers[String(engineerName)] = [];
      if (db.pettyCashBoxDays) {
        db.pettyCashBoxDays = db.pettyCashBoxDays.filter((d: any) => d.engineer !== engineerName);
      }
      if (db.engineers) {
        db.engineers = db.engineers.map((eng: any) => {
          if (eng.name === engineerName) {
            return { ...eng, initialBalance: 0, openingBalance: 0, opening_balance: 0 };
          }
          return eng;
        });
      }
    } else {
      db.engineerLedgers = {};
      db.pettyCashBoxDays = [];
      if (db.engineers) {
        db.engineers = db.engineers.map((eng: any) => ({ ...eng, initialBalance: 0, openingBalance: 0, opening_balance: 0 }));
      }
    }
    
    await saveDb(db);
    
    // Perform real update/delete in Supabase database tables if they exist
    const supabase = getSupabaseAdminClient() || getSupabaseClient();
    if (supabase) {
      try {
        if (engineerName) {
          await supabase.from('engineers').update({ initial_balance: 0, opening_balance: 0 }).eq('name', engineerName);
          await supabase.from('petty_cash_box_days').delete().eq('engineer', engineerName);
        } else {
          await supabase.from('engineers').update({ initial_balance: 0, opening_balance: 0 });
          await supabase.from('petty_cash_box_days').delete().neq('id', 'placeholder');
        }
      } catch (sbErr) {
        console.warn("[Supabase Table Sync] Skip direct table update/delete because tables might not exist:", sbErr);
      }
    }
    
    res.json({ success: true, message: "تم تصفير وإعادة تعيين حركة الحسابات بالكامل بنجاح" });
  } catch (err: any) {
    console.error("Reset engineer ledger error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/engineers/ledger/insert", async (req, res) => {
  try {
    const { 
      engineerName, engineer_id,
      date, 
      inflow, amount_received,
      outflow, amount_paid,
      description, 
      method, payment_method,
      project, project_id,
      attachment, attachmentName 
    } = req.body;
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    if (!db.pettyCashBoxDays) db.pettyCashBoxDays = [];
    if (!db.engineerLedgers) db.engineerLedgers = {};
    
    const finalEngineerName = engineerName || engineer_id;
    const finalInflow = parseFloat(inflow !== undefined ? inflow : amount_received) || 0;
    const finalOutflow = parseFloat(outflow !== undefined ? outflow : amount_paid) || 0;
    const finalDescription = (description || "").trim();
    const finalMethod = (method || payment_method || "نقدي").trim();
    const finalProject = project || project_id || "";
    
    const newTx = {
      id: `tx-${Date.now()}`,
      inflow: finalInflow,
      outflow: finalOutflow,
      description: finalDescription,
      method: finalMethod,
      project: finalProject,
      attachment: attachment || undefined,
      attachmentName: attachmentName || undefined
    };
    
    // Update db.pettyCashBoxDays
    let dayObj = db.pettyCashBoxDays.find((d: any) => d.date === date && d.engineer === finalEngineerName);
    if (dayObj) {
      if (!dayObj.transactions) dayObj.transactions = [];
      dayObj.transactions.push(newTx);
    } else {
      dayObj = {
        date: date,
        engineer: finalEngineerName,
        transactions: [newTx]
      };
      db.pettyCashBoxDays.push(dayObj);
    }
    
    // Update db.engineerLedgers[finalEngineerName]
    if (!db.engineerLedgers[finalEngineerName]) {
      db.engineerLedgers[finalEngineerName] = [];
    }
    let ledgerDayObj = db.engineerLedgers[finalEngineerName].find((d: any) => d.date === date);
    if (ledgerDayObj) {
      if (!ledgerDayObj.transactions) ledgerDayObj.transactions = [];
      ledgerDayObj.transactions.push(newTx);
    } else {
      ledgerDayObj = {
        date: date,
        transactions: [newTx]
      };
      db.engineerLedgers[finalEngineerName].push(ledgerDayObj);
    }
    
    await saveDb(db);
    res.json({ success: true, message: "تم تسجيل حركة الصندوق بنجاح في قاعدة البيانات", pettyCashBoxDays: db.pettyCashBoxDays });
  } catch (err: any) {
    console.error("Insert petty cash transaction error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/engineers/ledger/delete-tx", async (req, res) => {
  try {
    const { engineerName, date, txId } = req.body;
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    if (db.pettyCashBoxDays) {
      db.pettyCashBoxDays = db.pettyCashBoxDays.map((d: any) => {
        if (d.date === date && d.engineer === engineerName) {
          return {
            ...d,
            transactions: (d.transactions || []).filter((t: any) => t.id !== txId)
          };
        }
        return d;
      }).filter((d: any) => (d.transactions && d.transactions.length > 0) || d.startingBalanceOverride !== undefined);
    }
    
    if (db.engineerLedgers && db.engineerLedgers[engineerName]) {
      db.engineerLedgers[engineerName] = db.engineerLedgers[engineerName].map((d: any) => {
        if (d.date === date) {
          return {
            ...d,
            transactions: (d.transactions || []).filter((t: any) => t.id !== txId)
          };
        }
        return d;
      }).filter((d: any) => (d.transactions && d.transactions.length > 0) || d.startingBalanceOverride !== undefined);
    }
    
    await saveDb(db);
    res.json({ success: true, message: "تم حذف الحركة بنجاح", pettyCashBoxDays: db.pettyCashBoxDays });
  } catch (err: any) {
    console.error("Delete petty cash transaction error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/engineers/ledger/update-starting-balance", async (req, res) => {
  try {
    const { engineerName, date, startingBalanceOverride } = req.body;
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    if (!db.pettyCashBoxDays) db.pettyCashBoxDays = [];
    if (!db.engineerLedgers) db.engineerLedgers = {};
    
    // Update pettyCashBoxDays
    let dayObj = db.pettyCashBoxDays.find((d: any) => d.date === date && d.engineer === engineerName);
    if (dayObj) {
      dayObj.startingBalanceOverride = parseFloat(startingBalanceOverride);
    } else {
      db.pettyCashBoxDays.push({
        date,
        engineer: engineerName,
        startingBalanceOverride: parseFloat(startingBalanceOverride),
        transactions: []
      });
    }
    
    // Update engineerLedgers
    if (!db.engineerLedgers[engineerName]) db.engineerLedgers[engineerName] = [];
    let ledgerDayObj = db.engineerLedgers[engineerName].find((d: any) => d.date === date);
    if (ledgerDayObj) {
      ledgerDayObj.startingBalanceOverride = parseFloat(startingBalanceOverride);
    } else {
      db.engineerLedgers[engineerName].push({
        date,
        startingBalanceOverride: parseFloat(startingBalanceOverride),
        transactions: []
      });
    }
    
    await saveDb(db);
    res.json({ success: true, message: "تم تحديث الرصيد الافتتاحي بنجاح", pettyCashBoxDays: db.pettyCashBoxDays });
  } catch (err: any) {
    console.error("Update starting balance error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * AI-POWERED MONTHLY FINANCIAL AGGREGATION & CATEGORIZATION
 */
app.post("/api/ai/aggregate-costs", async (req, res) => {
  try {
    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    if (!db.costAnalysisEntries) db.costAnalysisEntries = [];
    if (!db.costAnalysisCategories) db.costAnalysisCategories = ["حديد", "بوفيه", "مواد تشغيل", "نقل ومحروقات", "أجور عمالة", "مواد بناء", "ضيافة وبوفيه", "أدوات ومهمات", "أخرى"];

    // Gather all transactions from pettyCashBoxDays
    const allTransactions: any[] = [];
    if (db.pettyCashBoxDays && Array.isArray(db.pettyCashBoxDays)) {
      db.pettyCashBoxDays.forEach((day: any) => {
        if (day.transactions && Array.isArray(day.transactions)) {
          day.transactions.forEach((tx: any) => {
            // Only aggregate expenses (amount/outflow > 0, inflow = 0 or undefined)
            const inflow = parseFloat(tx.inflow) || 0;
            const outflow = parseFloat(tx.outflow) || parseFloat(tx.amount) || 0;
            
            if (outflow > 0 && inflow === 0) {
              allTransactions.push({
                id: tx.id,
                date: tx.date || day.date,
                project: tx.project || "عام",
                category: tx.category || "أخرى",
                amount: outflow,
                description: tx.description || "",
                engineer: tx.engineer || ""
              });
            }
          });
        }
      });
    }

    if (allTransactions.length === 0) {
      return res.json({
        success: true,
        message: "لم يتم العثور على أي مصروفات أو عهد يومية غير مجمعة في النظام للمزامنة والتحليل.",
        addedEntries: []
      });
    }

    if (!geminiApiKey) {
      return res.status(500).json({
        success: false,
        error: "لم يتم تكوين مفتاح API لجيميني (GEMINI_API_KEY). الرجاء إضافته في الإعدادات لتفعيل التجميع الذكي."
      });
    }

    const systemInstruction = `You are an expert Senior Construction Financial Analyst and Forensic Accountant.
Analyze the list of raw daily petty cash transactions and aggregate them monthly (by YYYY-MM) per unique combination of (Project, Standard Clean Accounting Category).
Clean categories MUST be mapped to one of: "حديد", "بوفيه", "مواد تشغيل", "نقل ومحروقات", "أجور عمالة", "مواد بناء", "ضيافة وبوفيه", "أدوات ومهمات", "أخرى".
For each aggregated group (Month, Project, Category):
- Sum the total cost amount of transactions.
- Write a highly professional, articulate Arabic accounting summary (ملخص محاسبي للذكاء الاصطناعي) of what these expenses covered based on the raw descriptions of all grouped transactions. Avoid generic text. Use proper financial Arabic terminology.
Return the aggregated entries matching the CostEntry schema in JSON format.`;

    const textContent = `Analyze, category-clean, and aggregate these ${allTransactions.length} raw petty cash expenses.
Raw Transactions:
${JSON.stringify(allTransactions, null, 2)}
Output the results strictly as a JSON object matching the requested schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: textContent }] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aggregatedEntries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  project: { type: Type.STRING, description: "Project name associated with the aggregate." },
                  category: { type: Type.STRING, description: "Strict clean category matching one of standard categories." },
                  amount: { type: Type.NUMBER, description: "Total aggregated cost amount." },
                  date: { type: Type.STRING, description: "Representing month, formatted as first day of the month: YYYY-MM-01" },
                  description: { type: Type.STRING, description: "Elegant professional Arabic financial summary." },
                  engineer: { type: Type.STRING, description: "Always 'الذكاء الاصطناعي (تجميع)'" }
                },
                required: ["project", "category", "amount", "date", "description", "engineer"]
              }
            }
          },
          required: ["aggregatedEntries"]
        }
      }
    });

    const textResult = response?.text || "{}";
    const parsedResult = JSON.parse(textResult.trim());
    const aiEntries = parsedResult.aggregatedEntries || [];

    // Assign unique IDs to each generated entry
    const timestamp = Date.now();
    const formattedAiEntries = aiEntries.map((entry: any, index: number) => ({
      id: `agg-cost-${timestamp}-${index}`,
      project: entry.project,
      category: entry.category,
      amount: entry.amount,
      date: entry.date,
      description: entry.description,
      engineer: entry.engineer || "الذكاء الاصطناعي (تجميع)"
    }));

    // Filter out previous AI-aggregated entries to avoid duplication
    const manualEntries = db.costAnalysisEntries.filter(
      (entry: any) => !entry.id.startsWith("agg-cost-") && entry.engineer !== "الذكاء الاصطناعي (تجميع)"
    );

    // Save back to db
    db.costAnalysisEntries = [...formattedAiEntries, ...manualEntries];
    saveDb(db);

    res.json({
      success: true,
      message: `تمت مزامنة وتجميع وتصنيف المصروفات شهرياً بالذكاء الاصطناعي بنجاح! تم إنشاء وتحديث عدد ${formattedAiEntries.length} قيد مالي تراكمي في جدول تحليل التكاليف والمخططات بنسبة دقة 100%.`,
      addedEntries: formattedAiEntries
    });

  } catch (err: any) {
    console.error("AI aggregation route error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * AI-POWERED MONTHLY FINANCIAL AGGREGATION & ARCHIVING PER ENGINEER
 */
app.post("/api/ai/aggregate-engineer-costs", async (req, res) => {
  try {
    const { engineerName, month } = req.body;
    if (!engineerName || !month) {
      return res.status(400).json({ success: false, error: "اسم المهندس والشهر مطلوبان لإتمام عملية التحليل." });
    }

    await fetchAndSyncDbFromMongo();
    const db = getDb();
    
    if (!db.costAnalysisEntries) db.costAnalysisEntries = [];
    if (!db.costAnalysisCategories) db.costAnalysisCategories = ["حديد", "بوفيه", "مواد تشغيل", "نقل ومحروقات", "أجور عمالة", "مواد بناء", "ضيافة وبوفيه", "أدوات ومهمات", "أخرى"];

    const [yearStr, monthStr] = month.split("-"); // "2026-07" -> "2026", "07"

    // Gather all transactions for this engineer and month
    const engineerTransactions: any[] = [];
    if (db.pettyCashBoxDays && Array.isArray(db.pettyCashBoxDays)) {
      db.pettyCashBoxDays.forEach((day: any) => {
        const isSameEngineer = day.engineer && day.engineer.trim().toLowerCase() === engineerName.trim().toLowerCase();
        const isSameMonth = day.date && day.date.startsWith(month);
        
        if (isSameEngineer && isSameMonth) {
          if (day.transactions && Array.isArray(day.transactions)) {
            day.transactions.forEach((tx: any) => {
              const outflow = parseFloat(tx.outflow) || parseFloat(tx.amount) || 0;
              if (outflow > 0) {
                engineerTransactions.push({
                  id: tx.id,
                  date: tx.date || day.date,
                  project: tx.project || "عام",
                  amount: outflow,
                  description: tx.description || "",
                  engineer: engineerName
                });
              }
            });
          }
        }
      });
    }

    if (engineerTransactions.length === 0) {
      return res.json({
        success: true,
        message: `لم يتم العثور على أي مصروفات أو عهد يومية مسجلة لعهدة المهندس (${engineerName}) خلال شهر (${monthStr}-${yearStr}).`,
        addedEntries: [],
        noData: true
      });
    }

    if (!geminiApiKey) {
      return res.status(500).json({
        success: false,
        error: "لم يتم تكوين مفتاح API لجيميني (GEMINI_API_KEY). الرجاء إضافته في الإعدادات لتفعيل التجميع الذكي."
      });
    }

    const systemInstruction = `You are an expert Senior Construction Financial Analyst and Forensic Accountant.
Analyze the list of raw daily petty cash transactions of the engineer (${engineerName}) for the month (${month}) and aggregate them by unique combination of (Project, Standard Clean Accounting Category).
Clean categories MUST be mapped to one of the standard categories: "حديد", "بوفيه", "مواد تشغيل", "نقل ومحروقات", "أجور عمالة", "مواد بناء", "ضيافة وبوفيه", "أدوات ومهمات", "أخرى".
If a transaction corresponds to iron or steel reinforcement, map it strictly to "حديد".
If a transaction is related to pantry, coffee, tea, meals, or buffets, map it strictly to "بوفيه".
If a transaction is related to project operations, consumables, raw materials, or site operation, map it strictly to "مواد تشغيل".
For each aggregated group (Project, Category):
- Sum the total cost amount of transactions.
- Write a highly professional, articulate Arabic accounting summary (ملخص محاسبي للذكاء الاصطناعي) of what these expenses covered based on the raw descriptions of all grouped transactions. Avoid generic text. Use proper financial Arabic terminology.
Return the aggregated entries matching the requested JSON schema.`;

    const textContent = `Analyze, category-clean, and aggregate these ${engineerTransactions.length} raw petty cash expenses for engineer ${engineerName}.
Raw Transactions:
${JSON.stringify(engineerTransactions, null, 2)}
Output the results strictly as a JSON object matching the requested schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [{ text: textContent }] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aggregatedEntries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  project: { type: Type.STRING, description: "Project name associated with the aggregate." },
                  category: { type: Type.STRING, description: "Strict clean category matching one of standard categories." },
                  amount: { type: Type.NUMBER, description: "Total aggregated cost amount." },
                  date: { type: Type.STRING, description: "Representing month, formatted as first day of the month: YYYY-MM-01" },
                  description: { type: Type.STRING, description: "Elegant professional Arabic financial summary." }
                },
                required: ["project", "category", "amount", "date", "description"]
              }
            }
          },
          required: ["aggregatedEntries"]
        }
      }
    });

    const textResult = response?.text || "{}";
    const parsedResult = JSON.parse(textResult.trim());
    const aiEntries = parsedResult.aggregatedEntries || [];

    // Assign unique IDs to each generated entry
    const timestamp = Date.now();
    const formattedAiEntries = aiEntries.map((entry: any, index: number) => ({
      id: `agg-eng-cost-${timestamp}-${index}`,
      project: entry.project,
      category: entry.category,
      amount: entry.amount,
      date: `${month}-01`, // first day of target month
      description: entry.description,
      engineer: engineerName
    }));

    // Filter out previous AI-aggregated entries for this specific engineer and month to avoid duplication
    db.costAnalysisEntries = db.costAnalysisEntries.filter(
      (entry: any) => !(entry.engineer && entry.engineer.trim().toLowerCase() === engineerName.trim().toLowerCase() && entry.date && entry.date.startsWith(month))
    );

    // Append new entries
    db.costAnalysisEntries = [...formattedAiEntries, ...db.costAnalysisEntries];
    saveDb(db);

    // Now, generate the clean white-background printing-standard Excel workbook
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["كشف تصنيف وتحليل مصروفات وعهد المهندس الشهري (الذكاء الاصطناعي)"],
      [""],
      ["اسم المهندس:", engineerName],
      ["الفترة الزمنية للتقرير:", `${monthStr} - ${yearStr}`],
      ["تاريخ الإصدار والطباعة:", new Date().toLocaleDateString("ar-EG")],
      [""],
      ["المشروع", "بند تصنيف التكلفة", "القيمة (EGP)", "التاريخ", "البيان والملخص المحاسبي الذكي (AI)", "المسؤول عن العهدة"],
    ];

    let grandTotal = 0;
    formattedAiEntries.forEach((entry: any) => {
      wsData.push([
        entry.project,
        entry.category,
        entry.amount,
        entry.date,
        entry.description,
        entry.engineer
      ]);
      grandTotal += entry.amount;
    });

    wsData.push([""]);
    wsData.push(["إجمالي المصروفات الكلي المعتمد", "", grandTotal, "", "المجموع التراكمي للبنود المحللة خلال الشهر", ""]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 25 }, // Project
      { wch: 25 }, // Category
      { wch: 18 }, // Amount
      { wch: 15 }, // Date
      { wch: 60 }, // Description
      { wch: 25 }, // Engineer
    ];

    XLSX.utils.book_append_sheet(wb, ws, "تحليل المصروفات");

    // Save the file automatically to the engineer's archived folder
    const targetDir = path.join(ORGANIZED_DIR, "engineers_folders", engineerName, `تحليلات ${yearStr}`);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const filename = `تحليل_بنود_شهر_${monthStr}.xlsx`;
    const fullPath = path.join(targetDir, filename);
    XLSX.writeFile(wb, fullPath);

    const relativePath = `/data/organized/engineers_folders/${encodeURIComponent(engineerName)}/تحليلات ${yearStr}/${filename}`;

    res.json({
      success: true,
      message: `نجحت عملية التحليل الذكي بالـ AI والتصدير للأرشيف! تم توليد عدد ${formattedAiEntries.length} بند مالي لعهدة المهندس (${engineerName}) وحفظ الشيت تلقائياً بمجلد المهندس بنجاح.`,
      addedEntries: formattedAiEntries,
      archivePath: relativePath
    });

  } catch (err: any) {
    console.error("AI engineer cost aggregation error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// AI-POWERED EXCEL ANALYSIS & CLASSIFICATION ENDPOINT
app.post("/api/ai/excel-analysis", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "لم يتم تحديد ملف إكسيل للرفع." });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet);

    if (rawRows.length === 0) {
      return res.status(400).json({ success: false, error: "ملف الإكسيل فارغ ولا يحتوي على أي بيانات." });
    }

    if (!geminiApiKey) {
      return res.status(500).json({
        success: false,
        error: "لم يتم تكوين مفتاح API لجيميني (GEMINI_API_KEY). الرجاء إضافته في الإعدادات لتفعيل الذكاء الاصطناعي."
      });
    }

    const systemInstruction = `You are an expert Construction Auditor and AI Accounting Assistant.
Analyze the provided raw rows from an uploaded Excel sheet.
Your task is to classify each row/transaction into one of the authorized standard cost categories: "حديد", "بوفيه", "مواد تشغيل", "نقل ومحروقات", "أجور عمالة", "مواد بناء", "ضيافة وبوفيه", "أدوات ومهمات", "أخرى".
For each transaction, extract or determine:
- date: formatted as YYYY-MM-DD (estimate based on context if missing).
- project: project name (default to 'عام' if not found).
- category: one of the authorized categories listed above.
- amount: the numeric cost value of the transaction.
- description: clear concise Arabic statement summarizing what this expense was for.
- engineer: the person/source of the transaction (default to 'إكسيل مستورد').

Return the classified entries as a JSON object matching the requested schema.`;

    const textContent = `Analyze and classify these raw rows extracted from an Excel sheet.
Raw Rows:
${JSON.stringify(rawRows.slice(0, 150), null, 2)}
Output the results strictly as a JSON object matching the requested schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ text: textContent }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classifiedEntries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  project: { type: Type.STRING },
                  category: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  date: { type: Type.STRING },
                  description: { type: Type.STRING },
                  engineer: { type: Type.STRING }
                },
                required: ["project", "category", "amount", "date", "description", "engineer"]
              }
            }
          },
          required: ["classifiedEntries"]
        }
      }
    });

    const textResult = response?.text || "{}";
    const parsedResult = JSON.parse(textResult.trim());
    const entries = parsedResult.classifiedEntries || [];

    const timestamp = Date.now();
    const formattedEntries = entries.map((entry: any, index: number) => ({
      id: `excel-cost-${timestamp}-${index}`,
      project: entry.project || "عام",
      category: entry.category || "أخرى",
      amount: entry.amount || 0,
      date: entry.date || new Date().toISOString().split('T')[0],
      description: entry.description || "",
      engineer: entry.engineer || "إكسيل مستورد"
    }));

    return res.json({
      success: true,
      entries: formattedEntries
    });

  } catch (err: any) {
    console.error("[Excel Analysis] Error parsing or analyzing Excel:", err);
    return res.status(500).json({ success: false, error: err.message || "حدث خطأ أثناء معالجة ملف الإكسيل بالذكاء الاصطناعي." });
  }
});

// --- Smart Webhook Endpoint for WhatsApp Petty Cash Screenshots (Gemini OCR) ---
app.post("/api/webhook/make-whatsapp", upload.single("file"), async (req, res) => {
  try {
    let fileBuffer: Buffer | null = null;
    let mimeType = "image/png";

    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype;
    } else if (req.body.imageBase64) {
      fileBuffer = Buffer.from(req.body.imageBase64, "base64");
      if (req.body.mimeType) {
        mimeType = req.body.mimeType;
      }
    } else if (req.body.imageUrl) {
      const fetchResponse = await fetch(req.body.imageUrl);
      if (fetchResponse.ok) {
        const arrayBuffer = await fetchResponse.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
        const contentType = fetchResponse.headers.get("content-type");
        if (contentType) mimeType = contentType;
      }
    }

    if (!fileBuffer) {
      return res.status(400).json({ success: false, error: "لم يتم العثور على أي صورة لمعالجتها. يرجى توفير ملف أو رابط صورة أو ترميز base64." });
    }

    await fetchAndSyncDbFromMongo();
    const db = getDb();
    const projectsList = db.projects || [];

    const imagePart = {
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType: mimeType,
      }
    };

    const promptText = `
أنت محاسب تكاليف ومراجع مالي محترف لشركة "دلتا لإنشاء الطرق والمقاولات" (Delta Road Construction).
أمامك لقطة شاشة (Screenshot) من محادثة واتساب تحتوي على كشف تصفية عهدة أسبوعية أرسلها المهندس من الموقع.
قم بقراءة وتحليل الصورة بدقة عالية واستخراج جميع المصروفات والحركات المالية اليومية المذكورة سطراً بسطر.

قائمة المشاريع المعتمدة في النظام هي:
${JSON.stringify(projectsList, null, 2)}

يرجى استخراج البيانات لكل حركة مالية وفق القواعد التالية:
1. "description": البيان بالتفصيل كما هو مكتوب باللغة العربية (مثال: "دفعه عمال شاهر").
2. "outflow": المبلغ المصروف (كرقم).
3. "inflow": المبلغ الوارد إن وجد (كرقم)، وإلا 0.
4. "date": ابحث عن تاريخ الحركة بجانبها أو في نفس السطر.
   - إذا وجدت تاريخاً واضحاً (مثال: 24-06-26، 26/6/2026، 2026-06-26)، قم بصياغته وتحويله إلى صيغة ISO القياسية YYYY-MM-DD.
   - إذا لم تجد أي تاريخ واضح بجانب الحركة، ضع القيمة فارغة (null أو "").
5. "project": حدد المشروع المرتبط بالحركة من قائمة المشاريع المعتمدة أعلاه. إذا لم تجد مطابقة، يرجى استنتاج أقرب مشروع أو تركه فارغاً.
6. "method": طريقة الدفع المستنتجة (انستاباي، نقدي، فودافون كاش، إلخ). الافتراضي هو "انستاباي".

يجب أن تكون الاستجابة بصيغة JSON مطابقة تماماً للهيكل التالي:
{
  "transactions": [
    {
      "description": "بيان الحركة",
      "outflow": 1200,
      "inflow": 0,
      "date": "2026-06-26", // أو null إذا لم يوجد تاريخ
      "project": "اسم المشروع",
      "method": "انستاباي"
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, { text: promptText }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["transactions"],
          properties: {
            transactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["description", "outflow", "inflow", "method"],
                properties: {
                  description: { type: Type.STRING },
                  outflow: { type: Type.NUMBER },
                  inflow: { type: Type.NUMBER },
                  date: { type: Type.STRING, description: "YYYY-MM-DD format if date exists, otherwise null" },
                  project: { type: Type.STRING, description: "Matching project name, or null" },
                  method: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const resultText = response.text || "";
    const resultJson = JSON.parse(resultText.trim());
    const extractedTxs = resultJson.transactions || [];

    if (!db.pendingTransactions) db.pendingTransactions = [];
    if (!db.pettyCashBoxDays) db.pettyCashBoxDays = [];

    const autoProcessed: any[] = [];
    const pendingProcessed: any[] = [];

    for (const tx of extractedTxs) {
      const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const cleanTx = {
        id: txId,
        inflow: tx.inflow || 0,
        outflow: tx.outflow || 0,
        description: tx.description || "حركة مستخرجة بالذكاء الاصطناعي",
        method: tx.method || "انستاباي",
        project: tx.project || projectsList[0] || "مشروع عام"
      };

      if (tx.date && tx.date.trim() !== "") {
        const targetDate = tx.date.trim();
        let existingDay = db.pettyCashBoxDays.find((d: any) => d.date === targetDate);
        if (existingDay) {
          existingDay.transactions.push(cleanTx);
        } else {
          db.pettyCashBoxDays.push({
            date: targetDate,
            transactions: [cleanTx]
          });
        }
        autoProcessed.push({ ...cleanTx, date: targetDate });
      } else {
        const pendingTx = {
          ...cleanTx,
          status: "Pending",
          date: ""
        };
        db.pendingTransactions.push(pendingTx);
        pendingProcessed.push(pendingTx);
      }
    }

    saveDb(db);

    triggerNotification(
      "success",
      "تصفية عهدة بالذكاء الاصطناعي 📱",
      `تمت معالجة لقطة الشاشة: تم إدراج ${autoProcessed.length} حركات تلقائياً بتواريخها، و ${pendingProcessed.length} حركات معلقة بانتظار تحديد التاريخ.`
    );

    res.json({
      success: true,
      message: "تمت معالجة لقطة الشاشة بنجاح.",
      autoProcessed,
      pendingProcessed
    });

  } catch (error: any) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * SCAN ENGINEER ORGANISED FOLDER FOR ARCHIVED DOCUMENTS & FILES
 */
function getFilesRecursively(dir: string, baseDir: string): any[] {
  let results: any[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const absPath = path.join(dir, file);
    const stat = fs.statSync(absPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(absPath, baseDir));
    } else {
      const relPath = "/" + path.relative(DATA_DIR, absPath).replace(/\\/g, "/");
      // Guess category/folder from parent folder structures
      const folderName = path.basename(path.dirname(absPath));
      const grandFolderName = path.basename(path.dirname(path.dirname(absPath)));
      results.push({
        name: file,
        path: relPath,
        size: stat.size,
        mtime: stat.mtime,
        folder: folderName,
        parentFolder: grandFolderName
      });
    }
  }
  return results;
}

app.get("/api/engineers/folders-and-files", async (req, res) => {
  try {
    const engineerName = req.query.engineerName as string;
    if (!engineerName) {
      return res.status(400).json({ success: false, error: "اسم المهندس مطلوب" });
    }
    const sanitize = (name: string) => name.replace(/[\/\\?%*:|"<>\s]/g, "_").trim();
    const sanitizedName = sanitize(engineerName);
    const targetDir = path.join(ORGANIZED_DIR, "engineers_folders", sanitizedName);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const files = getFilesRecursively(targetDir, targetDir);
    res.json({
      success: true,
      files
    });
  } catch (error: any) {
    console.error("Scan engineer files error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/engineers/upload-file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "لم يتم تحديد ملف للرفع." });
    }
    const { engineerName, date } = req.body;
    if (!engineerName) {
      return res.status(400).json({ success: false, error: "اسم المهندس مطلوب لحفظ الملف بداخل مجلده." });
    }
    
    const sanitize = (name: string) => name.replace(/[\/\\?%*:|"<>\s]/g, "_").trim();
    const sanitizedName = sanitize(engineerName);
    const dateStr = date || new Date().toISOString().split("T")[0];
    const yearStr = dateStr.split("-")[0] || "2026";
    const monthStr = dateStr.split("-")[1] || "06";
    
    const targetDir = path.join(ORGANIZED_DIR, "engineers_folders", sanitizedName, yearStr, monthStr);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const filename = path.basename(req.file.originalname);
    const finalAbsPath = path.join(targetDir, filename);
    fs.writeFileSync(finalAbsPath, req.file.buffer);
    
    const finalRelativePath = `/data/organized/engineers_folders/${sanitizedName}/${yearStr}/${monthStr}/${filename}`;
    
    res.json({
      success: true,
      path: finalRelativePath,
      name: filename
    });
  } catch (error: any) {
    console.error("Upload engineer file error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * AI-POWERED EXCEL EXPENSES EXTRACTION & CLASSIFICATION
 */
app.post("/api/ai/parse-excel-expenses", async (req, res) => {
  try {
    const { expenses, approvedCategories } = req.body;
    if (!expenses || !Array.isArray(expenses) || expenses.length === 0) {
      return res.status(400).json({ success: false, error: "لم يتم تزويد قائمة مصروفات صالحة للتحليل والتصنيف." });
    }

    if (!geminiApiKey) {
      return res.status(500).json({
        success: false,
        error: "لم يتم تكوين مفتاح API لجيميني (GEMINI_API_KEY). الرجاء إضافته في إعدادات لتفعيل التجميع والتصنيف الذكي."
      });
    }

    const categoriesList = approvedCategories || ["مواد تشغيل", "بوفيه وضيافة", "منتجات أسمنتية", "حديد تسليح", "أدوات ومهمات"];

    const systemInstruction = `You are an expert AI Construction Cost Accountant and Data Specialist.
Process a list of raw expenses parsed from an Excel sheet. Clean their descriptions, format amounts/dates, and classify/map each expense *strictly* to one of the approved categories list provided: ${JSON.stringify(categoriesList)}.
For each raw item, you must:
1. Parse the date and format it strictly as 'YYYY-MM-DD'. If the date is missing, incorrect, or not a string, use today's date or the default '2026-07-11'.
2. Format and clean the description to be brief, professional, and clear in Arabic (e.g. "شراء حديد تسليح للموقع").
3. Map the category *strictly* to one of the approved categories: ${JSON.stringify(categoriesList)}. Do not invent categories that are not in this list. If none match, use the closest general term or the first category in the list.
4. Keep the original amount as a number. If it is null or undefined or invalid, use 0.
5. If a project is specified, use it or clean it up. If not, default to "عام".
6. If an engineer is specified, keep it.
Return the structured list as a JSON object with key 'categorizedEntries'.`;

    const textContent = `Clean, format, and classify these raw expenses into our approved categories list.
Raw expenses:
${JSON.stringify(expenses, null, 2)}
Output the results strictly as a JSON object matching the requested schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [{ text: textContent }] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            categorizedEntries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  project: { type: Type.STRING, description: "Project name associated with the expense." },
                  category: { type: Type.STRING, description: "Clean category mapped strictly to one of the approved categories." },
                  amount: { type: Type.NUMBER, description: "Clean expense cost amount as a number." },
                  date: { type: Type.STRING, description: "Expense date formatted as YYYY-MM-DD." },
                  description: { type: Type.STRING, description: "Brief cleaned description of the expense in Arabic." },
                  engineer: { type: Type.STRING, description: "Engineer associated if any (optional)." }
                },
                required: ["project", "category", "amount", "date", "description"]
              }
            }
          },
          required: ["categorizedEntries"]
        }
      }
    });

    const parsedData = JSON.parse(response.text || "{}");
    const categorizedEntries = parsedData.categorizedEntries || [];

    // Assign IDs to entries
    const formattedEntries = categorizedEntries.map((entry: any, index: number) => ({
      id: `cost_excel_${Date.now()}_${index}`,
      project: entry.project || "عام",
      category: entry.category || categoriesList[0],
      amount: parseFloat(entry.amount) || 0,
      date: entry.date || new Date().toISOString().split("T")[0],
      description: entry.description || "",
      engineer: entry.engineer || undefined
    }));

    res.json({
      success: true,
      entries: formattedEntries,
      message: `تم استخراج وتصنيف عدد ${formattedEntries.length} قيد مالي بالذكاء الاصطناعي بنجاح مذهل!`
    });

  } catch (err: any) {
    console.error("AI excel parse expense route error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export the app
export default app;

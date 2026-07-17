import OpenAI from "openai";
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import * as XLSXStyle from "xlsx-js-style";



// Load environment variables
dotenv.config();

import {
  getSupabaseClient,
  getSupabaseAdminClient,
  checkSupabaseKeysConfig,
  DATA_DIR,
  ORGANIZED_DIR,
  DB_FILE,
  ORIGINAL_DB_FILE,
  defaultProjects,
  defaultSuppliers,
  defaultDb,
  getDb,
  setMemoryDb,
  saveDb,
  fetchAndSyncDbFromSupabase,
  sanitizeDeletedRecords,
  structuredLog,
  mapProjectNameToStandard,
  convertEasternToWesternNumerals,
  cleanBidiText,
  parseSafePrecisionNumber,
  sanitizeAndExtractBrands
} from "./database.js";

const supabaseClient = getSupabaseClient();
let isSupabaseDevicesDisabled = false;

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
        contents: `Translate this Arabic project name or text to a very short, clean English slug (no spaces, use hyphens). Only output the slug, nothing else. Text: "${trimmed}"`
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

// Storage directory and DB file locations are imported from ./database.js

const app = express();
const PORT = 3000;



// التأكد من تهيئة المجلدات حتى لا تضرب الـ Routes المسؤولة عن معالجة الفواتير
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ORGANIZED_DIR)) fs.mkdirSync(ORGANIZED_DIR, { recursive: true });
} catch (e) {
  console.warn("Could not create directories in /tmp:", e);
}

import { UserService } from "./services/UserService.js";
//
const Project: any = { deleteMany: async () => {}, findOne: async () => null, create: async () => {}, updateOne: async () => {}, deleteOne: async () => {} };
const AppState: any = { findOne: async () => null, updateOne: async () => {} };
const AllowedDevice: any = { updateMany: async () => {}, findOne: async () => null, deleteOne: async () => {}, findOneAndUpdate: async () => {}, find: async () => [] };
const User: any = { findOne: async () => null, find: async () => [], create: async () => {}, findOneAndUpdate: async () => {}, deleteOne: async () => {} };
const AITrainingTemplate: any = { find: async () => [], create: async () => {} };
// Core database variables and helpers are imported from ./database.js



// 4. تم إيقاف الدالة التلقائية لملء قاعدة البيانات بناءً على طلب المستخدم لعدم تكرار المشاريع الافتراضية
/*
async function seedDatabase() {
  try {
  } catch (err) {
    console.error("Error seeding database:", err);
  }
}
*/



// Run immediate background seed
try {
  UserService.seedAllRequiredUsers().catch((err: any) => console.error("Failed background seedAllRequiredUsers:", err));
} catch (err) {
  console.error("Failed background seedAllRequiredUsers:", err);
}

// تشغيل الدالة بمجرد تمام الاتصال والمزامنة لضمان استرجاع كل المشاريع من أطلس

// Populate initial DB on disk from committed repository template if available
try {
  if (!fs.existsSync(DB_FILE)) {
    if (fs.existsSync(ORIGINAL_DB_FILE)) {
      fs.copyFileSync(ORIGINAL_DB_FILE, DB_FILE);
      console.log("Successfully copied original committed db.json to /tmp/db.json");
    } else {
      // fs.writeFileSync(DB_FILE, ...); removed
    }
  }
} catch (e) {
  console.warn("Could not write initial default DB file (expected in read-only environments):", e);
}







// Helper to extract brands from description and recalculate math-accurate totalAmount








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
              await saveDb(db);
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
              await saveDb(db);
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


const aiClient = new OpenAI({
  apiKey: process.env.NARAROUTER_API_KEY || "MOCK_KEY_FOR_BUILD",
  baseURL: process.env.NARAROUTER_BASE_URL,
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
async function triggerNotification(type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) {
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
  await saveDb(db);
  return notification;
}

// REST API HELPER: Check for documents with due dates within the next 48 hours and add warnings
async function checkForUpcomingDueDates() {
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
      await saveDb(db);
    }
  } catch (err) {
    console.error("Error checking upcoming due dates:", err);
  }
}

/**
 * CORE SERVICE: Extract structured data from any Quote or PO document using Gemini API.
 */
async function extractDataFromDocument(fileBuffer: Buffer, mimeType: string, filename: string, userInstructions?: string, selectedAIModel?: string, useAdvanced?: boolean): Promise<any> {
  if (!process.env.NARAROUTER_API_KEY) {
    throw new Error("يرجى إعداد مفتاح API الخاص بـ NaraRouter في متغيرات البيئة");
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
    const modelsToTry = selectedAIModel && useAdvanced ? [selectedAIModel] : ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const currentModel = modelsToTry[(attempt - 1) % modelsToTry.length];
      try {
        console.log(`[Attempt ${attempt}/${maxRetries}] Processing extraction using model: ${currentModel}`);
        response = await ai.models.generateContent({
          model: currentModel,
          contents: { parts: [documentPart, textPart] },
          config: {
            systemInstruction: systemInstruction + "\n\nCRITICAL RULE: Do NOT hallucinate numbers. If unsure, output 0. Strictly match the JSON schema.",
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
async function extractFinancialFile(fileBuffer: Buffer, mimeType: string, filename: string, type: 'labor' | 'petty_cash' | 'subcontractor', userInstructions?: string, selectedAIModel?: string, useAdvanced?: boolean): Promise<any> {
  if (!process.env.NARAROUTER_API_KEY) {
    throw new Error("يرجى إعداد مفتاح API الخاص بـ NaraRouter في متغيرات البيئة");
  }

  const base64Data = fileBuffer.toString("base64");
  const todayStr = new Date().toISOString().split('T')[0];
  const db = getDb();


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
Analyze the provided document (which is a timesheet, labor attendance sheet, or manual log in Arabic or English, including WhatsApp screenshots) and extract worker details.
CRITICAL INSTRUCTION FOR EGYPTIAN WHATSAPP/MESSAGES: 
إذا قرأت (12 ساعة إضافي)، فهذا يعني أن الحضور = 1 (يومية عمل عادية)، والإضافي = 4 ساعات (بافتراض أن يوم العمل الطبيعي 8 ساعات، وما زاد فهو إضافي)، أو اتبع تعليمات المستخدم الحرفية إذا ذكر غير ذلك. التفريق بين (الإضافي) و (السهرة) ضروري.
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
   - project: Project name. Map to one of known projects: ${JSON.stringify(defaultProjects)} or default to 'الساحل' or 'البروج' or 'هايد بارك' if appropriate.`;

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
6. project: Current project associated with this transaction. Map to one of known projects: ${JSON.stringify(defaultProjects)}. Default to 'عام' if not clear.
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
2. project: Name of the project. Map to known projects: ${JSON.stringify(defaultProjects)}.
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
  const modelsToTry = selectedAIModel && useAdvanced ? [selectedAIModel] : ["gemini-3.5-flash", "gemini-3.1-flash-lite"];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const currentModel = modelsToTry[(attempt - 1) % modelsToTry.length];
    try {
      console.log(`[AI Financial Extraction Attempt ${attempt}] Using model: ${currentModel} for type: ${type}`);
      response = await ai.models.generateContent({
        model: currentModel,
        contents: { parts: [documentPart, textPart] },
        config: {
          systemInstruction: systemInstruction + "\n\nCRITICAL RULE: Do NOT hallucinate numbers. If unsure, output 0. Strictly match the JSON schema.",
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
  const parsed = JSON.parse(parsedText.trim());
  
  if (parsed.items && Array.isArray(parsed.items)) {
    let calculatedTotal = 0;
    parsed.items.forEach((item: any) => {
      if (typeof item.quantity === "number" && typeof item.unitPrice === "number") {
        const itemTotal = item.quantity * item.unitPrice;
        if (Math.abs((item.total || 0) - itemTotal) > 0.1) {
          item.total = itemTotal;
        }
        calculatedTotal += item.total;
      }
    });
    
    // If the stated total amount is completely off or 0, trust the calculated total
    if (!parsed.totalAmount || Math.abs(parsed.totalAmount - calculatedTotal) > 1.0) {
      if (calculatedTotal > 0) {
        parsed.totalAmount = calculatedTotal;
      }
    }
  }
  
  return parsed;
}

/**
 * POST ROUTE FOR MULTI-SECTION AI OCR & EXTRACTION
 */

app.post("/api/ai/compare-delivery-receipt", upload.single("file"), async (req, res) => {
  try {
    const poId = req.body.poId || req.body.po_id;
    if (!req.file) {
      return res.status(400).json({ success: false, error: "الرجاء رفع صورة إذن الاستلام" });
    }
    if (!poId) {
      return res.status(400).json({ success: false, error: "معرف أمر الشراء مفقود" });
    }

    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();
    const poDoc = (db.documents || []).find((d: any) => d.id === poId);
    if (!poDoc) {
      return res.status(404).json({ success: false, error: "أمر الشراء غير موجود" });
    }

    const { buffer, mimetype } = req.file;
    const base64Data = buffer.toString("base64");

    const systemInstruction = `You are a logistics and procurement expert. Analyze the attached Delivery Note image. Compare it with the provided Purchase Order (PO) items. For each item, determine how much was actually delivered based on the image. Return a JSON object with a comparisonResult array, and if any items are in the delivery note but NOT in the PO, put them in an unmatchedItems array.`;

    const poContext = `PO Items:
${JSON.stringify(poDoc.items, null, 2)}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: systemInstruction },
            { text: poContext },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimetype
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comparisonResult: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  poItemDescription: { type: Type.STRING, description: "الصنف من أمر الشراء" },
                  orderedQty: { type: Type.NUMBER },
                  deliveredQty: { type: Type.NUMBER, description: "المستخرج من الصورة" },
                  missingQty: { type: Type.NUMBER, description: "المطلوب ناقص المستلم" },
                  status: { type: Type.STRING, description: "'received', 'partial', 'missing', 'over_received'" },
                  aiSuggestion: { type: Type.STRING, description: "اقتراح ذكي، مثل 'تواصل مع المورد لتوريد الباقي'" }
                }
              }
            },
            unmatchedItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  deliveredQty: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    const responseText = response.text || "{}";
    let parsed = {};
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      console.warn("Could not parse AI response", e);
    }

    return res.json({ success: true, result: parsed });
  } catch (err: any) {
    console.error("Delivery Note Compare Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/ai/compare-delivery-note", upload.fields([{ name: 'deliveryNote', maxCount: 1 }, { name: 'catalog', maxCount: 1 }]), async (req, res) => {
  try {
    const poId = req.body.poId || req.body.po_id;
    const files = req.files as any;
    const deliveryNoteFile = files?.["deliveryNote"]?.[0];
    const catalogFile = files?.["catalog"]?.[0];

    if (!deliveryNoteFile) {
      return res.status(400).json({ success: false, error: "الرجاء رفع مستند إذن الاستلام (deliveryNote)" });
    }
    if (!poId) {
      return res.status(400).json({ success: false, error: "معرف أمر الشراء (poId) مفقود" });
    }

    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();
    const poDoc = (db.documents || []).find((d: any) => d.id === poId);
    if (!poDoc) {
      return res.status(404).json({ success: false, error: "أمر الشراء غير موجود في قاعدة البيانات" });
    }

    const systemInstruction = `You are an elite procurement and logistics matching expert. 
Your task is to compare a Delivery Note (image/pdf) against a Purchase Order (PO) items list.
CRITICAL RULE FOR NAME MISMATCH:
- If the item name in the Delivery Note does NOT exactly match the PO item name, DO NOT mark it as unknown immediately.
- You must use your deep knowledge of construction/materials company catalogs (e.g., Pipelife, Georg Fischer, Banninger, Elsewedy) to find synonyms or alternative names. For example, if PO says 'PVC Pipe 110mm' and Delivery Note says 'مواسير بايبلايف 110', you must match them.
- If a Catalog file is provided, use it as the primary reference to match ambiguous descriptions.
- Return a strict JSON object with 4 arrays: 'matchedItems', 'missingItems', 'overReceivedItems', 'unmatchedItems'.`;

    const poContext = `PO Items (Reference):
${JSON.stringify(poDoc.items, null, 2)}`;

    const parts: any[] = [
      { text: systemInstruction },
      { text: poContext },
      {
        inlineData: {
          data: deliveryNoteFile.buffer.toString("base64"),
          mimeType: deliveryNoteFile.mimetype || "image/jpeg"
        }
      }
    ];

    if (catalogFile) {
      parts.push({
        inlineData: {
          data: catalogFile.buffer.toString("base64"),
          mimeType: catalogFile.mimetype || "application/pdf"
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: parts
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchedItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  poItemDescription: { type: Type.STRING },
                  orderedQty: { type: Type.NUMBER },
                  deliveredQty: { type: Type.NUMBER },
                  matchType: { type: Type.STRING },
                  note: { type: Type.STRING }
                },
                required: ["poItemDescription", "orderedQty", "deliveredQty", "matchType"]
              }
            },
            missingItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  poItemDescription: { type: Type.STRING },
                  orderedQty: { type: Type.NUMBER },
                  missingQty: { type: Type.NUMBER }
                },
                required: ["poItemDescription", "orderedQty", "missingQty"]
              }
            },
            overReceivedItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  poItemDescription: { type: Type.STRING },
                  orderedQty: { type: Type.NUMBER },
                  deliveredQty: { type: Type.NUMBER }
                },
                required: ["poItemDescription", "orderedQty", "deliveredQty"]
              }
            },
            unmatchedItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  deliveredItemDescription: { type: Type.STRING },
                  deliveredQty: { type: Type.NUMBER },
                  note: { type: Type.STRING }
                },
                required: ["deliveredItemDescription", "deliveredQty"]
              }
            }
          },
          required: ["matchedItems", "missingItems", "overReceivedItems", "unmatchedItems"]
        }
      }
    });

    const responseText = response.text || "{}";
    let parsed = {};
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      console.warn("Could not parse AI response", e);
    }

    return res.json({ success: true, result: parsed });
  } catch (err: any) {
    console.error("Compare Delivery Note Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/ai/ocr", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم تحديد أي ملف للرفع." });
    }

    const type = req.body.type || "petty_cash"; // 'labor' | 'petty_cash' | 'subcontractor'
    const userInstructions = req.body.instructions || req.body.userInstructions || "";
    const selectedAIModel = req.body.selectedAIModel || "gemini-2.5-flash";
    const useAdvanced = req.body.useAdvanced === "true";
    
    const { buffer, mimetype, originalname } = req.file;

    const extracted = await extractFinancialFile(buffer, mimetype, originalname, type, userInstructions, selectedAIModel, useAdvanced);

    // Save temporary upload
    const sanitize = (name: string) => name.replace(/[\/\\?%*:|"<>s]/g, "_").trim();
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

    const sanitize = (name: string) => name.replace(/[\/\\?%*:|"<>s]/g, "_").trim();
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

    const finalPath = path.join(targetDir, filename);
    fs.renameSync(absTempPath, finalPath);

    const relativePath = `/data/organized/engineers_folders/${engName}/${yearStr}/${monthStr}/${filename}`;
    res.json({ success: true, path: relativePath });
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
    await fetchAndSyncDbFromSupabase(true);
    await checkForUpcomingDueDates();
    const db = getDb();

    res.json({
      documents: db.documents || [],
      notifications: db.notifications || [],
      telegramConfig: db.telegramConfig || { botToken: "", isWebhookSet: false, botUsername: null, webhookUrl: "" },
      projects: db.projects || [],
      suppliers: db.suppliers || [],
      version: db.version,
      engineers: db.engineers || [],
      pettyCashBoxDays: db.pettyCashBoxDays || [],
      engineerLedgers: db.engineerLedgers || {},
      subcontractorContracts: db.subcontractorContracts || [],
      laborTimesheets: db.laborTimesheets || [],
      costAnalysisEntries: db.costAnalysisEntries || [],
      deletedEngineerIds: db.deletedEngineerIds || [],
      draftAggregatedStatement: db.draftAggregatedStatement || [],
      archivedAggregatedStatements: db.archivedAggregatedStatements || []
    });
  } catch (err: any) {
    console.error("Fetch documents error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/state/sync", async (req, res) => {
  try {
    const state = req.body;
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();
    
    if (state.engineers) db.engineers = state.engineers;
    if (state.pettyCashBoxDays) db.pettyCashBoxDays = state.pettyCashBoxDays;
    if (state.engineerLedgers) db.engineerLedgers = state.engineerLedgers;
    if (state.subcontractorContracts) db.subcontractorContracts = state.subcontractorContracts;
    if (state.laborTimesheets) db.laborTimesheets = state.laborTimesheets;
    if (state.costAnalysisEntries) db.costAnalysisEntries = state.costAnalysisEntries;
    if (state.costAnalysisCategories) db.costAnalysisCategories = state.costAnalysisCategories;
    if (state.draftAggregatedStatement) db.draftAggregatedStatement = state.draftAggregatedStatement;
    if (state.archivedAggregatedStatements) db.archivedAggregatedStatements = state.archivedAggregatedStatements;
    
    if (state.deletedEngineerIds) {
      db.deletedEngineerIds = [...new Set([...(db.deletedEngineerIds || []), ...state.deletedEngineerIds])];
    }
    if (state.deletedSubcontractorIds) {
      db.deletedSubcontractorIds = [...new Set([...(db.deletedSubcontractorIds || []), ...state.deletedSubcontractorIds])];
    }
    if (state.deletedLaborTimesheetIds) {
      db.deletedLaborTimesheetIds = [...new Set([...(db.deletedLaborTimesheetIds || []), ...state.deletedLaborTimesheetIds])];
    }
    if (state.deletedCostAnalysisIds) {
      db.deletedCostAnalysisIds = [...new Set([...(db.deletedCostAnalysisIds || []), ...state.deletedCostAnalysisIds])];
    }

    await saveDb(db);
    res.json({ success: true });
  } catch (err: any) {
    console.error("State sync error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/projects/add", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "اسم المشروع مطلوب" });
    }
    const cleanName = name.trim();
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    const projects = db.projects || [];
    if (!projects.some((p: string) => p.toLowerCase() === cleanName.toLowerCase())) {
      db.projects = [...projects, cleanName];
      await saveDb(db);

//
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
    
    await fetchAndSyncDbFromSupabase(true);
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
    
    await saveDb(db);
    
    // Rename folders in Supabase Storage and update URLs automatically
    await moveProjectStorageFolder(cleanOld, cleanNew);
    
//
    
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
    await fetchAndSyncDbFromSupabase(true);
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
    
    await saveDb(db);
    
//
    
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
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    const suppliers = db.suppliers || [];
    if (!suppliers.some((s: string) => s.toLowerCase() === cleanName.toLowerCase())) {
      db.suppliers = [...suppliers, cleanName];
      await saveDb(db);
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
    
    await fetchAndSyncDbFromSupabase(true);
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
    
    await saveDb(db);
    
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
    await fetchAndSyncDbFromSupabase(true);
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
    
    await saveDb(db);
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
    
    await fetchAndSyncDbFromSupabase(true);
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
    
    await saveDb(db);
    res.json({ success: true, updatedCount });
  } catch (error: any) {
    console.error("Rename unit error:", error);
    res.status(500).json({ error: error.message });
  }
});

async function getNextPoNumberForProject(db: any, projectName: string): Promise<string> {
  const cleanProj = (projectName || "عام").trim();
  
//
  const projectPos = (db.documents || []).filter(
    (d: any) => 
      ((d.docType || d.type)?.toLowerCase() === 'po' || (d.docType || d.type) === 'أمر شراء' || d.category === 'purchase_order') && 
      (d.projectName || 'عام').trim() === cleanProj
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
    await fetchAndSyncDbFromSupabase(true);
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
//
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
//
  // the device has been deleted from Supabase by an Admin! We must sync this deletion 
//
  if (supabaseClient && !isSupabaseDevicesDisabled && !supabaseRecord) {
    if (localRecord) {
//
      db.allowed_devices = db.allowed_devices.filter((d: any) => d.device_fingerprint !== fingerprint);
      await saveDb(db);

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
  let lWeight = getWeight(localStatus);

  let maxWeight = Math.max(sWeight, lWeight);
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
  } else if (supabaseRole === "admin" || localRole === "admin") {
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
    await saveDb(db2);
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
        await saveDb(db3);
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
      await saveDb(db3);
    }
  }

  const resolvedNickname = 
    (supabaseRecord?.nickname || supabaseRecord?.device_name) ||
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
    const user = await UserService.login(email, password);
    return res.json({ success: true, user });
  } catch (err: any) {
    console.error("[Auth] Login error:", err);
    return res.status(err.message.includes("كلمة المرور") || err.message.includes("مسجل") ? 401 : (err.message.includes("تعطيل") ? 403 : 500)).json({ success: false, error: err.message });
  }
});

// Endpoint to verify the active session on app startup or navigation
app.post("/api/auth/verify-session", async (req, res) => {
  try {
    const user = await UserService.verifySession(req.body.email);
    return res.json({ success: true, user });
  } catch (err: any) {
    console.error("[Session verification] Error:", err);
    return res.status(401).json({ success: false, error: err.message });
  }
});

// Admin Route: Get Users List
app.get("/api/admin/users", async (req, res) => {
  try {
    const users = await UserService.listUsers();
    return res.json({ success: true, users });
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
    const result = await UserService.createUser(name, email, password, role, allowed_departments);
    return res.json(result);
  } catch (err: any) {
    console.error("[Auth] Create user error:", err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Admin Route: Update User (Edit Role or status or name or email or password or departments)
app.post("/api/admin/users/update", async (req, res) => {
  try {
    const { id, email, name, role, status, password, newEmail, allowed_departments } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "البريد الإلكتروني للموظف مطلوب" });
    }
    const result = await UserService.updateUser(id, email, name, role, status, password, newEmail, allowed_departments);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Admin Route: Delete User (or de-activate)
app.post("/api/admin/users/delete", async (req, res) => {
  try {
    const { id, email } = req.body;
    const result = await UserService.deleteUser(id, email);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
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
    const result = UserService.verifyPassword(req.body.password);
    return res.json(result);
  } catch (err: any) {
    return res.status(401).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/change-password", async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    const result = await UserService.changePassword(email, currentPassword, newPassword);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/reset", async (req, res) => {
  try {
    const result = await UserService.resetAdmin(req.body.secret);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
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

//

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

//

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
      await saveDb(db);
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
      await saveDb(db);
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

//

    // 3. Local JSON - Complete removal from array
    try {
      const db = getDb();

      if (db.allowed_devices) {
        db.allowed_devices = db.allowed_devices.filter((d: any) => d.device_fingerprint !== fingerprint);
      }
      if (db.deleted_devices) {
        db.deleted_devices = db.deleted_devices.filter((f: string) => f !== fingerprint);
      }
      await saveDb(db);
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
      await saveDb(db);
    }

//

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
    await saveDb(db);

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

//

    res.json({ success: true, message: "تم إعادة إرسال طلب الاتصال بنجاح" });
  } catch (err: any) {
    console.error("[Device Auth] Request Reconnect Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// AI OCR Extraction Endpoint

// 2. Direct client file upload & parsing
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم تحديد أي ملف للرفع." });
    }

    await fetchAndSyncDbFromSupabase(true);
    const { buffer, mimetype, originalname } = req.file;
    const userInstructions = req.body.instructions || req.body.notes || "";
    const selectedAIModel = req.body.selectedAIModel || "gemini-2.5-flash";
    const useAdvanced = req.body.useAdvanced === "true";
    
    let extractedData: any;
    let extractionFailed = false;
    try {
      extractedData = await extractDataFromDocument(buffer, mimetype, originalname, userInstructions, selectedAIModel, useAdvanced);
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
        
        const docNum1 = (d.docNumber || "").trim().toLowerCase();
        const docNum2 = (extractedData.docNumber || "").trim().toLowerCase();
        const docNumMatch = docNum1 && docNum2 && docNum1 !== "n/a" && docNum2 !== "n/a" && docNum1 === docNum2;
        
        if (docNumMatch && nameMatch) return true;
        
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
    await saveDb(db);
    
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

    await fetchAndSyncDbFromSupabase(true);
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
      await saveDb(db);
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

    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();


    if (action === "proceed") {
      db.documents = [proposedDocument, ...(db.documents || [])];
      await saveDb(db);

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

      await saveDb(db);

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
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();
    if (req.body.version) db.version = req.body.version;

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
    await saveDb(db);
    res.json({ success: true, documents: updatedDocs, version: db.version });
  } catch (error: any) {
    console.error("Update documents database error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Clear notifications
app.post("/api/notifications/clear", async (req, res) => {
  try {
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    db.notifications = [];
    await saveDb(db);
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
    await fetchAndSyncDbFromSupabase(true);
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
      await fetchAndSyncDbFromSupabase(true);
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

    const selectedAIModel = req.body.selectedAIModel || "gpt-5.6-luna";
    const useAdvanced = req.body.useAdvanced === "true";
    let resultText = "{}";

    if (useAdvanced) {
      // For OpenAI, parts must be mapped to the message content array format
      const openaiContent: any = parts.map(p => {
        if (p.text) return { type: "text", text: p.text };
        if (p.inlineData) return { type: "image_url", image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } };
        return { type: "text", text: "" };
      });
      const openAiResponse = await aiClient.chat.completions.create({
        model: selectedAIModel,
        messages: [
          { role: "system", content: "You are an elite procurement manager and financial analyst for a major construction company in the Middle East. Always reply in clean Arabic. Output strict JSON only." },
          { role: "user", content: openaiContent }
        ],
        response_format: { type: "json_object" }
      });
      resultText = openAiResponse.choices[0].message.content || "{}";
    } else {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          systemInstruction: "You are an elite procurement manager and financial analyst for a major construction company in the Middle East. Always reply in clean Arabic. Output strict JSON only.",
        }
      });
      resultText = response.text || "{}";
    }
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
    await fetchAndSyncDbFromSupabase(true);
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

    await saveDb(db);
    res.json({ success: true, comparison: newComparison });
  } catch (error: any) {
    console.error("Save comparison error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a comparison
app.delete("/api/comparisons/:id", async (req, res) => {
  try {
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    db.quotation_comparisons = db.quotation_comparisons || [];

    const { id } = req.params;
    db.quotation_comparisons = db.quotation_comparisons.filter((c: any) => c.id !== id);
    await saveDb(db);

    res.json({ success: true, message: "تم حذف المقارنة بنجاح" });
  } catch (error: any) {
    console.error("Delete comparison error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Financial & Accounting Endpoints (Petty Cash, Subcontractors, Labor Timesheets, Cost Analysis) ---
app.get("/api/supabase-config", (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
  });
});

app.post("/api/engineers/delete", async (req, res) => {
  try {
    const { id, name } = req.body;
    await fetchAndSyncDbFromSupabase(true);
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

    // 4. Track deleted engineers to prevent stale client-side states from restoring them
    db.deletedEngineerIds = db.deletedEngineerIds || [];
    if (id && !db.deletedEngineerIds.includes(id)) {
      db.deletedEngineerIds.push(id);
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
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    
    if (db.subcontractorContracts) {
      db.subcontractorContracts = db.subcontractorContracts.filter((c: any) => c.id !== id);
    }

    // Track deleted subcontractors to prevent stale client-side states from restoring them
    db.deletedSubcontractorIds = db.deletedSubcontractorIds || [];
    if (id && !db.deletedSubcontractorIds.includes(id)) {
      db.deletedSubcontractorIds.push(id);
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
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    
    if (db.laborTimesheets) {
      db.laborTimesheets = db.laborTimesheets.filter((ts: any) => ts.id !== id);
    }

    // Track deleted labor timesheets to prevent stale client-side states from restoring them
    db.deletedLaborTimesheetIds = db.deletedLaborTimesheetIds || [];
    if (id && !db.deletedLaborTimesheetIds.includes(id)) {
      db.deletedLaborTimesheetIds.push(id);
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
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    
    if (db.costAnalysisEntries) {
      db.costAnalysisEntries = db.costAnalysisEntries.filter((item: any) => item.id !== id);
    }

    // Track deleted cost analysis entries to prevent stale client-side states from restoring them
    db.deletedCostAnalysisIds = db.deletedCostAnalysisIds || [];
    if (id && !db.deletedCostAnalysisIds.includes(id)) {
      db.deletedCostAnalysisIds.push(id);
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

app.post("/api/cost-analysis/save-analysis", async (req, res) => {
  try {
    const { engineerName, projectName, notes, entries, categories } = req.body;
    if (!Array.isArray(entries)) {
      return res.status(400).json({ success: false, error: "تنسيق بنود التحليل غير صحيح." });
    }
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    
    db.saved_analyses = db.saved_analyses || [];
    
    const newSaved = {
      id: 'saved_analysis_' + Date.now(),
      engineerName: engineerName || 'عام',
      projectName: projectName || 'عام',
      date: new Date().toISOString(),
      notes: notes || '',
      entries,
      categories: categories || []
    };
    
    db.saved_analyses.push(newSaved);
    
    await saveDb(db);
    
    res.json({ success: true, message: "تم حفظ التحليل المالي الحالي بنجاح في السجلات المحفوظة", analysis: newSaved });
  } catch (err: any) {
    console.error("Save analysis error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/cost-analysis/saved-analyses", async (req, res) => {
  try {
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    res.json({ success: true, savedAnalyses: db.saved_analyses || [] });
  } catch (err: any) {
    console.error("Fetch saved analyses error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/cost-analysis/delete-saved-analysis", async (req, res) => {
  try {
    const { id } = req.body;
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    
    if (db.saved_analyses) {
      db.saved_analyses = db.saved_analyses.filter((item: any) => item.id !== id);
    }
    
    await saveDb(db);
    res.json({ success: true, message: "تم حذف التحليل المحفوظ بنجاح" });
  } catch (err: any) {
    console.error("Delete saved analysis error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/cost-analysis/clear-current", async (req, res) => {
  try {
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    
    // Add all current entry IDs to deleted list so they aren't synced back from stale caches
    db.deletedCostAnalysisIds = db.deletedCostAnalysisIds || [];
    const currentEntries = db.costAnalysisEntries || [];
    currentEntries.forEach((item: any) => {
      if (item.id && !db.deletedCostAnalysisIds.includes(item.id)) {
        db.deletedCostAnalysisIds.push(item.id);
      }
    });
    
    db.costAnalysisEntries = [];
    
    await saveDb(db);
    
    // Try to delete from Supabase Database if tables exist
    const supabase = getSupabaseAdminClient() || getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('cost_analysis_entries').delete().neq('id', '_dummy_id_clear_all_');
      } catch (sbErr) {
        console.warn("[Supabase Table Sync] Skip direct table delete because tables might not exist:", sbErr);
      }
    }
    
    res.json({ success: true, message: "تم تصفير وحذف كافة بنود التحليل المالي الحالي بنجاح للبدء من جديد" });
  } catch (err: any) {
    console.error("Clear current analysis error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/financial-data", async (req, res) => {
  try {
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    console.log('[API financial-data] engineers=', db.engineers?.length || 0);
    console.log('[API financial-data] pettyCashBoxDays=', db.pettyCashBoxDays?.length || 0);

    res.json({
      success: true,
      pettyCashBoxDays: db.pettyCashBoxDays || [],
      subcontractorContracts: db.subcontractorContracts || [],
      laborTimesheets: db.laborTimesheets || [],
      costAnalysisEntries: db.costAnalysisEntries || [],
      costAnalysisCategories: db.costAnalysisCategories || [],
      pendingTransactions: db.pendingTransactions || [],
      archives: db.archives || [],
      engineers: db.engineers || [],
      projectsList: db.projects || [],
      version: db.version
    });
  } catch (err: any) {
    console.error("Fetch financial data error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/financial-data/update", async (req, res) => {
  try {
    const { pettyCashBoxDays, subcontractorContracts, laborTimesheets, costAnalysisEntries, costAnalysisCategories, pendingTransactions, archives, engineers } = req.body;
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();
    if (req.body.version) db.version = req.body.version;


    // Load deleted entities lists to prevent restoration of deleted items
    db.deletedEngineerIds = db.deletedEngineerIds || [];
    db.deletedSubcontractorIds = db.deletedSubcontractorIds || [];
    db.deletedLaborTimesheetIds = db.deletedLaborTimesheetIds || [];
    db.deletedCostAnalysisIds = db.deletedCostAnalysisIds || [];
    
    if (pettyCashBoxDays !== undefined && pettyCashBoxDays.length > 0) db.pettyCashBoxDays = pettyCashBoxDays;
    if (subcontractorContracts !== undefined) {
      db.subcontractorContracts = subcontractorContracts.filter((c: any) => !db.deletedSubcontractorIds.includes(c.id));
    }
    if (laborTimesheets !== undefined) {
      db.laborTimesheets = laborTimesheets.filter((ts: any) => !db.deletedLaborTimesheetIds.includes(ts.id));
    }
    if (costAnalysisEntries !== undefined) {
      db.costAnalysisEntries = costAnalysisEntries.filter((item: any) => !db.deletedCostAnalysisIds.includes(item.id));
    }
    if (costAnalysisCategories !== undefined) db.costAnalysisCategories = costAnalysisCategories;
    if (pendingTransactions !== undefined) db.pendingTransactions = pendingTransactions;
    if (archives !== undefined) db.archives = archives;
    if (engineers !== undefined && engineers.length > 0) {
      db.engineers = engineers.filter((eng: any) => !db.deletedEngineerIds.includes(eng.id));
    }
    
    const updatedDb = await saveDb(db);
    res.json({ 
      success: true, 
      message: "تم حفظ البيانات المالية المحاسبية بنجاح",
      pettyCashBoxDays: updatedDb.pettyCashBoxDays || [],
      subcontractorContracts: updatedDb.subcontractorContracts || [],
      laborTimesheets: updatedDb.laborTimesheets || [],
      costAnalysisEntries: updatedDb.costAnalysisEntries || [],
      costAnalysisCategories: updatedDb.costAnalysisCategories || [],
      pendingTransactions: updatedDb.pendingTransactions || [],
      archives: updatedDb.archives || [],
      engineers: updatedDb.engineers || [],
      version: updatedDb.version
    });
  } catch (err: any) {
    console.error("Save financial data error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/engineers/ledger", async (req, res) => {
  try {
    const { engineerName } = req.query;
    await fetchAndSyncDbFromSupabase(true);
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
    
    if (!engineerName) {
      return res.status(400).json({ success: false, error: "الرجاء اختيار اسم المهندس" });
    }
    if (!Array.isArray(ledgerData)) {
      return res.status(400).json({ success: false, error: "بيانات العهدة غير صالحة" });
    }

    await fetchAndSyncDbFromSupabase(true);
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
    
    const updatedDb = await saveDb(db);
    res.json({ 
      success: true, 
      message: "تم ترحيل واعتماد العهدة للمهندس بنجاح",
      ledgerData: updatedDb.engineerLedgers[String(engineerName)] || [],
      pettyCashBoxDays: updatedDb.pettyCashBoxDays || []
    });
  } catch (err: any) {
    console.error("Save engineer ledger error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function calculateInflow(transactions: any[]): number {
  return (transactions || []).reduce((acc, t) => acc + (Number(t.inflow) || 0), 0);
}

function calculateOutflow(transactions: any[]): number {
  return (transactions || []).reduce((acc, t) => acc + (Number(t.outflow) || 0), 0);
}

function calculateLedgerBalances(sortedDays: any[], defaultInitialBalance: number): any[] {
  let runningBalance = defaultInitialBalance;
  return sortedDays.map((day) => {
    let startingBalance = runningBalance;
    if (day.startingBalanceOverride !== undefined && day.startingBalanceOverride !== null && !isNaN(Number(day.startingBalanceOverride))) {
      startingBalance = Number(day.startingBalanceOverride);
    }
    const dayInflow = calculateInflow(day.transactions);
    const dayOutflow = calculateOutflow(day.transactions);
    const endingBalance = startingBalance + dayInflow - dayOutflow;
    runningBalance = endingBalance;
    return {
      ...day,
      computedStartingBalance: startingBalance,
      computedEndingBalance: endingBalance,
      totalInflow: dayInflow,
      totalOutflow: dayOutflow,
    };
  });
}

app.post("/api/engineers/ledger/approve-range", async (req, res) => {
  try {
    const { engineerName, startDate, endDate } = req.body;
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    if (!engineerName) {
      return res.status(400).json({ success: false, error: "الرجاء اختيار اسم المهندس" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "الرجاء تحديد النطاق الزمني بالكامل" });
    }
    
    let updatedCount = 0;
    
    // Update transactions inside db.pettyCashBoxDays
    if (db.pettyCashBoxDays && Array.isArray(db.pettyCashBoxDays)) {
      db.pettyCashBoxDays = db.pettyCashBoxDays.map((d: any) => {
        if (d.engineer === engineerName && d.date >= startDate && d.date <= endDate) {
          const updatedTransactions = (d.transactions || []).map((t: any) => {
            if (t.status !== 'approved') {
              updatedCount++;
            }
            return { ...t, status: 'approved' };
          });
          return { ...d, transactions: updatedTransactions, updatedAt: new Date().toISOString() };
        }
        return d;
      });
    }
    
    // Update transactions inside db.engineerLedgers
    if (db.engineerLedgers && db.engineerLedgers[engineerName] && Array.isArray(db.engineerLedgers[engineerName])) {
      db.engineerLedgers[engineerName] = db.engineerLedgers[engineerName].map((d: any) => {
        if (d.date >= startDate && d.date <= endDate) {
          const updatedTransactions = (d.transactions || []).map((t: any) => {
            return { ...t, status: 'approved' };
          });
          return { ...d, transactions: updatedTransactions, updatedAt: new Date().toISOString() };
        }
        return d;
      });
    }

    // Excel generation
    // 1. Get default initial balance for the engineer
    const engineer = (db.engineers || []).find((e: any) => e.name === engineerName);
    const defaultInitialBalance = engineer ? (Number(engineer.initialBalance || engineer.initial_balance) || 0) : 0;

    // 2. Filter and sort all days of this engineer chronologically
    const allBoxDays = (db.pettyCashBoxDays || [])
      .filter((d: any) => d.engineer === engineerName)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    // 3. Compute ledger balances sequentially
    const computedDays = calculateLedgerBalances(allBoxDays, defaultInitialBalance);

    // 4. Filter the days that fall in the approved range [startDate, endDate]
    const approvedDays = computedDays.filter((d: any) => d.date >= startDate && d.date <= endDate);

    let relativePath = "";
    if (approvedDays.length > 0) {
      // Build rows for Excel
      const rows: any[] = [];
      const merges: any[] = [];
      let currentExcelRow = 0;

      // Title Row
      rows.push([`كشف حركة صندوق المهندس ${engineerName} للفترة من ${startDate} إلى ${endDate}`, "", "", ""]);
      merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } });
      currentExcelRow++;

      // Separator Empty Row
      rows.push(["", "", "", ""]);
      currentExcelRow++;

      approvedDays.forEach((day: any) => {
        const startingBal = day.computedStartingBalance;
        const dayTransactions = day.transactions || [];

        // Row 1: Header Row for Day
        const dateParts = day.date.split('-');
        const formattedDate = dateParts.length === 3 ? `${dateParts[2]} - ${dateParts[1]} - ${dateParts[0].slice(2)}` : day.date;
        
        rows.push([formattedDate, "كشف حركة الصندوق ليوم", "", ""]);
        merges.push({ s: { r: currentExcelRow, c: 1 }, e: { r: currentExcelRow, c: 3 } });
        currentExcelRow++;

        // Row 2: Opening Balance Row
        rows.push([startingBal, "رصيد اول اليوم", "", ""]);
        merges.push({ s: { r: currentExcelRow, c: 1 }, e: { r: currentExcelRow, c: 3 } });
        currentExcelRow++;

        // Transactions
        const transStartRowIdx = currentExcelRow + 1; // 1-indexed
        if (dayTransactions.length === 0) {
          rows.push(["", 0, "لا توجد حركات لهذا اليوم", ""]);
          currentExcelRow++;
        } else {
          dayTransactions.forEach((tx: any) => {
            const amount = tx.inflow > 0 ? tx.inflow : tx.outflow;
            const projOrMethod = tx.outflow > 0 ? tx.project : tx.method;
            rows.push(["", amount, tx.description, projOrMethod]);
            currentExcelRow++;
          });
        }
        const transEndRowIdx = currentExcelRow; // 1-indexed

        // Total Row ("الاجمالي")
        const inflowRows: number[] = [];
        const outflowRows: number[] = [];
        dayTransactions.forEach((tx: any, idx: number) => {
          if (tx.inflow > 0) {
            inflowRows.push(transStartRowIdx + idx);
          } else {
            outflowRows.push(transStartRowIdx + idx);
          }
        });

        const totalAFormula = `A${transStartRowIdx - 1}`; // Opening balance is at Row 2, which is transStartRowIdx - 1
        // (A_opening + sum of B_inflows)
        let totalAExpression = `${totalAFormula}`;
        if (inflowRows.length > 0) {
          totalAExpression += `+` + inflowRows.map(r => `B${r}`).join('+');
        }

        let totalBExpression = "0";
        if (outflowRows.length > 0) {
          totalBExpression = outflowRows.map(r => `B${r}`).join('+');
        }

        rows.push([
          { f: totalAExpression },
          { f: totalBExpression },
          "الاجمالي",
          ""
        ]);
        const totalRowIdx = currentExcelRow + 1; // 1-indexed
        currentExcelRow++;

        // Ending Balance Row ("رصيد اخر اليوم")
        rows.push([
          { f: `A${totalRowIdx}-B${totalRowIdx}` },
          "رصيد اخر اليوم",
          "",
          ""
        ]);
        merges.push({ s: { r: currentExcelRow, c: 1 }, e: { r: currentExcelRow, c: 3 } });
        currentExcelRow++;

        // Separator Empty Row
        rows.push(["", "", "", ""]);
        currentExcelRow++;
      });

      // Create Worksheet with styling using XLSXStyle
      const ws = XLSXStyle.utils.aoa_to_sheet(rows);
      ws['!merges'] = merges;
      ws['!views'] = [{ RTL: true }]; // right-to-left
      ws['!cols'] = [
        { wch: 18 }, // Col A
        { wch: 15 }, // Col B
        { wch: 35 }, // Col C
        { wch: 22 }, // Col D
      ];

      // Style elements
      const borderDashedBlue = {
        top: { style: "dashed", color: { rgb: "4F81BD" } },
        bottom: { style: "dashed", color: { rgb: "4F81BD" } },
        left: { style: "dashed", color: { rgb: "4F81BD" } },
        right: { style: "dashed", color: { rgb: "4F81BD" } }
      };
      
      const fontMain = { name: "Arial", sz: 11 };
      const fontBold = { name: "Arial", sz: 11, bold: true };
      const fontTitle = { name: "Arial", sz: 14, bold: true, color: { rgb: "1F4E78" } };

      // Style Title Row (A1)
      if (ws['A1']) {
        ws['A1'].s = {
          font: fontTitle,
          alignment: { horizontal: "center", vertical: "center" },
          fill: { fgColor: { rgb: "F2F6FA" } },
          border: borderDashedBlue
        };
      }

      for (let r = 2; r < currentExcelRow; r++) {
        ['A', 'B', 'C', 'D'].forEach(col => {
          const ref = `${col}${r+1}`;
          if (!ws[ref]) {
            ws[ref] = { v: "" };
          }
          ws[ref].s = {
            font: fontMain,
            border: borderDashedBlue,
            alignment: { horizontal: "center", vertical: "center" }
          };
          
          if (col === 'A' || col === 'B') {
            ws[ref].s.numFmt = '#,##0.00';
            ws[ref].s.alignment = { horizontal: "left", vertical: "center" };
          }
        });
      }

      // Header styling of days
      let curRow = 2; // skip title & separator
      approvedDays.forEach((day: any) => {
        const rHeader = curRow + 1;
        ['A', 'B', 'C', 'D'].forEach(col => {
          const ref = `${col}${rHeader}`;
          if (ws[ref]) {
            ws[ref].s.font = fontBold;
            ws[ref].s.fill = { fgColor: { rgb: "D9E1F2" } }; // Soft blue header
          }
        });
        curRow++; // opening row
        
        const rOpening = curRow + 1;
        ['A', 'B', 'C', 'D'].forEach(col => {
          const ref = `${col}${rOpening}`;
          if (ws[ref]) {
            ws[ref].s.font = fontBold;
            if (col === 'A') ws[ref].s.font.color = { rgb: "1F4E78" };
          }
        });
        curRow++; // transactions
        
        const dayTransactions = day.transactions || [];
        const transCount = dayTransactions.length === 0 ? 1 : dayTransactions.length;
        for (let t = 0; t < transCount; t++) {
          const rTrans = curRow + 1;
          if (ws[`C${rTrans}`]) {
            ws[`C${rTrans}`].s.alignment = { horizontal: "center", vertical: "center" };
          }
          if (ws[`D${rTrans}`]) {
            ws[`D${rTrans}`].s.alignment = { horizontal: "right", vertical: "center" };
          }
          curRow++;
        }
        
        // Total row
        const rTotal = curRow + 1;
        ['A', 'B', 'C', 'D'].forEach(col => {
          const ref = `${col}${rTotal}`;
          if (ws[ref]) {
            ws[ref].s.font = fontBold;
            ws[ref].s.fill = { fgColor: { rgb: "E2EFDA" } }; // Soft green
          }
        });
        curRow++;

        // Ending balance row
        const rEnding = curRow + 1;
        ['A', 'B', 'C', 'D'].forEach(col => {
          const ref = `${col}${rEnding}`;
          if (ws[ref]) {
            ws[ref].s.font = fontBold;
            ws[ref].s.fill = { fgColor: { rgb: "F2F2F2" } };
            if (col === 'A') ws[ref].s.font.color = { rgb: "385723" };
          }
        });
        curRow++; // separator row
        curRow++;
      });

      const wb = XLSXStyle.utils.book_new();
      XLSXStyle.utils.book_append_sheet(wb, ws, "حركة الصندوق المعتمدة");

      const sanitize = (name: string) => name.replace(/[\/\\?%*:|"<>\s]/g, "_").trim();
      const sanitizedName = sanitize(engineerName);
      const folderPath = path.join(ORGANIZED_DIR, "engineers_folders", sanitizedName, "approved_ledgers");
      fs.mkdirSync(folderPath, { recursive: true });
      
      const filename = `كشف_معتمد_${startDate}_إلى_${endDate}.xlsx`;
      const fullPath = path.join(folderPath, filename);
      XLSXStyle.writeFile(wb, fullPath);

      relativePath = "/data/" + path.relative(DATA_DIR, fullPath).replace(/\\/g, "/");
    }
    
    await saveDb(db);
    res.json({ 
      success: true, 
      message: `تم بنجاح اعتماد وإغلاق حركات العهدة للمهندس (${engineerName}) للفترة من ${startDate} إلى ${endDate}.`,
      pettyCashBoxDays: db.pettyCashBoxDays,
      excelPath: relativePath
    });
  } catch (err: any) {
    console.error("Approve ledger range error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/engineers/ledger/reset", async (req, res) => {
  try {
    const { engineerName } = req.body;
    await fetchAndSyncDbFromSupabase(true);
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
            return { ...eng, initialBalance: 0, openingBalance: 0, opening_balance: 0, updatedAt: new Date().toISOString() };
          }
          return eng;
        });
      }
    } else {
      db.engineerLedgers = {};
      db.pettyCashBoxDays = [];
      if (db.engineers) {
        db.engineers = db.engineers.map((eng: any) => ({ ...eng, initialBalance: 0, openingBalance: 0, opening_balance: 0, updatedAt: new Date().toISOString() }));
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
    await fetchAndSyncDbFromSupabase(true);
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
      status: 'unapproved',
      attachment: attachment || undefined,
      attachmentName: attachmentName || undefined
    };
    
    // Update db.pettyCashBoxDays
    let dayObj = db.pettyCashBoxDays.find((d: any) => d.date === date && d.engineer === finalEngineerName);
    if (dayObj) {
      if (!dayObj.transactions) dayObj.transactions = [];
      dayObj.transactions.push(newTx);
      dayObj.updatedAt = new Date().toISOString();
    } else {
      dayObj = {
        date: date,
        engineer: finalEngineerName,
        transactions: [newTx],
        updatedAt: new Date().toISOString()
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
      ledgerDayObj.updatedAt = new Date().toISOString();
    } else {
      ledgerDayObj = {
        date: date,
        transactions: [newTx],
        updatedAt: new Date().toISOString()
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
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    
    if (db.pettyCashBoxDays) {
      db.pettyCashBoxDays = db.pettyCashBoxDays.map((d: any) => {
        if (d.date === date && d.engineer === engineerName) {
          return {
            ...d,
            transactions: (d.transactions || []).filter((t: any) => t.id !== txId),
            updatedAt: new Date().toISOString()
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
            transactions: (d.transactions || []).filter((t: any) => t.id !== txId),
            updatedAt: new Date().toISOString()
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
    
    if (!engineerName) {
      return res.status(400).json({ success: false, error: "الرجاء اختيار اسم المهندس" });
    }
    if (!date) {
      return res.status(400).json({ success: false, error: "الرجاء تحديد التاريخ" });
    }
    if (startingBalanceOverride === undefined || startingBalanceOverride === null || isNaN(parseFloat(startingBalanceOverride))) {
      return res.status(400).json({ success: false, error: "الرجاء تحديد قيمة رصيد أول اليوم صالحة" });
    }

    const adminClient = getSupabaseAdminClient();
    if (!adminClient) {
      return res.status(500).json({ success: false, error: "فشل الاتصال بقاعدة بيانات Supabase" });
    }

    // 1. Fetch complete app_state directly from Supabase
    let { data: row, error: fetchErr } = await adminClient
      .from('app_state')
      .select('data')
      .eq('key', 'global_state')
      .maybeSingle();

    if (fetchErr || !row) {
      const { data: row2 } = await adminClient
        .from('app_state')
        .select('data')
        .eq('id', 'global_state')
        .maybeSingle();
      if (row2) row = row2;
    }

    if (!row) {
      console.error("Error fetching app_state for updating starting balance:", fetchErr);
      return res.status(500).json({ success: false, error: "تعذر قراءة قاعدة البيانات من Supabase" });
    }

    const db = row.data || {};
    
    if (!db.pettyCashBoxDays) db.pettyCashBoxDays = [];
    if (!db.engineerLedgers) db.engineerLedgers = {};
    
    const nowStr = new Date().toISOString();

    // Update pettyCashBoxDays
    let dayObj = db.pettyCashBoxDays.find((d: any) => d.date === date && (d.engineer || "عام") === (engineerName || "عام"));
    if (dayObj) {
      dayObj.startingBalanceOverride = parseFloat(startingBalanceOverride);
      dayObj.updatedAt = nowStr;
    } else {
      db.pettyCashBoxDays.push({
        date,
        engineer: engineerName,
        startingBalanceOverride: parseFloat(startingBalanceOverride),
        transactions: [],
        updatedAt: nowStr
      });
    }
    
    // Update engineerLedgers
    if (!db.engineerLedgers[engineerName]) db.engineerLedgers[engineerName] = [];
    let ledgerDayObj = db.engineerLedgers[engineerName].find((d: any) => d.date === date);
    if (ledgerDayObj) {
      ledgerDayObj.startingBalanceOverride = parseFloat(startingBalanceOverride);
      ledgerDayObj.updatedAt = nowStr;
    } else {
      db.engineerLedgers[engineerName].push({
        date,
        startingBalanceOverride: parseFloat(startingBalanceOverride),
        transactions: [],
        updatedAt: nowStr
      });
    }
    
    // 3. Save db which correctly updates all Supabase tables
    await saveDb(db);
    setMemoryDb(db);

    // 5. Return success response with the updated data
    res.json({ success: true, message: "تم تحديث الرصيد الافتتاحي بنجاح", pettyCashBoxDays: db.pettyCashBoxDays || [] });
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
    await fetchAndSyncDbFromSupabase(true);
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

    if (!process.env.NARAROUTER_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "يرجى إعداد مفتاح API الخاص بـ NaraRouter في متغيرات البيئةلتفعيل التجميع الذكي."
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
        systemInstruction: systemInstruction + "\n\nCRITICAL RULE: Do NOT hallucinate numbers. If unsure, output 0. Strictly match the JSON schema.",
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
    await saveDb(db);

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

    await fetchAndSyncDbFromSupabase(true);
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

    if (!process.env.NARAROUTER_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "يرجى إعداد مفتاح API الخاص بـ NaraRouter في متغيرات البيئةلتفعيل التجميع الذكي."
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
        systemInstruction: systemInstruction + "\n\nCRITICAL RULE: Do NOT hallucinate numbers. If unsure, output 0. Strictly match the JSON schema.",
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
    await saveDb(db);

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

    if (!process.env.NARAROUTER_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "يرجى إعداد مفتاح API الخاص بـ NaraRouter في متغيرات البيئة"
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
        systemInstruction: systemInstruction + "\n\nCRITICAL RULE: Do NOT hallucinate numbers. If unsure, output 0. Strictly match the JSON schema.",
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

// AI-POWERED MULTIMODAL CUSTODY PARSER (AI Multimodal Parser)


app.get("/api/ai/verify", async (req, res) => {
  try {
    const key = process.env.NARAROUTER_API_KEY;
    console.log(key ? "Key Found" : "Key Missing");
    
    if (!key) {
      return res.status(500).json({ success: false, error: "Missing NARAROUTER_API_KEY in environment variables." });
    }
    
    // Verify connection by fetching models
    await aiClient.models.list();
    return res.json({ status: "success", message: "NaraRouter API is connected!" });
  } catch (err: any) {
    console.error("NaraRouter Connection Error:", err.message);
    return res.status(500).json({ status: "error", error: err.message });
  }
});
app.get("/api/ai/models", async (req, res) => {
  try {
    if (!process.env.NARAROUTER_API_KEY) {
      return res.status(500).json({ error: "يرجى إعداد مفتاح API الخاص بـ NaraRouter في متغيرات البيئة" });
    }
    const models = await aiClient.models.list();
    return res.json({ success: true, models: models.data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/custody/analyze-multimodal", upload.single("file"), async (req, res) => {
  try {
    const selectedMonth = req.body.selected_month || req.body.selectedMonth; // format "YYYY-MM"
    if (!selectedMonth) {
      return res.status(400).json({ success: false, error: "لم يتم تحديد الشهر المستهدف للتحليل." });
    }

    const engineerName = req.body.engineerName || "عام";
    const selectedAIModel = req.body.selectedAIModel || "gpt-5.6-luna";
    const useMemory = req.body.useMemory === "true";

    if (!process.env.NARAROUTER_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "يرجى إعداد مفتاح API الخاص بـ NaraRouter في متغيرات البيئة"
      });
    }

    const db = getDb();


    // 1. Load Training templates for Few-Shot prompting
    let trainingData: any[] = db.aiTrainingTemplates || [];

    let isExcel = false;
    let excelText = "";
    let imagePart: any = null;

    if (req.file) {
      const mime = req.file.mimetype || "";
      const name = req.file.originalname || "";
      if (
        mime.includes("sheet") || 
        mime.includes("excel") || 
        mime.includes("csv") || 
        name.endsWith(".xlsx") || 
        name.endsWith(".xls") || 
        name.endsWith(".csv")
      ) {
        isExcel = true;
      }
    }

    if (isExcel && req.file) {
      // Parse Excel / CSV using xlsx library
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet);

      if (rawRows.length === 0) {
        return res.status(400).json({ success: false, error: "ملف الإكسيل فارغ ولا يحتوي على أي بيانات." });
      }
      excelText = JSON.stringify(rawRows.slice(0, 250), null, 2);
    } else {
      // Handle Image / Screenshot (pasted or uploaded)
      let fileBuffer: Buffer | null = null;
      let mimeType = "image/png";

      if (req.file) {
        fileBuffer = req.file.buffer;
        mimeType = req.file.mimetype;
      } else if (req.body.imageBase64) {
        fileBuffer = Buffer.from(req.body.imageBase64, "base64");
        if (req.body.mimeType) mimeType = req.body.mimeType;
      }

      if (!fileBuffer) {
        return res.status(400).json({ success: false, error: "لم يتم استلام أي ملف أو صورة للتحليل." });
      }

      imagePart = {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${fileBuffer.toString("base64")}`
        }
      };
    }

    const projectsList = db.projects || [];

    // 2. Multimodal prompt construction with Few-Shot Training Data
    let systemInstruction = `أنت خبير محاسبة إنشائية متمرس ومحاسب قانوني محترف.\nقم باستخراج حركات العهدة (المبالغ الواردة/المدين والمبالغ الصادرة/الدائن) حصرياً لشهر ${selectedMonth}.\n`;
    if (useMemory && trainingData.length > 0) {
      systemInstruction += `التزم بالقواعد والمسميات والمطابقات التي تدربت عليها في الأمثلة السابقة لحفظ الأخطاء وتجنب تكرارها:\n${JSON.stringify(trainingData.slice(0, 50))}\n\n`;
    }
    systemInstruction += `يجب الالتزام بالقواعد التالية أثناء استخراج البيانات:
1. استخراج حركات العهدة وتحديد قيم المدين (inflow) والدائن (outflow).
2. بالنسبة للتاريخ: استخرج التواريخ المرتبطة بالشهر المستهدف حصرياً (${selectedMonth}). تجاهل واستبعد تماماً أي حركة تاريخها لا يقع في هذا الشهر. يجب أن يكون التاريخ بالتنسيق الصريح YYYY-MM-DD وأن يقع حصرياً في الشهر المستهدف: "${selectedMonth}". على سبيل المثال، إذا كان الشهر المستهدف هو "2026-07"، فيجب أن تكون كافة التواريخ بصيغة "2026-07-XX".
3. بالنسبة للمشروع (project): يجب تحديد اسم المشروع المرتبط بكل حركة بدقة ومطابقته حصرياً من هذه القائمة المصرح بها للمشاريع:
${JSON.stringify(projectsList)}
إذا لم تجد أي تطابق، استخدم قيمة "عام".
4. بالنسبة للبيان/الوصف (description): يجب استخراج ووصف الحركة ببيان واضح ومختصر باللغة العربية.
5. طريقة الدفع (method): حدد الطريقة (مثل "نقدي", "انستاباي", "شيك"). القيمة الافتراضية "نقدي" إذا لم تتضح.

أخرج الناتج النهائي بصيغة JSON صريحة ومطابقة للهيكل التالي فقط دون أي نصوص أو تعليقات خارجية:
{
  "extractedTransactions": [
    { "date": "YYYY-MM-DD", "description": "text", "inflow": number, "outflow": number, "project": "text", "method": "text" }
  ]
}`;

    let response;
    if (isExcel) {
      const textContent = `Analyze and extract transactions from these raw Excel rows.
Target Month: ${selectedMonth}
Target Engineer/Person: ${engineerName}
Raw Rows Data:
${excelText}

Output the results strictly as a JSON object matching the requested schema.`;

      const openAiResponse = await aiClient.chat.completions.create({
        model: selectedAIModel,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: textContent }
        ],
        response_format: { type: "json_object" }
      });
      response = { text: openAiResponse.choices[0].message.content || "{}" };
    } else {
      const promptText = `Analyze this image / custody screenshot and extract all box movements (transactions) for the target month: ${selectedMonth}.
Target Engineer/Person: ${engineerName}

Analyze the image visually, perform OCR, map the descriptions and projects based on the authorized project list and the training templates provided in the system instruction.
Return the structured transactions strictly in JSON format.`;

      const openAiResponse = await aiClient.chat.completions.create({
        model: selectedAIModel,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: [
            { type: "text", text: promptText },
            imagePart
          ]}
        ],
        response_format: { type: "json_object" }
      });
      response = { text: openAiResponse.choices[0].message.content || "{}" };
    }

    const textResult = response?.text || "{}";
    const parsedResult = JSON.parse(textResult.trim());
    const extracted = parsedResult.extractedTransactions || [];

    if (!db.pettyCashBoxDays) db.pettyCashBoxDays = [];
    if (!db.engineerLedgers) db.engineerLedgers = {};

    const finalEngineerName = engineerName || "عام";

    for (const tx of extracted) {
      const inflowVal = parseFloat(tx.inflow) || 0;
      const outflowVal = parseFloat(tx.outflow) || 0;
      
      // Ensure date falls in selected month
      let dateVal = tx.date || `${selectedMonth}-01`;
      if (!dateVal.startsWith(selectedMonth)) {
        // Fallback to selected month
        const dayPart = dateVal.split('-')[2] || "01";
        dateVal = `${selectedMonth}-${dayPart.padStart(2, '0')}`;
      }

      // Final validate date format YYYY-MM-DD
      const dateParts = dateVal.split('-');
      if (dateParts.length !== 3 || dateParts[0].length !== 4) {
        dateVal = `${selectedMonth}-01`;
      }

      const descVal = (tx.description || "").trim();
      const methodVal = (tx.method || "نقدي").trim();
      const projVal = tx.project || "";

      // Only insert if there's actually an inflow or outflow
      if (inflowVal === 0 && outflowVal === 0) {
        continue;
      }

      const newTx = {
        id: `tx-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        inflow: inflowVal,
        outflow: outflowVal,
        description: descVal,
        method: methodVal,
        project: projVal,
        status: 'unapproved'
      };

      // 1. Update in db.pettyCashBoxDays
      let dayObj = db.pettyCashBoxDays.find((d: any) => d.date === dateVal && d.engineer === finalEngineerName);
      if (dayObj) {
        if (!dayObj.transactions) dayObj.transactions = [];
        dayObj.transactions.push(newTx);
      } else {
        dayObj = {
          date: dateVal,
          engineer: finalEngineerName,
          transactions: [newTx]
        };
        db.pettyCashBoxDays.push(dayObj);
      }

      // 2. Update in db.engineerLedgers[finalEngineerName]
      if (!db.engineerLedgers[finalEngineerName]) {
        db.engineerLedgers[finalEngineerName] = [];
      }
      let ledgerDayObj = db.engineerLedgers[finalEngineerName].find((d: any) => d.date === dateVal);
      if (ledgerDayObj) {
        if (!ledgerDayObj.transactions) ledgerDayObj.transactions = [];
        ledgerDayObj.transactions.push(newTx);
      } else {
        ledgerDayObj = {
          date: dateVal,
          transactions: [newTx]
        };
        db.engineerLedgers[finalEngineerName].push(ledgerDayObj);
      }
    }

    await saveDb(db);

    return res.json({
      success: true,
      message: "تم تشغيل المعالج الذكي الشامل بنجاح واستخراج حركات العهدة كمسودات!",
      pettyCashBoxDays: db.pettyCashBoxDays
    });

  } catch (err: any) {
    console.error("[Multimodal AI Analysis] Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "حدث خطأ غير متوقع أثناء معالجة المستند بالمعالج الذكي الشامل."
    });
  }
});

// Dedicated Training Template Save Endpoint
app.post("/api/custody/train", async (req, res) => {
  try {
    const { originalText, correctedText, type } = req.body;
    if (!originalText || !correctedText) {
      return res.status(400).json({ success: false, error: "النص الأصلي والـتصحيح مطلوبان." });
    }

    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();

    db.aiTrainingTemplates = db.aiTrainingTemplates || [];
    
    const newTemplate = {
      originalText: originalText.trim(),
      correctedText: correctedText.trim(),
      type: type || "correction",
      createdAt: new Date().toISOString()
    };
    db.aiTrainingTemplates.push(newTemplate);
    await saveDb(db);


    return res.json({ success: true, message: "تم تسجيل قالب التدريب بنجاح للتعلم المستمر!" });
  } catch (err: any) {
    console.error("[Training Engine] Error saving template:", err);
    return res.status(500).json({ success: false, error: err.message || "حدث خطأ أثناء حفظ قالب التدريب." });
  }
});

// Endpoint to update transaction details & learn from edits
app.post("/api/engineers/ledger/update-tx", async (req, res) => {
  try {
    const { engineerName, date, txId, description, project, method, inflow, outflow } = req.body;
    await fetchAndSyncDbFromSupabase(true);
    const db = getDb();


    let foundTx: any = null;
    let oldDesc = "";
    let oldProj = "";

    // 1. Update in db.pettyCashBoxDays
    if (db.pettyCashBoxDays) {
      db.pettyCashBoxDays = db.pettyCashBoxDays.map((d: any) => {
        if (d.date === date && d.engineer === engineerName) {
          const updatedTxs = (d.transactions || []).map((t: any) => {
            if (t.id === txId) {
              foundTx = { ...t };
              oldDesc = t.description || "";
              oldProj = t.project || "";
              return {
                ...t,
                description: description !== undefined ? description : t.description,
                project: project !== undefined ? project : t.project,
                method: method !== undefined ? method : t.method,
                inflow: inflow !== undefined ? parseFloat(inflow) || 0 : t.inflow,
                outflow: outflow !== undefined ? parseFloat(outflow) || 0 : t.outflow
              };
            }
            return t;
          });
          return { ...d, transactions: updatedTxs, updatedAt: new Date().toISOString() };
        }
        return d;
      });
    }

    // 2. Update in db.engineerLedgers
    if (db.engineerLedgers && db.engineerLedgers[engineerName]) {
      db.engineerLedgers[engineerName] = db.engineerLedgers[engineerName].map((d: any) => {
        if (d.date === date) {
          const updatedTxs = (d.transactions || []).map((t: any) => {
            if (t.id === txId) {
              return {
                ...t,
                description: description !== undefined ? description : t.description,
                project: project !== undefined ? project : t.project,
                method: method !== undefined ? method : t.method,
                inflow: inflow !== undefined ? parseFloat(inflow) || 0 : t.inflow,
                outflow: outflow !== undefined ? parseFloat(outflow) || 0 : t.outflow
              };
            }
            return t;
          });
          return { ...d, transactions: updatedTxs, updatedAt: new Date().toISOString() };
        }
        return d;
      });
    }

    if (!foundTx) {
      return res.status(404).json({ success: false, error: "الحركة غير موجودة" });
    }

    // Auto train if original text or project was modified
    db.aiTrainingTemplates = db.aiTrainingTemplates || [];
    let autoTrained = false;

    if (description && oldDesc && description.trim() !== oldDesc.trim()) {
      const newTemplate = {
        originalText: oldDesc.trim(),
        correctedText: description.trim(),
        type: "description",
        createdAt: new Date().toISOString()
      };
      db.aiTrainingTemplates.push(newTemplate);
    }

    if (project && oldProj && project.trim() !== oldProj.trim()) {
      const newTemplate = {
        originalText: oldProj.trim(),
        correctedText: project.trim(),
        type: "project",
        createdAt: new Date().toISOString()
      };
      db.aiTrainingTemplates.push(newTemplate);
    }

    await saveDb(db);

    res.json({ 
      success: true, 
      message: "تم تحديث الحركة بنجاح وتعليم الموديل من هذا التعديل!", 
      pettyCashBoxDays: db.pettyCashBoxDays,
      autoTrained
    });
  } catch (err: any) {
    console.error("Update petty cash transaction error:", err);
    res.status(500).json({ success: false, error: err.message });
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

    await fetchAndSyncDbFromSupabase(true);
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

    await saveDb(db);

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

    if (!process.env.NARAROUTER_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "يرجى إعداد مفتاح API الخاص بـ NaraRouter في متغيرات البيئة"
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
        systemInstruction: systemInstruction + "\n\nCRITICAL RULE: Do NOT hallucinate numbers. If unsure, output 0. Strictly match the JSON schema.",
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


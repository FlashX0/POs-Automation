const fs = require('fs');
let content = fs.readFileSync('api/app.ts', 'utf-8');

// Replace the start of mongoose.connection.once("open", async () => {
const openStartOld = `mongoose.connection.once("open", async () => {
  try {
    // 1. تنظيف المشاريع الافتراضية الثلاثة والمستندات الافتراضية من MongoDB Atlas نهائياً لتبدأ لوحة التحكم فارغة 100%`;

const openStartNew = `mongoose.connection.once("open", async () => {
  try {
  try {
    // 1. تنظيف المشاريع الافتراضية الثلاثة والمستندات الافتراضية من MongoDB Atlas نهائياً لتبدأ لوحة التحكم فارغة 100%`;

if (content.includes(openStartOld)) {
  content = content.replace(openStartOld, openStartNew);
  console.log("Replaced start");
}

// And close the main try/catch block at the end of the event handler
const openEndOld = `  try {
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
            console.log(\`[Auto-Mapping] Updating document \${doc.id} project from "\${doc.projectName}" to standard "\${standard}"\`);
            doc.projectName = standard;
            changed = true;
          }
        }
      });
    }

    if (changed) {
      await saveDb(db);
      console.log("Successfully mapped existing documents and seeded approved standard projects list.");
    }
  } catch (err) {
    console.error("Error syncing and seeding standard projects:", err);
  }
});`;

const openEndNew = `  try {
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
            console.log(\`[Auto-Mapping] Updating document \${doc.id} project from "\${doc.projectName}" to standard "\${standard}"\`);
            doc.projectName = standard;
            changed = true;
          }
        }
      });
    }

    if (changed) {
      await saveDb(db);
      console.log("Successfully mapped existing documents and seeded approved standard projects list.");
    }
  } catch (err) {
    console.error("Error syncing and seeding standard projects:", err);
  }
  
  } catch (globalErr) {
    console.error("CRITICAL ERROR IN MONGO OPEN EVENT:", globalErr);
  }
});`;

if (content.includes(openEndOld)) {
  content = content.replace(openEndOld, openEndNew);
  console.log("Replaced end");
}

fs.writeFileSync('api/app.ts', content);

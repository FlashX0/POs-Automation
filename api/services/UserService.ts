import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { getDb, saveDb, getSupabaseClient, getSupabaseAdminClient, checkSupabaseKeysConfig, fetchAndSyncDbFromMongo } from "../app.js";
import { User } from "../models/MongooseModels.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { SupabaseRepository } from "../repositories/SupabaseRepository.js";

export class UserService {

  public static ensureLocalUsersSeeded(db: any): boolean {
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
        isSystem: true,
        createdAt: new Date().toISOString()
      });
      changed = true;
    } else {
      if (adminUser.id !== "c45b9915-e6a3-4c65-81c5-b3206c6f3144") {
        adminUser.id = "c45b9915-e6a3-4c65-81c5-b3206c6f3144";
        changed = true;
      }
      if (false) {
        adminUser.role = "admin";
        changed = true;
      }
      if (false) {
        adminUser.isSystem = true;
        changed = true;
      }
    }

    let normalUser = db.users.find((u: any) => u.email && u.email.toLowerCase() === userEmail);
    if (!normalUser) {
      db.users.push({
        id: "usr_user_1",
        name: "موظف عادي",
        email: userEmail,
        password: bcrypt.hashSync("DeltaUser2026", 10),
        role: "user",
        status: "active",
        isSystem: true,
        createdAt: new Date().toISOString()
      });
      changed = true;
    } else {
      if (!normalUser.isSystem) {
        normalUser.isSystem = true;
        changed = true;
      }
    }

    // Deduplicate user IDs to ensure strict uniqueness
    const seenIds = new Set<string>();
    db.users.forEach((u: any, idx: number) => {
      if (u.email && u.email.toLowerCase() === adminEmail) {
        u.id = "c45b9915-e6a3-4c65-81c5-b3206c6f3144";
        u.isSystem = true;
        seenIds.add(u.id);
        return;
      }
      if (u.email && u.email.toLowerCase() === userEmail) {
        u.isSystem = true;
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

  public static async seedAllRequiredUsers() {
    try {
      const db = getDb();
      const changed = this.ensureLocalUsersSeeded(db);
      if (changed) {
        await saveDb(db);
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
              status: "active",
              isSystem: true
            });
            console.log("[Seeder] Seeded Admin (Khaled) to MongoDB Atlas.");
          } else {
            let mongoChanged = false;
            if (false) {
              mongoAdminExists.role = "admin";
              mongoChanged = true;
            }
            if (false) {
              (mongoAdminExists as any).isSystem = true;
              mongoChanged = true;
            }
            if (mongoChanged) {
              await mongoAdminExists.save();
              console.log("[Seeder] Updated Admin (Khaled) role & isSystem to 'admin' in MongoDB Atlas.");
            }
          }
          
          const mongoUserExists = await User.findOne({ email: userEmail });
          if (!mongoUserExists) {
            await User.create({
              name: "موظف عادي",
              email: userEmail,
              password: hashedUser,
              role: "user",
              status: "active",
              isSystem: true
            });
            console.log("[Seeder] Seeded standard user to MongoDB Atlas.");
          } else {
            if (false) {
              (mongoUserExists as any).isSystem = true;
              await mongoUserExists.save();
              console.log("[Seeder] Updated standard user isSystem in MongoDB Atlas.");
            }
          }
        } catch (mongoErr: any) {
          console.error("[Seeder] MongoDB user collection seed failed:", mongoErr.message);
        }
      }

      // Supabase Auth and database synchronization (Purge & Align)
      const adminClient = SupabaseRepository.getAdminClient();
      const publicClient = SupabaseRepository.getClient();

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
          const localDb = getDb();
          localDb.users = localDb.users || [];
          const originalCount = localDb.users.length;

          const sbEmails = new Set<string>();
          sbUsers.forEach((u: any) => {
            if (u.email) sbEmails.add(u.email.toLowerCase());
          });
          sbEmails.add(adminEmail);
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
            await saveDb(localDb);
          }

          // Also purge from MongoDB
          if (mongoose.connection.readyState === 1) {
            try {
              const allMongoUsers = await User.find({});
              for (const mUser of allMongoUsers) {
                const mEmail = mUser.email.toLowerCase();
                if (!sbEmails.has(mEmail)) {
                  console.log(`[Seeder] Purging unsynced user from MongoDB: ${mEmail}`);
                  await User.deleteOne({ email: mEmail });
                }
              }
            } catch (mongoErr: any) {
              console.warn("[Seeder] Failed to purge unsynced users from MongoDB:", mongoErr.message);
            }
          }

        } catch (adminErr: any) {
          console.warn("[Seeder] Supabase admin sync error (will continue without purging):", adminErr.message);
        }
      }
    } catch (err: any) {
      console.error("[Seeder] General error seeding users:", err.message);
    }
  }

  public static async login(email: string, password: string): Promise<any> {
    if (!email || !password) {
      throw new Error("البريد الإلكتروني وكلمة المرور مطلوبان");
    }
    const lowerEmail = email.toLowerCase().trim();
    await this.seedAllRequiredUsers();
    
    let matchedUser: any = null;
    let authUid: string | null = null;
    let loggedInViaSupabase = false;

    const publicClient = SupabaseRepository.getClient();
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

    if (loggedInViaSupabase && authUid) {
      matchedUser = db.users.find((u: any) => u.id === authUid);
      if (!matchedUser) {
        matchedUser = db.users.find((u: any) => u.email.toLowerCase() === lowerEmail);
        if (matchedUser) {
          console.log(`[Auth] Matching user by email to sync ID to Supabase UID: ${authUid}`);
          matchedUser.id = authUid;
          await saveDb(db);
        }
      }

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
            await saveDb(db);
          }
        } catch (mongoErr) {
          console.warn("[Login] MongoDB lookup by UID failed:", mongoErr);
        }
      }

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
        await saveDb(db);
        console.log(`[Auth] Auto-created database entry for authenticated user: ${lowerEmail}`);
      }
    } else {
      matchedUser = db.users.find((u: any) => u.email.toLowerCase() === lowerEmail);
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
            db.users.push(matchedUser);
            await saveDb(db);
          }
        } catch (err) {
          console.warn("[Login] MongoDB check failed:", err);
        }
      }

      if (!matchedUser) {
        throw new Error("عذراً، البريد الإلكتروني غير مسجل في النظام");
      }

      const passwordIsValid = await bcrypt.compare(password, matchedUser.password);
      if (!passwordIsValid) {
        throw new Error("كلمة المرور غير صحيحة");
      }
    }

    if (matchedUser.status === "blocked") {
      throw new Error("تم تعطيل حسابك من قبل الإدارة. يرجى التواصل مع المسؤول.");
    }

    if (matchedUser.role === 'admin') {
      matchedUser.allowed_departments = ['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis', 'engineers'];
    }

    console.log(`[Auth] User ${matchedUser.name} (${matchedUser.email}) logged in successfully as [${matchedUser.role}]`);
    return {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
      status: matchedUser.status,
      allowed_departments: matchedUser.role === 'admin'
        ? ['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis', 'engineers']
        : matchedUser.allowed_departments || []
    };
  }


  public static async verifySession(email: string): Promise<any> {
    if (!email) {
      throw new Error("جلسة غير صالحة");
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
          db.users.push(matchedUser);
          await saveDb(db);
        }
      } catch (err) {
        console.warn("[Session verification] MongoDB check failed:", err);
      }
    }

    if (!matchedUser || matchedUser.status === "blocked") {
      throw new Error("جلسة غير صالحة أو تم حظر الحساب");
    }

    if (matchedUser.role === 'admin') {
      matchedUser.allowed_departments = ['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis', 'engineers'];
    }

    return {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
      status: matchedUser.status,
      allowed_departments: matchedUser.role === 'admin'
        ? ['procurement', 'petty_cash', 'subcontractors', 'labor_timesheet', 'cost_analysis', 'engineers']
        : matchedUser.allowed_departments || []
    };
  }


  public static async listUsers(): Promise<any[]> {
    const db = getDb();
    let usersList = [...db.users];

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
                : [],
              createdAt: mUser.createdAt ? mUser.createdAt.toISOString() : new Date().toISOString()
            };
            usersList.push(mapped);
          } else {
            const existing = usersList.find((u: any) => u.email.toLowerCase() === mUser.email.toLowerCase());
            if (existing) {
              existing.allowed_departments = (mUser.allowed_departments && mUser.allowed_departments.length > 0)
                ? mUser.allowed_departments
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
    return sanitizedUsers;
  }


  public static async createUser(name: string, email: string, password: string, role: string, allowed_departments: string[]) {
    
  let createdUserId = "";
  let supabaseAdmin: any = null;
  try {
    // args provided in method signature: name, email, password, role, allowed_departments 
    if (!name || !email || !password) {
      throw new Error("الرجاء إدخال الاسم، البريد الإلكتروني وكلمة المرور");
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
      throw new Error("عذراً، البريد الإلكتروني مسجل بالفعل لمستخدم آخر");
    }

    // Validate Supabase keys configuration
    const configCheck = checkSupabaseKeysConfig();
    if (!configCheck.isValid) {
      console.error("[Auth] Supabase configuration check failed:", configCheck.error);
      throw new Error(configCheck.error);
    }

    // 1. Get dynamic Supabase Admin Client
    supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      console.error("[Auth] SUPABASE_SERVICE_ROLE_KEY is missing or invalid on the server.");
      throw new Error("فشل إنشاء الحساب: مفتاح الخدمة SUPABASE_SERVICE_ROLE_KEY غير مهيأ على السيرفر. يرجى ضبط المتغيرات البيئية للمشروع.");
    }

        // --- STEP 0: Check Duplicate in Supabase Auth ---
    const { data: { users: authUsers }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (!listErr && authUsers) {
      const isTakenInSupabase = authUsers.some((u: any) => u.email?.toLowerCase().trim() === lowerEmail);
      if (isTakenInSupabase) {
        throw new Error("عذراً، البريد الإلكتروني مسجل بالفعل لمستخدم آخر");
      }
    }

    // --- STEP 1: Create Supabase Auth User ---
    const { data: sbData, error: sbError } = await supabaseAdmin.auth.admin.createUser({
      email: lowerEmail,
      password: password,
      email_confirm: true,
      user_metadata: { name, role: role || "user", allowed_departments: finalDeps }
    });

    if (sbError) {
      console.warn("[Supabase Admin Auth] User creation failed:", sbError.message);
      throw new Error(`فشل إنشاء الحساب في Supabase Auth: ${sbError.message}`);
    }

    if (!sbData || !sbData.user) {
      throw new Error("فشل إنشاء الحساب في Supabase Auth: لم يتم إرجاع بيانات المستخدم.");
    }

    createdUserId = sbData.user.id;
    console.log("[Supabase Admin Auth] User created successfully. UID:", createdUserId);

    // --- STEP 2: Create/Update Profile (in profiles table) ---
    console.log(`[Supabase DB] Attempting insert into 'profiles' table for UID: ${createdUserId}...`);
    const { error: insertErr } = await supabaseAdmin
      .from('profiles')
      .insert([
        { 
          id: createdUserId, 
          email: lowerEmail, 
          full_name: name.trim() // Correct existing column name!
        }
      ]);

    if (insertErr) {
      console.error(`[Supabase DB] 'profiles' insert failed:`, insertErr.message);
      throw new Error(`فشل إدخال الموظف في جدول profiles بالـ Supabase: ${insertErr.message}`);
    }
    console.log("[Supabase DB] Successfully inserted into 'profiles' table.");

    const hashedPassword = await bcrypt.hash(password, 10);
    const isSystemValue = (lowerEmail === "khaled@delta.com" || lowerEmail === "user@delta.com");

    // --- STEP 3: Create MongoDB User Document & Commit locally ---
    const newUser = {
      id: createdUserId,
      supabaseUserId: createdUserId,
      email: lowerEmail,
      password: hashedPassword,
      name: name.trim(),
      role: role || "user",
      status: "active",
      allowed_departments: finalDeps,
      isSystem: isSystemValue,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save locally
    db.users.push(newUser);
    await saveDb(db);

    // Save to MongoDB Atlas
    if (mongoose.connection.readyState === 1) {
      try {
        await User.create({
          _id: createdUserId,
          supabaseUserId: createdUserId,
          email: lowerEmail,
          password: hashedPassword,
          name: name.trim(),
          role: role || "user",
          status: "active",
          allowed_departments: finalDeps,
          isSystem: isSystemValue,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } catch (mongoErr: any) {
        console.error("[Auth] Failed to write user to MongoDB:", mongoErr.message);
        throw new Error(`فشل كتابة مستخدم MongoDB: ${mongoErr.message}`);
      }
    }

    console.log(`[Auth] User ${name} successfully created by Admin as [${role || "user"}] with departments:`, finalDeps);
    return { success: true, message: "تم إنشاء حساب الموظف الجديد بنجاح!" };

  } catch (err: any) {
    console.error("[Auth] Create user error (Triggering Rollback):", err);
    
    // Rollback steps to avoid orphan records!
    if (createdUserId && supabaseAdmin) {
      console.log(`[ROLLBACK] Rolling back user creation for UID: ${createdUserId}...`);
      try {
        // Delete profile from profiles table first
        await supabaseAdmin.from('profiles').delete().eq('id', createdUserId);
        // Delete auth user from Supabase Auth
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        if (delErr) console.error("[ROLLBACK] Failed to delete auth user:", delErr.message);
      } catch (rollbackEx: any) {
        console.error("[ROLLBACK] Exception during rollback:", rollbackEx.message);
      }
    }

    throw new Error(err.message);
  }

  }

  public static async updateUser(id: string, email: string, name: string, role: string, status: string, password?: string, newEmail?: string, allowed_departments?: string[]) {
    
  try {
    // args provided in method signature: id, email, name, role, status, password, newEmail, allowed_departments 
    if (!email) {
      throw new Error("البريد الإلكتروني للموظف مطلوب");
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
      throw new Error("الموظف غير موجود");
    }

    let isSystemAccount = false;
    let originalEmailVal = lowerEmail;

    if (userIndex !== -1) {
      const existingUser = db.users[userIndex];
      originalEmailVal = existingUser.email?.toLowerCase().trim() || lowerEmail;
      if (existingUser.isSystem) {
        isSystemAccount = true;
      }
    }

    const systemEmails = ["khaled@delta.com", "user@delta.com"];
    if (systemEmails.includes(originalEmailVal)) {
      isSystemAccount = true;
    }

    if (isSystemAccount) {
      if (role && userIndex !== -1 && role !== db.users[userIndex].role) {
        throw new Error("هذا الحساب محمي كـ System Account ولا يمكن تعديل صلاحياته (دور الموظف).");
      }
      if (status && status !== "active") {
        throw new Error("هذا الحساب محمي كـ System Account ولا يمكن تعطيله أو إلغاء تفعيله.");
      }
    }

    let lowerNewEmail = "";
    if (newEmail && newEmail.toLowerCase().trim() !== lowerEmail) {
      lowerNewEmail = newEmail.toLowerCase().trim();
      // Check if new email is already taken
      const isTaken = db.users.some((u: any) => u.email.toLowerCase() === lowerNewEmail);
      if (isTaken) {
        throw new Error("البريد الإلكتروني الجديد مستخدم بالفعل من قبل موظف آخر");
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
          console.error("[Supabase Admin Auth] Failed to update user Auth:", sbUpdateErr.message);
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
      if (isSystemAccount) db.users[userIndex].isSystem = true;
      await saveDb(db);
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
      if (isSystemAccount) updateData.isSystem = true;

      await User.findOneAndUpdate({ email: lowerEmail }, { $set: updateData });
    }

    return { success: true, message: "تم تحديث بيانات ورتبة الموظف بنجاح!" };
  } catch (err: any) {
    console.error("[Auth] Update user error:", err);
    throw new Error(err.message);
  }

  }

  public static async deleteUser(id: string, email: string) {
    
  try {
    // args provided in method signature: id, email 
    if (!id && !email) {
      throw new Error("البريد الإلكتروني أو المعرف الفريد مطلوب");
    }

    const lowerEmail = email ? email.toLowerCase().trim() : "";
    const db = getDb();

    db.users = db.users || [];

    // Find user details FIRST
    let userToDelete = db.users.find((u: any) => 
      (id && u.id === id) || 
      (lowerEmail && u.email?.toLowerCase().trim() === lowerEmail)
    );

    let targetUserId = id || (userToDelete ? userToDelete.id : "");
    let userEmailForDeletion = lowerEmail || (userToDelete ? userToDelete.email?.toLowerCase().trim() : "");

    // Enforce isSystem protection check
    if (userToDelete && userToDelete.isSystem) {
      throw new Error("هذا الحساب محمي كـ System Account ولا يمكن حذفه نهائياً.");
    }

    const systemEmails = ["khaled@delta.com", "user@delta.com"];
    if (userEmailForDeletion && systemEmails.includes(userEmailForDeletion.toLowerCase())) {
      throw new Error("هذا الحساب محمي كـ System Account ولا يمكن حذفه نهائياً.");
    }

    if (mongoose.connection.readyState === 1) {
      let mongoUser = null;
      if (targetUserId) {
        mongoUser = await User.findById(targetUserId);
      } else if (userEmailForDeletion) {
        mongoUser = await User.findOne({ email: userEmailForDeletion });
      }
      if (mongoUser && (mongoUser as any).isSystem) {
        throw new Error("هذا الحساب محمي كـ System Account ولا يمكن حذفه نهائياً.");
      }
    }

    const supabaseAdmin = getSupabaseAdminClient();
    if (!supabaseAdmin) {
      throw new Error("فشل الحذف: مفتاح الخدمة SUPABASE_SERVICE_ROLE_KEY غير مهيأ على السيرفر.");
    }

    // --- STEP 1: Delete from Supabase Auth FIRST ---
    let authUserId = targetUserId;
    if (!authUserId && userEmailForDeletion) {
      console.log(`[Supabase Delete] Direct Auth lookup for: ${userEmailForDeletion}`);
      const { data: { users: authUsers }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (!listErr && authUsers) {
        const matchedAuthUser = authUsers.find((u: any) => u.email?.toLowerCase().trim() === userEmailForDeletion);
        if (matchedAuthUser) {
          authUserId = matchedAuthUser.id;
        }
      }
    }

    if (authUserId) {
      console.log(`[Supabase Delete] Deleting user from Auth: ${authUserId}`);
      const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
      if (authDelErr) {
        // If not found, we can proceed, otherwise fail
        const isUserNotFound = authDelErr.message?.includes("User not found") || authDelErr.message?.includes("not found");
        if (!isUserNotFound) {
          console.error("[Supabase Delete Auth] Failed to delete user from Supabase Auth:", authDelErr.message);
          throw new Error(`فشل حذف الحساب من Supabase Auth: ${authDelErr.message}`);
        }
      }
    }

    // --- STEP 2: Delete from profiles Table ---
    if (userEmailForDeletion) {
      try {
        await supabaseAdmin.from('profiles').delete().eq('email', userEmailForDeletion);
      } catch (e) {
        console.warn("Could not delete from profiles table:", e.message);
      }
    }

    // --- STEP 3: Delete from MongoDB ---
    if (mongoose.connection.readyState === 1 && userEmailForDeletion) {
      try {
        await User.deleteOne({ email: userEmailForDeletion });
      } catch (e) {
        console.warn("Could not delete from MongoDB User table:", e.message);
      }
    }

    // --- STEP 4: Delete locally and save state ---
    if (authUserId) {
      db.users = db.users.filter((u: any) => u.id !== authUserId);
    } else if (userEmailForDeletion) {
      db.users = db.users.filter((u: any) => u.email.toLowerCase() !== userEmailForDeletion.toLowerCase());
    }
    await saveDb(db);

    return { success: true, message: "تم حذف حساب الموظف بالكامل من قواعد البيانات بنجاح" };
  } catch (err: any) {
    console.error("[Auth] Delete user error:", err);
    throw new Error(err.message);
  }

  }

  public static verifyPassword(password: string) {
    
  try {
    // args provided in method signature: password 
    const currentDb = getDb();
    const currentPassword = currentDb.adminPassword || "DeltaAdmin2026";
    if (password === currentPassword) {
      return { success: true };
    } else {
      throw new Error("كلمة المرور غير صحيحة");
    }
  } catch (err: any) {
    throw new Error(err.message);
  }

  }

  public static async changePassword(email: string, currentPassword: string, newPassword: string) {
    
  try {
    // args provided in method signature: currentPassword, newPassword 
    if (!newPassword || newPassword.trim().length < 4) {
      throw new Error("كلمة المرور الجديدة يجب أن تكون من 4 أحرف أو أكثر");
    }
    const currentDb = getDb();
    const actualOldPassword = currentDb.adminPassword || "DeltaAdmin2026";
    if (currentPassword !== actualOldPassword) {
      throw new Error("كلمة المرور القديمة غير صحيحة");
    }
    currentDb.adminPassword = newPassword.trim();
    await saveDb(currentDb);
    return { success: true };
  } catch (err: any) {
    throw new Error(err.message);
  }

  }

  public static async resetAdmin(secret: string) {
  try {
    if (secret !== "016135") {
      throw new Error("كلمة المرور غير صحيحة");
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
    db.deletedEngineerIds = [];
    db.deletedSubcontractorIds = [];
    db.deletedLaborTimesheetIds = [];
    db.deletedCostAnalysisIds = [];
    
    await saveDb(db);

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
    
    return { success: true, message: "تمت إعادة تعيين قاعدة البيانات والمسح نهائياً من السيرفر بنجاح" };
  } catch (err: any) {
    throw new Error(err.message);
  }

  }

}

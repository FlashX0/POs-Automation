import mongoose from "mongoose";

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
});
export const Project: any = mongoose.models.Project || mongoose.model("Project", projectSchema);

const appStateSchema = new mongoose.Schema({
  key: { type: String, default: "global_state", unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }
});
export const AppState: any = mongoose.models.AppState || mongoose.model("AppState", appStateSchema);

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
export const AllowedDevice: any = mongoose.models.AllowedDevice || mongoose.model("AllowedDevice", allowedDeviceSchema);

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, default: "user" }, // admin or user
  status: { type: String, default: "active" }, // active, blocked, etc.
  allowed_departments: { type: [String], default: [] },
  isSystem: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
export const User: any = mongoose.models.User || mongoose.model("User", userSchema);

const aiTrainingTemplateSchema = new mongoose.Schema({
  originalText: { type: String, required: true },
  correctedText: { type: String, required: true },
  type: { type: String, default: "correction" },
  createdAt: { type: Date, default: Date.now }
});
export const AITrainingTemplate: any = mongoose.models.AITrainingTemplate || mongoose.model("AITrainingTemplate", aiTrainingTemplateSchema);

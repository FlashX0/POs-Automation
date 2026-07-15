import mongoose from "mongoose";
import { AppState, User, AllowedDevice, Project, AITrainingTemplate } from "../models/MongooseModels.js";

export class MongoRepository {
  public static isConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }

  // AppState Operations
  public static async getGlobalState(): Promise<any | null> {
    if (!this.isConnected()) return null;
    try {
      const dbDoc = await AppState.findOne({ key: "global_state" }).lean();
      return dbDoc ? dbDoc.data : null;
    } catch (err: any) {
      console.warn("[MongoRepository] Failed to load global state:", err.message);
      return null;
    }
  }

  public static async saveGlobalState(data: any): Promise<boolean> {
    if (!this.isConnected()) return false;
    try {
      await AppState.findOneAndUpdate(
        { key: "global_state" },
        { data },
        { upsert: true, new: true }
      );
      return true;
    } catch (err: any) {
      console.warn("[MongoRepository] Failed to save global state:", err.message);
      return false;
    }
  }
}

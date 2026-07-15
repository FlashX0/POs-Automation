import { User } from "../models/MongooseModels.js";
import mongoose from "mongoose";

export class UserRepository {
  public static async findAll(): Promise<any[]> {
    if (mongoose.connection.readyState !== 1) return [];
    return User.find().lean();
  }

  public static async findByEmail(email: string): Promise<any | null> {
    if (mongoose.connection.readyState !== 1) return null;
    return User.findOne({ email }).lean();
  }

  public static async findById(id: string): Promise<any | null> {
    if (mongoose.connection.readyState !== 1) return null;
    return User.findById(id).lean();
  }

  public static async create(userData: any): Promise<any> {
    if (mongoose.connection.readyState !== 1) return null;
    return User.create(userData);
  }

  public static async updateByEmail(email: string, updateData: any): Promise<boolean> {
    if (mongoose.connection.readyState !== 1) return false;
    const result = await User.findOneAndUpdate({ email }, { $set: updateData });
    return !!result;
  }

  public static async deleteByEmail(email: string): Promise<boolean> {
    if (mongoose.connection.readyState !== 1) return false;
    const result = await User.deleteOne({ email });
    return result.deletedCount > 0;
  }
}

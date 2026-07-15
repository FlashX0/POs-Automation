import { getSupabaseClient, getSupabaseAdminClient } from "../database.js";

export class SupabaseRepository {
  public static getClient() {
    return getSupabaseClient();
  }
  
  public static getAdminClient() {
    return getSupabaseAdminClient();
  }
}

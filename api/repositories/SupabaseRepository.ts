import { getSupabaseClient, getSupabaseAdminClient } from "../app.js";

export class SupabaseRepository {
  public static getClient() {
    return getSupabaseClient();
  }
  
  public static getAdminClient() {
    return getSupabaseAdminClient();
  }
}

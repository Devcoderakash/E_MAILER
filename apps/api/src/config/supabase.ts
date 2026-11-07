import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Supabase Admin Client for Backend Services
 * Initialized with SUPABASE_SECRET_KEY (service_role)
 * CAUTION: Strictly backend-only. Never expose this client or secret key to frontend/client applications.
 */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://snmwnvwhezvkgzzihjdf.supabase.co";
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_Mo7DGcbXD6bpwS6jXQCjPQ_vdwEAQqL";

if (!import.meta.env.VITE_SUPABASE_URL || !(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)) {
  console.warn(
    "[MailPilot] Supabase frontend environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY) are missing or using defaults. Update your .env file."
  );
}

/**
 * Supabase client instance for frontend operations (Client-side Auth, Public Data Queries).
 * Strictly uses the Publishable / Anon key — NEVER use service_role / secret key here.
 */
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});


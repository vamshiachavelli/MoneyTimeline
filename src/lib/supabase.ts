import "react-native-url-polyfill/auto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env, isSupabaseConfigured } from "@/config/env";
import { supabaseStorage } from "@/services/supabase/storage";
import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | null = null;

export const assertSupabaseConfigured = () => {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
};

export const getSupabaseClient = () => {
  assertSupabaseConfigured();

  client ??= createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: supabaseStorage
    }
  });

  return client;
};

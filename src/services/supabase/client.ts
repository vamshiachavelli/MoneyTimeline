import "react-native-url-polyfill/auto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env, isSupabaseConfigured } from "@/config/env";
import type { Database } from "@/types/database";
import { supabaseStorage } from "./storage";

let supabaseClient: SupabaseClient<Database> | null = null;

export const assertSupabaseConfigured = () => {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Missing Supabase configuration. Copy .env.example to .env and fill in the Expo public keys."
    );
  }
};

export const getSupabaseClient = () => {
  assertSupabaseConfigured();

  supabaseClient ??= createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: supabaseStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });

  return supabaseClient;
};

import { getSupabaseClient } from "@/services/supabase/client";

export const authService = {
  async signUp(email: string, password: string, fullName?: string) {
    const supabase = getSupabaseClient();

    return supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName?.trim()
        }
      }
    });
  },

  async signIn(email: string, password: string) {
    const supabase = getSupabaseClient();

    return supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
  },

  async signOut() {
    const supabase = getSupabaseClient();

    return supabase.auth.signOut();
  }
};

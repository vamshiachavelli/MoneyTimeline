import { getSupabaseClient } from "@/lib/supabase";
import type { Profile } from "@/types/database";

export const authService = {
  getSession: () => getSupabaseClient().auth.getSession(),
  getUser: () => getSupabaseClient().auth.getUser(),
  signInWithPassword: (email: string, password: string) =>
    getSupabaseClient().auth.signInWithPassword({ email, password }),
  signOut: () => getSupabaseClient().auth.signOut(),
  signUpWithPassword: ({
    email,
    firstName,
    lastName,
    password
  }: {
    email: string;
    firstName?: string;
    lastName?: string;
    password: string;
  }) =>
    getSupabaseClient().auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName
        }
      }
    }),
  upsertProfile: async (profile: Pick<Profile, "id"> & Partial<Profile>) => {
    const { data, error } = await getSupabaseClient()
      .from("profiles")
      .upsert(profile)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
};

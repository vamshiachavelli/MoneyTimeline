import { getSupabaseClient } from "@/lib/supabase";
import type { Profile } from "@/types/database";

export type ProfileUpsertInput = {
  firstName: string;
  id: string;
  lastName: string;
  phone: string;
};

export const profileService = {
  getProfile: async (userId: string) => {
    const { data, error } = await getSupabaseClient()
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as Profile | null;
  },
  upsertProfile: async ({ firstName, id, lastName, phone }: ProfileUpsertInput) => {
    const displayName = `${firstName} ${lastName}`.trim();
    const { data, error } = await getSupabaseClient()
      .from("profiles")
      .upsert({
        display_name: displayName || null,
        first_name: firstName || null,
        id,
        last_name: lastName || null,
        phone: phone || null
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as Profile;
  }
};

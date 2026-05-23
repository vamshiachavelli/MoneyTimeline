import { getSupabaseClient } from "@/lib/supabase";
import type { Account } from "@/types/database";

export type AccountInput = Pick<Account, "name" | "account_type" | "currency"> &
  Partial<
    Pick<
      Account,
      "color" | "external_account_id" | "icon_name" | "institution" | "last_four" | "metadata"
    >
  >;

export const accountService = {
  create: async (userId: string, account: AccountInput) => {
    const { data, error } = await getSupabaseClient()
      .from("accounts")
      .insert({ ...account, user_id: userId })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },
  list: async (userId: string) => {
    const { data, error } = await getSupabaseClient()
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data;
  },
  softDelete: async (accountId: string) => {
    const { error } = await getSupabaseClient()
      .from("accounts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", accountId);

    if (error) {
      throw error;
    }
  },
  update: async (accountId: string, patch: Partial<AccountInput>) => {
    const { data, error } = await getSupabaseClient()
      .from("accounts")
      .update(patch)
      .eq("id", accountId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
};

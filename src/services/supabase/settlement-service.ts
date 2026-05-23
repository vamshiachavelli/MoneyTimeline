import { getSupabaseClient } from "@/lib/supabase";
import type { Settlement } from "@/types/database";
import {
  validateCurrency,
  validatePositiveAmountMinor
} from "@/services/validation/finance-validation";

export type SettlementInput = Pick<
  Settlement,
  "amount_minor" | "created_by_user_id" | "currency"
> &
  Partial<
    Pick<
      Settlement,
      | "from_contact_id"
      | "from_user_id"
      | "group_id"
      | "metadata"
      | "notes"
      | "payment_method"
      | "to_contact_id"
      | "to_user_id"
    >
  >;

export const settlementService = {
  confirmByUser: async (settlementId: string) => {
    const { data, error } = await getSupabaseClient()
      .from("settlements")
      .update({
        status: "user_confirmed",
        user_confirmed_at: new Date().toISOString()
      })
      .eq("id", settlementId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },
  create: async (settlement: SettlementInput) => {
    validatePositiveAmountMinor(settlement.amount_minor);
    validateCurrency(settlement.currency);

    const { data, error } = await getSupabaseClient()
      .from("settlements")
      .insert(settlement)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },
  listVisible: async () => {
    const { data, error } = await getSupabaseClient()
      .from("settlements")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  }
};

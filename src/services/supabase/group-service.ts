import { getSupabaseClient } from "@/lib/supabase";
import type { Group, GroupMember, SplitMethod } from "@/types/database";
import {
  validateCurrency,
  validateIsoDate,
  validatePositiveAmountMinor
} from "@/services/validation/finance-validation";

export const groupService = {
  createExpense: async ({
    amountMinor,
    createdByUserId,
    currency,
    expenseDate,
    groupId,
    method,
    title
  }: {
    amountMinor: number;
    createdByUserId: string;
    currency: string;
    expenseDate: string;
    groupId?: string | null;
    method: SplitMethod;
    title: string;
  }) => {
    validatePositiveAmountMinor(amountMinor);
    validateCurrency(currency);
    validateIsoDate(expenseDate);

    const { data, error } = await getSupabaseClient()
      .from("expenses")
      .insert({
        amount_minor: amountMinor,
        created_by_user_id: createdByUserId,
        currency,
        expense_date: expenseDate,
        group_id: groupId ?? null,
        method,
        title
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },
  createGroup: async (
    ownerUserId: string,
    group: Pick<Group, "name"> & Partial<Pick<Group, "avatar_color" | "description">>
  ) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("groups")
      .insert({ ...group, owner_user_id: ownerUserId })
      .select()
      .single();

    if (error) {
      throw error;
    }

    const { error: memberError } = await supabase.from("group_members").insert({
      group_id: data.id,
      role: "owner",
      status: "active",
      user_id: ownerUserId
    });

    if (memberError) {
      throw memberError;
    }

    return data;
  },
  listGroups: async (userId: string) => {
    const { data, error } = await getSupabaseClient()
      .from("groups")
      .select("*, group_members!inner(*)")
      .eq("group_members.user_id", userId)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    return data;
  },
  upsertMember: async (
    groupId: string,
    member: Pick<GroupMember, "role" | "status"> &
      Partial<Pick<GroupMember, "contact_id" | "display_name" | "user_id">>
  ) => {
    const { data, error } = await getSupabaseClient()
      .from("group_members")
      .insert({ ...member, group_id: groupId })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
};

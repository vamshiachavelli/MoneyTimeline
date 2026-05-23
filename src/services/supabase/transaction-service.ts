import { getSupabaseClient } from "@/lib/supabase";
import type { Transaction, TransactionStatus } from "@/types/database";
import {
  validateCurrency,
  validateIsoDate,
  validatePositiveAmountMinor
} from "@/services/validation/finance-validation";

export type TransactionInput = Pick<
  Transaction,
  "amount_minor" | "currency" | "direction" | "duplicate_hash" | "merchant" | "transaction_date"
> &
  Partial<
    Pick<
      Transaction,
      | "account_id"
      | "ai_category_suggestion"
      | "category_id"
      | "confidence"
      | "description"
      | "expense_id"
      | "external_transaction_id"
      | "import_job_id"
      | "kind"
      | "metadata"
      | "original_description"
      | "posted_at"
      | "status"
      | "uploaded_file_id"
    >
  >;

const validateTransactionInput = (transaction: TransactionInput) => {
  validatePositiveAmountMinor(transaction.amount_minor);
  validateCurrency(transaction.currency);
  validateIsoDate(transaction.transaction_date);
};

export const transactionService = {
  createMany: async (userId: string, transactions: TransactionInput[]) => {
    transactions.forEach(validateTransactionInput);

    const { data, error } = await getSupabaseClient()
      .from("transactions")
      .insert(transactions.map((transaction) => ({ ...transaction, user_id: userId })))
      .select();

    if (error) {
      throw error;
    }

    return data;
  },
  listByDateRange: async ({
    endDate,
    startDate,
    userId
  }: {
    endDate: string;
    startDate: string;
    userId: string;
  }) => {
    validateIsoDate(startDate);
    validateIsoDate(endDate);

    const { data, error } = await getSupabaseClient()
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate)
      .order("transaction_date", { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  },
  listForUser: async (userId: string) => {
    const { data, error } = await getSupabaseClient()
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false });

    if (error) {
      throw error;
    }

    return data;
  },
  updateStatus: async (transactionId: string, status: TransactionStatus) => {
    const { data, error } = await getSupabaseClient()
      .from("transactions")
      .update({ status })
      .eq("id", transactionId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
};

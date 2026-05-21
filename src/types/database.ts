export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ClassificationStatus = "unclassified" | "personal" | "shared";
export type SettlementStatus =
  | "pending"
  | "user_confirmed"
  | "both_confirmed"
  | "cancelled";
export type SplitMethod = "equal" | "custom_amount" | "percentage" | "item_level";
export type StatementStatus = "processing" | "review_ready" | "imported" | "failed";

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: Account;
        Insert: Omit<Account, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Account, "id" | "user_id" | "created_at">>;
      };
      groups: {
        Row: Group;
        Insert: Omit<Group, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Group, "id" | "user_id" | "created_at">>;
      };
      group_members: {
        Row: GroupMember;
        Insert: Omit<GroupMember, "id" | "created_at">;
        Update: Partial<Omit<GroupMember, "id" | "created_at">>;
      };
      people: {
        Row: Person;
        Insert: Omit<Person, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Person, "id" | "user_id" | "created_at">>;
      };
      settlements: {
        Row: Settlement;
        Insert: Omit<Settlement, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Settlement, "id" | "user_id" | "created_at">>;
      };
      splits: {
        Row: Split;
        Insert: Omit<Split, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Split, "id" | "user_id" | "created_at">>;
      };
      statements: {
        Row: Statement;
        Insert: Omit<Statement, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Statement, "id" | "user_id" | "created_at">>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Transaction, "id" | "user_id" | "created_at">>;
      };
    };
  };
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  last_four: string | null;
  account_type: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type Statement = {
  id: string;
  user_id: string;
  account_id: string | null;
  file_name: string;
  file_type: "pdf" | "csv" | "xlsx" | "xls";
  file_path: string | null;
  status: StatementStatus;
  total_rows: number;
  duplicate_rows: number;
  failed_rows: number;
  imported_rows: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  account_id: string | null;
  statement_id: string | null;
  date: string;
  merchant: string;
  description: string | null;
  amount: number;
  category: string | null;
  classification_status: ClassificationStatus;
  duplicate_hash: string;
  split_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Person = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_color: string | null;
  created_at: string;
  updated_at: string;
};

export type Group = {
  id: string;
  user_id: string;
  name: string;
  avatar_color: string | null;
  created_at: string;
  updated_at: string;
};

export type GroupMember = {
  id: string;
  group_id: string;
  person_id: string;
  created_at: string;
};

export type Split = {
  id: string;
  user_id: string;
  transaction_id: string;
  group_id: string | null;
  person_id: string | null;
  method: SplitMethod;
  user_share_amount: number;
  counterparty_share_amount: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

export type Settlement = {
  id: string;
  user_id: string;
  person_id: string | null;
  group_id: string | null;
  amount: number;
  status: SettlementStatus;
  user_confirmed_at: string | null;
  counterparty_confirmed_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

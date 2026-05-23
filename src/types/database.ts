export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Relationships: [];
  Row: Row;
  Insert: Insert;
  Update: Update;
};

type RowBase = {
  created_at: string;
  updated_at: string;
};

type SoftDelete = {
  deleted_at: string | null;
};

export type AccountType =
  | "checking"
  | "savings"
  | "credit_card"
  | "cash"
  | "loan"
  | "investment"
  | "other";
export type TransactionDirection = "debit" | "credit";
export type TransactionKind = "expense" | "income" | "payment" | "transfer";
export type TransactionStatus = "unclassified" | "personal" | "shared" | "ignored";
export type UploadedFileType = "pdf" | "csv" | "xlsx" | "xls" | "image" | "other";
export type ImportJobStatus =
  | "queued"
  | "processing"
  | "review_ready"
  | "completed"
  | "failed"
  | "cancelled";
export type GroupMemberRole = "owner" | "admin" | "member";
export type GroupMemberStatus = "invited" | "active" | "removed" | "left";
export type ExpenseStatus = "draft" | "posted" | "voided";
export type SplitMethod = "equal" | "exact_amount" | "percentage" | "ratio";
export type SplitStatus = "pending" | "accepted" | "settled" | "cancelled";
export type SettlementStatus =
  | "pending"
  | "user_confirmed"
  | "both_confirmed"
  | "cancelled";
export type FriendshipStatus = "contact" | "invited" | "accepted" | "blocked";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";
export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "imported"
  | "classified"
  | "split"
  | "settled"
  | "signed_in"
  | "exported";

export type Profile = RowBase &
  SoftDelete & {
    avatar_url: string | null;
    default_currency: string;
    display_name: string | null;
    first_name: string | null;
    id: string;
    last_name: string | null;
    onboarding_completed_at: string | null;
    phone: string | null;
    timezone: string;
  };

export type Account = RowBase &
  SoftDelete & {
    account_type: AccountType;
    color: string | null;
    currency: string;
    external_account_id: string | null;
    icon_name: string | null;
    id: string;
    institution: string | null;
    last_four: string | null;
    metadata: Json;
    name: string;
    opening_balance_minor: number;
    user_id: string;
  };

export type Category = RowBase &
  SoftDelete & {
    color: string | null;
    icon_name: string | null;
    id: string;
    is_system: boolean;
    name: string;
    parent_category_id: string | null;
    sort_order: number;
    user_id: string | null;
  };

export type UploadedFile = RowBase &
  SoftDelete & {
    bucket_id: string;
    file_type: UploadedFileType;
    id: string;
    metadata: Json;
    mime_type: string | null;
    original_file_name: string;
    sha256_hash: string | null;
    size_bytes: number;
    storage_path: string;
    user_id: string;
  };

export type ImportJob = RowBase &
  SoftDelete & {
    account_id: string | null;
    completed_at: string | null;
    duplicate_rows: number;
    error_message: string | null;
    failed_rows: number;
    id: string;
    imported_rows: number;
    parsed_rows: number;
    parser_version: string | null;
    source_type: UploadedFileType;
    started_at: string | null;
    status: ImportJobStatus;
    summary: Json;
    total_rows: number;
    uploaded_file_id: string | null;
    user_id: string;
  };

export type Contact = RowBase &
  SoftDelete & {
    avatar_color: string | null;
    avatar_url: string | null;
    email: string | null;
    id: string;
    linked_user_id: string | null;
    metadata: Json;
    name: string;
    notes: string | null;
    phone: string | null;
    user_id: string;
  };

export type Friendship = RowBase &
  SoftDelete & {
    addressee_user_id: string | null;
    contact_id: string | null;
    id: string;
    requester_user_id: string;
    status: FriendshipStatus;
  };

export type Group = RowBase &
  SoftDelete & {
    avatar_color: string | null;
    avatar_url: string | null;
    default_currency: string;
    description: string | null;
    id: string;
    metadata: Json;
    name: string;
    owner_user_id: string;
  };

export type GroupMember = RowBase &
  SoftDelete & {
    contact_id: string | null;
    display_name: string | null;
    group_id: string;
    id: string;
    invited_at: string;
    joined_at: string | null;
    role: GroupMemberRole;
    status: GroupMemberStatus;
    user_id: string | null;
  };

export type Expense = RowBase &
  SoftDelete & {
    account_id: string | null;
    amount_minor: number;
    created_by_user_id: string;
    currency: string;
    description: string | null;
    expense_date: string;
    group_id: string | null;
    id: string;
    import_job_id: string | null;
    merchant: string | null;
    metadata: Json;
    method: SplitMethod;
    receipt_file_id: string | null;
    status: ExpenseStatus;
    title: string;
    uploaded_file_id: string | null;
  };

export type Transaction = RowBase &
  SoftDelete & {
    account_id: string | null;
    ai_category_suggestion: Json;
    amount_minor: number;
    category_id: string | null;
    confidence: number | null;
    currency: string;
    description: string | null;
    direction: TransactionDirection;
    duplicate_hash: string;
    expense_id: string | null;
    external_transaction_id: string | null;
    id: string;
    import_job_id: string | null;
    kind: TransactionKind;
    merchant: string;
    metadata: Json;
    original_description: string | null;
    posted_at: string | null;
    status: TransactionStatus;
    transaction_date: string;
    uploaded_file_id: string | null;
    user_id: string;
  };

export type ExpensePayer = RowBase &
  SoftDelete & {
    amount_minor: number;
    currency: string;
    expense_id: string;
    id: string;
    payer_contact_id: string | null;
    payer_user_id: string | null;
  };

export type ExpenseSplit = RowBase &
  SoftDelete & {
    amount_minor: number;
    currency: string;
    expense_id: string;
    id: string;
    metadata: Json;
    owed_to_user_id: string | null;
    participant_contact_id: string | null;
    participant_user_id: string | null;
    percentage: number | null;
    ratio_weight: number | null;
    status: SplitStatus;
  };

export type Settlement = RowBase &
  SoftDelete & {
    amount_minor: number;
    cancelled_at: string | null;
    counterparty_confirmed_at: string | null;
    created_by_user_id: string;
    currency: string;
    from_contact_id: string | null;
    from_user_id: string | null;
    group_id: string | null;
    id: string;
    metadata: Json;
    notes: string | null;
    payment_method: string | null;
    status: SettlementStatus;
    to_contact_id: string | null;
    to_user_id: string | null;
    user_confirmed_at: string | null;
  };

export type Subscription = RowBase &
  SoftDelete & {
    current_period_end: string | null;
    current_period_start: string | null;
    id: string;
    metadata: Json;
    plan_key: string;
    provider: string;
    provider_customer_id: string | null;
    provider_subscription_id: string | null;
    status: SubscriptionStatus;
    user_id: string;
  };

export type UserSettings = RowBase &
  SoftDelete & {
    ai_preferences: Json;
    appearance: Json;
    import_preferences: Json;
    notification_preferences: Json;
    user_id: string;
  };

export type AuditLog = {
  action: AuditAction;
  created_at: string;
  entity_id: string | null;
  entity_table: string;
  id: string;
  ip_address: string | null;
  metadata: Json;
  user_agent: string | null;
  user_id: string | null;
};

type Insert<T> = Partial<T>;

type Update<T> = Partial<Omit<T, "id" | "created_at">>;

export type Database = {
  public: {
    Tables: {
      accounts: TableDefinition<Account, Insert<Account>, Update<Account>>;
      audit_logs: TableDefinition<
        AuditLog,
        Omit<AuditLog, "id" | "created_at"> & { id?: string; created_at?: string },
        never
      >;
      categories: TableDefinition<Category, Insert<Category>, Update<Category>>;
      contacts: TableDefinition<Contact, Insert<Contact>, Update<Contact>>;
      expense_payers: TableDefinition<ExpensePayer, Insert<ExpensePayer>, Update<ExpensePayer>>;
      expense_splits: TableDefinition<ExpenseSplit, Insert<ExpenseSplit>, Update<ExpenseSplit>>;
      expenses: TableDefinition<Expense, Insert<Expense>, Update<Expense>>;
      friendships: TableDefinition<Friendship, Insert<Friendship>, Update<Friendship>>;
      group_members: TableDefinition<GroupMember, Insert<GroupMember>, Update<GroupMember>>;
      groups: TableDefinition<Group, Insert<Group>, Update<Group>>;
      import_jobs: TableDefinition<ImportJob, Insert<ImportJob>, Update<ImportJob>>;
      profiles: TableDefinition<Profile, Insert<Profile>, Update<Profile>>;
      settlements: TableDefinition<Settlement, Insert<Settlement>, Update<Settlement>>;
      subscriptions: TableDefinition<Subscription, Insert<Subscription>, Update<Subscription>>;
      transactions: TableDefinition<Transaction, Insert<Transaction>, Update<Transaction>>;
      uploaded_files: TableDefinition<UploadedFile, Insert<UploadedFile>, Update<UploadedFile>>;
      user_settings: TableDefinition<UserSettings, Insert<UserSettings>, Update<UserSettings>>;
    };
    Views: Record<string, never>;
    Functions: {
      expense_visible_to_user: {
        Args: { target_expense_id: string; target_user_id: string };
        Returns: boolean;
      };
      is_group_admin: {
        Args: { target_group_id: string; target_user_id: string };
        Returns: boolean;
      };
      is_group_member: {
        Args: { target_group_id: string; target_user_id: string };
        Returns: boolean;
      };
      settlement_visible_to_user: {
        Args: { target_settlement_id: string; target_user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      account_type: AccountType;
      audit_action: AuditAction;
      expense_status: ExpenseStatus;
      friendship_status: FriendshipStatus;
      group_member_role: GroupMemberRole;
      group_member_status: GroupMemberStatus;
      import_job_status: ImportJobStatus;
      settlement_status: SettlementStatus;
      split_method: SplitMethod;
      split_status: SplitStatus;
      subscription_status: SubscriptionStatus;
      transaction_direction: TransactionDirection;
      transaction_kind: TransactionKind;
      transaction_status: TransactionStatus;
      uploaded_file_type: UploadedFileType;
    };
  };
};

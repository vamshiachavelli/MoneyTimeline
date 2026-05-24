import { getSupabaseClient } from "@/lib/supabase";
import type { ImportJob, Transaction, UploadedFile } from "@/types/database";

export type ImportHistoryItem = {
  accountName: string | null;
  duplicateRows: number;
  failedRows: number;
  fileName: string;
  fileSizeBytes: number | null;
  fileType: string;
  id: string;
  importedAt: string;
  importedRows: number;
  parsedRows: number;
  status: ImportJob["status"];
  totalRows: number;
  transactions: Transaction[];
  uploadedFileId: string | null;
};

const readMetadataString = (metadata: unknown, key: string) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
};

export const importHistoryService = {
  listForUser: async (userId: string): Promise<ImportHistoryItem[]> => {
    const supabase = getSupabaseClient();
    const { data: jobs, error: jobsError } = await supabase
      .from("import_jobs")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (jobsError) {
      throw jobsError;
    }

    const importJobs = (jobs ?? []) as ImportJob[];
    const uploadedFileIds = importJobs
      .map((job) => job.uploaded_file_id)
      .filter((id): id is string => Boolean(id));
    const jobIds = importJobs.map((job) => job.id);

    const [{ data: files, error: filesError }, { data: transactions, error: transactionsError }] =
      await Promise.all([
        uploadedFileIds.length > 0
          ? supabase
              .from("uploaded_files")
              .select("*")
              .in("id", uploadedFileIds)
              .is("deleted_at", null)
          : Promise.resolve({ data: [], error: null }),
        jobIds.length > 0
          ? supabase
              .from("transactions")
              .select("*")
              .eq("user_id", userId)
              .is("deleted_at", null)
              .in("import_job_id", jobIds)
              .order("transaction_date", { ascending: false })
          : Promise.resolve({ data: [], error: null })
      ]);

    if (filesError) {
      throw filesError;
    }

    if (transactionsError) {
      throw transactionsError;
    }

    const filesById = new Map(
      ((files ?? []) as UploadedFile[]).map((file) => [file.id, file])
    );
    const transactionsByJob = ((transactions ?? []) as Transaction[]).reduce<
      Record<string, Transaction[]>
    >((acc, transaction) => {
      if (!transaction.import_job_id) {
        return acc;
      }

      acc[transaction.import_job_id] = [
        ...(acc[transaction.import_job_id] ?? []),
        transaction
      ];
      return acc;
    }, {});

    return importJobs.flatMap((job) => {
      const file = job.uploaded_file_id ? filesById.get(job.uploaded_file_id) : null;
      const jobTransactions = transactionsByJob[job.id] ?? [];
      const firstTransaction = jobTransactions[0] ?? null;
      const hasUsefulImportRecord =
        jobTransactions.length > 0 ||
        job.imported_rows > 0 ||
        job.duplicate_rows > 0 ||
        job.failed_rows > 0 ||
        job.status === "failed";

      if (!hasUsefulImportRecord) {
        return [];
      }

      return [{
        accountName: firstTransaction
          ? readMetadataString(firstTransaction.metadata, "import_account_name")
          : null,
        duplicateRows: job.duplicate_rows,
        failedRows: job.failed_rows,
        fileName: file?.original_file_name ?? "Imported statement",
        fileSizeBytes: file?.size_bytes ?? null,
        fileType: file?.file_type ?? job.source_type,
        id: job.id,
        importedAt: job.completed_at ?? job.created_at,
        importedRows: job.imported_rows || jobTransactions.length,
        parsedRows: job.parsed_rows || jobTransactions.length,
        status: job.status,
        totalRows: job.total_rows || jobTransactions.length + job.duplicate_rows,
        transactions: jobTransactions,
        uploadedFileId: job.uploaded_file_id
      }];
    });
  },
  updateImportJobSummary: async ({
    duplicateRows,
    failedRows,
    importJobId,
    importedRows,
    parsedRows,
    totalRows
  }: {
    duplicateRows: number;
    failedRows: number;
    importJobId: string;
    importedRows: number;
    parsedRows: number;
    totalRows: number;
  }) => {
    const { error } = await getSupabaseClient()
      .from("import_jobs")
      .update({
        completed_at: new Date().toISOString(),
        duplicate_rows: duplicateRows,
        failed_rows: failedRows,
        imported_rows: importedRows,
        parsed_rows: parsedRows,
        status: "completed",
        summary: {
          duplicate_rows: duplicateRows,
          failed_rows: failedRows,
          imported_rows: importedRows,
          parsed_rows: parsedRows,
          total_rows: totalRows
        },
        total_rows: totalRows
      })
      .eq("id", importJobId);

    if (error) {
      throw error;
    }
  }
};

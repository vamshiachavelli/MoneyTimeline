import { getSupabaseClient } from "@/lib/supabase";
import type { UploadedFile } from "@/types/database";
import { validateImportFile } from "@/services/validation/finance-validation";

export type RegisterUploadInput = {
  bucketId: "bank-statements" | "receipts" | "exports";
  fileName: string;
  mimeType?: string | null;
  sha256Hash?: string | null;
  sizeBytes: number;
  storagePath: string;
};

export const uploadService = {
  buildUserStoragePath: ({
    fileName,
    fileToken,
    userId
  }: {
    fileName: string;
    fileToken?: string;
    userId: string;
  }) => {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const token = fileToken ?? createUuid();

    return `${userId}/${token}/${safeName}`;
  },
  createImportJob: async ({
    accountId,
    sourceType,
    uploadedFileId,
    userId
  }: {
    accountId?: string | null;
    sourceType: UploadedFile["file_type"];
    uploadedFileId: string;
    userId: string;
  }) => {
    const { data, error } = await getSupabaseClient()
      .from("import_jobs")
      .insert({
        account_id: accountId ?? null,
        source_type: sourceType,
        uploaded_file_id: uploadedFileId,
        user_id: userId
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },
  registerUploadedFile: async (userId: string, input: RegisterUploadInput) => {
    const fileType = validateImportFile({
      fileName: input.fileName,
      sizeBytes: input.sizeBytes
    });
    const { data, error } = await getSupabaseClient()
      .from("uploaded_files")
      .insert({
        bucket_id: input.bucketId,
        file_type: fileType,
        mime_type: input.mimeType ?? null,
        original_file_name: input.fileName,
        sha256_hash: input.sha256Hash ?? null,
        size_bytes: input.sizeBytes,
        storage_path: input.storagePath,
        user_id: userId
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  },
  uploadStatementBlob: async ({
    bucketId = "bank-statements",
    contentType,
    fileName,
    uri,
    userId
  }: {
    bucketId?: "bank-statements";
    contentType?: string | null;
    fileName: string;
    uri: string;
    userId: string;
  }) => {
    const response = await fetch(uri);
    const blob = await response.blob();
    const storagePath = uploadService.buildUserStoragePath({ fileName, userId });
    const { error } = await getSupabaseClient()
      .storage
      .from(bucketId)
      .upload(storagePath, blob, {
        contentType: contentType ?? undefined,
        upsert: false
      });

    if (error) {
      throw error;
    }

    return {
      bucketId,
      sizeBytes: blob.size,
      storagePath
    };
  },
  startProcessing: async (uploadedFileId: string) => {
    const { data, error } = await getSupabaseClient().functions.invoke("process-upload", {
      body: { uploaded_file_id: uploadedFileId }
    });

    if (error) {
      throw error;
    }

    return data;
  }
};

const createUuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;

    return value.toString(16);
  });

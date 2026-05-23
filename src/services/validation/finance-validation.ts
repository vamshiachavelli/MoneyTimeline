import type { UploadedFileType } from "@/types/database";

const supportedFileTypes = ["pdf", "csv", "xlsx", "xls"] as const;
const maxImportFileSizeBytes = 50 * 1024 * 1024;

export type SupportedImportFileType = (typeof supportedFileTypes)[number];

export const isSupportedImportFileType = (
  value: string
): value is SupportedImportFileType => supportedFileTypes.includes(value as SupportedImportFileType);

export const parseFileType = (fileName: string): UploadedFileType => {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  return isSupportedImportFileType(extension) ? extension : "other";
};

export const validateCurrency = (currency: string) => {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a 3-letter uppercase ISO code.");
  }
};

export const validatePositiveAmountMinor = (amountMinor: number, label = "Amount") => {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error(`${label} must be a positive integer in minor currency units.`);
  }
};

export const validateNonNegativeAmountMinor = (amountMinor: number, label = "Amount") => {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new Error(`${label} must be a non-negative integer in minor currency units.`);
  }
};

export const validateIsoDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) {
    throw new Error("Date must be an ISO calendar date in YYYY-MM-DD format.");
  }
};

export const validateImportFile = ({
  fileName,
  sizeBytes
}: {
  fileName: string;
  sizeBytes: number;
}) => {
  const fileType = parseFileType(fileName);

  if (!isSupportedImportFileType(fileType)) {
    throw new Error("File must be a PDF, CSV, Excel .xlsx, or Excel .xls statement.");
  }

  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxImportFileSizeBytes) {
    throw new Error("File size must be between 1 byte and 50 MiB.");
  }

  return fileType;
};

export const validateExactSplit = (amountsMinor: number[], totalMinor: number) => {
  validatePositiveAmountMinor(totalMinor, "Total");
  amountsMinor.forEach((amount, index) =>
    validateNonNegativeAmountMinor(amount, `Split amount ${index + 1}`)
  );

  const allocated = amountsMinor.reduce((sum, amount) => sum + amount, 0);

  if (allocated !== totalMinor) {
    throw new Error("Exact split amounts must add up to the transaction total.");
  }
};

export const validatePercentageSplit = (percentages: number[]) => {
  percentages.forEach((percentage, index) => {
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      throw new Error(`Split percentage ${index + 1} must be between 0 and 100.`);
    }
  });

  const total = percentages.reduce((sum, percentage) => sum + percentage, 0);

  if (Math.abs(total - 100) > 0.0001) {
    throw new Error("Split percentages must add up to 100%.");
  }
};

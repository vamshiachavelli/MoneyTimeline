import type { DocumentPickerAsset } from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { read, utils } from "xlsx";

import { env, isSupabaseConfigured } from "@/config/env";

export type StatementFileType = "csv" | "pdf" | "xls" | "xlsx" | "unknown";

export type ParserAccount = {
  id: string;
  name: string;
};

export type ParsedTransactionKind = "expense" | "income" | "payment" | "transfer";

export type ParsedTransactionDraft = {
  accountId: string;
  accountName: string;
  amount: number;
  category: string | null;
  date: string;
  description: string | null;
  duplicateHash: string;
  kind: ParsedTransactionKind;
  merchant: string;
  raw: Record<string, string>;
  rowNumber: number;
};

export type DuplicateReason = "previous_import" | "same_file";

export type DuplicateTransactionDraft = ParsedTransactionDraft & {
  duplicateReason: DuplicateReason;
};

export type StatementFailedRow = {
  message: string;
  raw: Record<string, string> | string[] | string;
  rowNumber: number;
};

export type StatementParseSummary = {
  duplicatesSkipped: number;
  failedRows: number;
  newTransactions: number;
  totalFound: number;
};

export type StatementParseResult = {
  duplicates: DuplicateTransactionDraft[];
  failedRows: StatementFailedRow[];
  fileType: StatementFileType;
  source: "local_csv" | "local_excel" | "remote_pdf_ocr";
  summary: StatementParseSummary;
  transactions: ParsedTransactionDraft[];
};

type HeaderMap = {
  account?: string;
  amount?: string;
  category?: string;
  credit?: string;
  date?: string;
  debit?: string;
  description?: string;
  merchant?: string;
};

type NormalizedRow = {
  data: Record<string, string>;
  rowNumber: number;
};

const dateHeaders = ["date", "transaction date", "posted date", "posting date", "post date"];
const merchantHeaders = ["merchant", "payee", "name", "vendor", "transaction"];
const descriptionHeaders = ["description", "memo", "details", "transaction description", "narrative"];
const amountHeaders = ["amount", "transaction amount", "charge", "charges", "value"];
const debitHeaders = ["debit", "withdrawal", "withdrawals", "spent", "debits"];
const creditHeaders = ["credit", "deposit", "deposits", "payment", "credits"];
const categoryHeaders = ["category", "type", "classification"];
const accountHeaders = ["account", "account name", "card", "source"];

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");

const detectFileType = (file: DocumentPickerAsset): StatementFileType => {
  const name = file.name.toLowerCase();
  const mimeType = file.mimeType?.toLowerCase() ?? "";

  if (name.endsWith(".pdf") || mimeType.includes("pdf")) {
    return "pdf";
  }

  if (name.endsWith(".csv") || mimeType.includes("csv")) {
    return "csv";
  }

  if (name.endsWith(".xlsx") || mimeType.includes("spreadsheetml")) {
    return "xlsx";
  }

  if (name.endsWith(".xls") || mimeType.includes("excel")) {
    return "xls";
  }

  return "unknown";
};

export const parseStatementFile = async ({
  account,
  file,
  knownDuplicateHashes = []
}: {
  account: ParserAccount;
  file: DocumentPickerAsset;
  knownDuplicateHashes?: Iterable<string>;
}): Promise<StatementParseResult> => {
  const fileType = detectFileType(file);

  if (fileType === "csv") {
    const text = await readStatementText(file);
    return parseRowsToResult(
      parseCsvRows(text),
      account,
      fileType,
      "local_csv",
      knownDuplicateHashes
    );
  }

  if (fileType === "xls" || fileType === "xlsx") {
    const rows = await parseExcelRows(file);
    return parseRowsToResult(rows, account, fileType, "local_excel", knownDuplicateHashes);
  }

  if (fileType === "pdf") {
    return parsePdfViaWorker(file, account, knownDuplicateHashes);
  }

  return {
    duplicates: [],
    failedRows: [
      {
        message: "Unsupported file type. Use PDF, CSV, XLS, or XLSX.",
        raw: file.name,
        rowNumber: 0
      }
    ],
    fileType,
    source: "local_csv",
    summary: {
      duplicatesSkipped: 0,
      failedRows: 1,
      newTransactions: 0,
      totalFound: 0
    },
    transactions: []
  };
};

const readStatementText = async (file: DocumentPickerAsset) => {
  if (file.file) {
    return file.file.text();
  }

  try {
    const response = await fetch(file.uri);
    return response.text();
  } catch {
    return FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.UTF8
    });
  }
};

const readStatementBase64 = async (file: DocumentPickerAsset) => {
  if (file.file) {
    const buffer = await file.file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";

    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return globalThis.btoa(binary);
  }

  return FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64
  });
};

const parseExcelRows = async (file: DocumentPickerAsset) => {
  const base64 = await readStatementBase64(file);
  const workbook = read(base64, {
    cellDates: true,
    type: "base64"
  });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];

  if (!sheet) {
    return [];
  }

  return utils.sheet_to_json<string[]>(sheet, {
    blankrows: false,
    defval: "",
    header: 1,
    raw: false
  });
};

const parseRowsToResult = (
  rows: string[][],
  account: ParserAccount,
  fileType: StatementFileType,
  source: StatementParseResult["source"],
  knownDuplicateHashes: Iterable<string> = []
): StatementParseResult => {
  const normalizedRows = rowsToObjects(rows);
  const headerMap = buildHeaderMap(normalizedRows.headers);
  const transactions: ParsedTransactionDraft[] = [];
  const duplicates: DuplicateTransactionDraft[] = [];
  const failedRows: StatementFailedRow[] = [];
  const seenHashes = new Set<string>();
  const existingHashes = new Set(knownDuplicateHashes);

  normalizedRows.rows.forEach((row) => {
    const parsed = normalizeTransactionRow(row, headerMap, account);

    if ("message" in parsed) {
      failedRows.push(parsed);
      return;
    }

    if (existingHashes.has(parsed.duplicateHash)) {
      duplicates.push({
        ...parsed,
        duplicateReason: "previous_import"
      });
      return;
    }

    if (seenHashes.has(parsed.duplicateHash)) {
      duplicates.push({
        ...parsed,
        duplicateReason: "same_file"
      });
      return;
    }

    seenHashes.add(parsed.duplicateHash);
    transactions.push(parsed);
  });

  return {
    duplicates,
    failedRows,
    fileType,
    source,
    summary: {
      duplicatesSkipped: duplicates.length,
      failedRows: failedRows.length,
      newTransactions: transactions.length,
      totalFound: transactions.length + duplicates.length
    },
    transactions
  };
};

const parseCsvRows = (text: string) => {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === "\"" && nextChar === "\"") {
      currentCell += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
};

const detectDelimiter = (text: string) => {
  const headerLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"];

  return candidates.reduce((bestDelimiter, candidate) => {
    const bestCount = headerLine.split(bestDelimiter).length;
    const candidateCount = headerLine.split(candidate).length;
    return candidateCount > bestCount ? candidate : bestDelimiter;
  }, ",");
};

const rowsToObjects = (rows: string[][]) => {
  const headerIndex = rows.findIndex((row) => row.filter(Boolean).length >= 2);

  if (headerIndex === -1) {
    return { headers: [], rows: [] as NormalizedRow[] };
  }

  const headers = rows[headerIndex].map((header, index) =>
    normalizeHeader(header || `column ${index + 1}`)
  );
  const dataRows = rows.slice(headerIndex + 1);

  return {
    headers,
    rows: dataRows.map((row, index) => ({
      data: headers.reduce<Record<string, string>>((acc, header, columnIndex) => {
        acc[header] = `${row[columnIndex] ?? ""}`.trim();
        return acc;
      }, {}),
      rowNumber: headerIndex + index + 2
    }))
  };
};

const buildHeaderMap = (headers: string[]): HeaderMap => ({
  account: findHeader(headers, accountHeaders),
  amount: findHeader(headers, amountHeaders),
  category: findHeader(headers, categoryHeaders),
  credit: findHeader(headers, creditHeaders),
  date: findHeader(headers, dateHeaders),
  debit: findHeader(headers, debitHeaders),
  description: findHeader(headers, descriptionHeaders),
  merchant: findHeader(headers, merchantHeaders)
});

const findHeader = (headers: string[], candidates: string[]) => {
  const exactMatch = candidates.find((candidate) => headers.includes(candidate));

  if (exactMatch) {
    return exactMatch;
  }

  return headers.find((header) =>
    candidates.some((candidate) => header.includes(candidate) || candidate.includes(header))
  );
};

const normalizeTransactionRow = (
  row: NormalizedRow,
  headerMap: HeaderMap,
  account: ParserAccount
): ParsedTransactionDraft | StatementFailedRow => {
  const dateValue = pickValue(row.data, headerMap.date);
  const merchantValue =
    pickValue(row.data, headerMap.merchant) || pickValue(row.data, headerMap.description);
  const descriptionValue = pickValue(row.data, headerMap.description);
  const amountValue = resolveAmount(row.data, headerMap, merchantValue || descriptionValue);

  if (!dateValue) {
    return makeFailedRow(row, "Missing transaction date.");
  }

  const date = parseDate(dateValue);

  if (!date) {
    return makeFailedRow(row, `Could not read date "${dateValue}".`);
  }

  if (!merchantValue) {
    return makeFailedRow(row, "Missing merchant or description.");
  }

  if (amountValue == null || Number.isNaN(amountValue)) {
    return makeFailedRow(row, "Missing or invalid amount.");
  }

  const merchant = cleanMerchant(merchantValue);
  const description = descriptionValue && descriptionValue !== merchantValue
    ? descriptionValue.trim()
    : null;
  const descriptor = `${merchant} ${description ?? ""}`;
  const kind = inferTransactionKind(descriptor, amountValue);
  const category = pickValue(row.data, headerMap.category) || inferCategoryForKind(kind);
  const duplicateHash = createTransactionDuplicateHash({
    accountId: account.id,
    amount: amountValue,
    date,
    merchant
  });

  return {
    accountId: account.id,
    accountName: pickValue(row.data, headerMap.account) || account.name,
    amount: amountValue,
    category,
    date,
    description,
    duplicateHash,
    kind,
    merchant,
    raw: row.data,
    rowNumber: row.rowNumber
  };
};

const pickValue = (data: Record<string, string>, header?: string) => {
  if (!header) {
    return "";
  }

  return data[header]?.trim() ?? "";
};

const resolveAmount = (data: Record<string, string>, headerMap: HeaderMap, descriptor: string) => {
  const debit = parseMoney(pickValue(data, headerMap.debit));
  const credit = parseMoney(pickValue(data, headerMap.credit));
  const amount = parseMoney(pickValue(data, headerMap.amount));

  if (debit != null && debit !== 0) {
    return Math.abs(debit);
  }

  if (credit != null && credit !== 0) {
    return -Math.abs(credit);
  }

  if (amount == null) {
    return null;
  }

  if (amount < 0 && !isCreditLike(descriptor)) {
    return Math.abs(amount);
  }

  return amount;
};

const parseMoney = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const isParenthesesNegative = /^\(.*\)$/.test(trimmed);
  const normalized = trimmed.replace(/[,$\s]/g, "").replace(/[()]/g, "");
  const parsed = Number.parseFloat(normalized);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return isParenthesesNegative ? -Math.abs(parsed) : parsed;
};

const isCreditLike = (descriptor: string) =>
  /payroll|deposit|refund|credit|reversal|cashback|zelle payment from|mobile payment - thank you|ach deposit|internet transfer from/i.test(
    descriptor
  );

const inferTransactionKind = (
  descriptor: string,
  amount: number
): ParsedTransactionKind => {
  if (/mobile payment - thank you|payment thank you|american express.*ach pmt|ach pmt|credit card payment|card payment|autopay|online payment|payment to/i.test(descriptor)) {
    return "payment";
  }

  if (/transfer (to|from)|internet transfer|external transfer|account transfer/i.test(descriptor)) {
    return "transfer";
  }

  if (amount < 0 || /payroll|deposit|zelle payment from|refund|credit/i.test(descriptor)) {
    return "income";
  }

  return "expense";
};

const inferCategoryForKind = (kind: ParsedTransactionKind) => {
  if (kind === "payment" || kind === "transfer") {
    return "Payments / Transfers";
  }

  if (kind === "income") {
    return "Income";
  }

  return null;
};

const parseDate = (value: string) => {
  const trimmed = value.trim();
  const isoLike = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const usLike = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);

  if (isoLike) {
    return formatDateParts(
      Number(isoLike[1]),
      Number(isoLike[2]),
      Number(isoLike[3])
    );
  }

  if (usLike) {
    const year = Number(usLike[3]) < 100 ? 2000 + Number(usLike[3]) : Number(usLike[3]);
    return formatDateParts(year, Number(usLike[1]), Number(usLike[2]));
  }

  const parsedDate = new Date(trimmed);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return formatDateParts(
    parsedDate.getFullYear(),
    parsedDate.getMonth() + 1,
    parsedDate.getDate()
  );
};

const formatDateParts = (year: number, month: number, day: number) => {
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
};

const cleanMerchant = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\b\d{8,}\b/g, "")
    .trim();

export const createTransactionDuplicateHash = ({
  accountId,
  amount,
  date,
  merchant
}: {
  accountId: string;
  amount: number;
  date: string;
  merchant: string;
}) => {
  const key = `${accountId}|${date}|${merchant.toLowerCase()}|${amount.toFixed(2)}`;
  let hash = 5381;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 33) ^ key.charCodeAt(index);
  }

  return `txn_${(hash >>> 0).toString(16)}`;
};

const makeFailedRow = (row: NormalizedRow, message: string): StatementFailedRow => ({
  message,
  raw: row.data,
  rowNumber: row.rowNumber
});

const parsePdfViaWorker = async (
  file: DocumentPickerAsset,
  account: ParserAccount,
  knownDuplicateHashes: Iterable<string>
): Promise<StatementParseResult> => {
  if (!isSupabaseConfigured) {
    return {
      duplicates: [],
      failedRows: [
        {
          message:
            "PDF parsing is routed through the secure OCR worker. Configure Supabase to enable text PDF and scanned PDF extraction.",
          raw: file.name,
          rowNumber: 0
        }
      ],
      fileType: "pdf",
      source: "remote_pdf_ocr",
      summary: {
        duplicatesSkipped: 0,
        failedRows: 1,
        newTransactions: 0,
        totalFound: 0
      },
      transactions: []
    };
  }

  const response = await fetch(`${env.supabaseUrl}/functions/v1/parse-statement`, {
    body: JSON.stringify({
      account,
      fileName: file.name,
      fileType: "pdf",
      knownDuplicateHashes: [...knownDuplicateHashes],
      mimeType: file.mimeType,
      payload: await readStatementBase64(file)
    }),
    headers: {
      Authorization: `Bearer ${env.supabaseAnonKey}`,
      apikey: env.supabaseAnonKey,
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("The PDF parser could not process this statement.");
  }

  return response.json() as Promise<StatementParseResult>;
};

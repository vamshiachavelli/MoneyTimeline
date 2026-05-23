import * as pdfjs from "npm:pdfjs-dist@4.10.38/legacy/build/pdf.mjs";

type ParseStatementBody = {
  account: {
    id: string;
    name: string;
  };
  fileName: string;
  fileType: "pdf";
  knownDuplicateHashes?: string[];
  debug?: boolean;
  mimeType?: string;
  payload: string;
};

type TextItem = {
  page: number;
  text: string;
  x: number;
  y: number;
};

type PdfLine = {
  page: number;
  text: string;
  xMax: number;
  xMin: number;
  y: number;
};

type TransactionDraft = {
  accountId: string;
  accountName: string;
  amount: number;
  category: string | null;
  date: string;
  description: string | null;
  duplicateHash: string;
  kind: TransactionKind;
  merchant: string;
  raw: Record<string, string>;
  rowNumber: number;
};

type TransactionKind = "expense" | "income" | "payment" | "transfer";

type FailedRow = {
  message: string;
  raw: Record<string, string> | string;
  rowNumber: number;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    },
    status
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await request.json()) as Partial<ParseStatementBody>;

    if (!body.fileName || body.fileType !== "pdf" || !body.payload || !body.account?.id) {
      return jsonResponse({ error: "Invalid PDF parse request" }, 400);
    }

    const parseResult = await parsePdfStatement(body as ParseStatementBody);
    return jsonResponse(parseResult);
  } catch (error) {
    return jsonResponse(
      {
        duplicates: [],
        failedRows: [
          {
            message:
              error instanceof Error
                ? error.message
                : "The PDF parser could not process this statement.",
            raw: "parse-statement",
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
      },
      200
    );
  }
});

const parsePdfStatement = async (body: ParseStatementBody) => {
  const items = await extractTextItems(body.payload);

  if (items.length === 0) {
    return buildResult([], [
      {
        message:
          "No selectable text was found in this PDF. This looks like a scanned statement and needs OCR.",
        raw: body.fileName,
        rowNumber: 0
      }
    ], body.knownDuplicateHashes ?? []);
  }

  const lines = groupItemsIntoLines(items);
  const candidates = extractTransactionsFromPositionedLines(lines, body);
  const failedRows: FailedRow[] = [];

  if (candidates.length === 0) {
    failedRows.push({
      message:
        "No transaction rows were detected. This statement format may need a bank-specific parser rule.",
      raw: body.fileName,
      rowNumber: 0
    });
  }

  const result = buildResult(candidates, failedRows, body.knownDuplicateHashes ?? []);

  if (body.debug) {
    return {
      ...result,
      debug: {
        itemCount: items.length,
        lineCount: lines.length,
        lines: lines.slice(0, 220)
      }
    };
  }

  return result;
};

const extractTextItems = async (base64: string): Promise<TextItem[]> => {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true
  });
  const document = await loadingTask.promise;
  const items: TextItem[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();

    for (const rawItem of content.items) {
      if (!("str" in rawItem) || !rawItem.str.trim()) {
        continue;
      }

      const transform = rawItem.transform;
      items.push({
        page: pageNumber,
        text: rawItem.str.trim(),
        x: transform[4],
        y: transform[5]
      });
    }
  }

  await document.destroy();
  return items;
};

const groupItemsIntoLines = (items: TextItem[]): PdfLine[] => {
  const lines: Array<{ items: TextItem[]; page: number; y: number }> = [];

  for (const item of items) {
    const existing = lines.find(
      (line) => line.page === item.page && Math.abs(line.y - item.y) <= 2.5
    );

    if (existing) {
      existing.items.push(item);
      existing.y = (existing.y + item.y) / 2;
    } else {
      lines.push({ items: [item], page: item.page, y: item.y });
    }
  }

  return lines
    .map((line) => {
      const sortedItems = line.items.sort((a, b) => a.x - b.x);
      return {
        page: line.page,
        text: mergeLineText(sortedItems),
        xMax: Math.max(...sortedItems.map((item) => item.x)),
        xMin: Math.min(...sortedItems.map((item) => item.x)),
        y: line.y
      };
    })
    .sort((a, b) => (a.page === b.page ? b.y - a.y : a.page - b.page));
};

const mergeLineText = (items: TextItem[]) => {
  let text = "";
  let previousX = 0;

  items.forEach((item, index) => {
    const gap = index === 0 ? 0 : item.x - previousX;
    const separator = gap > 12 ? " " : "";
    text += `${separator}${item.text}`;
    previousX = item.x + Math.max(item.text.length * 4.2, 8);
  });

  return text.replace(/\s+/g, " ").trim();
};

const extractTransactionsFromPositionedLines = (
  lines: PdfLine[],
  body: ParseStatementBody
): TransactionDraft[] => {
  const fullLineTransactions = lines
    .map((line) => parseFullTransactionLine(line, body))
    .filter(Boolean) as TransactionDraft[];
  const dateColumnLines = lines.filter((line) => isDateOnlyLine(line.text));
  const amountColumnLines = lines.filter((line) => isAmountOnlyLine(line.text));
  const rowCandidates = dateColumnLines
    .map((dateLine) => {
      const amountLine = findNearestAmountLine(dateLine, amountColumnLines);
      const description = findDescriptionForRow(dateLine, lines);
      const date = parseDate(dateLine.text);
      const amount = amountLine ? parseMoney(amountLine.text) : null;

      if (!date || amount == null || !description) {
        return null;
      }

      const merchant = cleanMerchant(description);

      if (!merchant || isNoiseMerchant(merchant)) {
        return null;
      }

      const normalizedAmount = normalizeAmount(amount, merchant);
      const kind = inferTransactionKind(merchant, normalizedAmount);

      return {
        accountId: body.account.id,
        accountName: body.account.name,
        amount: normalizedAmount,
        category: inferCategory(merchant, kind),
        date,
        description,
        duplicateHash: createDuplicateHash({
          accountId: body.account.id,
          amount: normalizedAmount,
          date,
          merchant
        }),
        kind,
        merchant,
        raw: {
          amount: amountLine?.text ?? "",
          date: dateLine.text,
          description,
          fileName: body.fileName,
          page: `${dateLine.page}`
        },
        rowNumber: lineNumber(dateLine)
      };
    })
    .filter(Boolean) as TransactionDraft[];

  return dedupeDrafts([...fullLineTransactions, ...rowCandidates]);
};

const parseFullTransactionLine = (
  line: PdfLine,
  body: ParseStatementBody
): TransactionDraft | null => {
  const match = line.text.match(
    /^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}[/-]\d{1,2}[/-]\d{1,2})(?:\*)?\s+(.+)$/
  );

  if (!match) {
    return null;
  }

  const date = parseDate(match[1]);
  const remainder = match[2].trim();
  const moneyMatches = [...remainder.matchAll(/[-+]?[$]?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?/g)];

  if (!date || moneyMatches.length === 0) {
    return null;
  }

  const amountMatch = moneyMatches[moneyMatches.length - 1];
  const amount = parseMoney(amountMatch[0]);

  if (amount == null) {
    return null;
  }

  const rawDescription = remainder.slice(0, amountMatch.index).trim();
  const description = rawDescription
    .replace(/\s+\d+(?:\.\d+)?%\s+[-+]?[$]?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?\s*$/i, "")
    .trim();
  const merchant = cleanMerchant(description);

  if (!merchant || isNoiseMerchant(merchant) || merchant.length < 2) {
    return null;
  }

  const normalizedAmount = normalizeAmount(amount, merchant);
  const kind = inferTransactionKind(merchant, normalizedAmount);

  return {
    accountId: body.account.id,
    accountName: body.account.name,
    amount: normalizedAmount,
    category: inferCategory(merchant, kind),
    date,
    description,
    duplicateHash: createDuplicateHash({
      accountId: body.account.id,
      amount: normalizedAmount,
      date,
      merchant
    }),
    kind,
    merchant,
    raw: {
      amount: amountMatch[0],
      date: match[1],
      line: line.text,
      page: `${line.page}`
    },
    rowNumber: lineNumber(line)
  };
};

const findNearestAmountLine = (dateLine: PdfLine, amountLines: PdfLine[]) =>
  amountLines
    .filter((amountLine) => amountLine.page === dateLine.page)
    .map((amountLine) => ({
      amountLine,
      distance: Math.abs(amountLine.y - dateLine.y)
    }))
    .filter(({ distance }) => distance <= 5)
    .sort((a, b) => a.distance - b.distance)[0]?.amountLine ?? null;

const findDescriptionForRow = (dateLine: PdfLine, lines: PdfLine[]) => {
  const sameRowDescriptions = lines
    .filter(
      (line) =>
        line.page === dateLine.page &&
        Math.abs(line.y - dateLine.y) <= 4 &&
        !isDateOnlyLine(line.text) &&
        !isAmountOnlyLine(line.text) &&
        !isHeaderOrNoise(line.text)
    )
    .sort((a, b) => a.xMin - b.xMin);

  if (sameRowDescriptions.length > 0) {
    return sameRowDescriptions.map((line) => line.text).join(" ");
  }

  const nearestBelow = lines
    .filter(
      (line) =>
        line.page === dateLine.page &&
        line.y < dateLine.y &&
        dateLine.y - line.y <= 9 &&
        !isDateOnlyLine(line.text) &&
        !isAmountOnlyLine(line.text) &&
        !isHeaderOrNoise(line.text)
    )
    .sort((a, b) => Math.abs(a.y - dateLine.y) - Math.abs(b.y - dateLine.y))[0];

  return nearestBelow?.text ?? "";
};

const isDateOnlyLine = (text: string) =>
  /^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}[/-]\d{1,2}[/-]\d{1,2})(?:\*)?$/.test(
    text.trim()
  );

const isAmountOnlyLine = (text: string) =>
  /^[-+]?[$]?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?(?:\s+[-+]?[$]?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?)*$/.test(
    text.trim()
  );

const isHeaderOrNoise = (text: string) =>
  /^(date|amount|description|merchant|detail|total|payments|credits|fees|interest charged|new charges summary|continued|page \d+)/i.test(
    text.trim()
  );

const isNoiseMerchant = (merchant: string) =>
  /^(total|amount|new balance|minimum payment|interest charge|payment due date|customer care|website|payments?|credits?|fees?)\b/i.test(
    merchant
  );

const parseMoney = (value: string) => {
  const firstMoney = value.match(/[-+]?[$]?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?/);

  if (!firstMoney) {
    return null;
  }

  const raw = firstMoney[0];
  const isParenthesesNegative = /^\(.*\)$/.test(raw);
  const normalized = raw.replace(/[,$\s]/g, "").replace(/[()]/g, "");
  const parsed = Number.parseFloat(normalized);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return isParenthesesNegative ? -Math.abs(parsed) : parsed;
};

const normalizeAmount = (amount: number, merchant: string) => {
  if (amount < 0 && !isCreditLike(merchant)) {
    return Math.abs(amount);
  }

  return amount;
};

const isCreditLike = (descriptor: string) =>
  /payroll|deposit|refund|credit|reversal|cashback|zelle payment from|mobile payment - thank you|ach deposit|internet transfer from/i.test(
    descriptor
  );

const inferTransactionKind = (
  descriptor: string,
  amount: number
): TransactionKind => {
  if (
    /mobile payment - thank you|payment thank you|american express.*ach pmt|ach pmt|credit card payment|card payment|autopay|online payment|payment to/i.test(
      descriptor
    )
  ) {
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

const parseDate = (value: string) => {
  const trimmed = value.trim().replace(/\*$/, "");
  const isoLike = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const usLike = trimmed.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
  const fallbackYear = 2026;

  if (isoLike) {
    return formatDateParts(Number(isoLike[1]), Number(isoLike[2]), Number(isoLike[3]));
  }

  if (usLike) {
    const year = usLike[3]
      ? Number(usLike[3]) < 100
        ? 2000 + Number(usLike[3])
        : Number(usLike[3])
      : fallbackYear;

    return formatDateParts(year, Number(usLike[1]), Number(usLike[2]));
  }

  return null;
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
    .replace(/\b(?:co id|id|indn|conf)#?:?.*$/i, "")
    .replace(/\b\d{8,}\b/g, "")
    .trim();

const inferCategory = (merchant: string, kind: TransactionKind) => {
  if (kind === "payment" || kind === "transfer") {
    return "Payments / Transfers";
  }

  if (kind === "income") {
    return "Income";
  }

  if (/fuel|76|shell|uber|parking|muni|s?dot|paybyphone/i.test(merchant)) {
    return "Transport";
  }

  if (/domino|restaurant|tst\*|saffron|masala|desi adda|bakery|coffee|starbucks/i.test(merchant)) {
    return "Dining";
  }

  if (/safeway|qfc|mayuri foods|grocery|trader joe|costco/i.test(merchant)) {
    return "Groceries";
  }

  if (/amazon|apple\.com|dollar tree|comcast|xfinity|rocket money/i.test(merchant)) {
    return "Shopping";
  }

  if (/payment|thank you|ach|zelle|remitly|appfolio|maple leaf/i.test(merchant)) {
    return "Bills";
  }

  return null;
};

const createDuplicateHash = ({
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

const dedupeDrafts = (drafts: TransactionDraft[]) => {
  const seen = new Set<string>();
  const deduped: TransactionDraft[] = [];

  drafts.forEach((draft) => {
    if (seen.has(draft.duplicateHash)) {
      return;
    }

    seen.add(draft.duplicateHash);
    deduped.push(draft);
  });

  return deduped;
};

const buildResult = (
  transactions: TransactionDraft[],
  failedRows: FailedRow[],
  knownDuplicateHashes: string[]
) => {
  const known = new Set(knownDuplicateHashes);
  const duplicates = transactions
    .filter((transaction) => known.has(transaction.duplicateHash))
    .map((transaction) => ({
      ...transaction,
      duplicateReason: "previous_import" as const
    }));
  const newTransactions = transactions.filter(
    (transaction) => !known.has(transaction.duplicateHash)
  );

  return {
    duplicates,
    failedRows,
    fileType: "pdf",
    source: "remote_pdf_ocr",
    summary: {
      duplicatesSkipped: duplicates.length,
      failedRows: failedRows.length,
      newTransactions: newTransactions.length,
      totalFound: transactions.length
    },
    transactions: newTransactions
  };
};

const lineNumber = (line: PdfLine) => Math.round(line.page * 1000 + (800 - line.y));

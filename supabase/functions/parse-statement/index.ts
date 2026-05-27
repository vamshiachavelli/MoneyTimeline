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

type StatementPeriod = {
  end: string;
  start: string;
  year: number;
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

type DetectedStatementAccount = {
  accountType: "Checking" | "Credit card" | "Savings" | "Other";
  confidence: "high" | "medium";
  institution: string;
  lastFour: string | null;
  name: string;
};

type FailedRow = {
  message: string;
  raw: Record<string, string> | string;
  rowNumber: number;
};

const moneyPatternSource =
  "[-+]?[$]?(?:\\(?\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?\\)?|\\(?\\.\\d{2}\\)?)";
const moneyPattern = new RegExp(moneyPatternSource);
const moneyPatternGlobal = new RegExp(moneyPatternSource, "g");

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
        detectedAccount: null,
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
  const statementText = `${body.fileName} ${lines.map((line) => line.text).join(" ")}`;
  const detectedAccount = detectStatementAccount(statementText);
  const statementPeriod = detectStatementPeriod(statementText);
  const candidates = filterTransactionsToStatementPeriod(
    extractTransactionsFromPositionedLines(lines, body, statementPeriod),
    statementPeriod
  );
  const failedRows: FailedRow[] = [];

  if (candidates.length === 0) {
    failedRows.push({
      message:
        "No transaction rows were detected. This statement format may need a bank-specific parser rule.",
      raw: body.fileName,
      rowNumber: 0
    });
  }

  const result = {
    ...buildResult(candidates, failedRows, body.knownDuplicateHashes ?? []),
    detectedAccount
  };

  if (body.debug) {
    return {
      ...result,
      debug: {
        itemCount: items.length,
        lineCount: lines.length,
        statementPeriod,
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
  body: ParseStatementBody,
  statementPeriod: StatementPeriod | null
): TransactionDraft[] => {
  const fallbackYear = statementPeriod?.year ?? 2026;
  const fullLineTransactions = lines
    .map((line) => parseFullTransactionLine(line, body, fallbackYear))
    .filter(Boolean) as TransactionDraft[];
  const dateColumnLines = lines.filter((line) => isDateOnlyLine(line.text));
  const amountColumnLines = lines.filter((line) => isAmountOnlyLine(line.text));
  const rowCandidates = dateColumnLines
    .map((dateLine) => {
      const amountLine = findNearestAmountLine(dateLine, amountColumnLines);
      const description = findDescriptionForRow(dateLine, lines);
      const date = parseDate(dateLine.text, fallbackYear);
      const amount = amountLine ? parseMoney(amountLine.text) : null;

      if (!date || amount == null || amount === 0 || !description) {
        return null;
      }

      const merchant = cleanMerchant(description);

      if (!merchant || isNoiseMerchant(merchant)) {
        return null;
      }

      const normalizedAmount = normalizeAmount(amount, merchant);
      const kind = inferTransactionKind(`${merchant} ${description}`, normalizedAmount);

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
  body: ParseStatementBody,
  fallbackYear: number
): TransactionDraft | null => {
  const match = line.text.match(
    /^(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}[/-]\d{1,2}[/-]\d{1,2})(?:\*)?\s+(.+)$/
  );

  if (!match) {
    return null;
  }

  const date = parseDate(match[1], fallbackYear);
  const remainder = match[2].trim();
  const moneyMatches = [...remainder.matchAll(moneyPatternGlobal)];

  if (!date || moneyMatches.length === 0) {
    return null;
  }

  const amountMatch = moneyMatches[moneyMatches.length - 1];
  const amount = parseMoney(amountMatch[0]);

  if (amount == null || amount === 0) {
    return null;
  }

  const rawDescription = remainder.slice(0, amountMatch.index).trim();
  const description = rawDescription
    .replace(
      new RegExp(`\\s+\\d+(?:\\.\\d+)?%\\s+${moneyPatternSource}\\s*$`, "i"),
      ""
    )
    .trim();
  const merchant = cleanMerchant(description);

  if (!merchant || isNoiseMerchant(merchant) || merchant.length < 2) {
    return null;
  }

  const normalizedAmount = normalizeAmount(amount, merchant);
  const kind = inferTransactionKind(`${merchant} ${description}`, normalizedAmount);

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
  new RegExp(`^${moneyPatternSource}(?:\\s+${moneyPatternSource})*$`).test(
    text.trim()
  );

const isHeaderOrNoise = (text: string) =>
  /^(date|amount|description|merchant|detail|total|payments|credits|fees|interest charged|new charges summary|continued|page \d+)/i.test(
    text.trim()
  );

const isNoiseMerchant = (merchant: string) =>
  /^(total|amount|new balance|minimum payment|payment due date|customer care|website|fees?)\b/i.test(
    merchant
  );

const parseMoney = (value: string) => {
  const firstMoney = value.match(moneyPattern);

  if (!firstMoney) {
    return null;
  }

  const raw = firstMoney[0];
  const isParenthesesNegative = /^\(.*\)$/.test(raw);
  const normalized = raw
    .replace(/[,$\s]/g, "")
    .replace(/[()]/g, "")
    .replace(/^([+-]?)\./, "$10.");
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
  /payroll|deposit|refund|credit|reversal|cashback|zelle payment from|mobile payment - thank you|ach deposit|internet transfer from|account transfer/i.test(
    descriptor
  );

const inferTransactionKind = (
  descriptor: string,
  amount: number
): TransactionKind => {
  if (
    /mobile payment - thank you|payment thank you|american express.*ach pmt|ach pmt|applecard.*payment|chase credit crd.*epay|credit crd.*epay|des:payment|credit card payment|card payment|autopay|online payment|payment to/i.test(
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

const parseDate = (value: string, fallbackYear = 2026) => {
  const trimmed = value.trim().replace(/\*$/, "");
  const isoLike = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const usLike = trimmed.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);

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

const detectStatementPeriod = (text: string): StatementPeriod | null => {
  const normalized = text.replace(/\s+/g, " ");
  const monthRange = normalized.match(
    /\b(?:for|from)?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\s+(?:to|through|[-–—])\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i
  );

  if (monthRange) {
    const start = formatDateParts(
      Number(monthRange[3]),
      monthNameToNumber(monthRange[1]),
      Number(monthRange[2])
    );
    const end = formatDateParts(
      Number(monthRange[6]),
      monthNameToNumber(monthRange[4]),
      Number(monthRange[5])
    );

    return start && end ? { end, start, year: Number(monthRange[6]) } : null;
  }

  const shortRange = normalized.match(
    /\b(?:opening\/closing date|closing date)\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*[-–—]\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i
  );

  if (shortRange) {
    const startYear = normalizeYear(shortRange[3]);
    const endYear = normalizeYear(shortRange[6]);
    const start = formatDateParts(startYear, Number(shortRange[1]), Number(shortRange[2]));
    const end = formatDateParts(endYear, Number(shortRange[4]), Number(shortRange[5]));

    return start && end ? { end, start, year: endYear } : null;
  }

  const appleRange = normalized.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})\s*[-–—]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4})/i
  );

  if (appleRange) {
    const year = Number(appleRange[5]);
    const start = formatDateParts(year, monthNameToNumber(appleRange[1]), Number(appleRange[2]));
    const end = formatDateParts(year, monthNameToNumber(appleRange[3]), Number(appleRange[4]));

    return start && end ? { end, start, year } : null;
  }

  const closingOnly = normalized.match(/\bclosing date\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);

  if (closingOnly) {
    const year = normalizeYear(closingOnly[3]);
    const end = formatDateParts(year, Number(closingOnly[1]), Number(closingOnly[2]));
    const start = formatDateParts(
      Number(closingOnly[1]) === 1 ? year - 1 : year,
      Number(closingOnly[1]) === 1 ? 12 : Number(closingOnly[1]) - 1,
      1
    );

    return start && end ? { end, start, year } : null;
  }

  return null;
};

const filterTransactionsToStatementPeriod = (
  transactions: TransactionDraft[],
  statementPeriod: StatementPeriod | null
) => {
  if (!statementPeriod) {
    return transactions;
  }

  return transactions.filter(
    (transaction) =>
      transaction.date >= statementPeriod.start && transaction.date <= statementPeriod.end
  );
};

const monthNameToNumber = (value: string) => {
  const normalized = value.slice(0, 3).toLowerCase();
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return months.indexOf(normalized) + 1;
};

const normalizeYear = (value: string) => {
  const year = Number(value);
  return year < 100 ? 2000 + year : year;
};

const cleanMerchant = (value: string) =>
  getKnownMerchantName(value) ??
  value
    .replace(/\s+/g, " ")
    .replace(/\b(?:co id|id|indn|conf)#?:?.*$/i, "")
    .replace(/\s+(?:des|id|indn):.*$/i, "")
    .replace(/\s+\d{3,}.*$/g, "")
    .replace(/\s+(?:seattle|bellevue|redmond|cupertino|philadelphia|wa|ca|pa|usa)\b.*$/i, "")
    .replace(/\b\d{8,}\b/g, "")
    .trim();

const knownMerchantRules: Array<[RegExp, string]> = [
  [/mobile payment - thank you|payment thank you/i, "Credit Card Payment"],
  [/ach deposit.*internet transfer|internet transfer from/i, "Account Transfer"],
  [/american express.*ach pmt/i, "American Express Payment"],
  [/zelle payment from\s+(.+?)(?:\s+conf#|$)/i, "Zelle Payment Received"],
  [/zelle payment to\s+(.+?)(?:\s+conf#|$)/i, "Zelle Payment"],
  [/amazon\.com svcs.*payroll/i, "Amazon Payroll"],
  [/amazon|amzn\.com/i, "Amazon"],
  [/apple\.com\/bill|apple online store/i, "Apple"],
  [/starbucks/i, "Starbucks"],
  [/target/i, "Target"],
  [/uber eats/i, "Uber Eats"],
  [/\buber\b/i, "Uber"],
  [/trader joe/i, "Trader Joe's"],
  [/whole foods/i, "Whole Foods"],
  [/costco/i, "Costco"],
  [/qfc/i, "QFC"],
  [/safeway fuel/i, "Safeway Fuel"],
  [/safeway/i, "Safeway"],
  [/\b76\b|northgate 76/i, "76 Gas"],
  [/shell/i, "Shell"],
  [/s?dot paybyphone|parking/i, "Parking"],
  [/seattle muni/i, "Seattle Municipal"],
  [/domino/i, "Domino's"],
  [/saffron/i, "Saffron Spice"],
  [/masala/i, "Masala of India"],
  [/desi adda/i, "Desi Adda"],
  [/mayuri bakery/i, "Mayuri Bakery"],
  [/mayuri foods/i, "Mayuri Foods"],
  [/dollar tree/i, "Dollar Tree"],
  [/maple leaf/i, "Maple Leaf"],
  [/remitly/i, "Remitly"],
  [/comcast|xfinity/i, "Xfinity"],
  [/purchase interest charge/i, "Interest Charge"]
];

const getKnownMerchantName = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  const match = knownMerchantRules.find(([pattern]) => pattern.test(normalized));

  return match?.[1] ?? null;
};

const detectStatementAccount = (text: string): DetectedStatementAccount | null => {
  const normalized = text.replace(/\s+/g, " ").trim();
  const lastFour =
    normalized.match(/(?:ending in|ending|account(?: number)?|card(?: number)?|acct)\D{0,16}(\d{4})/i)?.[1] ??
    normalized.match(/\*{2,}(\d{4})/)?.[1] ??
    null;
  const accountRules: Array<[RegExp, Omit<DetectedStatementAccount, "lastFour">]> = [
    [
      /apple\s+card|goldman\s+sachs/i,
      {
        accountType: "Credit card",
        confidence: "high",
        institution: "Apple Card",
        name: "Apple Card"
      }
    ],
    [
      /bank\s+of\s+america/i,
      {
        accountType: /adv plus banking|checking|personal deposit|banking/i.test(normalized)
          ? "Checking"
          : "Credit card",
        confidence: "medium",
        institution: "Bank of America",
        name: /adv plus banking|checking|personal deposit|banking/i.test(normalized)
          ? "Bank of America Checking"
          : "Bank of America Card"
      }
    ],
    [
      /american\s+express|\bamex\b/i,
      {
        accountType: "Credit card",
        confidence: "high",
        institution: "American Express",
        name: "Amex Card"
      }
    ],
    [
      /chase|jpmorgan/i,
      {
        accountType: "Credit card",
        confidence: "high",
        institution: "Chase",
        name: "Chase Card"
      }
    ],
    [
      /wells\s+fargo/i,
      {
        accountType: "Checking",
        confidence: "high",
        institution: "Wells Fargo",
        name: "Wells Fargo Account"
      }
    ]
  ];
  const match = accountRules.find(([pattern]) => pattern.test(normalized));

  return match ? { ...match[1], lastFour } : null;
};

const inferCategory = (merchant: string, kind: TransactionKind) => {
  if (kind === "payment" || kind === "transfer") {
    return "Payments / Transfers";
  }

  if (kind === "income") {
    return "Income";
  }

  if (/fuel|76\b|shell|uber|parking|muni|s?dot|paybyphone|delta|flight/i.test(merchant)) {
    return "Transport";
  }

  if (/domino|restaurant|tst\*|saffron|masala|desi adda|bakery|coffee|starbucks|grubhub|doordash|uber eats/i.test(merchant)) {
    return "Dining";
  }

  if (/safeway|qfc|mayuri foods|grocery|trader joe|costco|whole foods/i.test(merchant)) {
    return "Groceries";
  }

  if (/amazon|apple|target|dollar tree|comcast|xfinity|rocket money/i.test(merchant)) {
    return "Shopping";
  }

  if (/ach|zelle|remitly|appfolio|maple leaf|electric|utility|bill/i.test(merchant)) {
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

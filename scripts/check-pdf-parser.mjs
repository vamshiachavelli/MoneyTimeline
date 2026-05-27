import fs from "node:fs";
import path from "node:path";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const sampleDirectory =
  "/Users/killer/Library/Mobile Documents/com~apple~CloudDocs/All the statements";

const defaultFiles = [
  "Apple Card Statement - March 2026.pdf",
  "B3BF18E2-C496-4BF1-9C11-C252FAD23D03-list.pdf",
  "eStmt_2026-03-25.pdf",
  "Feb_26_-_Mar_27_2026.pdf"
].map((fileName) => path.join(sampleDirectory, fileName));

const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultFiles;

const moneyPatternSource =
  "[-+]?[$]?(?:\\(?\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?\\)?|\\(?\\.\\d{2}\\)?)";
const moneyPattern = new RegExp(moneyPatternSource);
const moneyPatternGlobal = new RegExp(moneyPatternSource, "g");

const expectedMinimums = new Map([
  ["Apple Card Statement - March 2026.pdf", 17],
  ["B3BF18E2-C496-4BF1-9C11-C252FAD23D03-list.pdf", 7],
  ["eStmt_2026-03-25.pdf", 15],
  ["Feb_26_-_Mar_27_2026.pdf", 8]
]);

const run = async () => {
  let failed = false;

  for (const filePath of files) {
    const fileName = path.basename(filePath);

    if (!fs.existsSync(filePath)) {
      console.log(`${fileName}: skipped, file not found`);
      continue;
    }

    const lines = await extractLines(filePath);
    const statementText = `${fileName} ${lines.map((line) => line.text).join(" ")}`;
    const period = detectStatementPeriod(statementText);
    const detectedAccount = detectStatementAccount(statementText);
    const transactions = filterTransactionsToStatementPeriod(
      extractTransactions(lines, period),
      period
    );
    const kindCounts = transactions.reduce(
      (acc, transaction) => {
        acc[transaction.kind] = (acc[transaction.kind] ?? 0) + 1;
        return acc;
      },
      {}
    );
    const minimum = expectedMinimums.get(fileName) ?? 1;
    const status = transactions.length >= minimum ? "ok" : "needs attention";

    if (transactions.length < minimum) {
      failed = true;
    }

    console.log(
      JSON.stringify(
        {
          file: fileName,
          status,
          detectedAccount,
          statementPeriod: period,
          transactionCount: transactions.length,
          expectedMinimum: minimum,
          kindCounts
        },
        null,
        2
      )
    );
  }

  if (failed) {
    process.exitCode = 1;
  }
};

const extractLines = async (filePath) => {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const document = await pdfjs.getDocument({
    data,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true
  }).promise;
  const lines = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const groups = [];

    for (const rawItem of content.items) {
      if (!rawItem.str?.trim()) {
        continue;
      }

      const item = {
        page: pageNumber,
        text: rawItem.str.trim(),
        x: rawItem.transform[4],
        y: rawItem.transform[5]
      };
      const existing = groups.find((line) => Math.abs(line.y - item.y) <= 2.5);

      if (existing) {
        existing.items.push(item);
        existing.y = (existing.y + item.y) / 2;
      } else {
        groups.push({ items: [item], page: pageNumber, y: item.y });
      }
    }

    for (const group of groups) {
      const sorted = group.items.sort((a, b) => a.x - b.x);
      lines.push({
        page: pageNumber,
        text: mergeLineText(sorted),
        xMin: Math.min(...sorted.map((item) => item.x)),
        y: group.y
      });
    }
  }

  await document.destroy();
  return lines.sort((a, b) => (a.page === b.page ? b.y - a.y : a.page - b.page));
};

const mergeLineText = (items) => {
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

const extractTransactions = (lines, statementPeriod) =>
  lines
    .map((line) => parseFullTransactionLine(line, statementPeriod?.year ?? 2026))
    .filter(Boolean);

const parseFullTransactionLine = (line, fallbackYear) => {
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
    .replace(new RegExp(`\\s+\\d+(?:\\.\\d+)?%\\s+${moneyPatternSource}\\s*$`, "i"), "")
    .trim();
  const merchant = cleanMerchant(description);

  if (!merchant || isNoiseMerchant(merchant) || merchant.length < 2) {
    return null;
  }

  const normalizedAmount = amount < 0 && !isCreditLike(merchant) ? Math.abs(amount) : amount;
  const kind = inferTransactionKind(`${merchant} ${description}`, normalizedAmount);

  return {
    amount: normalizedAmount,
    date,
    kind,
    merchant
  };
};

const parseMoney = (value) => {
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

const inferTransactionKind = (descriptor, amount) => {
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

const isCreditLike = (descriptor) =>
  /payroll|deposit|refund|credit|reversal|cashback|zelle payment from|mobile payment - thank you|ach deposit|internet transfer from|account transfer/i.test(
    descriptor
  );

const cleanMerchant = (value) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\b(?:co id|id|indn|conf)#?:?.*$/i, "")
    .replace(/\s+(?:des|id|indn):.*$/i, "")
    .replace(/\s+\d{3,}.*$/g, "")
    .replace(/\s+(?:seattle|bellevue|redmond|cupertino|philadelphia|wa|ca|pa|usa)\b.*$/i, "")
    .replace(/\b\d{8,}\b/g, "")
    .trim();

const isNoiseMerchant = (merchant) =>
  /^(total|amount|new balance|minimum payment|payment due date|customer care|website|fees?)\b/i.test(
    merchant
  );

const parseDate = (value, fallbackYear = 2026) => {
  const trimmed = value.trim().replace(/\*$/, "");
  const isoLike = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const usLike = trimmed.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);

  if (isoLike) {
    return formatDateParts(Number(isoLike[1]), Number(isoLike[2]), Number(isoLike[3]));
  }

  if (usLike) {
    const year = usLike[3] ? normalizeYear(usLike[3]) : fallbackYear;
    return formatDateParts(year, Number(usLike[1]), Number(usLike[2]));
  }

  return null;
};

const formatDateParts = (year, month, day) => {
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
};

const detectStatementPeriod = (text) => {
  const normalized = text.replace(/\s+/g, " ");
  const monthRange = normalized.match(
    /\b(?:for|from)?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\s+(?:to|through|[-–—])\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i
  );

  if (monthRange) {
    return makePeriod(
      Number(monthRange[3]),
      monthNameToNumber(monthRange[1]),
      Number(monthRange[2]),
      Number(monthRange[6]),
      monthNameToNumber(monthRange[4]),
      Number(monthRange[5])
    );
  }

  const shortRange = normalized.match(
    /\b(?:opening\/closing date|closing date)\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*[-–—]\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i
  );

  if (shortRange) {
    return makePeriod(
      normalizeYear(shortRange[3]),
      Number(shortRange[1]),
      Number(shortRange[2]),
      normalizeYear(shortRange[6]),
      Number(shortRange[4]),
      Number(shortRange[5])
    );
  }

  const appleRange = normalized.match(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})\s*[-–—]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),\s*(\d{4})/i
  );

  if (appleRange) {
    const year = Number(appleRange[5]);
    return makePeriod(
      year,
      monthNameToNumber(appleRange[1]),
      Number(appleRange[2]),
      year,
      monthNameToNumber(appleRange[3]),
      Number(appleRange[4])
    );
  }

  const closingOnly = normalized.match(/\bclosing date\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);

  if (closingOnly) {
    const year = normalizeYear(closingOnly[3]);
    return makePeriod(
      Number(closingOnly[1]) === 1 ? year - 1 : year,
      Number(closingOnly[1]) === 1 ? 12 : Number(closingOnly[1]) - 1,
      1,
      year,
      Number(closingOnly[1]),
      Number(closingOnly[2])
    );
  }

  return null;
};

const makePeriod = (startYear, startMonth, startDay, endYear, endMonth, endDay) => {
  const start = formatDateParts(startYear, startMonth, startDay);
  const end = formatDateParts(endYear, endMonth, endDay);
  return start && end ? { end, start, year: endYear } : null;
};

const filterTransactionsToStatementPeriod = (transactions, statementPeriod) => {
  if (!statementPeriod) {
    return transactions;
  }

  return transactions.filter(
    (transaction) =>
      transaction.date >= statementPeriod.start && transaction.date <= statementPeriod.end
  );
};

const monthNameToNumber = (value) => {
  const normalized = value.slice(0, 3).toLowerCase();
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return months.indexOf(normalized) + 1;
};

const normalizeYear = (value) => {
  const year = Number(value);
  return year < 100 ? 2000 + year : year;
};

const detectStatementAccount = (text) => {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (/apple\s+card|goldman\s+sachs/i.test(normalized)) {
    return { accountType: "Credit card", institution: "Apple Card", name: "Apple Card" };
  }

  if (/bank\s+of\s+america/i.test(normalized)) {
    return {
      accountType: /adv plus banking|checking|personal deposit|banking/i.test(normalized)
        ? "Checking"
        : "Credit card",
      institution: "Bank of America",
      name: /adv plus banking|checking|personal deposit|banking/i.test(normalized)
        ? "Bank of America Checking"
        : "Bank of America Card"
    };
  }

  if (/american\s+express|\bamex\b/i.test(normalized)) {
    return { accountType: "Credit card", institution: "American Express", name: "Amex Card" };
  }

  if (/chase|jpmorgan/i.test(normalized)) {
    return { accountType: "Credit card", institution: "Chase", name: "Chase Card" };
  }

  return null;
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

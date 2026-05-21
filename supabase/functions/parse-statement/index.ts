type ParseStatementBody = {
  account: {
    id: string;
    name: string;
  };
  fileName: string;
  fileType: "pdf";
  knownDuplicateHashes?: string[];
  mimeType?: string;
  payload: string;
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

  const body = (await request.json()) as Partial<ParseStatementBody>;

  if (!body.fileName || body.fileType !== "pdf" || !body.payload || !body.account?.id) {
    return jsonResponse({ error: "Invalid PDF parse request" }, 400);
  }

  const workerUrl = Deno.env.get("PDF_OCR_WORKER_URL");
  const workerKey = Deno.env.get("PDF_OCR_WORKER_KEY");

  if (!workerUrl) {
    return jsonResponse({
      duplicates: [],
      failedRows: [
        {
          message:
            "PDF/OCR worker is not configured. Set PDF_OCR_WORKER_URL to enable text and scanned PDF extraction.",
          raw: body.fileName,
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
    });
  }

  const workerResponse = await fetch(workerUrl, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(workerKey ? { Authorization: `Bearer ${workerKey}` } : {})
    },
    method: "POST"
  });

  const workerResult = await workerResponse.json();
  return jsonResponse(workerResult, workerResponse.status);
});

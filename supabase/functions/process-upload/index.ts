import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type UploadedFile = {
  file_type: "pdf" | "csv" | "xlsx" | "xls" | "image" | "other";
  id: string;
  original_file_name: string;
  storage_path: string;
  user_id: string;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Origin": "*"
};

const json = (body: unknown, status = 200) =>
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey) {
    return json({ error: "Supabase function environment is not configured." }, 500);
  }

  if (!authorization) {
    return json({ error: "Missing Authorization header." }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization
      }
    }
  });

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return json({ error: "Invalid or expired user session." }, 401);
  }

  let uploadedFileId = "";

  try {
    const body = (await request.json()) as { uploaded_file_id?: string };
    uploadedFileId = body.uploaded_file_id ?? "";
  } catch {
    return json({ error: "Request body must be JSON." }, 400);
  }

  if (!uploadedFileId) {
    return json({ error: "uploaded_file_id is required." }, 400);
  }

  const { data: uploadedFile, error: fileError } = await supabase
    .from("uploaded_files")
    .select("id,user_id,file_type,original_file_name,storage_path")
    .eq("id", uploadedFileId)
    .single<UploadedFile>();

  if (fileError || !uploadedFile) {
    return json({ error: "Uploaded file was not found." }, 404);
  }

  if (uploadedFile.user_id !== user.id) {
    return json({ error: "You do not have access to this uploaded file." }, 403);
  }

  const { data: job, error: jobError } = await supabase
    .from("import_jobs")
    .insert({
      source_type: uploadedFile.file_type,
      started_at: new Date().toISOString(),
      status: "processing",
      uploaded_file_id: uploadedFile.id,
      user_id: user.id
    })
    .select()
    .single();

  if (jobError || !job) {
    return json({ error: jobError?.message ?? "Unable to create import job." }, 500);
  }

  const nextStatus = uploadedFile.file_type === "other" || uploadedFile.file_type === "image"
    ? "failed"
    : "completed";
  const errorMessage =
    nextStatus === "failed"
      ? "Unsupported statement type. Upload PDF, CSV, XLSX, or XLS files."
      : null;

  const { error: updateError } = await supabase
    .from("import_jobs")
    .update({
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
      parser_version: "process-upload-skeleton-v1",
      status: nextStatus,
      summary: {
        file_name: uploadedFile.original_file_name,
        file_type: uploadedFile.file_type,
        message:
          nextStatus === "completed"
            ? "Upload verified. Parser implementation will populate review rows in a later task."
            : errorMessage,
        storage_path: uploadedFile.storage_path
      }
    })
    .eq("id", job.id);

  if (updateError) {
    return json({ error: updateError.message }, 500);
  }

  return json({
    import_job_id: job.id,
    status: nextStatus,
    uploaded_file_id: uploadedFile.id
  });
});

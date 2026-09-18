import fs from "node:fs";
import path from "node:path";

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

const env = loadEnv(path.resolve(".env"));
if (!env) {
  console.log(JSON.stringify({ ok: false, reason: "no_env_file" }));
  process.exit(0);
}

const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const key = env.SUPABASE_SECRET_KEY ?? "";
if (!url || !key) {
  console.log(JSON.stringify({ ok: false, reason: "missing_env" }));
  process.exit(0);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
};

async function probe(label, restPath) {
  try {
    const response = await fetch(`${url}${restPath}`, { headers });
    const text = await response.text();
    return {
      label,
      status: response.status,
      applied: response.ok,
      blocked: response.status === 401 || response.status === 403,
      missing: response.status === 400 || response.status === 404,
      hint: response.ok ? null : text.slice(0, 160),
    };
  } catch (error) {
    return {
      label,
      applied: false,
      blocked: false,
      missing: false,
      error: error instanceof Error ? error.message : "request_failed",
    };
  }
}

const checks = await Promise.all([
  probe("0042_companies.suspended_at", "/rest/v1/companies?select=suspended_at&limit=0"),
  probe("0042_invites.token_hash", "/rest/v1/company_invites?select=token_hash&limit=0"),
  probe("0042_audit_items.exception_photo_path", "/rest/v1/audit_items?select=exception_photo_path&limit=0"),
  probe("0043_notification_logs.template_vars", "/rest/v1/notification_logs?select=template_vars&limit=0"),
  probe("0044_assets.criticality", "/rest/v1/assets?select=criticality&limit=0"),
  probe("0044_assets.deleted_at", "/rest/v1/assets?select=deleted_at&limit=0"),
  probe("0044_transfers.status", "/rest/v1/asset_transfers?select=status&limit=0"),
  probe("0044_plans.instructions", "/rest/v1/maintenance_plans?select=instructions&limit=0"),
  probe("0044_companies.contact_email", "/rest/v1/companies?select=contact_email&limit=0"),
]);

console.log(
  JSON.stringify(
    {
      ok: true,
      host: new URL(url).host,
      report: checks,
    },
    null,
    2,
  ),
);

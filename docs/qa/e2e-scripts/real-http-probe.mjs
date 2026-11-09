import fs from "node:fs";

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:3000/api/v1";
const output = [];

async function probe(method, path, body) {
  const request = { method, headers: { Accept: "application/json", "User-Agent": "HES-real-QA/1.0" } };
  if (body !== undefined) {
    request.headers["Content-Type"] = "application/json";
    request.body = JSON.stringify(body);
  }
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, request);
    const text = await response.text();
    const record = {
      request: `${method} ${baseUrl}${path}`,
      httpStatus: response.status,
      elapsedMs: Date.now() - started,
      responseExcerpt: text.slice(0, 500),
      headers: Object.fromEntries(response.headers.entries()),
    };
    output.push(record);
    console.log(JSON.stringify(record));
  } catch (error) {
    const record = {
      request: `${method} ${baseUrl}${path}`,
      httpStatus: 0,
      elapsedMs: Date.now() - started,
      responseExcerpt: "",
      error: String(error),
    };
    output.push(record);
    console.log(JSON.stringify(record));
  }
}

await probe("GET", "/health");
await probe("GET", "/auth/me");
await probe("POST", "/auth/login", {
  email: "not-a-real-user@example.invalid",
  password: "invalid",
});

const reportPath = process.env.PROBE_OUTPUT ?? "docs/qa/e2e-scripts/real-http-probe-results.json";
fs.writeFileSync(reportPath, `${JSON.stringify({ baseUrl, output }, null, 2)}\n`, "utf8");

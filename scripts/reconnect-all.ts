/**
 * Reads all saved auth states from Redis and triggers a reconnect for each
 * via the baileys-api HTTP endpoint, reusing the stored metadata (webhookUrl,
 * webhookVerifyToken, etc.) so no manual input is needed.
 *
 * Picks up env vars already set in the container — no manual config needed.
 * Run inside the baileys-api container:
 *
 *   bun scripts/reconnect-all.ts
 *
 * Optional overrides:
 *   BAILEYS_API_URL  — defaults to http://localhost:3025 (internal)
 *   API_KEY          — defaults to BAILEYS_PROVIDER_DEFAULT_API_KEY
 *   DELAY_MS         — ms between each reconnect call (default: 500)
 *   DRY_RUN=true     — print what would be called without actually calling
 */

import { createClient } from "redis";

const BAILEYS_API_URL = process.env.BAILEYS_API_URL ?? "http://localhost:3025";
const API_KEY =
  process.env.API_KEY ?? process.env.BAILEYS_PROVIDER_DEFAULT_API_KEY;
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const DELAY_MS = Number(process.env.DELAY_MS ?? 500);
const DRY_RUN = process.env.DRY_RUN === "true";

if (!API_KEY) {
  console.error(
    "Missing API key — set API_KEY or BAILEYS_PROVIDER_DEFAULT_API_KEY",
  );
  process.exit(1);
}

const redis = createClient({
  url: REDIS_URL,
  password: REDIS_PASSWORD || undefined,
});

await redis.connect();

const keys = await redis.keys("@baileys-api:connections:*:authState");
const phoneNumbers = keys
  .map((k) => k.split(":").at(-2) ?? "")
  .filter(Boolean)
  .sort();

console.log(`Found ${phoneNumbers.length} phone numbers in Redis:\n`);

type Metadata = {
  webhookUrl: string;
  webhookVerifyToken: string;
  clientName?: string;
  includeMedia?: boolean;
  syncFullHistory?: boolean;
};

const results = { connected: 0, qr: 0, failed: 0, noMetadata: 0 };

for (const phoneNumber of phoneNumbers) {
  const raw = await redis.hGet(
    `@baileys-api:connections:${phoneNumber}:authState`,
    "metadata",
  );

  if (!raw) {
    console.log(`  [sem metadata] ${phoneNumber} — pulando`);
    results.noMetadata++;
    continue;
  }

  let metadata: Metadata;
  try {
    metadata = JSON.parse(raw) as Metadata;
  } catch {
    console.log(`  [metadata inválida] ${phoneNumber} — pulando`);
    results.noMetadata++;
    continue;
  }

  if (!metadata.webhookUrl || !metadata.webhookVerifyToken) {
    console.log(`  [metadata incompleta] ${phoneNumber} — pulando`);
    results.noMetadata++;
    continue;
  }

  if (DRY_RUN) {
    console.log(`  [dry-run] ${phoneNumber} → ${metadata.webhookUrl}`);
    continue;
  }

  try {
    const res = await fetch(
      `${BAILEYS_API_URL}/connections/${encodeURIComponent(phoneNumber)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({
          webhookUrl: metadata.webhookUrl,
          webhookVerifyToken: metadata.webhookVerifyToken,
          clientName: metadata.clientName,
          includeMedia: metadata.includeMedia,
          syncFullHistory: false,
        }),
      },
    );

    if (res.ok) {
      console.log(`  [ok] ${phoneNumber}`);
      results.connected++;
    } else {
      const body = await res.text();
      console.log(`  [erro ${res.status}] ${phoneNumber} — ${body}`);
      results.failed++;
    }
  } catch (err) {
    console.log(`  [falha de rede] ${phoneNumber} — ${err}`);
    results.failed++;
  }

  if (DELAY_MS > 0) {
    await Bun.sleep(DELAY_MS);
  }
}

await redis.disconnect();

console.log(`
Resumo:
  Reconectados/tentados: ${results.connected}
  Sem metadata:          ${results.noMetadata}
  Falhas:                ${results.failed}

Contas sem metadata no Redis perderam a sessão (auth state apagado pelo bug antigo).
Essas precisam ser reconectadas manualmente via QR scan.
`);

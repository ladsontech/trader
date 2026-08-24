import * as logger from "firebase-functions/logger";
import * as crypto from "crypto";

export type JsonRecord = Record<string, unknown>;

/* ── Ids ──────────────────────────────────────────────────────── */
export function generateReference(): string {
  return crypto.randomUUID();
}

/* ── Phone ────────────────────────────────────────────────────── */
export function formatPhone(phone: string, country: "UG" | "KE" = "UG"): string {
  let cleaned = phone.replace(/\s+/g, "").replace(/-/g, "");
  const isKenya = country === "KE" || cleaned.startsWith("+254") || cleaned.startsWith("254");

  if (isKenya) {
    if (cleaned.startsWith("0")) cleaned = "+254" + cleaned.substring(1);
    if (cleaned.startsWith("254") && !cleaned.startsWith("+")) cleaned = "+" + cleaned;
    if (!cleaned.startsWith("+")) cleaned = "+254" + cleaned;
    return cleaned;
  }

  if (cleaned.startsWith("0")) cleaned = "+256" + cleaned.substring(1);
  if (cleaned.startsWith("256") && !cleaned.startsWith("+")) cleaned = "+" + cleaned;
  if (!cleaned.startsWith("+")) cleaned = "+256" + cleaned;
  return cleaned;
}

export function normalizePhone(value: string, country: "UG" | "KE" = "UG"): string {
  const digits = value.replace(/\D/g, "");
  const isKenya = country === "KE" || digits.startsWith("254");

  if (isKenya) {
    if (digits.startsWith("254") && digits.length === 12) return `0${digits.slice(3)}`;
    if (digits.length === 9 && (digits.startsWith("7") || digits.startsWith("1"))) return `0${digits}`;
    return digits;
  }

  if (digits.startsWith("256") && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.length === 9 && digits.startsWith("7")) return `0${digits}`;
  return digits;
}

export function normalizeUgandanPhone(value: string): string {
  return normalizePhone(value, "UG");
}

export function isValidPhone(value: string, country: "UG" | "KE" = "UG"): boolean {
  const normalized = normalizePhone(value, country);
  if (country === "KE" || value.startsWith("+254") || value.replace(/\D/g, "").startsWith("254")) {
    return /^0(7|1)\d{8}$/.test(normalized);
  }
  return /^0(7|3)\d{8}$/.test(normalized);
}

export function isValidUgandanPhone(value: string): boolean {
  return isValidPhone(value, "UG");
}

/* ── Safe logging (never leak provider payloads / credentials) ── */
export function sanitizeText(value: unknown, maxLength = 240): string {
  const raw =
    typeof value === "string"
      ? value
      : value === null || value === undefined
        ? ""
        : String(value);
  return raw.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

const SENSITIVE_KEY = /(pass|secret|token|key|pin|auth|credential)/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[deep]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeText(value, 160);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 10).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: JsonRecord = {};
    for (const [k, v] of Object.entries(value as JsonRecord)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return "[unknown]";
}

export function logInfo(message: string, context: JsonRecord = {}): void {
  logger.info(message, redact(context) as JsonRecord);
}

export function logError(message: string, error?: unknown, context: JsonRecord = {}): void {
  const payload: JsonRecord = { ...(redact(context) as JsonRecord) };
  if (error instanceof Error) {
    payload.errorName = error.name;
    payload.errorMessage = sanitizeText(error.message);
  } else if (error !== undefined) {
    payload.error = redact(error);
  }
  logger.error(message, payload);
}

/* ── Provider payload parsing (ported from the Investio gateway) ─ */
const SUCCESS_STATUSES = new Set([
  "success", "successful", "succeeded", "completed", "complete",
  "confirmed", "approved", "paid", "processed", "done",
]);

const FAILURE_STATUSES = new Set([
  "failed", "failure", "declined", "denied", "cancelled", "canceled",
  "expired", "rejected", "reversed", "error", "errored", "timeout",
  "timed.out", "insufficient.funds",
]);

const REFERENCE_KEYS = [
  "reference", "transaction_reference", "transactionReference",
  "merchant_reference", "merchantReference", "external_reference",
  "externalReference", "request_reference", "requestReference",
  "payment_reference", "paymentReference", "client_reference",
  "clientReference", "order_reference", "orderReference",
  "tx_ref", "txRef", "uuid", "id",
];

const STATUS_KEYS = [
  "status", "transaction_status", "transactionStatus",
  "payment_status", "paymentStatus", "state",
];

const EVENT_KEYS = ["event_type", "eventType", "event", "type", "name"];
const FAILURE_REASON_KEYS = ["failureReason", "failure_reason", "reason", "message", "error"];
const NESTED_RECORD_KEYS = [
  "transaction", "data", "payload", "payment", "collection",
  "result", "event", "resource", "details", "meta",
];

function asRecord(value: unknown): JsonRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord;
  return null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export function normalizeToken(value: unknown): string {
  return (asString(value) || "").trim().toLowerCase().replace(/[\s_-]+/g, ".");
}

function collectRecords(value: unknown): JsonRecord[] {
  const root = asRecord(value);
  if (!root) return [];
  const output: JsonRecord[] = [];
  const queue: Array<{ record: JsonRecord; depth: number }> = [{ record: root, depth: 0 }];
  const seen = new Set<JsonRecord>();

  while (queue.length) {
    const current = queue.shift()!;
    if (seen.has(current.record)) continue;
    seen.add(current.record);
    output.push(current.record);
    if (current.depth >= 4) continue;
    for (const key of NESTED_RECORD_KEYS) {
      const child = asRecord(current.record[key]);
      if (child) queue.push({ record: child, depth: current.depth + 1 });
    }
  }
  return output;
}

function pickFirstString(records: JsonRecord[], keys: string[]): string | undefined {
  for (const record of records) {
    for (const key of keys) {
      const value = asString(record[key]);
      if (value) return value;
    }
  }
  return undefined;
}

export function extractProviderIds(value: unknown): string[] {
  const ids = new Set<string>();
  for (const record of collectRecords(value)) {
    for (const key of REFERENCE_KEYS) {
      const id = asString(record[key]);
      if (id) ids.add(id);
    }
  }
  return Array.from(ids);
}

export function extractWebhookFields(body: unknown): {
  reference?: string;
  providerStatus?: string;
  eventType?: string;
  failureReason?: string;
} {
  const records = collectRecords(body);
  return {
    reference: pickFirstString(records, REFERENCE_KEYS),
    providerStatus: pickFirstString(records, STATUS_KEYS),
    eventType: pickFirstString(records, EVENT_KEYS),
    failureReason: pickFirstString(records, FAILURE_REASON_KEYS),
  };
}

export function isSuccessStatus(providerStatus?: string, eventType?: string): boolean {
  const status = normalizeToken(providerStatus);
  const event = normalizeToken(eventType);
  return (
    SUCCESS_STATUSES.has(status) ||
    SUCCESS_STATUSES.has(event) ||
    [".success", ".successful", ".succeeded", ".completed", ".confirmed", ".approved", ".paid"]
      .some((suffix) => event.endsWith(suffix))
  );
}

export function isFailureStatus(providerStatus?: string, eventType?: string): boolean {
  const status = normalizeToken(providerStatus);
  const event = normalizeToken(eventType);
  return (
    FAILURE_STATUSES.has(status) ||
    FAILURE_STATUSES.has(event) ||
    [".failed", ".failure", ".declined", ".cancelled", ".canceled", ".expired", ".rejected", ".reversed"]
      .some((suffix) => event.endsWith(suffix))
  );
}

export function providerErrorMessage(result: unknown, fallback: string): string {
  for (const record of collectRecords(result)) {
    const message = asString(record.message) || asString(record.error);
    if (message) return sanitizeText(message);
  }
  return fallback;
}

export function providerSnapshot(value: unknown): JsonRecord {
  const fields = extractWebhookFields(value);
  const ids = extractProviderIds(value).slice(0, 10);
  const snapshot: JsonRecord = {};
  if (ids.length) snapshot.providerIds = ids;
  if (fields.providerStatus) snapshot.providerStatus = sanitizeText(fields.providerStatus, 80);
  if (fields.eventType) snapshot.providerEventType = sanitizeText(fields.eventType, 80);
  if (fields.failureReason) snapshot.providerFailureReason = sanitizeText(fields.failureReason);
  return snapshot;
}

/* ── Misc ─────────────────────────────────────────────────────── */
export function timestampToMillis(value: unknown): number {
  if (!value) return 0;
  const anyValue = value as { toMillis?: () => number };
  if (typeof anyValue.toMillis === "function") return anyValue.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { pantaFetch } from "@/lib/api";
import type { MarketImageUploadResponse } from "@/lib/types";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export function validateMarketImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type) && !/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
    return "Use a PNG, JPEG, WebP, or GIF image";
  }
  if (file.size <= 0) return "Image file is empty";
  if (file.size > MAX_BYTES) return "Image must be 5MB or smaller";
  return null;
}

/** Step 1–2: get signed fields from Panta, then POST the file to Cloudinary. */
export async function uploadMarketImage(opts: {
  apiKey: string;
  file: File;
}): Promise<{ secureUrl: string; upload: MarketImageUploadResponse }> {
  const validation = validateMarketImageFile(opts.file);
  if (validation) throw new Error(validation);

  const { data: upload } = await pantaFetch<MarketImageUploadResponse>(
    "/markets/create/image-upload/",
    { method: "POST", apiKey: opts.apiKey, body: {} },
  );

  if (!upload.uploadUrl || !upload.fields) {
    throw new Error("image-upload response missing uploadUrl/fields");
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(upload.fields)) {
    if (value === undefined || value === null) continue;
    form.append(key, String(value));
  }
  form.append("file", opts.file);

  const res = await fetch(upload.uploadUrl, { method: "POST", body: form });
  const text = await res.text();
  let parsed: { secure_url?: string; error?: { message?: string }; message?: string } =
    {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const msg =
      parsed.error?.message ||
      parsed.message ||
      text.slice(0, 200) ||
      `Cloudinary upload failed (${res.status})`;
    throw new Error(msg);
  }
  const secureUrl = parsed.secure_url?.trim();
  if (!secureUrl) {
    throw new Error("Cloudinary upload returned no secure_url");
  }
  return { secureUrl, upload };
}

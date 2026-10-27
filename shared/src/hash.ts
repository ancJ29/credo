/** SHA-256 of a request body as lowercase hex, the value of `x-amz-content-sha256`. WebCrypto,
 * so the browser and Node run the same function. A string is hashed as its UTF-8 bytes. */
export async function sha256Hex(body: string | Uint8Array<ArrayBuffer>) {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

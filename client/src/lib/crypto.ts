/**
 * End-to-end encryption of secrets, entirely in the browser (Web Crypto API).
 *
 * - A random 256-bit key is generated for each secret. It is placed in the URL fragment
 *   (`#...`), which browsers never send to the server.
 * - If a password is set, it is stretched with PBKDF2 (salted with the fragment key) and
 *   mixed into the key derivation: the link alone is then not enough to decrypt.
 * - The AES-256-GCM encryption key and the password verifier sent to the server are both
 *   derived with HKDF from (fragment key || stretched password). The server therefore never
 *   learns anything usable about the content or the password.
 */

const VERSION = 'v1';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const PBKDF2_ITERATIONS = 600_000;
const encoder = new TextEncoder();

function subtle(): SubtleCrypto {
	if (!globalThis.crypto?.subtle) {
		throw new Error('Encryption requires a secure context (HTTPS or localhost).');
	}
	return crypto.subtle;
}

export function toBase64Url(bytes: Uint8Array): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
	const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
	const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generates a new random secret key, base64url-encoded (to be put in the URL fragment). */
export function generateKey(): string {
	return toBase64Url(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));
}

/** Decodes and validates a fragment key. Returns null if it is malformed. */
export function parseKey(value: string): Uint8Array<ArrayBuffer> | null {
	try {
		const bytes = fromBase64Url(value);
		return bytes.length === KEY_BYTES ? bytes : null;
	} catch {
		return null;
	}
}

export interface DerivedKeys {
	encryptionKey: CryptoKey;
	/** Hex-encoded password verifier (64 chars), only when a password is set. */
	verifier?: string;
}

/** Derives the encryption key (and the password verifier, if any). Slow when a password is set. */
export async function deriveKeys(key: Uint8Array<ArrayBuffer>, password?: string): Promise<DerivedKeys> {
	const s = subtle();

	let ikm: Uint8Array<ArrayBuffer> = key;
	if (password) {
		const pwKey = await s.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
			'deriveBits'
		]);
		const stretched = new Uint8Array(
			await s.deriveBits(
				{ name: 'PBKDF2', hash: 'SHA-256', salt: key, iterations: PBKDF2_ITERATIONS },
				pwKey,
				256
			)
		);
		ikm = new Uint8Array(key.length + stretched.length);
		ikm.set(key);
		ikm.set(stretched, key.length);
	}

	const master = await s.importKey('raw', ikm, 'HKDF', false, ['deriveKey', 'deriveBits']);
	const hkdf = (info: string) => ({
		name: 'HKDF',
		hash: 'SHA-256',
		salt: new Uint8Array(0),
		info: encoder.encode(`sharesecret/${VERSION}/${info}`)
	});

	const encryptionKey = await s.deriveKey(
		hkdf('encryption'),
		master,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);

	let verifier: string | undefined;
	if (password) {
		verifier = toHex(new Uint8Array(await s.deriveBits(hkdf('auth'), master, 256)));
	}

	return { encryptionKey, verifier };
}

export interface EncryptedSecret {
	/** Opaque payload stored by the server: `v1.<base64url(iv || ciphertext)>`. */
	payload: string;
	/** Fragment key, base64url-encoded. */
	key: string;
	verifier?: string;
}

export async function encryptSecret(content: string, password?: string): Promise<EncryptedSecret> {
	const key = generateKey();
	const { encryptionKey, verifier } = await deriveKeys(parseKey(key)!, password);

	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const ciphertext = new Uint8Array(
		await subtle().encrypt({ name: 'AES-GCM', iv }, encryptionKey, encoder.encode(content))
	);

	const blob = new Uint8Array(iv.length + ciphertext.length);
	blob.set(iv);
	blob.set(ciphertext, iv.length);

	return { payload: `${VERSION}.${toBase64Url(blob)}`, key, verifier };
}

/** Thrown when the payload cannot be decrypted (wrong key/password, or corrupted data). */
export class DecryptionError extends Error {}

export async function decryptSecret(payload: string, encryptionKey: CryptoKey): Promise<string> {
	const [version, data] = payload.split('.', 2);
	if (version !== VERSION || !data) throw new DecryptionError('Unsupported secret format.');

	const blob = fromBase64Url(data);
	try {
		const plain = await subtle().decrypt(
			{ name: 'AES-GCM', iv: blob.subarray(0, IV_BYTES) },
			encryptionKey,
			blob.subarray(IV_BYTES)
		);
		return new TextDecoder().decode(plain);
	} catch {
		throw new DecryptionError('Unable to decrypt the secret: the link is probably corrupted.');
	}
}

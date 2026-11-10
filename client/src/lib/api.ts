import { decryptSecret, deriveKeys, encryptSecret } from './crypto';

export interface CreatedSecret {
	/** Server-side identifier. */
	hash: string;
	/** Decryption key, to be put in the URL fragment (never sent to the server). */
	key: string;
}

/**
 * Encrypts the secret in the browser, then stores the ciphertext server-side.
 * The server never sees the content, the key, or the password.
 */
export async function createSecret(content: string, password?: string): Promise<CreatedSecret> {
	const { payload, key, verifier } = await encryptSecret(content, password || undefined);

	const body: { content: string; password?: string } = { content: payload };
	if (verifier) body.password = verifier;

	const res = await fetch('/api/secret', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!res.ok) {
		throw new Error(`The server refused to create the secret (HTTP ${res.status}).`);
	}

	const data: { hash?: string } = await res.json();
	if (!data.hash) throw new Error('Invalid server response.');
	return { hash: data.hash, key };
}

/** Tells whether the secret requires a password. */
export async function isProtected(hash: string): Promise<boolean> {
	const res = await fetch(`/api/is-protected?hash=${encodeURIComponent(hash)}`);
	if (!res.ok) {
		throw new Error(`Unable to check the secret (HTTP ${res.status}).`);
	}
	const data: { protected?: boolean } = await res.json();
	return data.protected === true;
}

/** Thrown when the secret does not exist, has already been read, or the password is wrong. */
export class SecretNotFoundError extends Error {}

/**
 * Reads and decrypts a secret. Warning: reading it destroys it server-side.
 * `key` is the decoded URL fragment key.
 */
export async function readSecret(
	hash: string,
	key: Uint8Array<ArrayBuffer>,
	password?: string
): Promise<string> {
	const { encryptionKey, verifier } = await deriveKeys(key, password || undefined);

	// POST so that the password verifier never ends up in a URL (proxy logs, history…).
	const res = await fetch('/api/secret/read', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ hash, password: verifier })
	});
	if (res.status === 404) throw new SecretNotFoundError('Secret not found.');
	if (!res.ok) {
		throw new Error(`Unable to read the secret (HTTP ${res.status}).`);
	}

	const data: { content?: string } = await res.json();
	if (typeof data.content !== 'string') throw new Error('Invalid server response.');
	return decryptSecret(data.content, encryptionKey);
}

/** Share link for a secret. The key lives in the fragment, which browsers never send. */
export function secretUrl({ hash, key }: CreatedSecret, origin = location.origin): string {
	return `${origin}/secrets?hash=${encodeURIComponent(hash)}#${key}`;
}

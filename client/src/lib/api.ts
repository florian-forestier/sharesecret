/** SHA-256 hash of a string, hex-encoded (64 characters). */
export async function sha256Hex(value: string): Promise<string> {
	if (!globalThis.crypto?.subtle) {
		throw new Error(
			'Password hashing requires a secure context (HTTPS or localhost).'
		);
	}
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates a secret server-side and returns its identifier (hash).
 * The optional password is SHA-256 hashed before being sent: it never travels in clear text.
 */
export async function createSecret(content: string, password?: string): Promise<string> {
	const body: { content: string; password?: string } = { content };
	if (password) body.password = await sha256Hex(password);

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
	return data.hash;
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
 * Reads a secret. Warning: reading it destroys it server-side.
 * The optional password is SHA-256 hashed before being sent.
 */
export async function readSecret(hash: string, password?: string): Promise<string> {
	const params = new URLSearchParams({ hash });
	if (password) params.set('password', await sha256Hex(password));

	const res = await fetch(`/api/secret?${params}`);
	if (res.status === 404) throw new SecretNotFoundError('Secret not found.');
	if (!res.ok) {
		throw new Error(`Unable to read the secret (HTTP ${res.status}).`);
	}

	const data: { content?: string } = await res.json();
	if (typeof data.content !== 'string') throw new Error('Invalid server response.');
	return data.content;
}

/** Share link for a secret. */
export function secretUrl(hash: string, origin = location.origin): string {
	return `${origin}/secrets?hash=${encodeURIComponent(hash)}`;
}

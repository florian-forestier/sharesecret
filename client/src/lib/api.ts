/** Hash SHA-256 d'une chaîne, encodé en hexadécimal (64 caractères). */
export async function sha256Hex(value: string): Promise<string> {
	if (!globalThis.crypto?.subtle) {
		throw new Error(
			'Le hachage du mot de passe nécessite un contexte sécurisé (HTTPS ou localhost).'
		);
	}
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Crée un secret côté serveur et renvoie son identifiant (hash).
 * Le mot de passe éventuel est haché en SHA-256 avant envoi : il ne transite jamais en clair.
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
		throw new Error(`Le serveur a refusé la création du secret (HTTP ${res.status}).`);
	}

	const data: { hash?: string } = await res.json();
	if (!data.hash) throw new Error('Réponse du serveur invalide.');
	return data.hash;
}

/** Indique si le secret demande un mot de passe. */
export async function isProtected(hash: string): Promise<boolean> {
	const res = await fetch(`/api/is-protected?hash=${encodeURIComponent(hash)}`);
	if (!res.ok) {
		throw new Error(`Impossible de vérifier le secret (HTTP ${res.status}).`);
	}
	const data: { protected?: boolean } = await res.json();
	return data.protected === true;
}

/** Erreur levée quand le secret n'existe pas, a déjà été lu ou que le mot de passe est faux. */
export class SecretNotFoundError extends Error {}

/**
 * Lit un secret. Attention : la lecture le détruit côté serveur.
 * Le mot de passe éventuel est haché en SHA-256 avant envoi.
 */
export async function readSecret(hash: string, password?: string): Promise<string> {
	const params = new URLSearchParams({ hash });
	if (password) params.set('password', await sha256Hex(password));

	const res = await fetch(`/api/secret?${params}`);
	if (res.status === 404) throw new SecretNotFoundError('Secret introuvable.');
	if (!res.ok) {
		throw new Error(`Impossible de lire le secret (HTTP ${res.status}).`);
	}

	const data: { content?: string } = await res.json();
	if (typeof data.content !== 'string') throw new Error('Réponse du serveur invalide.');
	return data.content;
}

/** Lien de partage d'un secret. */
export function secretUrl(hash: string, origin = location.origin): string {
	return `${origin}/secrets?hash=${encodeURIComponent(hash)}`;
}

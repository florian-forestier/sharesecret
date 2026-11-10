<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { isProtected, readSecret, SecretNotFoundError } from '#lib';

	type Status =
		| 'checking' // appel à /api/is-protected en cours
		| 'ready' // prêt à révéler (avec ou sans mot de passe)
		| 'revealing' // appel à /api/secret en cours
		| 'revealed'
		| 'gone' // inexistant ou déjà lu
		| 'error';

	// La page est pré-rendue : le paramètre `hash` n'est lisible que côté navigateur.
	let hash = '';

	let status = $state<Status>('checking');
	let needsPassword = $state(false);
	let password = $state('');
	let showPassword = $state(false);
	let passwordError = $state<string | null>(null);
	let error = $state<string | null>(null);
	let secret = $state('');
	let copied = $state(false);

	onMount(async () => {
		hash = page.url.searchParams.get('hash') ?? '';
		if (!hash) {
			status = 'gone';
			return;
		}
		try {
			needsPassword = await isProtected(hash);
			status = 'ready';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Une erreur inattendue est survenue.';
			status = 'error';
		}
	});

	async function reveal(event: SubmitEvent) {
		event.preventDefault();
		if (status !== 'ready' || (needsPassword && !password)) return;

		status = 'revealing';
		passwordError = null;
		try {
			secret = await readSecret(hash, needsPassword ? password : undefined);
			password = '';
			status = 'revealed';
		} catch (e) {
			if (e instanceof SecretNotFoundError) {
				if (needsPassword) {
					// Le serveur répond 404 aussi pour un mauvais mot de passe.
					passwordError = 'Mot de passe incorrect, ou le secret a déjà été lu.';
					status = 'ready';
				} else {
					status = 'gone';
				}
			} else {
				error = e instanceof Error ? e.message : 'Une erreur inattendue est survenue.';
				status = 'error';
			}
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(secret);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			error = 'Impossible de copier automatiquement, sélectionnez le texte manuellement.';
		}
	}
</script>

<svelte:head>
	<title>Secret partagé · Zecrets</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="container py-5">
	<div class="row justify-content-center">
		<div class="col-12 col-lg-8">
			<h1 class="mb-2">Secret partagé</h1>
			<p class="lead mb-4">Ce secret ne peut être lu qu'une seule fois.</p>

			{#if status === 'checking'}
				<div class="d-flex align-items-center gap-2 text-muted">
					<span class="spinner spinner-sm" aria-hidden="true"></span>
					Vérification du secret…
				</div>
			{:else if status === 'gone'}
				<div class="alert alert-warning" role="alert">
					<h2 class="alert-heading h5">Secret introuvable</h2>
					<p class="mb-0">Ce lien est invalide, ou le secret a déjà été lu et détruit.</p>
				</div>
				<a class="btn btn-primary" href="/">Créer un nouveau secret</a>
			{:else if status === 'error'}
				<div class="alert alert-danger" role="alert">{error}</div>
				<button class="btn btn-secondary" type="button" onclick={() => location.reload()}>
					Réessayer
				</button>
			{:else if status === 'revealed'}
				<div class="card card-glow">
					<div class="card-body">
						<label class="form-label" for="secret">Contenu</label>
						<textarea
							id="secret"
							class="form-control form-control-mono mb-3"
							rows="6"
							readonly
							value={secret}
						></textarea>
						{#if error}
							<div class="alert alert-danger" role="alert">{error}</div>
						{/if}
						<div class="d-flex flex-wrap gap-2">
							<button class="btn btn-primary" type="button" onclick={copy}>
								{copied ? 'Copié !' : 'Copier'}
							</button>
							<a class="btn btn-outline-secondary" href="/">Créer un nouveau secret</a>
						</div>
					</div>
					<div class="card-footer text-muted small">
						Le secret a été détruit sur le serveur : copiez-le avant de quitter la page.
					</div>
				</div>
			{:else}
				<form class="card card-accent" onsubmit={reveal}>
					<div class="card-body">
						{#if needsPassword}
							<div class="mb-3">
								<label class="form-label" for="password">Mot de passe</label>
								<div class="input-group">
									<input
										id="password"
										class="form-control"
										class:is-invalid={passwordError}
										type={showPassword ? 'text' : 'password'}
										autocomplete="off"
										bind:value={password}
										disabled={status === 'revealing'}
										required
									/>
									<button
										class="btn btn-secondary"
										type="button"
										onclick={() => (showPassword = !showPassword)}
									>
										{showPassword ? 'Masquer' : 'Afficher'}
									</button>
								</div>
								{#if passwordError}
									<div class="invalid-feedback">{passwordError}</div>
								{:else}
									<div class="form-text">Ce secret est protégé par un mot de passe.</div>
								{/if}
							</div>
						{:else}
							<p>
								En affichant ce secret, il sera <strong>définitivement supprimé</strong> du serveur.
							</p>
						{/if}

						<button
							class="btn btn-primary btn-lg w-100"
							type="submit"
							disabled={status === 'revealing' || (needsPassword && !password)}
						>
							{#if status === 'revealing'}
								<span class="spinner spinner-sm" aria-hidden="true"></span>
								Déchiffrement…
							{:else}
								Révéler le secret
							{/if}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</main>

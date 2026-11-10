<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { isProtected, readSecret, SecretNotFoundError } from '#lib';

	type Status =
		| 'checking' // /api/is-protected call in progress
		| 'ready' // ready to reveal (with or without password)
		| 'revealing' // /api/secret call in progress
		| 'revealed'
		| 'gone' // does not exist or already read
		| 'error';

	// The page is prerendered: the `hash` parameter is only readable in the browser.
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
			error = e instanceof Error ? e.message : 'An unexpected error occurred.';
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
					// The server also responds 404 for a wrong password.
					passwordError = 'Incorrect password, or the secret has already been read.';
					status = 'ready';
				} else {
					status = 'gone';
				}
			} else {
				error = e instanceof Error ? e.message : 'An unexpected error occurred.';
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
			error = 'Unable to copy automatically, please select the text manually.';
		}
	}
</script>

<svelte:head>
	<title>Shared secret · ShareSecrets</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="container py-5">
	<div class="row justify-content-center">
		<div class="col-12 col-lg-8">
			<h1 class="mb-2">Shared secret</h1>
			<p class="lead mb-4">This secret will be destroyed after you see it.</p>

			{#if status === 'checking'}
				<div class="d-flex align-items-center gap-2 text-muted">
					<span class="spinner spinner-sm" aria-hidden="true"></span>
					Validating…
				</div>
			{:else if status === 'gone'}
				<div class="alert alert-warning" role="alert">
					<h2 class="alert-heading h5">Not found</h2>
					<p class="mb-0">This link is invalid, or the secret has already been read and destroyed.</p>
				</div>
				<a class="btn btn-primary" href="/">Create a new secret</a>
			{:else if status === 'error'}
				<div class="alert alert-danger" role="alert">{error}</div>
				<button class="btn btn-secondary" type="button" onclick={() => location.reload()}>
					Retry
				</button>
			{:else if status === 'revealed'}
				<div class="card card-glow">
					<div class="card-body">
						<label class="form-label" for="secret">Content</label>
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
								{copied ? 'Copied!' : 'Copy'}
							</button>
							<a class="btn btn-outline-secondary" href="/">Create a new secret</a>
						</div>
					</div>
					<div class="card-footer text-muted small">
						The secret is no longer stored server-side; copy it before leaving the page.
					</div>
				</div>
			{:else}
				<form class="card card-accent" onsubmit={reveal}>
					<div class="card-body">
						{#if needsPassword}
							<div class="mb-3">
								<label class="form-label" for="password">Password</label>
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
										{showPassword ? 'Hide' : 'Show'}
									</button>
								</div>
								{#if passwordError}
									<div class="invalid-feedback">{passwordError}</div>
								{:else}
									<div class="form-text">This secret is password-protected.</div>
								{/if}
							</div>
						{:else}
							<p>
								Once displayed, this secret will be <strong>permanently deleted</strong> from the server.
							</p>
						{/if}

						<button
							class="btn btn-primary btn-lg w-100"
							type="submit"
							disabled={status === 'revealing' || (needsPassword && !password)}
						>
							{#if status === 'revealing'}
								<span class="spinner spinner-sm" aria-hidden="true"></span>
								Decrypting…
							{:else}
								Reveal
							{/if}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</main>

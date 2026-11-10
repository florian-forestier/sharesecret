<script lang="ts">
	import { createSecret, secretUrl } from '#lib';

	let content = $state('');
	let usePassword = $state(false);
	let password = $state('');
	let showPassword = $state(false);

	let loading = $state(false);
	let error = $state<string | null>(null);
	let link = $state<string | null>(null);
	let copied = $state(false);

	const canSubmit = $derived(
		!loading && content.trim().length > 0 && (!usePassword || password.length > 0)
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) return;

		loading = true;
		error = null;
		try {
			const hash = await createSecret(content, usePassword ? password : undefined);
			link = secretUrl(hash);
		} catch (e) {
			error = e instanceof Error ? e.message : 'An unexpected error occurred.';
		} finally {
			loading = false;
		}
	}

	async function copy() {
		if (!link) return;
		try {
			await navigator.clipboard.writeText(link);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			error = 'Unable to copy automatically, please select the link manually.';
		}
	}

	function reset() {
		content = '';
		password = '';
		usePassword = false;
		showPassword = false;
		link = null;
		error = null;
		copied = false;
	}
</script>

<main class="container py-5">
	<div class="row justify-content-center">
		<div class="col-12 col-lg-8">
			<h1 class="mb-2">Share a secret</h1>
			<p class="lead mb-4">
				The secret is encrypted server-side and destroyed as soon as it is read.
			</p>

			{#if error}
				<div class="alert alert-danger" role="alert">{error}</div>
			{/if}

			{#if link}
				<div class="card card-glow">
					<div class="card-body">
						<h2 class="card-title">Link to your secret</h2>
						<p class="text-muted">
							This link will only work once.
							{#if usePassword}Share the password through a different channel.{/if}
						</p>
						<div class="input-group mb-3">
							<input
								class="form-control form-control-mono"
								type="text"
								readonly
								value={link}
								aria-label="Link to the secret"
								onfocus={(e) => e.currentTarget.select()}
							/>
							<button class="btn btn-primary" type="button" onclick={copy}>
								{copied ? 'Copied!' : 'Copy'}
							</button>
						</div>
						<button class="btn btn-outline-secondary" type="button" onclick={reset}>
							Create another secret
						</button>
					</div>
				</div>
			{:else}
				<form class="card card-accent" onsubmit={submit}>
					<div class="card-body">
						<div class="mb-3">
							<label class="form-label" for="content">Secret</label>
							<textarea
								id="content"
								class="form-control form-control-mono"
								rows="6"
								placeholder="Password, token, API key…"
								bind:value={content}
								disabled={loading}
								required
							></textarea>
						</div>

						<div class="form-check form-switch mb-3">
							<input
								id="use-password"
								class="form-check-input"
								type="checkbox"
								role="switch"
								bind:checked={usePassword}
								disabled={loading}
							/>
							<label for="use-password">Protect with a password</label>
						</div>

						{#if usePassword}
							<div class="mb-3">
								<label class="form-label" for="password">Password</label>
								<div class="input-group">
									<input
										id="password"
										class="form-control"
										type={showPassword ? 'text' : 'password'}
										autocomplete="new-password"
										bind:value={password}
										disabled={loading}
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
								<div class="form-text">
									Password is hashed before being sent to the server.
								</div>
							</div>
						{/if}

						<button class="btn btn-primary btn-lg w-100" type="submit" disabled={!canSubmit}>
							{#if loading}
								<span class="spinner spinner-sm" aria-hidden="true"></span>
								Creating…
							{:else}
								Generate a link
							{/if}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
</main>

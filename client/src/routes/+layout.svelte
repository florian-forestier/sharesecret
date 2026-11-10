<script lang="ts">
	import '#lib/styles/theme.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="d-flex flex-column min-vh-100">
	<div class="flex-grow-1">
		{@render children()}
	</div>

	<footer class="border-top py-3">
		<div class="container text-center text-muted small">
			No personal data is collected.
			<a href="https://github.com/florian-forestier/sharesecret" target="_blank" rel="noopener noreferrer">
				Source code
			</a>
		</div>
	</footer>
</div>

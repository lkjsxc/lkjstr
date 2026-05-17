<script lang="ts">
  import { appMetadata } from '$lib/app/metadata';
</script>

<header class="app-header" aria-label="Application header">
  <strong>{appMetadata.name}</strong>
  <span>{appMetadata.buildLabel}</span>
</header>

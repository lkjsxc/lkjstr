<script lang="ts">
  import { appMetadata } from '$lib/app/metadata';
</script>

<header class="app-header" aria-label="Application header">
  <strong>{appMetadata.name}</strong>
  <span>{appMetadata.buildLabel}</span>
  <a
    class="app-header__source"
    href="https://github.com/lkjsxc/lkjstr"
    target="_blank"
    rel="noopener noreferrer"
  >
    GitHub
  </a>
</header>

<script lang="ts">
  import type { SettingGroup } from '$lib/settings/settings-groups';
  import SettingsRow from './SettingsRow.svelte';

  type Props = {
    group: SettingGroup;
    save: (key: string, value: unknown) => void;
    reset: (key: string) => void;
  };

  let props: Props = $props();
</script>

<section class="settings-section" aria-label={props.group.title}>
  <h3>{props.group.title}</h3>
  {#each props.group.settings as setting (setting.key)}
    <SettingsRow {setting} save={props.save} reset={props.reset} />
  {/each}
</section>

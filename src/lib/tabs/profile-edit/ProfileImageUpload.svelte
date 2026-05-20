<script lang="ts">
  type Props = {
    id: string;
    label: string;
    uploading: boolean;
    upload: (files: FileList | null) => void;
  };

  let props: Props = $props();
</script>

<div class="toolbar">
  <span class="sr-only">{props.label}</span>
  <input
    class="sr-only"
    id={props.id}
    type="file"
    accept="image/*"
    onchange={(event) => props.upload(event.currentTarget.files)}
  />
  <label for={props.id}>
    {props.uploading ? 'Uploading...' : props.label}
  </label>
</div>

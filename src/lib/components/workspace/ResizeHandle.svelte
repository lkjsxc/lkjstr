<script lang="ts">
  type Props = {
    direction: 'horizontal' | 'vertical';
    resize: (deltaRatio: number) => void;
    equalize: () => void;
  };

  let { direction, resize, equalize }: Props = $props();
  let start = 0;

  function pointerDown(event: PointerEvent): void {
    start = direction === 'horizontal' ? event.clientX : event.clientY;
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp, { once: true });
  }

  function pointerMove(event: PointerEvent): void {
    const current = direction === 'horizontal' ? event.clientX : event.clientY;
    resize((current - start) / 800);
    start = current;
  }

  function pointerUp(): void {
    window.removeEventListener('pointermove', pointerMove);
  }
</script>

<button
  type="button"
  class={`resize ${direction}`}
  aria-label="Resize panes"
  onpointerdown={pointerDown}
  ondblclick={equalize}
></button>

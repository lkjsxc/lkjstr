// Inline media shares one page budget. The relay scheduler keeps its own Worker slots.
export type ImageDemand = {
  distance: number;
  start: (done: () => void) => void;
};

type ImageSource = () => ImageDemand[];
const sources = new Set<ImageSource>(); // One source per visible feed.
const slots = 4;
let active = 0;
let frame = 0;

export function wakeImageLane(): void {
  if (!frame && sources.size) frame = requestAnimationFrame(drain);
}

function drain(): void {
  frame = 0;
  const ready = [...sources].flatMap((source) => source());
  ready.sort((a, b) => a.distance - b.distance);
  for (const demand of ready.slice(0, slots - active)) {
    active++;
    demand.start(() => {
      active--;
      wakeImageLane();
    });
  }
}

export function joinImageLane(source: ImageSource): () => void {
  sources.add(source);
  wakeImageLane();
  return () => {
    sources.delete(source);
    if (!sources.size) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

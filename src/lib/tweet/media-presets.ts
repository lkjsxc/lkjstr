export type TweetMediaPreset = {
  readonly id: string;
  readonly label: string;
  readonly path: string;
  readonly fileName: string;
  readonly type: string;
};

export const tweetMediaPresets: readonly TweetMediaPreset[] = [
  {
    id: 'field',
    label: 'Field',
    path: '/media/presets/field.svg',
    fileName: 'field.svg',
    type: 'image/svg+xml',
  },
  {
    id: 'signal',
    label: 'Signal',
    path: '/media/presets/signal.svg',
    fileName: 'signal.svg',
    type: 'image/svg+xml',
  },
];

export async function presetFile(preset: TweetMediaPreset): Promise<File> {
  const response = await fetch(preset.path);
  if (!response.ok) throw new Error('Bundled media preset unavailable.');
  return new File([await response.blob()], preset.fileName, {
    type: preset.type,
  });
}

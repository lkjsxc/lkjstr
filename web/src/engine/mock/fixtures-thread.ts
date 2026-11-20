// Two threads for the thread scenes, added only when `mock.threads` is set (the default world stays as it is): a long
// conversation with four notes above its focus, branches and a nested exchange, and a thread whose first note answers
// one nobody has. `re` names an earlier entry by its index; `-1` names the missing note.
import type { MediaSpec } from './fixtures-notes.ts';
import { byHandle } from './people.ts';
import { idOf, media, type World } from './world.ts';

export type ThreadSpec = readonly [by: string, re: number | null, text: string, media?: MediaSpec];

/** Ids from 7000 (the long thread), 7100 (the missing one); 7199 is the note nobody has. */
export const LONG_FOCUS = 4;
export const MISSING_FOCUS = 1;
export const LONG: readonly ThreadSpec[] = [
  ['aoi', null, '週末、川沿いを歩いてきました。どこまで行ったら引き返すか、毎回迷います。'],
  [
    'komorebi',
    0,
    '橋が三つ目に見えたら引き返す、と決めています。そこから先は車道沿いで落ち着かないので。',
  ],
  ['aoi', 1, '三つ目の橋、わかります。あの先のパン屋さんまで行くと、帰りが長いんですよね。'],
  [
    'sam',
    2,
    'The bakery past the third bridge is worth it. Get the walnut loaf and take the bus back.',
  ],
  [
    'aoi',
    3,
    'バスで帰る、は考えたことがなかったです。次はそうしてみます🚌\nほかにおすすめの帰り道はありますか？朝の光がきれいな道だとうれしいです。',
    [1600, 1067, 205, '朝の川沿いの道'],
  ],
  ['kenji', 4, 'バス停は三つ目の橋のたもとにあります。15分おきなので、待つのも苦になりません。'],
  ['aoi', 5, 'たもとのバス停、気づいていませんでした。ありがとうございます！'],
  ['kenji', 6, 'どういたしまして。帰りに猫がいたら写真をお願いします🐈'],
  ['taro', 5, '休日は30分おきになるので注意です。'],
  ['kenji', 8, 'そうでした、補足ありがとうございます。'],
  ['aoi', 8, '時刻表、写真に撮っておきます📷'],
  [
    'lena',
    4,
    'Walk along the river on the way there and the old canal path on the way back. Same distance, different light.',
  ],
  ['aoi', 11, 'Canal path! I have never taken it. Is it paved?'],
  ['lena', 12, 'Mostly gravel. Fine for walking, less so for bicycles.'],
  [
    'mio',
    4,
    '帰り道に神社がありますよ。夕方は鳥居の影がきれいです⛩️',
    [1200, 900, 330, '夕方の鳥居'],
  ],
  ['hiroshi', 4, 'Bus 23 also stops near the relay office, if anyone wants to say hi.'],
  ['ichiro', 4, '山歩きの話かと思って開いたら川でした。川もいいですね。'],
  ['ada', 4, 'I keep a small notebook of these routes: distance, time, and one thing I noticed.'],
  ['priya', 17, '"One thing I noticed" is a great constraint. Stealing this.'],
  ['ada', 18, 'Please do.'],
  ['akane', 4, '「引き返す場所を決める」って、翻訳の仕事にも当てはまる気がします。'],
  ['yuki', 4, 'ねむい。でも歩きたい。'],
  ['taro', 4, '自転車だと三つ目の橋はすぐです🚲'],
];
export const MISSING: readonly ThreadSpec[] = [
  ['hiroshi', -1, 'それ、うちのリレーでも起きていました。原因は書き込みキューのあふれでした。'],
  ['kenji', 0, 'キューの上限、どのくらいにしていますか？'],
  ['hiroshi', 1, '今は2000です。足りないときはログに出るようにしました。'],
];

/** Adds both threads once, two days old, a quarter of an hour apart. */
export function addThreads(w: World): void {
  if (w.byId.has(idOf(7000))) return;
  const put = (list: readonly ThreadSpec[], from: number, start: number): void =>
    list.forEach(([by, re, text, picture], i) => {
      w.arrive(byHandle(by), text, w.base - (start - i * 15) * 60_000, {
        id: idOf(from + i),
        re: re === null ? undefined : idOf(re < 0 ? from + 99 : from + re),
        media: picture ? [media(picture, false)] : [],
      });
    });
  put(LONG, 7000, 2900);
  put(MISSING, 7100, 2400);
  w.notes.sort((a, b) => b.at - a.at);
}

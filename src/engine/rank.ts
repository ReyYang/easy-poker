import { freshDeck, rankValue, suitOf } from "./cards.ts";
import type { Card } from "./types.ts";

export const CATEGORY = {
  highCard: 0,
  pair: 1,
  twoPair: 2,
  trips: 3,
  straight: 4,
  flush: 5,
  fullHouse: 6,
  quads: 7,
  straightFlush: 8,
  royalFlush: 9,
} as const;

export const CATEGORY_NAMES: Record<number, string> = {
  0: "高牌",
  1: "一对",
  2: "两对",
  3: "三条",
  4: "顺子",
  5: "同花",
  6: "葫芦",
  7: "四条",
  8: "同花顺",
  9: "皇家同花顺",
};

export interface HandValue {
  category: number;
  ranks: number[];
  cards: Card[];
}

export function compareHand(a: HandValue, b: HandValue, shortDeck = false): number {
  const strength = (v: HandValue) => shortDeck && v.category === CATEGORY.flush ? 6.5 : v.category;
  if (a.category !== b.category) return strength(a) - strength(b);
  const n = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < n; i++) {
    const d = (a.ranks[i] ?? 0) - (b.ranks[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function combinations(cards: Card[], k: number): Card[][] {
  const out: Card[][] = [];
  const combo: Card[] = [];
  const rec = (start: number) => {
    if (combo.length === k) {
      out.push(combo.slice());
      return;
    }
    for (let i = start; i < cards.length; i++) {
      combo.push(cards[i]!);
      rec(i + 1);
      combo.pop();
    }
  };
  rec(0);
  return out;
}

function straightHigh(uniqueDesc: number[], shortDeck: boolean): number | null {
  if (uniqueDesc.length < 5) return null;
  for (let i = 0; i <= uniqueDesc.length - 5; i++) {
    const hi = uniqueDesc[i]!;
    if (
      uniqueDesc[i + 1] === hi - 1 &&
      uniqueDesc[i + 2] === hi - 2 &&
      uniqueDesc[i + 3] === hi - 3 &&
      uniqueDesc[i + 4] === hi - 4
    ) {
      return hi;
    }
  }
  const set = new Set(uniqueDesc);
  if (shortDeck && [14, 9, 8, 7, 6].every((r) => set.has(r))) return 9;
  if (!shortDeck && set.has(14) && set.has(5) && set.has(4) && set.has(3) && set.has(2)) {
    return 5;
  }
  return null;
}

export function evaluate5(cards: Card[], shortDeck = false): HandValue {
  if (cards.length !== 5) throw new Error("evaluate5_requires_5");
  const byRank = cards.slice().sort((a, b) => rankValue(b) - rankValue(a));
  const ranks = byRank.map(rankValue);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]!));
  const unique = [...new Set(ranks)];
  const sHigh = straightHigh(unique, shortDeck);

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  if (flush && sHigh === 14) {
    return { category: CATEGORY.royalFlush, ranks: [14], cards: byRank };
  }
  if (flush && sHigh !== null) {
    return { category: CATEGORY.straightFlush, ranks: [sHigh], cards: byRank };
  }
  if (groups[0]?.[1] === 4) {
    return {
      category: CATEGORY.quads,
      ranks: [groups[0][0], groups[1]![0]],
      cards: byRank,
    };
  }
  if (groups[0]?.[1] === 3 && groups[1]?.[1] === 2) {
    return {
      category: CATEGORY.fullHouse,
      ranks: [groups[0][0], groups[1][0]],
      cards: byRank,
    };
  }
  if (flush) {
    return { category: CATEGORY.flush, ranks, cards: byRank };
  }
  if (sHigh !== null) {
    return { category: CATEGORY.straight, ranks: [sHigh], cards: byRank };
  }
  if (groups[0]?.[1] === 3) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return { category: CATEGORY.trips, ranks: [groups[0][0], ...kickers], cards: byRank };
  }
  if (groups[0]?.[1] === 2 && groups[1]?.[1] === 2) {
    const kicker = groups[2]![0];
    return {
      category: CATEGORY.twoPair,
      ranks: [groups[0][0], groups[1][0], kicker],
      cards: byRank,
    };
  }
  if (groups[0]?.[1] === 2) {
    const kickers = groups.slice(1).map((g) => g[0]);
    return { category: CATEGORY.pair, ranks: [groups[0][0], ...kickers], cards: byRank };
  }
  return { category: CATEGORY.highCard, ranks, cards: byRank };
}

export function evaluateBest(cards: Card[], shortDeck = false): HandValue {
  if (cards.length < 5) {
    const padded = cards.slice();
    return {
      category: CATEGORY.highCard,
      ranks: padded.map(rankValue).sort((a, b) => b - a),
      cards: padded,
    };
  }
  if (cards.length === 5) return evaluate5(cards, shortDeck);
  let best: HandValue | null = null;
  for (const five of combinations(cards, 5)) {
    const v = evaluate5(five, shortDeck);
    if (!best || compareHand(v, best, shortDeck) > 0) best = v;
  }
  return best!;
}

export function evaluate7(cards: Card[], shortDeck = false): HandValue {
  return evaluateBest(cards, shortDeck);
}

export function rankName(value: HandValue): string {
  return CATEGORY_NAMES[value.category] ?? "未知";
}

function seedFromCards(hands: Record<string, Card[]>, board: Card[]): number {
  let h = 2166136261;
  const text = `${board.join("")}|${Object.keys(hands).sort().map((k) => `${k}:${hands[k]!.join("")}`).join("|")}`;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

function scoreBoard(
  entries: [string, Card[]][],
  board: Card[],
  shortDeck: boolean,
): string[] {
  let best: HandValue | null = null;
  let winners: string[] = [];
  for (const [id, hole] of entries) {
    const v = evaluateBest([...hole, ...board], shortDeck);
    if (!best) {
      best = v;
      winners = [id];
      continue;
    }
    const cmp = compareHand(v, best, shortDeck);
    if (cmp > 0) {
      best = v;
      winners = [id];
    } else if (cmp === 0) {
      winners.push(id);
    }
  }
  return winners;
}

/** Exact equities on flop/turn/river and deterministic 400-sample Monte Carlo preflop. */
export function computeEquities(
  hands: Record<string, Card[]>,
  board: Card[],
  shortDeck = false,
): { equities: Record<string, number>; outs: Record<string, number> } {
  const entries = Object.entries(hands).filter(([, h]) => h.length === 2);
  const equities: Record<string, number> = {};
  const outs: Record<string, number> = {};
  for (const [id] of entries) {
    equities[id] = 0;
    outs[id] = 0;
  }
  if (entries.length === 0) return { equities, outs };
  if (entries.length === 1) {
    equities[entries[0]![0]] = 100;
    return { equities, outs };
  }

  const used = new Set<Card>(board);
  for (const [, hole] of entries) for (const c of hole) used.add(c);
  const rem = freshDeck(shortDeck).filter((c) => !used.has(c));
  const need = Math.max(0, 5 - board.length);
  const shares: Record<string, number> = {};
  for (const [id] of entries) shares[id] = 0;

  let trials = 0;
  if (need === 0) {
    const winners = scoreBoard(entries, board, shortDeck);
    for (const id of winners) shares[id]! += 1 / winners.length;
    trials = 1;
  } else if (need === 1) {
    for (const r of rem) {
      const winners = scoreBoard(entries, [...board, r], shortDeck);
      for (const id of winners) {
        shares[id]! += 1 / winners.length;
        outs[id]! += 1;
      }
      trials += 1;
    }
  } else if (need === 2) {
    for (let i = 0; i < rem.length; i++) {
      for (let j = i + 1; j < rem.length; j++) {
        const winners = scoreBoard(entries, [...board, rem[i]!, rem[j]!], shortDeck);
        for (const id of winners) shares[id]! += 1 / winners.length;
        trials += 1;
      }
    }
  } else {
    let seed = seedFromCards(hands, board);
    const nextRand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const pool = rem.slice();
    const samples = 400;
    for (let t = 0; t < samples; t++) {
      for (let i = 0; i < need; i++) {
        const j = i + Math.floor(nextRand() * (pool.length - i));
        const tmp = pool[i]!;
        pool[i] = pool[j]!;
        pool[j] = tmp;
      }
      const winners = scoreBoard(entries, [...board, ...pool.slice(0, need)], shortDeck);
      for (const id of winners) shares[id]! += 1 / winners.length;
      trials += 1;
    }
  }

  for (const [id] of entries) {
    equities[id] = trials > 0 ? Math.round((shares[id]! / trials) * 100) : 0;
  }
  return { equities, outs };
}

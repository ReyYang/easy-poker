export const MAX_SEATS = 8;
export const ACTION_MS = 30_000;
export const HAND_PAUSE_MS = 7_500;
export const RUNOUT_VOTE_MS = 5_000;
export const DURATION_MINUTES = [30, 60, 120, 240, 480] as const;
export type DurationMinutes = (typeof DURATION_MINUTES)[number];

export const RANK_CHARS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export const SUITS = ["c", "d", "h", "s"] as const;

export type RankChar = (typeof RANK_CHARS)[number];
export type Suit = (typeof SUITS)[number];
export type Card = `${RankChar}${Suit}`;

export type TableStatus = "waiting" | "playing" | "finished";
export type Street = "preflop" | "flop" | "turn" | "river";
export type ActionType = "fold" | "check" | "call" | "bet" | "raise" | "allin";

export interface TableConfig {
  durationMinutes: DurationMinutes;
  shortDeck: boolean;
  unlimitedBuyin: boolean;
  maxBuyins: number;
  straddleAllowed: boolean;
  squidEnabled: boolean;
  bounty27Enabled: boolean;
  smallBlind: number;
  bigBlind: number;
  ante: number;
}

export interface CreateTableInput {
  durationMinutes: number;
  shortDeck?: boolean;
  unlimitedBuyin?: boolean;
  maxBuyins?: number;
  straddleAllowed?: boolean;
  squidEnabled?: boolean;
  bounty27Enabled?: boolean;
  smallBlind?: number;
  bigBlind?: number;
  ante?: number;
  tableNumber?: string;
  password?: string;
}

export interface PlayerStats {
  handsDealt: number;
  vpipHands: number;
  pfrHands: number;
  threeBetHands: number;
  showdowns: number;
  showdownWins: number;
}

export interface PlayerHud {
  handsDealt: number;
  vpip: number;
  pfr: number;
  threeBet: number;
  wsd: number;
}

export interface PlayerState {
  id: string;
  nickname: string;
  seat: number | null;
  sitting: boolean;
  sittingOut: boolean;
  chips: number;
  buyinCount: number;
  buyinChips: number;
  holeCards: Card[] | null;
  folded: boolean;
  allIn: boolean;
  inHand: boolean;
  betThisStreet: number;
  committed: number;
  actedThisStreet: boolean;
  shown: boolean;
  autoStraddle: boolean;
  pendingBuyinChips: number;
  timeoutStreak: number;
  lastEmoteAt: number | null;
  stats: PlayerStats;
}

export interface RunoutVote {
  deadline: number;
  choices: Record<string, "once" | "twice">;
}

export interface SidePot {
  amount: number;
  eligible: string[];
}

export interface HandAction {
  playerId: string;
  type: ActionType;
  amount?: number;
  allIn?: boolean;
}

export interface RecordedAction extends HandAction {
  street: Street;
  nickname: string;
  label: string;
}

export interface RunStage {
  street: Street;
  board: Card[];
  equities: Record<string, number>;
  outs?: Record<string, number>;
}

export interface HandSummary {
  handNumber: number;
  board: Card[];
  pot: number;
  winners: { id: string; nickname: string; amount: number; handName?: string }[];
  shown: Record<string, (Card | null)[]>;
  muckedIds: string[];
  actions: RecordedAction[];
}

export interface HandState {
  handNumber: number;
  deck: Card[];
  board: Card[];
  street: Street;
  buttonSeat: number;
  sbSeat: number;
  bbSeat: number;
  straddleSeat: number | null;
  actorSeat: number | null;
  actingPlayerId: string | null;
  actionDeadline: number | null;
  currentBet: number;
  minRaise: number;
  lastFullRaise: number;
  pots: SidePot[];
  streetPot: number;
  streetActions: HandAction[];
  handActions: RecordedAction[];
  lastAggressorId: string | null;
  raiseCount: number;
  vpipIds: string[];
  pfrIds: string[];
  threeBetIds: string[];
}

export interface SquidState {
  participants: string[];
  holders: string[];
}

export interface SettlementPlayer {
  id: string;
  nickname: string;
  buyinChips: number;
  stack: number;
  net: number;
  stats?: PlayerHud;
}

export interface Settlement {
  players: SettlementPlayer[];
  endedAt: number;
  reason: "duration" | "forced" | "no_players";
}

export interface GameEvent {
  type:
    | "fold"
    | "check"
    | "call"
    | "bet"
    | "raise"
    | "allin"
    | "deal"
    | "street"
    | "settle"
    | "timeout"
    | "win"
    | "bounty"
    | "squid"
    | "emote";
  playerId?: string;
  recipientIds?: string[];
  amount?: number;
  message?: string;
  emoji?: string;
  variant?: number;
  at?: number;
}

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canBet: boolean;
  minBet: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  canAllIn: boolean;
  toCall: number;
}

export interface RuntimeOpts {
  now?: () => number;
  random?: () => number;
}

export class PokerError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "PokerError";
    this.code = code;
  }
}

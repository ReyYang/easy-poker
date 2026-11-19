import assert from "node:assert/strict";
import { test } from "node:test";
import { agentContext, apiUrl, decide, gameWsUrl, legalMove, MODEL_TIMEOUT_MS, modelTransport, PRESET_BOTS, PROMPTS, reasoningEffortForModel, responsesBody } from "../public/js/agent-core.js";

test("browser AI clamps model output to the legal action", () => {
  const legal = { canFold: true, canCheck: false, canCall: true, canBet: false, canRaise: true, canAllIn: true, minRaiseTo: 8, maxRaiseTo: 100 };
  assert.deepEqual(legalMove('{"action":"check"}', legal), { action: "call" });
  assert.deepEqual(legalMove('{"action":"raise","amount":999}', legal), { action: "raise", amount: 100 });
});

test("browser AI builds model and game WebSocket URLs", () => {
  assert.equal(apiUrl("https://api.example.com/v1", "responses"), "https://api.example.com/v1/responses");
  assert.equal(gameWsUrl("https://poker.example", "ABC123", "bot-1"), "wss://poker.example/ws?table=ABC123&playerId=bot-1");
});

test("browser AI can route a model request through the game proxy", () => {
  const body = { model: "model-a", input: "hello" };
  assert.deepEqual(modelTransport("https://models.example/v1/responses", body, { useProxy: false }), {
    url: "https://models.example/v1/responses", body,
  });
  assert.deepEqual(modelTransport("https://models.example/v1/responses", body, { useProxy: true, proxyOrigin: "https://poker.example/" }), {
    url: "https://poker.example/api/model-proxy",
    body: { url: "https://models.example/v1/responses", body },
  });
});

test("browser AI receives factual position, stack, player count, and street action context", () => {
  const seat = (playerId, chips, flags = {}) => ({ playerId, nickname: playerId, chips, bet: 0, folded: false, allIn: false, inHand: true, ...flags });
  const seats = [seat("hero", 200, { isButton: true }), seat("sb", 100, { isSb: true }), seat("bb", 400, { isBb: true }), seat("utg", 300), seat("co", 80), null, null, null];
  const context = agentContext({
    config: { smallBlind: 1, bigBlind: 2, shortDeck: false },
    me: { id: "hero", holeCards: ["As", "Kd"] },
    seats,
    street: "preflop",
    board: [],
    pot: 3,
    streetActions: [{ playerId: "sb", type: "call", amount: 2 }],
    legal: { canFold: true, canCall: true },
  });
  assert.equal(context.hero.position, "BTN");
  assert.equal(context.players.find((player) => player.playerId === "utg").position, "UTG");
  assert.equal(context.players.find((player) => player.playerId === "co").position, "CO");
  assert.equal(context.hero.stackBB, 100);
  assert.equal(context.activePlayerCount, 5);
  assert.deepEqual(context.effectiveStacksBB.map((item) => item.value), [50, 100, 100, 40]);
  assert.equal(context.streetActions[0].amountBB, 1);
  for (const style of ["tom_dwan", "tan_xuan", "phil_ivey", "alan_keating", "aaron_zang"]) assert.ok(PROMPTS[style]);
});

test("browser AI selects low-latency reasoning effort only for reasoning models", () => {
  assert.equal(reasoningEffortForModel("gpt-5.4"), "none");
  assert.equal(reasoningEffortForModel("gpt-5.4-mini"), "none");
  assert.equal(reasoningEffortForModel("gpt-5.3-codex"), "low");
  assert.equal(reasoningEffortForModel("gpt-5-mini"), "low");
  assert.equal(reasoningEffortForModel("gpt-4.1-mini"), undefined);
  assert.equal(reasoningEffortForModel("deepseek-chat"), undefined);

  assert.deepEqual(responsesBody("gpt-5.3-codex", "sys", "in").reasoning, { effort: "low" });
  assert.deepEqual(responsesBody("gpt-5.4-mini", "sys", "in").reasoning, { effort: "none" });
  assert.equal("reasoning" in responsesBody("gpt-5.3-codex", "sys", "in", false), false);
  assert.equal("reasoning" in responsesBody("deepseek-chat", "sys", "in"), false);
  assert.equal(PRESET_BOTS.length, 5);
  assert.equal(MODEL_TIMEOUT_MS, 25_000);
});

test("browser AI retries responses without reasoning before falling back to chat completions", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    if (calls.length === 1) return new Response(JSON.stringify({ error: { message: "unsupported reasoning" } }), { status: 400 });
    return new Response(JSON.stringify({ output_text: '{"action":"call"}' }), { status: 200 });
  };
  try {
    const move = await decide({
      config: { smallBlind: 1, bigBlind: 2, shortDeck: false },
      me: { id: "hero", holeCards: ["As", "Kd"] },
      seats: [{ playerId: "hero", nickname: "hero", chips: 200, bet: 0, folded: false, allIn: false, inHand: true, isButton: true }],
      street: "preflop",
      board: [],
      pot: 3,
      streetActions: [],
      legal: { canFold: true, canCheck: false, canCall: true, canBet: false, canRaise: false, canAllIn: false },
    }, "tom_dwan", { apiKey: "k", baseUrl: "https://api.example.com/v1", model: "gpt-5.3-codex" });
    assert.deepEqual(move, { action: "call" });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://api.example.com/v1/responses");
    assert.deepEqual(calls[0].body.reasoning, { effort: "low" });
    assert.equal(calls[1].url, "https://api.example.com/v1/responses");
    assert.equal("reasoning" in calls[1].body, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

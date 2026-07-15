import assert from "node:assert/strict";
import test from "node:test";
import {
  accountContextFacts,
  accountIdentityAnswer,
  assistantSurface,
  hostPropertyId,
  shouldLoadHostInsights,
} from "../src/modules/ai/assistant-context.ts";

const host = {
  id: "owner-1",
  email: "host@example.com",
  name: "Kingsley Maduabuchi",
  phone: null,
  role: "OWNER",
  capabilities: ["GUEST", "OWNER"],
};

const guest = {
  ...host,
  id: "guest-1",
  role: "GUEST",
  capabilities: ["GUEST"],
};

test("backend capabilities identify a host without removing guest booking access", () => {
  const answer = accountIdentityAnswer(
    "Am I a guest or host?",
    host,
    "/host/dashboard",
  );
  assert.match(answer, /has host access/i);
  assert.match(answer, /not a guest-only user/i);
  assert.match(answer, /Host Workspace/);
});

test("guest and anonymous identities never receive host claims", () => {
  assert.match(
    accountIdentityAnswer("What is my role?", guest, "/search"),
    /guest account/i,
  );
  assert.match(
    accountIdentityAnswer("Am I a guest or host?", null, "/search"),
    /not signed in/i,
  );
  assert.match(
    accountContextFacts(guest, "/search").join(" "),
    /does not have host access/i,
  );
});

test("host route context is descriptive and property ids are isolated", () => {
  assert.equal(
    assistantSurface("/host/bookings"),
    "the host bookings workspace",
  );
  assert.equal(hostPropertyId("/host/properties/prop_123"), "prop_123");
  assert.equal(hostPropertyId("/host/properties/new"), null);
  assert.equal(hostPropertyId("/stays/prop_123"), null);
});

test("owner insights load on host routes or explicit owner questions", () => {
  assert.equal(
    shouldLoadHostInsights("How am I doing?", "/host/dashboard"),
    true,
  );
  assert.equal(
    shouldLoadHostInsights("How are my property earnings?", "/search"),
    true,
  );
  assert.equal(shouldLoadHostInsights("Find me a stay", "/search"), false);
});

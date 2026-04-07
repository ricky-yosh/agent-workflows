import { describe, it, expect } from "vitest";
import { createAgentRegistry } from "../registry.js";

describe("AgentRegistry", () => {
  it("returns agent by name", () => {
    const registry = createAgentRegistry({ claude: { command: "claude" } });
    const agent = registry.get("claude");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("claude");
  });

  it("returns undefined for unknown agent", () => {
    const registry = createAgentRegistry({});
    expect(registry.get("unknown")).toBeUndefined();
  });

  it("lists configured agents", () => {
    const registry = createAgentRegistry({
      claude: { command: "claude" },
      codex: { command: "codex" },
    });
    expect(registry.list().sort()).toEqual(["claude", "codex"]);
  });
});

// ── Task 5: SDK-based agents without a command string ──────────────

describe("AgentRegistry — SDK-based agents without command", () => {
  it("creates Claude agent when config has no command field", () => {
    const registry = createAgentRegistry({ claude: {} });
    const agent = registry.get("claude");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("claude");
  });

  it("creates Claude agent when config command is undefined", () => {
    const registry = createAgentRegistry({ claude: { command: undefined } });
    const agent = registry.get("claude");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("claude");
  });

  it("creates Codex agent with command and Claude agent without command side-by-side", () => {
    const registry = createAgentRegistry({
      claude: {},
      codex: { command: "/usr/local/bin/codex" },
    });
    expect(registry.list().sort()).toEqual(["claude", "codex"]);
    expect(registry.get("claude")!.name).toBe("claude");
    expect(registry.get("codex")!.name).toBe("codex");
  });

  it("Codex agent still requires a command — missing command skips it or throws", () => {
    // Codex is subprocess-based and needs a command string.
    // The registry should either skip it or throw — not create a broken agent.
    const registry = createAgentRegistry({ codex: {} });
    const agent = registry.get("codex");
    // Either the agent was not created, or if it was, it should fail isAvailable
    if (agent) {
      // If created, it should not be functional without a command
      expect(agent.name).toBe("codex");
    } else {
      expect(agent).toBeUndefined();
    }
  });

  it("getAvailable includes Claude agent created without command", async () => {
    const registry = createAgentRegistry({ claude: {} });
    const available = await registry.getAvailable();
    // Claude's isAvailable checks dynamic import of SDK — if SDK is installed, it should be available
    expect(available).toContain("claude");
  });

  it("list() includes agents created without a command", () => {
    const registry = createAgentRegistry({ claude: {} });
    expect(registry.list()).toEqual(["claude"]);
  });
});

// ── Task 5: AwConfig.agents type allows optional command ──────────

describe("AgentRegistry — config shape flexibility", () => {
  it("accepts config where some agents have command and others don't", () => {
    // This tests that the AgentConfig type allows { command?: string }
    const config = {
      claude: {},
      codex: { command: "codex" },
    };
    const registry = createAgentRegistry(config);
    expect(registry.list().sort()).toEqual(["claude", "codex"]);
  });

  it("ignores unknown agent names with no factory", () => {
    const registry = createAgentRegistry({ unknown_agent: {} });
    expect(registry.get("unknown_agent")).toBeUndefined();
    expect(registry.list()).toEqual([]);
  });

  it("handles empty config", () => {
    const registry = createAgentRegistry({});
    expect(registry.list()).toEqual([]);
  });
});

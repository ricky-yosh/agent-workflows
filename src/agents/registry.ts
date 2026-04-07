import type { Agent } from "../types.js";
import { createClaudeAgent } from "./claude.js";
import { createCodexAgent } from "./codex.js";

interface AgentConfig { [name: string]: { command?: string }; }

const AGENT_FACTORIES: Record<string, (cmd?: string) => Agent> = {
  claude: () => createClaudeAgent(), codex: (cmd) => createCodexAgent(cmd ?? ""),
};

export interface AgentRegistry {
  get(name: string): Agent | undefined;
  getAvailable(): Promise<string[]>;
  list(): string[];
}

export function createAgentRegistry(config: AgentConfig): AgentRegistry {
  const agents = new Map<string, Agent>();
  for (const [name, { command }] of Object.entries(config)) {
    const factory = AGENT_FACTORIES[name];
    if (factory) agents.set(name, factory(command));
  }
  return {
    get(name: string) { return agents.get(name); },
    async getAvailable() {
      const results = await Promise.all(
        Array.from(agents.entries()).map(async ([name, agent]) => {
          const ok = await agent.isAvailable();
          return ok ? name : null;
        })
      );
      return results.filter((n): n is string => n !== null);
    },
    list() { return Array.from(agents.keys()); },
  };
}

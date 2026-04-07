import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import yaml from "js-yaml";
import type { Workflow } from "../types.js";

export function loadWorkflow(filePath: string): Workflow {
  const raw = readFileSync(filePath, "utf-8");
  const parsed = yaml.load(raw) as Workflow;
  if (!parsed || !parsed.name || !Array.isArray(parsed.phases)) {
    throw new Error(`Invalid workflow file: ${filePath}`);
  }
  return parsed;
}

export function listWorkflows(dir: string): string[] {
  return readdirSync(dir)
    .filter((f: string) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f: string) => basename(f, f.endsWith(".yaml") ? ".yaml" : ".yml"));
}

export function loadWorkflowByName(dir: string, name: string): Workflow {
  const yamlPath = join(dir, `${name}.yaml`);
  const ymlPath = join(dir, `${name}.yml`);
  const filePath = existsSync(yamlPath) ? yamlPath : ymlPath;
  return loadWorkflow(filePath);
}

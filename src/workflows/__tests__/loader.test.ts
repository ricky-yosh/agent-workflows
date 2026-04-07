import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadWorkflow, listWorkflows, loadWorkflowByName } from "../loader.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "aw-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const VALID_WORKFLOW_YAML = `
name: Test Workflow
description: A test workflow

phases:
  - name: Phase One
    steps:
      - name: Step A
        type: think
        skill: /test-skill
  - name: Phase Two
    loop: true
    steps:
      - name: Step B
        type: code
        outputs:
          - output.txt
`;

describe("loadWorkflow", () => {
  it("parses valid YAML into a Workflow object with correct fields", () => {
    const filePath = join(tempDir, "test.yaml");
    writeFileSync(filePath, VALID_WORKFLOW_YAML, "utf-8");

    const workflow = loadWorkflow(filePath);

    expect(workflow.name).toBe("Test Workflow");
    expect(workflow.description).toBe("A test workflow");
    expect(Array.isArray(workflow.phases)).toBe(true);
    expect(workflow.phases).toHaveLength(2);

    const phase1 = workflow.phases[0];
    expect(phase1.name).toBe("Phase One");
    expect(phase1.steps).toHaveLength(1);
    expect(phase1.steps[0].name).toBe("Step A");
    expect(phase1.steps[0].type).toBe("think");
    expect(phase1.steps[0].skill).toBe("/test-skill");

    const phase2 = workflow.phases[1];
    expect(phase2.name).toBe("Phase Two");
    expect(phase2.loop).toBe(true);
    expect(phase2.steps[0].outputs).toEqual(["output.txt"]);
  });

  it("throws on invalid YAML (missing name)", () => {
    const filePath = join(tempDir, "invalid.yaml");
    writeFileSync(
      filePath,
      `description: no name here\nphases: []\n`,
      "utf-8"
    );

    expect(() => loadWorkflow(filePath)).toThrow(
      `Invalid workflow file: ${filePath}`
    );
  });

  it("throws on invalid YAML (phases is not an array)", () => {
    const filePath = join(tempDir, "bad-phases.yaml");
    writeFileSync(
      filePath,
      `name: Bad\ndescription: bad\nphases: not-an-array\n`,
      "utf-8"
    );

    expect(() => loadWorkflow(filePath)).toThrow(
      `Invalid workflow file: ${filePath}`
    );
  });

  it("throws on malformed YAML syntax", () => {
    const filePath = join(tempDir, "malformed.yaml");
    writeFileSync(filePath, `name: [unclosed bracket\n`, "utf-8");

    expect(() => loadWorkflow(filePath)).toThrow();
  });
});

describe("listWorkflows", () => {
  it("lists yaml files in a directory without extensions", () => {
    writeFileSync(join(tempDir, "brownfield.yaml"), VALID_WORKFLOW_YAML);
    writeFileSync(join(tempDir, "greenfield.yaml"), VALID_WORKFLOW_YAML);
    writeFileSync(join(tempDir, "other.yml"), VALID_WORKFLOW_YAML);
    writeFileSync(join(tempDir, "readme.txt"), "not a workflow");

    const names = listWorkflows(tempDir);

    expect(names).toContain("brownfield");
    expect(names).toContain("greenfield");
    expect(names).toContain("other");
    expect(names).not.toContain("readme");
    expect(names).not.toContain("readme.txt");
  });

  it("returns empty array when no yaml files exist", () => {
    writeFileSync(join(tempDir, "readme.txt"), "just text");
    const names = listWorkflows(tempDir);
    expect(names).toEqual([]);
  });
});

describe("loadWorkflowByName", () => {
  it("loads a workflow by name from a directory", () => {
    writeFileSync(join(tempDir, "brownfield.yaml"), VALID_WORKFLOW_YAML);

    const workflow = loadWorkflowByName(tempDir, "brownfield");

    expect(workflow.name).toBe("Test Workflow");
    expect(workflow.phases).toHaveLength(2);
  });

  it("throws when the named workflow file does not exist", () => {
    expect(() => loadWorkflowByName(tempDir, "nonexistent")).toThrow();
  });
});

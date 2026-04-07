#!/usr/bin/env node

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import { marked } from "marked";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const workflowDir = join(root, "workflows");

// ── Docs (README, CLAUDE.md) ──
const readmeRaw = readFileSync(join(root, "README.md"), "utf-8");
const readmeHtml = marked.parse(readmeRaw);
const claudeMdRaw = existsSync(join(root, "CLAUDE.md"))
  ? readFileSync(join(root, "CLAUDE.md"), "utf-8")
  : "";
const claudeMdHtml = claudeMdRaw ? marked.parse(claudeMdRaw) : "";
const outDir = join(process.cwd(), ".aw", "docs");

function extractDescription(raw) {
  const line = raw.split("\n").filter((l) => l.trim()).find(
    (l) => !l.startsWith("#") && !l.startsWith("---") && l.length > 10
  );
  return line || "";
}

// ── Skills ──
const skillsDir = join(root, "skills");
const skillGuidelinesRaw = existsSync(join(skillsDir, "SKILL-GUIDELINES.md"))
  ? readFileSync(join(skillsDir, "SKILL-GUIDELINES.md"), "utf-8")
  : "";
const skillGuidelinesHtml = skillGuidelinesRaw
  ? marked.parse(skillGuidelinesRaw)
  : "";
const skillGroups = {};
if (existsSync(skillsDir)) {
  for (const group of readdirSync(skillsDir)) {
    const groupDir = join(skillsDir, group);
    try {
      const entries = readdirSync(groupDir);
      for (const entry of entries) {
        const skillFile = join(groupDir, entry, "SKILL.md");
        if (existsSync(skillFile)) {
          if (!skillGroups[group]) skillGroups[group] = [];
          const raw = readFileSync(skillFile, "utf-8");
          skillGroups[group].push({
            name: entry,
            description: extractDescription(raw),
            html: marked.parse(raw),
          });
        }
      }
    } catch {
      // not a directory, skip
    }
  }
}

function buildSkillsHtml() {
  const groups = Object.keys(skillGroups).sort();
  if (groups.length === 0) {
    return `<div class="empty-state">
      <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a7 7 0 0 1 4 12.7V16a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-1.3A7 7 0 0 1 12 2z"/><path d="M9 21h6"/><path d="M10 19h4"/></svg></div>
      <p>No skills found</p>
      <span>Add SKILL.md files under skills/ to see them here.</span>
    </div>`;
  }

  // Build segment buttons for skill groups
  const segmentBtns = groups
    .map(
      (group) =>
        `<button class="segment-btn" data-target="${esc(group)}" onclick="selectSkillGroup('${esc(group)}')">${esc(group)}<span class="segment-count">${skillGroups[group].length}</span></button>`
    )
    .join("");

  // Build a panel per group (like workflow articles)
  const groupPanels = groups
    .map((group) => {
      const skills = skillGroups[group];
      const skillItems = skills
        .map(
          (s) => `
          <div class="list-item" data-search-text="${esc(s.name)} ${esc(s.description)}" onclick="openSkillDetail('skill-${esc(group)}-${esc(s.name)}')">
            <div class="list-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 1 4 12.7V16a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-1.3A7 7 0 0 1 12 2z"/><path d="M9 21h6"/></svg></div>
            <div class="list-item-content">
              <span class="list-item-title">${esc(s.name)}</span>
              <span class="list-item-desc">${esc(s.description).substring(0, 120)}</span>
            </div>
            <div class="list-item-chevron"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4l4 4-4 4"/></svg></div>
          </div>
          <div class="detail-panel" id="skill-${esc(group)}-${esc(s.name)}" data-review-source="skills/${esc(group)}/${esc(s.name)}" data-review-title="${esc(s.name)}">
            <button class="detail-back" onclick="closeSkillDetail('skill-${esc(group)}-${esc(s.name)}', '${esc(group)}')">&larr; Back to ${esc(group)}</button>
            <div class="detail-header">
              <span class="detail-badge">${esc(group)}</span>
              <h3 class="detail-title">${esc(s.name)}</h3>
            </div>
            <div class="markdown-body">${s.html}</div>
          </div>`
        )
        .join("");
      return `
        <div class="skill-group-panel" data-skill-group="${esc(group)}" style="display:none">
          <div class="list-group-items">${skillItems}</div>
        </div>`;
    })
    .join("");

  return `
    <div class="segment-control">
      <div class="segment-track">${segmentBtns}</div>
    </div>
    ${groupPanels}`;
}

const skillsHtml = buildSkillsHtml();

// ── Digests ──
const digestsDir = join(process.cwd(), ".aw", "digests");
const digestFiles = [];
if (existsSync(digestsDir)) {
  for (const file of readdirSync(digestsDir)) {
    if (file.endsWith(".md")) {
      const raw = readFileSync(join(digestsDir, file), "utf-8");
      const name = file.replace(/\.md$/, "").replace(/[-_]/g, " ");
      digestFiles.push({
        name,
        description: extractDescription(raw),
        html: marked.parse(raw),
      });
    }
  }
  digestFiles.sort((a, b) => a.name.localeCompare(b.name));
}

function buildDigestsHtml() {
  if (digestFiles.length === 0) {
    return `<div class="empty-state">
      <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg></div>
      <p>No digests yet</p>
      <span>Digests are created during workflow execution.</span>
    </div>`;
  }
  const digestItems = digestFiles
    .map(
      (d) => `
          <div class="list-item" data-search-text="${esc(d.name)} ${esc(d.description)}" onclick="openDigestDetail('digest-${esc(d.name.replace(/\s+/g, "-"))}')">
            <div class="list-item-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg></div>
            <div class="list-item-content">
              <span class="list-item-title">${esc(d.name)}</span>
              <span class="list-item-desc">${esc(d.description).substring(0, 120)}</span>
            </div>
            <div class="list-item-chevron"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 4l4 4-4 4"/></svg></div>
          </div>
          <div class="detail-panel" id="digest-${esc(d.name.replace(/\s+/g, "-"))}" data-review-source="digests/${esc(d.name.replace(/\s+/g, "-"))}" data-review-title="${esc(d.name)}">
            <button class="detail-back" onclick="closeDigestDetail('digest-${esc(d.name.replace(/\s+/g, "-"))}')">&larr; Back to Digests</button>
            <div class="detail-header">
              <h3 class="detail-title">${esc(d.name)}</h3>
            </div>
            <div class="markdown-body">${d.html}</div>
          </div>`)
    .join("");
  return `<div class="list-group-items">${digestItems}</div>`;
}

const digestsHtml = buildDigestsHtml();

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Workflows ──

const files = existsSync(workflowDir)
  ? readdirSync(workflowDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
  : [];
const workflows = files.map((f) => {
  const raw = readFileSync(join(workflowDir, f), "utf-8");
  return yaml.load(raw);
});

// ── Icons (inline SVG for zero dependencies) ──

const icons = {
  think: `<svg class="type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 1 4 12.7V16a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-1.3A7 7 0 0 1 12 2z"/><path d="M9 21h6"/><path d="M10 19h4"/></svg>`,
  code: `<svg class="type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  input: `<svg class="type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 10H3"/><path d="M21 6H3"/><path d="M21 14H3"/><path d="M17 18H3"/></svg>`,
  output: `<svg class="output-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h7"/><path d="M7.5 5.5 10 8l-2.5 2.5"/><rect x="12" y="4" width="1.5" height="8" rx="0.5" fill="currentColor" stroke="none"/></svg>`,
  loop: `<svg class="loop-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`,
  parallel: `<svg class="parallel-label-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="4" y1="3" x2="4" y2="13"/><line x1="8" y1="3" x2="8" y2="13"/><line x1="12" y1="3" x2="12" y2="13"/></svg>`,
  clear: `<svg class="clear-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8h12"/><path d="M8 4v8"/></svg>`,
  file: `<svg class="file-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5z"/><polyline points="9 1 9 5 13 5"/></svg>`,
};

// ── Resolve agent per step (step > phase > workflow) ──

function resolveAgent(step, phase, workflow) {
  return step.agent || phase.agent || workflow.agent || null;
}

// ── Build step HTML ──

function buildStepHtml(step, phase, workflow) {
  const agent = resolveAgent(step, phase, workflow);
  const typeIcon = icons[step.type] || "";
  const agentHtml = agent
    ? `<span class="agent-pill agent-${esc(agent)}">${esc(agent)}</span>`
    : "";

  const skillHtml = step.skill
    ? `<div class="step-skill"><span class="skill-ref">${esc(step.skill)}</span></div>`
    : "";

  const commandHtml = step.command
    ? `<div class="step-command"><span class="command-ref">$ ${esc(step.command)}</span></div>`
    : "";

  const permHtml = step.permissions
    ? `<span class="perm-badge">${esc(step.permissions)}</span>`
    : "";

  const outputsHtml = step.outputs
    ? `<div class="step-outputs">
        ${icons.output}
        <div class="output-files">${step.outputs.map((o) => `<span class="output-chip">${icons.file}${esc(o)}</span>`).join("")}</div>
      </div>`
    : "";

  return `
    <div class="step" data-search-text="${esc(step.name)}">
      <div class="step-type-col">${typeIcon}</div>
      <div class="step-main">
        <div class="step-top-row">
          <span class="step-name">${esc(step.name)}</span>
          <div class="step-meta">
            ${permHtml}
            ${agentHtml}
          </div>
        </div>
        ${skillHtml}
        ${commandHtml}
        ${outputsHtml}
      </div>
    </div>`;
}

// ── Group steps: detect parallel runs ──

function groupSteps(steps) {
  const groups = [];
  let i = 0;
  while (i < steps.length) {
    if (steps[i].parallel) {
      const parallelGroup = [];
      while (i < steps.length && steps[i].parallel) {
        parallelGroup.push(steps[i]);
        i++;
      }
      groups.push({ type: "parallel", steps: parallelGroup });
    } else {
      groups.push({ type: "single", step: steps[i] });
      i++;
    }
  }
  return groups;
}

function buildStepGroupsHtml(steps, phase, workflow) {
  const groups = groupSteps(steps);
  let html = "";

  for (const group of groups) {
    if (group.type === "parallel") {
      const cols = group.steps
        .map((s) => `<div class="parallel-col">${buildStepHtml(s, phase, workflow)}</div>`)
        .join("");
      html += `
        <div class="parallel-group">
          <div class="parallel-label">${icons.parallel}<span>Runs in parallel</span></div>
          <div class="parallel-grid parallel-grid-${group.steps.length}">${cols}</div>
        </div>`;
    } else {
      html += buildStepHtml(group.step, phase, workflow);
      if (group.step.clear) {
        html += `
          <div class="clear-divider">
            <div class="clear-line"></div>
            <span class="clear-label">${icons.clear}state reset</span>
            <div class="clear-line"></div>
          </div>`;
      }
    }
  }

  return html;
}

// ── Build phase HTML ──

function buildPhaseHtml(phase, phaseIndex, workflow) {
  const phaseNum = String(phaseIndex + 1).padStart(2, "0");
  const stepsHtml = buildStepGroupsHtml(phase.steps || [], phase, workflow);
  const isLoop = phase.loop;

  const phaseClass = isLoop ? "phase phase-loop" : "phase";

  const loopIndicator = isLoop
    ? `<div class="loop-indicator">${icons.loop}<span>Repeats until all tasks complete</span></div>`
    : "";

  return `
    <section class="${phaseClass}">
      <div class="phase-indicator">
        <div class="phase-dot"></div>
        <div class="phase-line"></div>
      </div>
      <div class="phase-body">
        <div class="phase-label">Phase ${phaseNum}</div>
        <h3 class="phase-name">${esc(phase.name)}</h3>
        ${loopIndicator}
        <div class="steps-container">${stepsHtml}</div>
      </div>
    </section>`;
}

// ── Build workflow HTML ──

function buildWorkflowHtml(wf) {
  const phases = (wf.phases || []).map((p, i) => buildPhaseHtml(p, i, wf)).join("");
  const phaseCount = (wf.phases || []).length;
  const stepCount = (wf.phases || []).reduce((s, p) => s + (p.steps || []).length, 0);
  const agentHtml = wf.agent
    ? `<span class="agent-pill agent-${esc(wf.agent)}">${esc(wf.agent)}</span>`
    : "";
  const id = esc(wf.name.toLowerCase().replace(/\s+/g, "-"));
  return `
    <article class="workflow" data-workflow="${id}" style="display:none" data-review-source="workflows/${id}" data-review-title="${esc(wf.name)}">
      <header class="workflow-header">
        <div class="workflow-title-row">
          <h2 class="workflow-title">${esc(wf.name)}</h2>
          ${agentHtml}
        </div>
        <p class="workflow-desc">${esc(wf.description || "")}</p>
        <p class="workflow-meta">${phaseCount} phases &middot; ${stepCount} steps</p>
      </header>
      <div class="phases-timeline">${phases}</div>
    </article>`;
}

const workflowsHtml = workflows.map(buildWorkflowHtml).join("");

// Build segment control buttons
const segmentButtons = workflows
  .map((wf) => {
    const id = esc(wf.name.toLowerCase().replace(/\s+/g, "-"));
    return `<button class="segment-btn" data-target="${id}" onclick="selectWorkflow('${id}')">${esc(wf.name)}</button>`;
  })
  .join("\n          ");

// ── Build search index ──
const searchEntries = [];

// Index workflows
workflows.forEach((wf) => {
  const id = wf.name.toLowerCase().replace(/\s+/g, "-");
  searchEntries.push({
    type: "workflow",
    title: wf.name,
    desc: wf.description || "",
    action: `selectTab('workflows'); selectWorkflow('${id}')`,
  });
  (wf.phases || []).forEach((p) => {
    (p.steps || []).forEach((s) => {
      searchEntries.push({
        type: "step",
        title: s.name,
        desc: `${wf.name} \u2192 ${p.name}`,
        action: `selectTab('workflows'); selectWorkflow('${id}')`,
      });
    });
  });
});

// Index skills
Object.entries(skillGroups).forEach(([group, skills]) => {
  skills.forEach((s) => {
    searchEntries.push({
      type: "skill",
      title: s.name,
      desc: `${group} \u2014 ${s.description.substring(0, 80)}`,
      action: `selectTab('skills'); selectSkillGroup('${group}'); openSkillDetail('skill-${group}-${s.name}')`,
    });
  });
});

// Index digests
digestFiles.forEach((d) => {
  const slug = d.name.replace(/\s+/g, "-");
  searchEntries.push({
    type: "digest",
    title: d.name,
    desc: d.description.substring(0, 80),
    action: `selectTab('digests'); openDetail('digest-${slug}')`,
  });
});

// Index docs
searchEntries.push({
  type: "doc",
  title: "README",
  desc: "Project README",
  action: "selectTab('docs'); selectDoc('doc-readme')",
});
if (claudeMdRaw) {
  searchEntries.push({
    type: "doc",
    title: "CLAUDE",
    desc: "Claude Code project instructions",
    action: "selectTab('docs'); selectDoc('doc-claude')",
  });
}
if (skillGuidelinesRaw) {
  searchEntries.push({
    type: "doc",
    title: "SKILL-GUIDELINES",
    desc: "Skill authoring guidelines",
    action: "selectTab('docs'); selectDoc('doc-guidelines')",
  });
}

// ── Assemble full HTML ──

const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>aw &mdash; Workflow Index</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2318181b'/%3E%3Cpath d='M7 22 L12 10 L16 18 L20 10 L25 22' stroke='%236366f1' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
  <style>
    /* ========== Tokens ========== */
    :root {
      --font-headline: "Space Grotesk", sans-serif;
      --font-body: "Inter", sans-serif;
      --font-mono: "Fira Code", "SF Mono", monospace;
      --radius: 12px;
      --radius-sm: 6px;
      --transition: 0.2s ease;
    }

    [data-theme="dark"] {
      --bg: #020617;
      --bg-surface: #0f172a;
      --bg-surface-hover: #1e293b;
      --bg-inset: #0a0f1a;
      --bg-nav: rgba(15, 23, 42, 0.7);
      --bg-elevated: #141c2e;
      --border-ghost: rgba(148, 163, 184, 0.10);
      --text: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-tertiary: #64748b;
      --text-dim: #475569;
      --accent: #618bff;
      --accent-subtle: rgba(97, 139, 255, 0.15);
      --green: #4ade80;
      --green-subtle: rgba(74, 222, 128, 0.12);
      --purple: #c084fc;
      --purple-subtle: rgba(192, 132, 252, 0.12);
      --orange: #fb923c;
      --orange-subtle: rgba(251, 146, 60, 0.12);
      --red: #f87171;
      --red-subtle: rgba(248, 113, 113, 0.12);
      --cyan: #22d3ee;
      --cyan-subtle: rgba(34, 211, 238, 0.12);
      --dot-glow: rgba(59, 130, 246, 0.5);
      --phase-line: linear-gradient(to bottom, #1e293b, #334155, #1e293b);
      --loop-border: rgba(251, 146, 60, 0.45);
      --loop-bg: rgba(251, 146, 60, 0.08);
      --clear-line: #475569;
      --parallel-bg: rgba(34, 211, 238, 0.06);
      --parallel-border: rgba(34, 211, 238, 0.25);
      --search-bg: rgba(15, 23, 42, 0.95);
      --overlay: rgba(0, 0, 0, 0.6);
    }

    [data-theme="light"] {
      --bg: #f7f9fb;
      --bg-surface: #f0f4f7;
      --bg-surface-hover: #e8eff3;
      --bg-inset: #ffffff;
      --bg-nav: rgba(247, 249, 251, 0.7);
      --bg-elevated: #ffffff;
      --border-ghost: rgba(169, 180, 185, 0.10);
      --text: #2a3439;
      --text-secondary: #566166;
      --text-tertiary: #717c82;
      --text-dim: #a9b4b9;
      --accent: #0053db;
      --accent-subtle: rgba(0, 83, 219, 0.08);
      --green: #1a7f37;
      --green-subtle: rgba(26, 127, 55, 0.08);
      --purple: #8250df;
      --purple-subtle: rgba(130, 80, 223, 0.08);
      --orange: #9a6700;
      --orange-subtle: rgba(154, 103, 0, 0.08);
      --red: #cf222e;
      --red-subtle: rgba(207, 34, 46, 0.08);
      --cyan: #1b7c83;
      --cyan-subtle: rgba(27, 124, 131, 0.08);
      --dot-glow: rgba(0, 83, 219, 0.3);
      --phase-line: linear-gradient(to bottom, #d9e4ea, #a9b4b9, #d9e4ea);
      --loop-border: rgba(154, 103, 0, 0.25);
      --loop-bg: rgba(154, 103, 0, 0.03);
      --clear-line: #d9e4ea;
      --parallel-bg: rgba(27, 124, 131, 0.03);
      --parallel-border: rgba(27, 124, 131, 0.15);
      --search-bg: rgba(255, 255, 255, 0.97);
      --overlay: rgba(0, 0, 0, 0.3);
    }

    /* ========== Reset ========== */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: var(--font-body);
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      transition: background var(--transition), color var(--transition);
    }

    ::selection { background: var(--accent-subtle); }

    /* ========== Nav ========== */
    nav {
      position: fixed;
      top: 0;
      width: 100%;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 32px;
      background: var(--bg-nav);
      backdrop-filter: blur(16px) saturate(1.5);
      -webkit-backdrop-filter: blur(16px) saturate(1.5);
    }

    .nav-left {
      display: flex;
      align-items: center;
      gap: 32px;
    }

    .nav-brand {
      font-family: var(--font-headline);
      font-weight: 700;
      font-size: 20px;
      letter-spacing: -0.04em;
      color: var(--text);
    }

    .nav-brand span {
      color: var(--text-tertiary);
      font-weight: 400;
      margin-left: 6px;
    }

    /* ── Top-level tabs in nav ── */
    .nav-tabs {
      display: inline-flex;
      gap: 2px;
      padding: 3px;
      background: var(--bg-surface);
      border-radius: 10px;
    }

    .tab-btn {
      font-family: var(--font-headline);
      font-size: 13px;
      font-weight: 500;
      padding: 7px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all var(--transition);
      color: var(--text-secondary);
      background: transparent;
    }

    .tab-btn:hover {
      color: var(--text);
    }

    .tab-btn.active {
      background: var(--accent);
      color: #f8f7ff;
      box-shadow: 0 2px 8px rgba(0, 83, 219, 0.3);
    }

    .nav-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* ── Search trigger ── */
    .search-trigger {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px;
      background: var(--bg-surface);
      border: none;
      border-radius: 10px;
      cursor: pointer;
      color: var(--text-tertiary);
      font-family: var(--font-body);
      font-size: 13px;
      transition: all var(--transition);
    }

    .search-trigger:hover {
      color: var(--text-secondary);
      background: var(--bg-surface-hover);
    }

    .search-trigger svg {
      width: 15px;
      height: 15px;
    }

    .search-trigger kbd {
      font-family: var(--font-mono);
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--bg);
      color: var(--text-dim);
    }

    .theme-btn {
      color: var(--text-secondary);
      background: var(--bg-surface);
      border: none;
      padding: 8px;
      border-radius: 10px;
      cursor: pointer;
      transition: all var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .theme-btn:hover {
      color: var(--text);
      background: var(--bg-surface-hover);
    }

    .theme-icon {
      width: 18px;
      height: 18px;
    }

    [data-theme="dark"] #icon-moon { display: none; }
    [data-theme="dark"] #icon-sun { display: block; }
    [data-theme="light"] #icon-sun { display: none; }
    [data-theme="light"] #icon-moon { display: block; }

    /* ========== Search modal ========== */
    .search-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 100;
      background: var(--overlay);
      backdrop-filter: blur(4px);
      align-items: flex-start;
      justify-content: center;
      padding-top: 15vh;
    }

    .search-overlay.open {
      display: flex;
    }

    .search-modal {
      width: 580px;
      max-width: 90vw;
      max-height: 420px;
      background: var(--search-bg);
      border-radius: 16px;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .search-input-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
    }

    .search-input-wrap svg {
      width: 20px;
      height: 20px;
      color: var(--text-tertiary);
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      font-family: var(--font-body);
      font-size: 16px;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text);
    }

    .search-input::placeholder {
      color: var(--text-dim);
    }

    .search-results {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .search-result {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background var(--transition);
    }

    .search-result:hover, .search-result.active {
      background: var(--bg-surface-hover);
    }

    .search-result-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 12px;
      font-weight: 600;
      font-family: var(--font-mono);
    }

    .search-result-icon.type-workflow { background: var(--accent-subtle); color: var(--accent); }
    .search-result-icon.type-step { background: var(--green-subtle); color: var(--green); }
    .search-result-icon.type-skill { background: var(--purple-subtle); color: var(--purple); }
    .search-result-icon.type-digest { background: var(--cyan-subtle); color: var(--cyan); }

    .search-result-text {
      flex: 1;
      min-width: 0;
    }

    .search-result-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .search-result-desc {
      font-size: 12px;
      color: var(--text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .search-empty {
      padding: 32px;
      text-align: center;
      color: var(--text-dim);
      font-size: 14px;
    }

    .search-hint {
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--text-dim);
      font-size: 11px;
      font-family: var(--font-mono);
    }

    .search-hint kbd {
      padding: 1px 5px;
      border-radius: 3px;
      background: var(--bg-surface);
      margin: 0 2px;
    }

    /* ========== Container ========== */
    .container {
      max-width: 920px;
      margin: 0 auto;
      padding: 100px 32px 80px;
    }

    /* ========== Page header ========== */
    .page-header {
      margin-bottom: 56px;
    }

    .page-header h1 {
      font-family: var(--font-headline);
      font-size: 48px;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: 16px;
    }

    .page-header .subtitle {
      font-size: 18px;
      color: var(--text-secondary);
      max-width: 520px;
      line-height: 1.6;
    }

    /* ========== Tab panes ========== */
    .tab-pane {
      display: none;
    }

    .tab-pane.active {
      display: block;
    }

    /* ========== List items (skills & digests) ========== */
    .list-group-items {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .list-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 20px;
      background: var(--bg-surface);
      border-radius: var(--radius);
      cursor: pointer;
      transition: all var(--transition);
    }

    .list-item:hover {
      background: var(--bg-surface-hover);
      transform: translateX(2px);
    }

    .list-item-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: var(--accent-subtle);
      color: var(--accent);
    }

    .list-item-icon svg {
      width: 18px;
      height: 18px;
    }

    .list-item-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .list-item-title {
      font-family: var(--font-mono);
      font-size: 14px;
      font-weight: 500;
      color: var(--text);
    }

    .list-item-desc {
      font-size: 12px;
      color: var(--text-tertiary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .list-item-chevron {
      color: var(--text-dim);
      flex-shrink: 0;
      transition: transform var(--transition);
    }

    .list-item-chevron svg {
      width: 14px;
      height: 14px;
    }

    .list-item:hover .list-item-chevron {
      color: var(--text-tertiary);
      transform: translateX(2px);
    }

    /* ── Detail panel ── */
    .detail-panel {
      display: none;
      animation: slideIn 0.2s ease;
    }

    .detail-panel.open {
      display: block;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateX(12px); }
      to { opacity: 1; transform: translateX(0); }
    }

    .detail-back {
      font-family: var(--font-body);
      font-size: 13px;
      color: var(--accent);
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px 0;
      margin-bottom: 16px;
      transition: color var(--transition);
    }

    .detail-back:hover {
      color: var(--text);
    }

    .detail-header {
      margin-bottom: 24px;
    }

    .detail-badge {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 500;
      padding: 3px 10px;
      border-radius: 6px;
      background: var(--accent-subtle);
      color: var(--accent);
      display: inline-block;
      margin-bottom: 8px;
      text-transform: capitalize;
    }

    .detail-title {
      font-family: var(--font-headline);
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    /* ── Empty states ── */
    .empty-state {
      text-align: center;
      padding: 64px 32px;
      color: var(--text-tertiary);
    }

    .empty-icon {
      margin-bottom: 16px;
    }

    .empty-icon svg {
      width: 40px;
      height: 40px;
      stroke: var(--text-dim);
    }

    .empty-state p {
      font-family: var(--font-headline);
      font-size: 16px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }

    .empty-state span {
      font-size: 13px;
    }

    /* ========== Markdown body (README, Skills, Digests) ========== */
    .markdown-body {
      font-family: var(--font-body);
      font-size: 15px;
      line-height: 1.7;
      color: var(--text);
      max-width: 720px;
    }

    .markdown-body h1 {
      font-family: var(--font-headline);
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0 0 16px;
      padding-bottom: 12px;
    }

    .markdown-body h2 {
      font-family: var(--font-headline);
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin: 40px 0 12px;
      padding-bottom: 8px;
    }

    .markdown-body h3 {
      font-family: var(--font-headline);
      font-size: 18px;
      font-weight: 600;
      margin: 32px 0 8px;
    }

    .markdown-body h4 {
      font-family: var(--font-headline);
      font-size: 15px;
      font-weight: 600;
      margin: 24px 0 8px;
    }

    .markdown-body p { margin: 0 0 16px; }
    .markdown-body ul, .markdown-body ol { margin: 0 0 16px; padding-left: 24px; }
    .markdown-body li { margin-bottom: 4px; }
    .markdown-body li > ul, .markdown-body li > ol { margin-top: 4px; margin-bottom: 0; }
    .markdown-body a { color: var(--accent); text-decoration: none; }
    .markdown-body a:hover { text-decoration: underline; }

    .markdown-body code {
      font-family: var(--font-mono);
      font-size: 13px;
      background: var(--bg-surface);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .markdown-body pre {
      background: var(--bg-surface);
      border-radius: var(--radius-sm);
      padding: 16px 20px;
      margin: 0 0 16px;
      overflow-x: auto;
    }

    .markdown-body pre code {
      background: none;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }

    .markdown-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 16px;
      font-size: 14px;
    }

    .markdown-body th, .markdown-body td {
      text-align: left;
      padding: 8px 12px;
    }

    .markdown-body th {
      font-weight: 600;
      background: var(--bg-surface);
    }

    .markdown-body strong { font-weight: 600; }

    .markdown-body hr {
      border: none;
      height: 1px;
      background: var(--bg-surface-hover);
      margin: 32px 0;
    }

    .markdown-body blockquote {
      border-left: 3px solid var(--accent);
      padding-left: 16px;
      margin: 0 0 16px;
      color: var(--text-secondary);
    }

    /* ========== Segment control (workflow sub-tabs) ========== */
    .segment-control {
      margin-bottom: 48px;
    }

    .segment-track {
      display: inline-flex;
      padding: 4px;
      background: var(--bg-surface);
      border-radius: 10px;
      gap: 2px;
    }

    .segment-btn {
      font-family: var(--font-headline);
      font-size: 14px;
      font-weight: 500;
      padding: 8px 24px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all var(--transition);
      color: var(--text-secondary);
      background: transparent;
    }

    .segment-btn:hover { color: var(--text); }

    .segment-count {
      font-family: var(--font-mono);
      font-size: 11px;
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: 8px;
      background: var(--border-ghost);
      color: var(--text-tertiary);
    }

    .segment-btn.active .segment-count {
      background: rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.9);
    }

    .segment-btn.active {
      background: var(--accent);
      color: #f8f7ff;
      box-shadow: 0 2px 8px rgba(0, 83, 219, 0.3);
    }

    /* ========== Workflow ========== */
    .workflow { margin-bottom: 80px; }

    .workflow-header { margin-bottom: 36px; }

    .workflow-title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .workflow-title {
      font-family: var(--font-headline);
      font-size: 30px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .workflow-desc {
      color: var(--text-secondary);
      font-size: 18px;
      margin-top: 8px;
      line-height: 1.6;
    }

    .workflow-meta {
      color: var(--text-tertiary);
      font-size: 12px;
      font-family: var(--font-mono);
      margin-top: 6px;
      letter-spacing: 0.02em;
    }

    /* ========== Phase timeline ========== */
    .phases-timeline { display: flex; flex-direction: column; }

    .phase {
      display: flex;
      gap: 24px;
      position: relative;
    }

    .phase-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-shrink: 0;
      width: 20px;
      padding-top: 4px;
    }

    .phase-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 12px var(--dot-glow);
      flex-shrink: 0;
      position: relative;
      z-index: 1;
    }

    .phase-line {
      width: 2px;
      flex: 1;
      background: var(--phase-line);
      margin-top: 4px;
    }

    .phase:last-child .phase-line { display: none; }

    .phase-body {
      flex: 1;
      padding-bottom: 52px;
      min-width: 0;
    }

    .phase:last-child .phase-body { padding-bottom: 0; }

    .phase-label {
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--accent);
      margin-bottom: 4px;
    }

    .phase-name {
      font-family: var(--font-headline);
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin-bottom: 20px;
    }

    /* ── Loop phase ── */
    .phase-loop .phase-body { position: relative; }

    .phase-loop .steps-container {
      border-left: 2px solid var(--loop-border);
      background: var(--loop-bg);
      border-radius: var(--radius);
      padding: 4px 0;
    }

    .phase-loop .phase-dot {
      background: var(--orange);
      box-shadow: 0 0 12px rgba(251, 146, 60, 0.4);
    }

    .loop-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--orange);
      font-size: 12px;
      font-weight: 500;
      font-family: var(--font-mono);
      margin-bottom: 12px;
      letter-spacing: 0.02em;
    }

    .loop-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    /* ========== Steps container ========== */
    .steps-container {
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
      border-radius: var(--radius);
      overflow: hidden;
    }

    /* ========== Single step ========== */
    .step {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 14px 20px;
      transition: background var(--transition);
    }

    .step:hover { background: var(--bg-surface-hover); }

    .step-type-col {
      flex-shrink: 0;
      padding-top: 2px;
      color: var(--text-tertiary);
    }

    .type-icon { width: 18px; height: 18px; }

    .step-main { flex: 1; min-width: 0; }

    .step-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .step-name { font-size: 14px; font-weight: 500; }

    .step-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .step-skill { margin-top: 4px; }

    .skill-ref {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--purple);
      background: var(--purple-subtle);
      padding: 2px 10px;
      border-radius: 4px;
      display: inline-block;
    }

    .step-command { margin-top: 4px; }

    .command-ref {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--orange);
      background: var(--orange-subtle);
      padding: 2px 10px;
      border-radius: 4px;
      display: inline-block;
    }

    .step-outputs {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed var(--border-ghost);
    }

    .output-icon { width: 14px; height: 14px; color: var(--text-dim); flex-shrink: 0; }

    .output-files { display: flex; gap: 8px; flex-wrap: wrap; }

    .output-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-tertiary);
      background: var(--bg-inset);
      padding: 3px 10px;
      border-radius: var(--radius-sm);
    }

    .file-icon { width: 12px; height: 12px; flex-shrink: 0; }

    .agent-pill {
      font-size: 11px;
      font-weight: 600;
      font-family: var(--font-mono);
      padding: 2px 10px;
      border-radius: 12px;
      letter-spacing: 0.03em;
    }

    .agent-claude { color: var(--green); background: var(--green-subtle); }
    .agent-codex { color: var(--orange); background: var(--orange-subtle); }

    .perm-badge {
      font-size: 11px;
      font-weight: 500;
      font-family: var(--font-mono);
      color: var(--red);
      background: var(--red-subtle);
      padding: 2px 8px;
      border-radius: 12px;
    }

    /* ========== Parallel group ========== */
    .parallel-group { margin: 4px 0; }

    .parallel-label {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 20px 4px;
      font-size: 11px;
      font-weight: 500;
      font-family: var(--font-mono);
      color: var(--cyan);
      letter-spacing: 0.04em;
    }

    .parallel-label-icon { width: 14px; height: 14px; }

    .parallel-grid {
      display: grid;
      gap: 2px;
      padding: 0 8px 8px;
    }

    .parallel-grid-2 { grid-template-columns: 1fr 1fr; }
    .parallel-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
    .parallel-grid-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }

    .parallel-col {
      background: var(--parallel-bg);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }

    .parallel-col .step { padding: 12px 16px; }

    /* ========== Clear divider ========== */
    .clear-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 20px;
    }

    .clear-line {
      flex: 1;
      height: 1px;
      background: repeating-linear-gradient(to right, var(--clear-line) 0px, var(--clear-line) 4px, transparent 4px, transparent 8px);
    }

    .clear-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-family: var(--font-mono);
      color: var(--text-dim);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .clear-icon { width: 12px; height: 12px; }

    /* ========== Footer ========== */
    footer {
      margin-top: 64px;
      padding-top: 24px;
      color: var(--text-dim);
      font-size: 12px;
      font-family: var(--font-mono);
      letter-spacing: 0.02em;
    }

    /* ========== Shortcuts modal ========== */
    .shortcuts-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 110;
      background: var(--overlay);
      backdrop-filter: blur(4px);
      align-items: center;
      justify-content: center;
    }

    .shortcuts-overlay.open {
      display: flex;
    }

    .shortcuts-modal {
      width: 480px;
      max-width: 90vw;
      background: var(--search-bg);
      border-radius: 16px;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }

    .shortcuts-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px 16px;
    }

    .shortcuts-header h3 {
      font-family: var(--font-headline);
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .shortcuts-close {
      background: none;
      border: none;
      color: var(--text-tertiary);
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition);
    }

    .shortcuts-close:hover {
      color: var(--text);
      background: var(--bg-surface-hover);
    }

    .shortcuts-close svg {
      width: 18px;
      height: 18px;
    }

    .shortcuts-body {
      padding: 0 24px 24px;
    }

    .shortcuts-section {
      margin-bottom: 20px;
    }

    .shortcuts-section:last-child {
      margin-bottom: 0;
    }

    .shortcuts-section-title {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 8px;
    }

    .shortcut-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
    }

    .shortcut-row + .shortcut-row {
      border-top: 1px solid var(--border-ghost);
    }

    .shortcut-label {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .shortcut-keys {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .shortcut-keys kbd {
      font-family: var(--font-mono);
      font-size: 12px;
      padding: 3px 8px;
      border-radius: 6px;
      background: var(--bg-surface);
      color: var(--text-secondary);
      min-width: 24px;
      text-align: center;
    }

    .shortcut-keys span {
      font-size: 11px;
      color: var(--text-dim);
    }

    /* ========== Review Mode ========== */
    body.review-mode .review-section {
      cursor: pointer;
      border-radius: var(--radius-sm);
      padding: 8px;
      margin: -8px;
      margin-bottom: 4px;
      transition: outline var(--transition), outline-offset var(--transition), background var(--transition);
    }

    body.review-mode .review-section:hover {
      outline: 2px dashed var(--accent);
      outline-offset: 2px;
      background: var(--accent-subtle);
    }

    body.review-mode .review-section.review-selected {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
      background: var(--accent-subtle);
    }

    .review-feedback {
      width: 100%;
      min-height: 80px;
      margin-top: 12px;
      padding: 12px 16px;
      font-family: var(--font-body);
      font-size: 14px;
      line-height: 1.5;
      color: var(--text);
      background: var(--bg-inset);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      resize: vertical;
      outline: none;
      transition: border-color var(--transition);
    }

    .review-feedback:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-subtle);
    }

    .review-feedback::placeholder {
      color: var(--text-dim);
    }

    .review-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 60;
      display: none;
      align-items: center;
      justify-content: space-between;
      padding: 12px 32px;
      background: var(--bg-nav);
      backdrop-filter: blur(16px) saturate(1.5);
      -webkit-backdrop-filter: blur(16px) saturate(1.5);
      border-top: 1px solid var(--border-ghost);
    }

    .review-bar.has-selections {
      display: flex;
    }

    .review-bar-left {
      font-size: 14px;
      color: var(--text-secondary);
      font-family: var(--font-body);
    }

    .review-bar-right {
      display: flex;
      gap: 8px;
    }

    .review-bar-btn {
      font-family: var(--font-headline);
      font-size: 13px;
      font-weight: 500;
      padding: 7px 16px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all var(--transition);
      color: var(--text-secondary);
      background: var(--bg-surface);
    }

    .review-bar-btn:hover {
      color: var(--text);
      background: var(--bg-surface-hover);
    }

    .review-bar-btn.primary {
      background: var(--accent);
      color: #f8f7ff;
    }

    .review-bar-btn.primary:hover {
      opacity: 0.9;
    }

    .review-toggle {
      color: var(--text-secondary);
      background: var(--bg-surface);
      border: none;
      padding: 8px;
      border-radius: 10px;
      cursor: pointer;
      transition: all var(--transition);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .review-toggle:hover {
      color: var(--text);
      background: var(--bg-surface-hover);
    }

    .review-toggle.active {
      color: var(--accent);
      background: var(--accent-subtle);
    }

    .review-toggle.has-saved::after {
      content: '';
      position: absolute;
      top: 6px;
      right: 6px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
    }

    .review-toggle svg {
      width: 18px;
      height: 18px;
    }

    /* ========== Responsive ========== */
    @media (max-width: 640px) {
      .container { padding: 80px 20px 48px; }
      nav { padding: 12px 16px; flex-wrap: wrap; gap: 8px; }
      .nav-left { gap: 16px; flex-wrap: wrap; }
      .nav-tabs { order: 3; width: 100%; overflow-x: auto; }
      .page-header h1 { font-size: 32px; }
      .workflow-title { font-size: 24px; }
      .phase-name { font-size: 20px; }
      .phase { gap: 16px; }
      .step-top-row { flex-direction: column; align-items: flex-start; gap: 6px; }
      .parallel-grid { grid-template-columns: 1fr !important; }
      .search-trigger span { display: none; }
      .search-trigger kbd { display: none; }
    }
  </style>
</head>
<body>
  <nav>
    <div class="nav-left">
      <div class="nav-brand">aw<span>docs</span></div>
      <div class="nav-tabs">
        <button class="tab-btn" data-tab="docs" onclick="selectTab('docs')">Docs</button>
        <button class="tab-btn" data-tab="workflows" onclick="selectTab('workflows')">Workflows</button>
        <button class="tab-btn" data-tab="skills" onclick="selectTab('skills')">Skills</button>
        <button class="tab-btn" data-tab="digests" onclick="selectTab('digests')">Digests</button>
      </div>
    </div>
    <div class="nav-right">
      <button class="review-toggle" id="reviewToggle" onclick="toggleReviewMode()" aria-label="Toggle review mode" title="Review mode (R)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="search-trigger" onclick="openSearch()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <span>Search</span>
        <kbd>\u2318K</kbd>
      </button>
      <button class="theme-btn" onclick="toggleTheme()" aria-label="Toggle theme">
        <svg id="icon-sun" class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <svg id="icon-moon" class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
    </div>
  </nav>

  <!-- Search modal -->
  <div class="search-overlay" id="searchOverlay" onclick="if(event.target===this)closeSearch()">
    <div class="search-modal">
      <div class="search-input-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input class="search-input" id="searchInput" type="text" placeholder="Search workflows, skills, digests\u2026" autocomplete="off" oninput="onSearchInput(this.value)">
      </div>
      <div class="search-results" id="searchResults"></div>
      <div class="search-hint">
        <span><kbd>\u2191</kbd><kbd>\u2193</kbd> navigate &nbsp; <kbd>\u21B5</kbd> select</span>
        <span><kbd>esc</kbd> close</span>
      </div>
    </div>
  </div>

  <!-- Shortcuts modal -->
  <div class="shortcuts-overlay" id="shortcutsOverlay" onclick="if(event.target===this)closeShortcuts()">
    <div class="shortcuts-modal">
      <div class="shortcuts-header">
        <h3>Keyboard Shortcuts</h3>
        <button class="shortcuts-close" onclick="closeShortcuts()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="shortcuts-body">
        <div class="shortcuts-section">
          <div class="shortcuts-section-title">Navigation</div>
          <div class="shortcut-row">
            <span class="shortcut-label">Docs</span>
            <div class="shortcut-keys"><kbd>1</kbd></div>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-label">Workflows</span>
            <div class="shortcut-keys"><kbd>2</kbd></div>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-label">Skills</span>
            <div class="shortcut-keys"><kbd>3</kbd></div>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-label">Digests</span>
            <div class="shortcut-keys"><kbd>4</kbd></div>
          </div>
        </div>
        <div class="shortcuts-section">
          <div class="shortcuts-section-title">Actions</div>
          <div class="shortcut-row">
            <span class="shortcut-label">Search</span>
            <div class="shortcut-keys"><kbd>\u2318</kbd><span>+</span><kbd>K</kbd></div>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-label">Toggle review mode</span>
            <div class="shortcut-keys"><kbd>R</kbd></div>
          </div>
          <div class="shortcut-row">
            <span class="shortcut-label">Show shortcuts</span>
            <div class="shortcut-keys"><kbd>?</kbd></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="container">
    <div class="page-header">
      <h1>Workflow Index</h1>
      <p class="subtitle">Declarative workflow definitions for orchestrating Claude Code and Codex agent sessions.</p>
    </div>

    <div class="tab-pane" data-tab-pane="docs">
      <div class="segment-control">
        <div class="segment-track">
          <button class="segment-btn" data-target="doc-readme" onclick="selectDoc('doc-readme')">README</button>
          <button class="segment-btn" data-target="doc-claude" onclick="selectDoc('doc-claude')">CLAUDE</button>
          <button class="segment-btn" data-target="doc-guidelines" onclick="selectDoc('doc-guidelines')">SKILL-GUIDELINES</button>
        </div>
      </div>
      <div class="doc-panel" data-doc="doc-readme">
        <div class="markdown-body" data-review-source="README.md" data-review-title="README">${readmeHtml}</div>
      </div>
      <div class="doc-panel" data-doc="doc-claude" style="display:none">
        <div class="markdown-body" data-review-source="CLAUDE.md" data-review-title="CLAUDE">${claudeMdHtml}</div>
      </div>
      <div class="doc-panel" data-doc="doc-guidelines" style="display:none">
        <div class="markdown-body" data-review-source="skills/SKILL-GUIDELINES.md" data-review-title="SKILL-GUIDELINES">${skillGuidelinesHtml}</div>
      </div>
    </div>

    <div class="tab-pane" data-tab-pane="workflows">
      <div class="segment-control">
        <div class="segment-track">
          ${segmentButtons}
        </div>
      </div>
      <div class="workflows-container">
        ${workflowsHtml}
      </div>
    </div>

    <div class="tab-pane" data-tab-pane="skills">
      <div class="skills-container">${skillsHtml}</div>
    </div>

    <div class="tab-pane" data-tab-pane="digests">
      <div class="digests-container">${digestsHtml}</div>
    </div>

    <footer>
      Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
    </footer>
  </div>

  <!-- Review bar -->
  <div class="review-bar" id="reviewBar">
    <div class="review-bar-left"><span id="reviewCount">0</span> section(s) selected</div>
    <div class="review-bar-right">
      <button class="review-bar-btn" onclick="clearReviewSelections()">Clear All</button>
      <button class="review-bar-btn primary" onclick="copyReviewToClipboard()">
        <svg style="width:14px;height:14px;vertical-align:-2px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy to Clipboard
      </button>
    </div>
  </div>

  <script>
    // ── Cached DOM refs ──
    var searchOverlayEl = document.getElementById('searchOverlay');
    var shortcutsOverlayEl = document.getElementById('shortcutsOverlay');
    var searchInputEl = document.getElementById('searchInput');
    var searchResultsEl = document.getElementById('searchResults');

    // ── Search index ──
    var searchIndex = ${JSON.stringify(searchEntries)};
    var searchActiveIdx = -1;
    var currentResults = [];

    function openSearch() {
      searchActiveIdx = -1;
      searchOverlayEl.classList.add('open');
      searchInputEl.value = '';
      searchInputEl.focus();
      onSearchInput('');
    }

    function closeSearch() {
      searchOverlayEl.classList.remove('open');
      searchActiveIdx = -1;
    }

    function onSearchInput(q) {
      q = q.toLowerCase().trim();
      if (!q) {
        currentResults = searchIndex.slice(0, 8);
      } else {
        currentResults = searchIndex.filter(function(r) {
          return r.title.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q);
        }).slice(0, 12);
      }
      if (!currentResults.length) {
        searchResultsEl.innerHTML = '<div class="search-empty">No results for \\u201C' + q + '\\u201D</div>';
        searchActiveIdx = -1;
        return;
      }
      searchResultsEl.innerHTML = currentResults.map(function(r, i) {
        return renderSearchResult(r, i);
      }).join('');
      searchActiveIdx = -1;
    }

    function renderSearchResult(r, idx) {
      var abbrev = { workflow: 'WF', step: 'ST', skill: 'SK', digest: 'DG' };
      return '<div class="search-result" data-idx="' + idx + '" onclick="executeSearch(' + idx + ')" onmouseenter="highlightSearch(' + idx + ')">' +
        '<div class="search-result-icon type-' + r.type + '">' + (abbrev[r.type] || '') + '</div>' +
        '<div class="search-result-text">' +
          '<div class="search-result-title">' + esc(r.title) + '</div>' +
          '<div class="search-result-desc">' + esc(r.desc) + '</div>' +
        '</div></div>';
    }

    function esc(s) {
      var d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    }

    function highlightSearch(idx) {
      searchActiveIdx = idx;
      searchResultsEl.querySelectorAll('.search-result').forEach(function(el, i) {
        el.classList.toggle('active', i === idx);
      });
    }

    function executeSearch(idx) {
      if (idx < 0 || idx >= currentResults.length) return;
      new Function(currentResults[idx].action)();
      closeSearch();
    }

    // ── Shortcuts modal ──
    function openShortcuts() {
      shortcutsOverlayEl.classList.add('open');
    }

    function closeShortcuts() {
      shortcutsOverlayEl.classList.remove('open');
    }

    // ── Unified keyboard handler ──
    var tabKeys = { '1': 'docs', '2': 'workflows', '3': 'skills', '4': 'digests' };

    document.addEventListener('keydown', function(e) {
      var searchOpen = searchOverlayEl.classList.contains('open');
      var shortcutsOpen = shortcutsOverlayEl.classList.contains('open');

      // Cmd+K always works — toggle search (close shortcuts first if open)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (shortcutsOpen) closeShortcuts();
        if (searchOpen) closeSearch();
        else openSearch();
        return;
      }

      // When shortcuts modal is open: only ? or Escape closes it
      if (shortcutsOpen) {
        if (e.key === 'Escape' || e.key === '?') {
          e.preventDefault();
          closeShortcuts();
        }
        return; // block everything else
      }

      // When search modal is open: only search-specific keys
      if (searchOpen) {
        if (e.key === 'Escape') { closeSearch(); return; }
        var items = document.querySelectorAll('.search-result');
        if (!items.length) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          searchActiveIdx = (searchActiveIdx + 1) % items.length;
          highlightSearch(searchActiveIdx);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          searchActiveIdx = searchActiveIdx <= 0 ? items.length - 1 : searchActiveIdx - 1;
          highlightSearch(searchActiveIdx);
        } else if (e.key === 'Enter' && searchActiveIdx >= 0) {
          e.preventDefault();
          executeSearch(searchActiveIdx);
        }
        return; // block everything else
      }

      // No modal open — handle global shortcuts
      // Skip if user is typing in an input/textarea
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

      // ? opens shortcuts
      if (e.key === '?') {
        e.preventDefault();
        openShortcuts();
        return;
      }

      // R toggles review mode
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        toggleReviewMode();
        return;
      }

      // 1-4 switch tabs
      if (!e.metaKey && !e.ctrlKey && !e.altKey && tabKeys[e.key]) {
        e.preventDefault();
        selectTab(tabKeys[e.key]);
        return;
      }
    });

    // ── Skill group selection (segment control) ──
    function selectSkillGroup(group) {
      document.querySelectorAll('.skill-group-panel').forEach(function(el) {
        el.style.display = el.dataset.skillGroup === group ? '' : 'none';
      });
      // Update segment buttons within the skills container
      var skillsPane = document.querySelector('[data-tab-pane="skills"]');
      skillsPane.querySelectorAll('.segment-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.target === group);
      });
      localStorage.setItem('aw-docs-skill-group', group);
    }

    // ── Detail panels (digests) ──
    function openDigestDetail(id) {
      var panel = document.getElementById(id);
      if (!panel) return;
      var container = panel.closest('.list-group-items');
      container.querySelectorAll('.list-item').forEach(function(el) {
        el.style.display = 'none';
      });
      panel.classList.add('open');
    }

    function closeDigestDetail(id) {
      var panel = document.getElementById(id);
      if (!panel) return;
      panel.classList.remove('open');
      var container = panel.closest('.list-group-items');
      container.querySelectorAll('.list-item').forEach(function(el) {
        el.style.display = '';
      });
    }

    // ── Skill detail panels ──
    function openSkillDetail(id) {
      var panel = document.getElementById(id);
      if (!panel) return;
      // Hide the segment control and list items in the active group panel
      var skillsPane = document.querySelector('[data-tab-pane="skills"]');
      skillsPane.querySelector('.segment-control').style.display = 'none';
      var groupPanel = panel.closest('.skill-group-panel');
      groupPanel.querySelectorAll('.list-item').forEach(function(el) {
        el.style.display = 'none';
      });
      panel.classList.add('open');
    }

    function closeSkillDetail(id, group) {
      var panel = document.getElementById(id);
      if (!panel) return;
      panel.classList.remove('open');
      // Restore the segment control and list items
      var skillsPane = document.querySelector('[data-tab-pane="skills"]');
      skillsPane.querySelector('.segment-control').style.display = '';
      var groupPanel = panel.closest('.skill-group-panel');
      groupPanel.querySelectorAll('.list-item').forEach(function(el) {
        el.style.display = '';
      });
    }

    // ── Theme ──
    function getTheme() { return localStorage.getItem("aw-docs-theme") || "dark"; }
    function applyTheme(t) {
      document.documentElement.setAttribute("data-theme", t);
      localStorage.setItem("aw-docs-theme", t);
    }
    function toggleTheme() { applyTheme(getTheme() === "dark" ? "light" : "dark"); }
    applyTheme(getTheme());

    // ── Top-level tab selection ──
    function selectTab(id) {
      document.querySelectorAll(".tab-pane").forEach(function(el) {
        el.classList.toggle("active", el.dataset.tabPane === id);
      });
      document.querySelectorAll(".tab-btn").forEach(function(btn) {
        btn.classList.toggle("active", btn.dataset.tab === id);
      });
      localStorage.setItem("aw-docs-tab", id);
    }

    // ── Docs sub-tab selection ──
    function selectDoc(id) {
      var docsPane = document.querySelector('[data-tab-pane="docs"]');
      docsPane.querySelectorAll('.doc-panel').forEach(function(el) {
        el.style.display = el.dataset.doc === id ? '' : 'none';
      });
      docsPane.querySelectorAll('.segment-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.target === id);
      });
      localStorage.setItem('aw-docs-doc', id);
    }

    // ── Workflow selection ──
    function selectWorkflow(id) {
      var pane = document.querySelector('[data-tab-pane="workflows"]');
      pane.querySelectorAll(".workflow").forEach(function(el) {
        el.style.display = el.dataset.workflow === id ? "" : "none";
      });
      pane.querySelectorAll(".segment-btn").forEach(function(btn) {
        btn.classList.toggle("active", btn.dataset.target === id);
      });
      localStorage.setItem("aw-docs-workflow", id);
    }

    // ── Review mode ──
    var reviewSelections = {}; // { id: feedback }
    var reviewToggleEl = document.getElementById('reviewToggle');
    var reviewBarEl = document.getElementById('reviewBar');
    var reviewCountEl = document.getElementById('reviewCount');
    var saveDebounceTimer;

    // Content before the first heading is wrapped as its own section.
    function segmentMarkdownBody(mdBody) {
      if (mdBody.dataset.segmented) return;
      mdBody.dataset.segmented = '1';

      var source = '';
      var parentTitle = '';
      var srcEl = mdBody.closest('[data-review-source]');
      if (srcEl) {
        source = srcEl.dataset.reviewSource || '';
        parentTitle = srcEl.dataset.reviewTitle || '';
      }

      var children = Array.from(mdBody.children);
      if (!children.length) return;

      var groups = [];
      var current = { heading: null, nodes: [] };

      children.forEach(function(node) {
        var tagName = (node.tagName || '').toLowerCase();
        var isHeading = /^h[1-6]$/.test(tagName);
        if (isHeading) {
          if (current.nodes.length) groups.push(current);
          current = { heading: node, nodes: [node] };
        } else {
          current.nodes.push(node);
        }
      });
      if (current.nodes.length) groups.push(current);

      // If the whole body is one group with no heading, make it one section
      // using the parent title.
      groups.forEach(function(g, idx) {
        var wrapper = document.createElement('div');
        wrapper.className = 'review-section';

        var sectionTitle = g.heading ? g.heading.textContent.trim() : (parentTitle || 'Introduction');
        var sectionId = source + '/' + sectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
        wrapper.dataset.reviewId = sectionId;
        wrapper.dataset.reviewTitle = sectionTitle;
        wrapper.dataset.reviewSource = source;

        // Insert wrapper before first node in group, then move nodes in
        mdBody.insertBefore(wrapper, g.nodes[0]);
        g.nodes.forEach(function(n) { wrapper.appendChild(n); });
      });
    }

    function unsegmentAll() {
      document.querySelectorAll('.review-section').forEach(function(wrapper) {
        var parent = wrapper.parentNode;
        // Remove textarea children (feedback) before unwrapping
        var ta = wrapper.querySelector('.review-feedback');
        if (ta) ta.remove();
        while (wrapper.firstChild) {
          parent.insertBefore(wrapper.firstChild, wrapper);
        }
        parent.removeChild(wrapper);
        if (parent.dataset.segmented) delete parent.dataset.segmented;
      });
    }

    function segmentAllVisible() {
      document.querySelectorAll('.markdown-body').forEach(function(mdBody) {
        segmentMarkdownBody(mdBody);
      });
    }

    function toggleReviewMode() {
      var isActive = document.body.classList.toggle('review-mode');
      reviewToggleEl.classList.toggle('active', isActive);
      if (isActive) {
        segmentAllVisible();
        // Restore visual state for saved selections
        Object.keys(reviewSelections).forEach(function(id) {
          var el = document.querySelector('[data-review-id="' + id + '"]');
          if (el) {
            el.classList.add('review-selected');
            showFeedbackTextarea(el, id);
          }
        });
        updateReviewBar();
      } else {
        document.querySelectorAll('.review-feedback').forEach(function(ta) {
          var section = ta.closest('.review-section');
          if (section) reviewSelections[section.dataset.reviewId] = ta.value;
        });
        saveReviewState();
        unsegmentAll();
        reviewBarEl.classList.remove('has-selections');
      }
    }

    // Click delegation for review mode
    document.querySelector('.container').addEventListener('click', function(e) {
      if (!document.body.classList.contains('review-mode')) return;

      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'button' || tag === 'input' || tag === 'a') return;
      if (e.target.closest('.review-bar') || e.target.closest('.list-item') || e.target.closest('.detail-back') || e.target.closest('.segment-control')) return;

      var el = e.target.closest('.review-section');
      if (!el) return;

      e.preventDefault();
      e.stopPropagation();

      var id = el.dataset.reviewId;

      if (el.classList.contains('review-selected')) {
        // Deselect
        el.classList.remove('review-selected');
        var ta = el.querySelector('.review-feedback');
        if (ta) ta.remove();
        delete reviewSelections[id];
      } else {
        // Select
        el.classList.add('review-selected');
        if (!reviewSelections[id]) reviewSelections[id] = '';
        showFeedbackTextarea(el, id);
      }
      updateReviewBar();
      saveReviewState();
    });

    function showFeedbackTextarea(el, id) {
      if (el.querySelector('.review-feedback')) return;
      var ta = document.createElement('textarea');
      ta.className = 'review-feedback';
      ta.placeholder = 'Describe requested changes\\u2026';
      ta.value = reviewSelections[id] || '';
      ta.addEventListener('input', function() {
        reviewSelections[id] = ta.value;
        clearTimeout(saveDebounceTimer);
        saveDebounceTimer = setTimeout(saveReviewState, 400);
      });
      ta.addEventListener('click', function(ev) { ev.stopPropagation(); });
      el.appendChild(ta);
    }

    function updateReviewBar() {
      var count = Object.keys(reviewSelections).length;
      reviewCountEl.textContent = count;
      reviewBarEl.classList.toggle('has-selections', count > 0 && document.body.classList.contains('review-mode'));
    }

    function clearReviewSelections() {
      document.querySelectorAll('.review-selected').forEach(function(el) {
        el.classList.remove('review-selected');
        var ta = el.querySelector('.review-feedback');
        if (ta) ta.remove();
      });
      reviewSelections = {};
      updateReviewBar();
      saveReviewState();
      reviewToggleEl.classList.remove('has-saved');
    }

    function writeToClipboard(text) {
      // navigator.clipboard requires HTTPS or localhost; fall back for file://
      if (navigator.clipboard && navigator.clipboard.writeText && location.protocol !== 'file:') {
        return navigator.clipboard.writeText(text);
      }
      return new Promise(function(resolve) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      });
    }

    function copyReviewToClipboard() {
      var ids = Object.keys(reviewSelections);
      if (!ids.length) return;

      var lines = ['# Review Feedback', '', 'Sections reviewed: ' + ids.length, ''];

      ids.forEach(function(id) {
        var feedback = reviewSelections[id] || '(no feedback provided)';
        var el = document.querySelector('[data-review-id="' + id + '"]');
        if (!el) return;

        var source = el.dataset.reviewSource || '';
        var title = el.dataset.reviewTitle || id;

        // Temporarily detach textarea to get clean textContent
        var ta = el.querySelector('.review-feedback');
        if (ta) ta.parentNode.removeChild(ta);
        var sectionText = el.textContent.trim();
        if (ta) el.appendChild(ta);

        lines.push('---', '');
        if (source) lines.push('**File:** ' + source);
        lines.push('**Section:** ' + title, '');
        if (sectionText) {
          lines.push('### Current Content', '');
          lines.push(sectionText, '');
        }
        lines.push('### Feedback', '');
        lines.push(feedback, '');
      });

      lines.push('---', '');
      lines.push('## Instructions', '');
      lines.push('Please revise each section above according to its "Requested Changes" / "Feedback".');
      lines.push('Return the updated content in the same markdown format.');

      var text = lines.join('\\n');
      writeToClipboard(text).then(function() {
        var btn = reviewBarEl.querySelector('.primary');
        var orig = btn.innerHTML;
        btn.innerHTML = '<svg style="width:14px;height:14px;vertical-align:-2px;margin-right:4px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copied!';
        setTimeout(function() { btn.innerHTML = orig; }, 2000);
      }).catch(function(err) {
        alert('Copy failed: ' + err.message + '. Try selecting text manually.');
      });
    }

    function saveReviewState() {
      try {
        localStorage.setItem('aw-docs-review', JSON.stringify(reviewSelections));
      } catch(e) {}
      reviewToggleEl.classList.toggle('has-saved', Object.keys(reviewSelections).length > 0);
    }

    function loadReviewState() {
      try {
        var saved = localStorage.getItem('aw-docs-review');
        if (saved) {
          reviewSelections = JSON.parse(saved);
        }
      } catch(e) {}
    }

    // ── Init ──
    (function() {
      var tabBtns = document.querySelectorAll(".tab-btn");
      var validTabs = Array.from(tabBtns).map(function(b) { return b.dataset.tab; });
      var savedTab = localStorage.getItem("aw-docs-tab");
      if (savedTab === "readme") savedTab = "docs"; // migrate old value
      var tab = validTabs.includes(savedTab) ? savedTab : "docs";
      selectTab(tab);

      // Restore docs sub-tab selection
      var docPanels = document.querySelectorAll('.doc-panel');
      if (docPanels.length) {
        var validDocs = Array.from(docPanels).map(function(p) { return p.dataset.doc; });
        var savedDoc = localStorage.getItem('aw-docs-doc');
        var docTarget = validDocs.includes(savedDoc) ? savedDoc : validDocs[0];
        selectDoc(docTarget);
      }

      // Restore workflow selection
      var wfBtns = document.querySelectorAll('.workflows-container').length
        ? document.querySelectorAll('[data-tab-pane="workflows"] .segment-btn')
        : [];
      if (wfBtns.length) {
        var savedWf = localStorage.getItem("aw-docs-workflow");
        var validWfIds = Array.from(wfBtns).map(function(b) { return b.dataset.target; });
        var wfTarget = validWfIds.includes(savedWf) ? savedWf : validWfIds[0];
        selectWorkflow(wfTarget);
      }

      // Restore skill group selection
      var skillPanels = document.querySelectorAll('.skill-group-panel');
      if (skillPanels.length) {
        var validGroups = Array.from(skillPanels).map(function(p) { return p.dataset.skillGroup; });
        var savedGroup = localStorage.getItem('aw-docs-skill-group');
        var skillTarget = validGroups.includes(savedGroup) ? savedGroup : validGroups[0];
        selectSkillGroup(skillTarget);
      }

      // Restore review state
      loadReviewState();
      if (Object.keys(reviewSelections).length > 0) {
        reviewToggleEl.classList.add('has-saved');
      }
    })();
  </script>
</body>
</html>`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "index.html"), html, "utf-8");
console.log(`Generated .aw/docs/index.html with ${workflows.length} workflow(s)`);

import { readdirSync, readFileSync, existsSync, lstatSync, symlinkSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface SkillInfo {
  name: string;
  category: string;
  description: string;
  sourcePath: string;
  linked: boolean;
}

const GLOBAL_SKILLS_DIR = join(homedir(), ".claude", "skills");

function parseSkillDescription(skillMdPath: string): string {
  try {
    const raw = readFileSync(skillMdPath, "utf-8");
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return "";
    const descMatch = match[1].match(/description:\s*["']?(.*?)["']?\s*$/m);
    return descMatch ? descMatch[1] : "";
  } catch {
    return "";
  }
}

export function discoverSkills(awRoot: string): SkillInfo[] {
  const skillsRoot = join(awRoot, "skills");
  const results: SkillInfo[] = [];

  let categories: string[];
  try {
    categories = readdirSync(skillsRoot).filter(
      (name) => !name.startsWith(".") && existsSync(join(skillsRoot, name)),
    );
  } catch {
    return [];
  }

  for (const category of categories) {
    const categoryDir = join(skillsRoot, category);
    let entries: string[];
    try {
      entries = readdirSync(categoryDir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const sourcePath = join(categoryDir, name);
      const skillMdPath = join(sourcePath, "SKILL.md");
      if (!existsSync(skillMdPath)) continue;

      const description = parseSkillDescription(skillMdPath);
      const globalLink = join(GLOBAL_SKILLS_DIR, name);
      let linked = false;
      try {
        if (lstatSync(globalLink).isSymbolicLink()) linked = true;
      } catch {}

      results.push({ name, category, description, sourcePath, linked });
    }
  }

  return results.sort((a, b) =>
    a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}

/**
 * Symlink generic skills into a target directory's .claude/skills/.
 * Called with awRoot at startup, and again with the worktree cwd
 * before running steps so skills are available where Claude Code runs.
 */
export function autoLinkGenericSkills(awRoot: string, targetDir?: string): void {
  const genericDir = join(awRoot, "skills", "generic");
  const skillsDir = join(targetDir || awRoot, ".claude", "skills");
  mkdirSync(skillsDir, { recursive: true });

  let entries: string[];
  try {
    entries = readdirSync(genericDir);
  } catch {
    return;
  }

  for (const name of entries) {
    const sourcePath = join(genericDir, name);
    const skillMdPath = join(sourcePath, "SKILL.md");
    if (!existsSync(skillMdPath)) continue;

    const link = join(skillsDir, name);
    try {
      if (lstatSync(link).isSymbolicLink()) continue;
    } catch {}

    try {
      symlinkSync(sourcePath, link);
    } catch {}
  }
}

export function applySkillLinks(
  skills: SkillInfo[],
  selections: Map<string, boolean>,
): void {
  mkdirSync(GLOBAL_SKILLS_DIR, { recursive: true });

  for (const skill of skills) {
    const desired = selections.get(skill.name);
    if (desired === undefined) continue;

    const globalLink = join(GLOBAL_SKILLS_DIR, skill.name);

    if (desired && !skill.linked) {
      try {
        symlinkSync(skill.sourcePath, globalLink);
      } catch {}
    } else if (!desired && skill.linked) {
      try {
        if (lstatSync(globalLink).isSymbolicLink()) unlinkSync(globalLink);
      } catch {}
    }
  }
}

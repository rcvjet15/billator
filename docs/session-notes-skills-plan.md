# Plan: Native opencode session-note + read-session-notes skills

> Status: **DRAFT — not yet implemented.** Written to capture the agreed design
> so we can return to it later. Ask the user before executing; opencode must be
> restarted after the skills/config are created for them to load.

## Goal

Give opencode two **native** skills that read/write a personal knowledge base
(the "library") stored under `~/robi-stuff/`, modeled on the proven
Claude-agent skills already in `~/.claude/skills/` but rebuilt for opencode
(frontmatter `name` + `description`, `SKILL.md`).

Rationale: the Claude skills under `~/.claude/skills/` do **not** load in this
opencode environment, so we need opencode-native skills. opencode auto-loads
global skills from `~/.config/opencode/skill(s)/<name>/SKILL.md` and/or from
custom `skills.paths`.

## Agreed decisions

- **Skills home:** system-global → `~/.config/opencode/skills/<name>/SKILL.md`
  (always available across projects). Only the **knowledge-base content** lives
  inside robi-stuff.
- **KB root location:** `~/robi-stuff/session-notes/`
- **Path discovery:** a shared config file that both skills read every run:
  `~/.config/opencode/session-notes-config.json` →
  `{ "docs_root": "/Users/rcvjetkovic/robi-stuff/session-notes" }`
- **docs_root:** `/Users/rcvjetkovic/robi-stuff/session-notes`
- **robis-stuff KB directory name:** `session-notes`
- **File tree to seed:** per-project subdirs for `billator` and
  `kika-dario-bikes`, plus `general/` for cross-project notes, each with an
  `_index.md`; a top-level `_index.md` + a `CONVENTIONS.md` as source of truth.

## Layout to create

```
# 1) Native opencode skills (global)
~/.config/opencode/skills/
  write-session-notes/SKILL.md     # <-- naming: see open question below
  read-session-notes/SKILL.md

# 2) Shared root config read by both skills
~/.config/opencode/session-notes-config.json
  { "docs_root": "/Users/rcvjetkovic/robi-stuff/session-notes" }

# 3) The robi-stuff knowledge base (content created under this tree)
~/robi-stuff/session-notes/
  _index.md                        # top-level index (layout + subdir descriptions)
  CONVENTIONS.md                   # frontmatter + _index rules (source of truth)
  general/_index.md                # cross-project notes
  billator/_index.md               # billator notes
  kika-dario-bikes/_index.md       # kika notes
```

## Skill contents (adapted from the working Claude skills)

Both skills are rewrites of `~/.claude/skills/write-session-note/SKILL.md` and
`~/.claude/skills/read-session-notes/SKILL.md`, adjusted to opencode idioms
(no Claude-specific framing; tools are `read`/`grep`/`bash` via this client).
Use YAML **frontmatter** with `name` and `description` (opencode requires both;
description should cover *what* and *when to trigger*).

### write-session-notes

Core flow:
1. **Load config** — read `session-notes-config.json` for `docs_root`;
   verify it exists (`test -d`). If missing, run the first-run bootstrap:
   probe `~/robi-stuff/session-notes`, `~/git/service-ai-docs`,
   `~/notes/...`; ask the user; persist config as a real absolute path.
2. **Choose subdir** — current project (`~/robi-stuff/<project>`) → matching
   `<project>/` in the KB; cross-cutting → `general/`; if unclear → ASK.
3. **Filename** — kebab-case, descriptive; append `-YYYY-MM-DD` only for
   dated investigations; avoid generics (`notes.md`, `readme.md`).
   Check for duplicates first; ask about appending vs. a new file.
4. **Mandatory YAML frontmatter** (all but `related` required):
   ```yaml
   ---
   title: One-line human title
   project: <subdir name>
   type: howto | investigation | reference | knowledge-base | plan | postmortem
   created: YYYY-MM-DD
   summary: |
     2-4 sentences, written for a stranger; dense.
   keywords: [lowcase, kebab, entity-names, table-names, ticket-ids]
   related:
     - <subdir>/other-file.md
   ---
   ```
   No TOC macros, no line-number maps, no fabricated `related`.
5. **Update `_index.md`**:
   - exists → insert your line, alphabetically.
   - missing and file count now ≥ 8 → create it + adjust top-level `_index.md`.
   - missing and still < 8 → update the top-level inline listing instead.
6. **Verify** — `head -20` shows full frontmatter; required keys present;
   summary/kewwords are real (grep-able), `type` is in the allowed list.
   When a subdir doesn't exist yet → `mkdir`, add a line to `_index.md`, and add
   a "Session Notes Location" pointer to that project's `CLAUDE.md`/`AGENTS.md`.

Do NOT write: chat-only answers (unless asked), production code docs better
suited to the repo itself, transient "read-me-back" notes, or anything with
secrets/credentials.

### read-session-notes

Core principle: **index-first**, never read a full file until an index (or
`grep --include=_index.md`) says it's the right one. Use YAML summaries/tags as
the pre-filter in the `_index.md` tag brackets
`[type, keyword1, keyword2, …]`.

Flow:
1. **Load config** (same file as writer). Missing → tell the user we must
   configure it first (delegate to writer's first-run), do NOT guess a path.
2. **Entry point** by how narrow the query is:
   - named a project → `cat <docs_root>/<project>/_index.md` (and any nested
     `_index.md` like `assetspro/`).
   - named a concept/class/ticket, no project → tag grep across indexes:
     `grep -rH '<term>' <docs_root> --include=_index.md`
     (full recursive path catches nested indexes).
   - broad "what do we have on X" → `cat <docs_root>/_index.md` first.
3. **Read indexes, not files** (they're small); use `[type, k1, k2]` brackets to
   decide the 1-2 real candidates. If 5+ candidates → query is too broad, narrow.
4. **Read only candidates.** If a file is < 10 KB read it whole; else
   `head -20` for the frontmatter summary first.
5. **Cross-ref `related:`** from whichever file answers.
6. Anti-patterns: no full-body grep as first move; no re-reading a file already
   in context; no `ls`-and-blind-Read to browse a subdir; never answer from
   training-data memory about these private notes.

## Open question (pick before executing)

- Skill naming: the established skill id is **singular** `write-session-note`,
  but the user asked for **`write-session-notes`** and **`read-session-notes`**.
  frontmatter `name` must equal the folder name. Decide once (default if not
  told otherwise: plural `write-session-notes` + `read-session-notes`, matching
  how the user phrased it).

## Steps to execute when we return to it

1. Confirm skill names (singular vs plural) with the user.
2. `mkdir -p` the skill + KB dirs.
3. Write the two `SKILL.md` files.
4. Write `~/.config/opencode/session-notes-config.json`.
5. Bootstrap `~/robi-stuff/session-notes/` (`_index.md`, `CONVENTIONS.md`,
   subdir `_index.md` files for `billator`, `kika-dario-bikes`, `general`).
6. Optionally seed a first billator note distilled from this repo session as a
   live example.
7. Tell the user to **restart opencode** (skills/config load at startup).
8. Smoke-test: write a tiny `general/` stub, then read it back through the skill.

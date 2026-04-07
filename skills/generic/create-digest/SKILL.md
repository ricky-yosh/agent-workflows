---
name: create-digest
description: "Distill a document into a tight, journalist-style digest. Use when the user wants a summary, digest, or readable version of any document — specs, research notes, meeting transcripts, technical docs, PRDs, RFCs, or anything verbose that needs to be made concise and human. Also use when the user says /create-digest or asks to 'make this readable' or 'give me the highlights'."
---

# Create Digest

Turn a document into something people actually want to read.

## What this does

You take a source document — could be a spec, research notes, a long thread, meeting minutes, a technical RFC, anything — and produce a digest that captures everything important in a fraction of the words. The digest reads like a well-edited magazine piece: clear, direct, no filler.

## The voice

Write like a journalist at a good publication. That means:

- **Lead with the headline.** The single most important thing goes first. Not background, not methodology, not "this document covers..." — the news. What matters and why.
- **Every sentence earns its place.** If a sentence doesn't add information the reader needs, cut it. "It should be noted that" is seven words that say nothing. "Interestingly" is the writer clearing their throat. Kill them.
- **Short paragraphs, strong verbs.** Prefer active voice. Prefer concrete over abstract. "The sync engine retries three times before surfacing an error" beats "Error handling is performed by the synchronization subsystem through a retry mechanism."
- **Tell the story.** Even technical content has a narrative: there's a problem, an approach, tensions, tradeoffs, a resolution. Find that thread and follow it. Readers remember stories. They forget bullet lists.
- **No bloat words.** Strip out "basically", "essentially", "in order to", "it is important to note", "as mentioned above", "leveraging", "utilizing". Say the thing directly.
- **Use the simplest words that work.** Write so the reader never has to re-read a sentence. Prefer everyday words over formal ones — "use" not "utilize", "start" not "initiate", "show" not "demonstrate". When a technical term is the right word, keep it — but bridge the reader there. A short analogy or plain-language aside ("think of it like...") costs five words and saves the reader from guessing. The goal is low cognitive load, not dumbed-down content.

## How to produce the digest

1. **Read the source.** Read the entire document. Don't skim — you need to understand what matters before you can decide what to cut.

2. **Find the spine.** What's the one thing this document is really about? Everything in your digest should connect back to that central thread. Side points get a sentence or get cut.

3. **Write the digest.** Structure it naturally — not as a mechanical extraction of sections from the original, but as a piece that flows. Use headers when they help the reader navigate, not as decoration. A 2-page spec might need zero headers. A 30-page RFC might need four.

4. **Cut 20% more.** Your first draft is too long. It always is. Read it again and find the sentences that repeat what an earlier sentence already implied. Find the qualifiers that add nothing ("somewhat", "relatively", "in most cases"). Remove them.

5. **Save it.** Write the digest to `.aw/digests/` as a markdown file. Name it based on what was digested: `spec-digest.md`, `research-digest.md`, `rfc-digest.md`, etc. If there's already a file with that name, ask the user before overwriting.

6. **One line in the terminal.** Don't summarize the digest you just wrote — the user will read the file. Just confirm where it is:

   > Digest saved to `.aw/digests/[name]-digest.md`

## What to preserve, what to cut

**Always keep:**
- Decisions and their rationale (the "why" is often more valuable than the "what")
- Constraints, tradeoffs, and things that were explicitly ruled out
- Numbers, dates, names — concrete facts
- Open questions and unresolved risks

**Usually cut:**
- Background the audience already knows
- Process descriptions ("first we met, then we discussed...")
- Redundant examples (one good example beats three okay ones)
- Hedging language and caveats that don't change the substance
- Meta-commentary about the document itself

## Structural fidelity

Match the shape of the source. When the original is a sequence — tasks, steps, phases, a checklist — keep the items as a scannable list. Use the journalist voice for framing and context *around* the list, but don't melt individual items into paragraphs. A one-line description per item beats a paragraph that buries the same information.

The rule: if the reader will come back to this digest to check progress or find a specific item, structure wins over narrative. Lists stay lists. Tables stay tables. Sequences stay numbered.

## Length

No fixed rule. A good digest of a 1-page doc might be 3 sentences. A good digest of a 50-page RFC might be 2 pages. The right length is the shortest version that doesn't lose anything the reader needs. Aim for roughly 20-30% of the original length as a starting point, then let the content dictate.

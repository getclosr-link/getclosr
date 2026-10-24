# Agent Instructions

## Iron Law: land the work, don't just report it

Before every session end, every "I'll stop here" and every blocked message: **commit and push first, then report.** A handover text does not replace a commit. The text disappears with the session; an unsaved working tree stays behind.

- **Done means pushed.** A task is only finished when `git status` is clean and `git log @{u}..HEAD` is empty.
- **Save unfinished work as a WIP commit.** A commit whose message names what is still unchecked beats a lost working tree.
- **Land in between during long "continue" chains**, not only at the end.
- **Rate-limit, `overloaded` and compaction messages announce a hard stop.** Save immediately.

## Language: English only

Everything that lands in this repo is English: UI copy, code comments, docs, tests, commit messages, PR titles, PR bodies, issues and all comments (including automated triage runs). Chat with the maintainers may stay German.

Skill routing is defined globally in `~/.claude/CLAUDE.md`; don't duplicate it here.

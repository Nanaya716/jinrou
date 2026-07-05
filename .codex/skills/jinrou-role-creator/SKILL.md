---
name: jinrou-role-creator
description: Add or modify roles in the E:\Code\jinrou Node.js SocketStream werewolf game. Use when Codex needs to implement a new game role, wire role metadata, server CoffeeScript behavior, night resolution order, ordinary or special React TSX job forms, Jade manual pages, and language YAML text for this repository.
---

# Jinrou Role Creator

Use this skill to implement a new role in this repository from a behavior description.

## Workflow

1. Read `references/role-addition-guide.md` before editing. It contains the project-specific file map, server hooks, form protocol, and validation checklist.
2. Choose a stable ASCII role id, usually an English PascalCase noun phrase, and use it consistently across CoffeeScript, YAML, TSX, and manual files.
3. Classify the role before coding:
   - main role vs. `Complex` status/sub-role
   - visible team vs. win conditions
   - fortune/psychic results
   - human/werewolf/vampire final count
   - night timing via `midnightSort`
   - ordinary form vs. custom TSX form
4. Implement the server behavior first in `server/rpc/game/game.coffee`, then wire shared metadata in `client/code/shared/game.coffee`.
5. Add `language/ja/roles.yaml`, `language/ja/game_client_form.yaml`, and `manual/ja/jobs/<RoleId>.jade` text.
6. For special forms, update `front/src/pages/game-view/job-forms/types.ts`, `index.tsx`, and add a focused `<role>.tsx`.
7. Validate with static searches for the role id, CoffeeScript syntax if available, and `cd front; npm run test:manual-build` when front-end files changed.

## Guardrails

- Preserve existing role behavior and shared flow; avoid broad refactors.
- Do not add a custom TSX form when the normal radio-target form is enough.
- For roles whose player-facing role name/type is disguised, keep `getJobname()` as the true GM/openjob name and override `getJobDisp()`/`getTypeDisp()` for the player's displayed name/type.
- Keep `isWinner` aligned with `Game.judge`: the winning team is computed once, then each player decides whether they personally won.
- If a role is fox-like but hidden from fox allies, override fox visibility, fox chat, and fox log listening explicitly.
- If a role adds or removes `Complex` wrappers, verify `accessByJobTypeAll`, `isWinner`, and serialization still work when the role itself becomes wrapped.

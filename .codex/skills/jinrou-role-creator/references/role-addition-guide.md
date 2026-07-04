# Jinrou Role Addition Guide

## Core Files

- `client/code/shared/game.coffee`
  - `exports.jobs`: add ordinary selectable role ids.
  - `exports.hiddenJobs`: add non-selectable generated roles only.
  - `exports.nonhumans`: add roles that should count as non-human for UI/filtering.
  - `exports.blacks`: add roles whose fortune result is werewolf.
  - `exports.teams`: add role to every useful setup team bucket. A role can appear in multiple setup buckets if it belongs to multiple selection categories.
  - `exports.categories`: add role to yaminabe/manual selection categories.
  - `exports.gachaData`: add if the role should be obtainable from GachaAddicted.
  - `exports.jobrules`: add if fixed templates should include the role.
  - `exports.jobinfo`: add display color under the visible category.
  - `exports.jobinfos`: add only if the role exposes a new info panel field.

- `server/rpc/game/game.coffee`
  - Define the role class near similar roles.
  - Add it to `jobs=`.
  - Add it to role strength/random priority table near similar roles.
  - Add to special exclusion lists where behavior demands it, such as first-night automatic divination fox exclusions.
  - For status/sub-role behavior, define `class X extends Complex` and add it to `complexes=`.

- `language/ja/roles.yaml`
  - `jobname.<RoleId>` for display name.
  - `<RoleId>:` for ability logs, result logs, and errors.
  - `fortune` / `psychic` only when adding new result codes.

- `language/ja/game_client_form.yaml`
  - `messages.<RoleId>` for ordinary forms.
  - `specialName.<FormType>` and a `<RoleId>:` block for custom TSX forms.

- `manual/ja/jobs/<RoleId>.jade`
  - Add the role manual page.

## Server Role Hooks

Use `Player` defaults unless behavior needs overrides:

- Identity and team: `type`, `team`, `getTeam`, `getTeamDisp`, `getJobname`, `getJobDisp`.
- Judgement: `isHuman`, `isWerewolf`, `isFox`, `isVampire`, `humanCount`, `werewolfCount`, `vampireCount`, `isWinner`.
- Results: `fortuneResult`, `psychicResult`, `getFortuneResult`, `getPsychicResult`.
- Death and resistance: `hasDeadResistance`, `checkDeathResistance`, `hasDeadlyWeapon`, `die`, `dying`, `divined`, `whenguarded`, `beforebury`.
- Night timing: `midnightSort`, `sunset`, `midnight`, `deadnight`, `midnightAlways`, `sunrise`.
- Forms: `formType`, `job_target`, `sleeping`, `jobdone`, `makeJobSelection`, `checkJobValidity`, `getOpenForms`, `isFormTarget`, `job`.
- Visibility and chat: `getVisibilityQuery`, `isListener`, `isPrivateLogListener`, `getSpeakChoice`, `getSpeakChoiceDay`.

Night resolution collects all `gatherMidnightSort()` values, adds fixed `105` for werewolf attacks and `106` for Dracula, sorts ascending, then calls the relevant night hooks. Default `midnightSort` is `100`; guards tend to be around `80`.

## Death Reasons and Guardable Attacks

Death and guard behavior is keyed by `found` strings and the `Found` helpers near the top of `server/rpc/game/game.coffee`. Do not reuse an existing death reason just because the public death message looks similar; the same string can also drive retaliation, resistance, guardability, EyesWolf guard logs, Emma results, and hidden death-detail logs.

- `Found.isGuardableAttack(found)` controls ordinary guard-family protection. It is used by `Guarded`, `TrapGuarded`, and `SamuraiGuarded`.
- `Found.isGuardableWerewolfAttack(found)` controls guard-log reasons for attacks treated like a werewolf attack by EyesWolf. By default this is narrower than all werewolf-like deaths.
- `Found.isNormalWerewolfAttack(found)` controls normal werewolf-bite behavior such as fox bite resistance, poisoner/cat retaliation, cover behavior, and several role-specific reactions.
- `Found.isWerewolfAttack(found)` is a broader category used for effects that should react to any werewolf-attack death reason, including secondary deaths.

When adding a new active attack that should be guardable but should not trigger Cat/Poisoner bite retaliation, add a new `found` string and include it in `Found.isGuardableAttack`, but keep it out of `Found.isNormalWerewolfAttack` unless bite-retaliation and fox bite-resistance are intentionally desired. Then audit all downstream mappings:

- `Game.bury` public situation bucket and hidden `foundDetail` whitelist.
- `language/ja/game.yaml` `foundDetail.<found>` and public `found.<found>` only if it needs a distinct public message.
- `Emma` result mapping if the death should be classified for Emma.
- Any role-specific `checkDeathResistance`, `dying`, `beforebury`, or `Found.*Attack` checks that should or should not react.

For guardable custom attacks, call `target.die game, "<found>", attacker.id` rather than `setDead` directly so `checkDeathResistance` can run. Direct `setDead` bypasses guards, traps, death resistance, and `dying` hooks.

Poisoner/Cat specifics: `Poisoner.dying` starts with all living players as retaliation candidates, then narrows the list only for known death reasons. If a new death reason should not trigger Poisoner/Cat retaliation, add an explicit branch that sets `canbedead=[]`; simply keeping it out of `Found.isNormalWerewolfAttack` is not enough.

Trapguard specifics: `Trapper` applies the `TrapGuarded` complex. `TrapGuarded.checkDeathResistance` uses `Found.isGuardableAttack`; on success it prevents the target death and kills an attacker selected from `from` for vampire attacks or from living werewolf attackers otherwise. For a non-werewolf guardable attack, make sure `TrapGuarded` can identify the correct attacker via `from`; otherwise add a narrow branch for the new `found` string instead of relying on the werewolf fallback.

## Form Protocol

The server returns forms shaped like:

```coffee
{
    type: "RoleOrSpecialFormType"
    options: @makeJobSelection game, false
    formType: FormType.required
    objid: @objid
    data: {}
}
```

The front end submits:

- `jobtype`: form `type`
- `objid`: concrete role object id
- `target`: selected radio value
- `commandname`: clicked submit button name, for multi-action forms

For ordinary target selection, only add `game_client_form.yaml` `messages.<RoleId>`. For custom TSX forms, update `front/src/pages/game-view/job-forms/types.ts`, import and switch in `index.tsx`, and add a role-specific file.

## Complex Notes

`Complex` wraps a main role and optional sub role. Important consequences:

- `Complex.isWinner` often delegates to the main role unless the specific Complex overrides it.
- `accessByJobTypeAll(type)` may return the top Complex object for a main role match, not the inner main object.
- If a role can wrap itself or be wrapped by another ability, test `isJobType`, `accessByJobTypeAll`, `isWinner`, and serialization assumptions.
- For target or actor checks that should work through Chemical/multi-role wrappers, prefer `isJobType("<RoleId>")` when a recursive yes/no check is enough. It covers both `main` and `sub` roles, such as `RoleA×RoleB` and `RoleB×RoleA`.
- Long-lived data needed after the current night should live in serialized fields such as `flag` or `cmplFlag`; `target` is a temporary action target and is not serialized.
- If a standard Complex needs a source-specific rule, prefer a narrow subclass, such as `class RoleSpecificFriend extends Friend`, and override only the needed methods. Do not widen native `Friend`, `Guarded`, or other shared Complex behavior for one role.
- When subclassing `Friend`, override `getPartner` if `cmplType` changes, because the base method only treats literal `"Friend"` as the direct partner holder. Follow the existing `GotChocolateTrue` pattern: return `cmplFlag` only when `@cmplType` is the subclass type, otherwise delegate to `@main.getPartner()`.
- For source-specific win checks that must find a role inside Chemical, remember Chemical is created during initial role assignment. If no later wrapper can sit above the Chemical, checking `accessByJobTypeAll` plus the current object's immediate `main` and `sub` is usually enough. If later abilities can wrap the Chemical, prefer the existing `getAllMainRoles(top)` helper to inspect the concrete role tree instead of hand-rolling a one-off recursive scan.

## Fox-Like Hidden Role Pattern

For a role with fox traits but no fox ally visibility or fox chat:

```coffee
class RoleId extends Fox
    type:"RoleId"
    team:"Fox"
    isFoxVisible:->false
    getVisibilityQuery:->
        res = Player.prototype.getVisibilityQuery.call this
        res
    isListener:(game,log)-> Player.prototype.isListener.call this, game, log
    getSpeakChoice:(game)-> Player.prototype.getSpeakChoice.call this, game
```

Add role-specific win logic with `isWinner`, and add first-night automatic divination exclusions if the role has fox curse-on-divination behavior.

## Checklist

- Search `rg -n "<RoleId>"` and ensure all intended files contain the id.
- Confirm role class is in `jobs=`.
- Confirm setup metadata is in `exports.jobs`, `exports.teams`, `exports.categories`, and `exports.jobinfo`.
- Confirm i18n keys used by logs/forms exist.
- Confirm ordinary form message or TSX special form exists.
- Confirm manual page exists.
- Confirm yaminabe/random generation lists if the role should appear there.
- Run available validation. For front-end changes, use `cd front; npm run test:manual-build`.

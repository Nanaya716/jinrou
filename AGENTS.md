# Repository Guidelines

## Project Structure & Module Organization

This is a Node.js SocketStream werewolf game application. The main server entry is `app.js`, with startup helper code in `starter.js`. Server-side CoffeeScript lives in `server/`: RPC handlers are under `server/rpc/`, middleware under `server/middleware/`, and game themes under `server/themes/`. Legacy client templates and static assets are in `client/`. The TypeScript/React frontend is in `front/src/`, with webpack output copied to `client/static/front-assets/`. Copy `config.default/` to `config/` for local runtime settings. Documentation and manuals live in `docs/` and `manual/`; Docker files are in `Dockerfile` and `docker/`.

## Build, Test, and Development Commands

- `npm install`: install root SocketStream/server dependencies.
- `Copy-Item -Recurse config.default config`: create local configuration; edit `config/app.coffee`.
- `node app.js`: run development mode with MongoDB and Redis available.
- `cd front; npm install`: install frontend dependencies.
- `cd front; npm run watch`: continuously rebuild frontend assets.
- `cd front; npm run production-build`: build production frontend assets into `client/static/front-assets`.
- `SS_ENV=production SS_PACK=1 node app.js`: run the production server after building assets.
- `docker compose -f docker/docker-compose.yml up --build`: run the app with MongoDB and Redis via Docker.

## Coding Style & Naming Conventions

Follow `.editorconfig`: UTF-8, final newline, spaces, 2-space indentation by default, and 4-space indentation for `.coffee` files. CoffeeScript linting is configured in `coffeelint.json`; avoid tabs, trailing whitespace, trailing semicolons, and non-camel-case classes. Frontend TypeScript uses Prettier with single quotes and trailing commas. Keep theme files named after their theme identifier where possible.

## Testing Guidelines

There is no active root test script and `front/package.json` has a placeholder `npm test`. For frontend build validation, use `cd front; npm run test:manual-build`, which runs TypeScript and a webpack dev-check bundle. For server changes, run `node app.js` against local MongoDB and Redis and manually exercise affected RPC/game flows.

## Commit & Pull Request Guidelines

Recent history uses short, direct commit subjects, often in Chinese, such as `名字修正` or `主题`. Keep subjects concise and focused on one change. Pull requests should describe the behavior change, list manual verification commands, mention configuration or migration steps, and include screenshots for visible UI changes. Link related issues when available.

## Security & Configuration Tips

Do not commit local secrets from `config/`, database dumps, or generated runtime data. Keep `config.default/` as the documented template. Treat `prizedata/*.csv` as project data and review changes carefully before committing.

## Agent Notes: Log Performance

When working on `front/src/pages/game-view/logs/`, preserve unrelated log features such as quote/reply behavior, filtering improvements, and the current rule-panel display mode. The rule panel must render as an independent layer and must not resize or push the log area, because layout shifts here can trigger the same performance issue as new log messages.

There are two observed log stutter modes. The first is stable stutter on new messages, which can be improved by CSS isolation such as `contain: paint`. The second appears after an unclear browser/runtime state and causes new-message stutter until the browser is restarted. Treat both as likely layout/reflow or render-scope issues before changing product behavior.

Avoid removing log chunk boundaries or switching rendering modes without profiling: previous experiments showed that forcing fixed-mode rendering while removing chunked log wrappers made new messages stutter again, while restoring chunk boundaries reduced the issue. If upgrading state libraries, use a conservative React 18-compatible path: prefer `mobx@6.13.x` with `mobx-react@9.2.x`, audit `mobx-react-lite` usage, and do not upgrade React in the same step unless profiling proves it is necessary.

Do not reintroduce 100-message log block rendering for `front/src/pages/game-view/logs/`. The historical `StoredLogBlock` / `LogBlockWrapper` approach, including `display: grid` blocks with per-log `display: contents`, can cause one log to disappear visually at block boundaries in some player views. This is the same class of P0 issue addressed by commit `397f6df24d2ced7dc938de30f129cab07ae13c0c` (`去除100消息block`). Fix log spacing or reflow issues without splitting visible logs into independent 100-message grid containers.

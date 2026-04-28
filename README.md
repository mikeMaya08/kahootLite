# KahootLite

A frontend-only, multiplayer-style quiz platform inspired by Kahoot. Build
quizzes, host a game with a 6-character PIN, and play across multiple
browser tabs in simulated real time — no backend, no database, no server.

## ✨ Features

- **Quiz creation** — title, multiple questions, 4 answer options each, per-question time limit, persisted in `localStorage`.
- **Quiz library** — list, edit, delete, and one-click "Host" any saved quiz.
- **Room system** — generates a unique PIN; players join from any tab using the same PIN.
- **Cross-tab multiplayer simulation** — host in tab A, players in tabs B/C/D… all stay in sync via the `storage` event + a custom event for same-tab updates.
- **Live game flow** — countdown timer per question, auto-reveal when time runs out, host advances to next question.
- **Scoring** — base 500 pts for correct + up to 500 pt speed bonus that decays linearly with elapsed time.
- **Per-question + final leaderboard** with medals for top 3 and self-highlight.
- **Edge cases** — duplicate nicknames, empty quizzes, missing rooms, stale tabs all handled.
- **Polish** — dark/light theme toggle, avatar picker, animated transitions, color-coded answer shapes (▲ ◆ ● ■).

## 🚀 Run locally

Requires Node 18+.

```bash
npm install
npm run dev
```

Vite will open the app at `http://localhost:5173`.

To produce a static build:

```bash
npm run build
npm run preview
```

The build output in `dist/` is fully static — drop it into any web host.

## 🎮 How to play (in one browser)

1. **Tab A (Host):** open the app → **+ New quiz** → fill in a title and at least one question → **Save & host**.
2. The host tab now shows a Game PIN like `B7K2QF`.
3. **Tab B (Player):** open a new tab to the same URL → enter the PIN → pick a nickname and avatar → **Join game**.
4. Repeat for as many tabs as you want.
5. Back on the host tab, click **Start game**. All player tabs jump to the question screen automatically.
6. Players answer; host clicks **Reveal answer** (or waits for the timer); then **Next question →**.
7. After the last question, both host and players see the final leaderboard.

> Tip: if your browser puts background tabs to sleep, you can also test
> by tiling two browser windows side-by-side.

## 🧠 How the multiplayer simulation works

There is no server. State lives entirely in `localStorage`, and tabs
coordinate through two events:

1. **`window.addEventListener('storage', …)`** — fires in *other* tabs whenever a `localStorage` key changes. The host writing room state shows up immediately in every player tab.
2. **`CustomEvent('kahootlite:room-update')`** — fired manually by `saveRoom()` so components in the *same* tab also re-render (the native `storage` event explicitly skips the originating tab).

Both are funneled through the [`useRoom`](src/hooks/useRoom.js) hook, which exposes `[room, updateRoom]` to any component. `updateRoom` always reads the latest value from storage before writing, then merges — so two tabs writing simultaneously (e.g. two players joining at once) won't clobber each other.

Authority is informal but enforced:

- The **host tab** (the one that created the room) owns the canonical `status`, `currentQuestion`, and timing fields. Its identity is stored in `sessionStorage` under `kahootlite:hostFor:<CODE>`. Other tabs visiting `/host/<CODE>` get a read-only spectator view.
- **Player tabs** only mutate their own slot inside `room.players[playerId]`. Each tab gets its own ID via `sessionStorage`, so opening N tabs = N distinct players.

Timers are derived from a shared `questionEndTime` epoch timestamp — every tab independently computes `remaining = endTime - Date.now()`, so they stay in lockstep without needing to broadcast ticks.

## 📦 Project structure

```
kahootlite/
├── index.html
├── package.json
├── vite.config.js
├── README.md
└── src/
    ├── main.jsx              # React entry
    ├── App.jsx               # hash router + theme
    ├── styles.css            # global theme + components
    ├── hooks/
    │   ├── useHashRoute.js   # tiny #/route parser
    │   ├── useRoom.js        # subscribe + update room state
    │   └── useCountdown.js   # clock-based countdown
    ├── utils/
    │   ├── storage.js        # localStorage + event bus
    │   ├── id.js             # PIN + ID generators (crypto.getRandomValues)
    │   └── scoring.js        # points + ranking
    ├── components/
    │   ├── AnswerOption.jsx  # color-coded answer button
    │   ├── Leaderboard.jsx
    │   ├── QuestionEditor.jsx
    │   └── Timer.jsx
    └── pages/
        ├── Home.jsx          # join code + host CTA
        ├── QuizCreator.jsx   # build / edit a quiz
        ├── QuizList.jsx      # saved quizzes + host button
        ├── Host.jsx          # lobby → game → results (host)
        ├── Join.jsx          # nickname + avatar entry
        └── Play.jsx          # lobby → game → results (player)
```

## 🗂 Routes

All routes are hash-based so the app works from any static host:

| Hash                    | Screen                                    |
| ----------------------- | ----------------------------------------- |
| `#/`                    | Home (join + host shortcuts)              |
| `#/create`              | New-quiz editor                           |
| `#/edit/<quizId>`       | Edit existing quiz                        |
| `#/quizzes`             | Saved quiz library                        |
| `#/host/<CODE>`         | Host lobby + live game + final results    |
| `#/join/<CODE>`         | Player nickname/avatar entry              |
| `#/play/<CODE>`         | Player lobby + live game + final results  |

## ⚙️ Game state shape

```jsonc
{
  "code": "B7K2QF",
  "hostId": "host-xxxx",
  "quiz": { /* full quiz object */ },
  "status": "lobby | playing | reveal | finished",
  "currentQuestion": 0,
  "questionStartTime": 1714325200000,
  "questionEndTime": 1714325220000,
  "players": {
    "p-abc123": {
      "id": "p-abc123",
      "name": "Bob",
      "emoji": "🦊",
      "score": 950,
      "answers": {
        "0": { "choice": 2, "correct": true, "points": 950, "answeredAt": 1714325203000 }
      }
    }
  }
}
```

## ❓ FAQ

**Why does opening a second host tab show "Spectator view"?** The room only has one host token, stored in the original tab's `sessionStorage`. This prevents accidentally controlling a game from a tab that just happens to be on the host URL.

**Can I clear my data?** Open DevTools → Application → Local Storage → delete the `kahootlite:*` keys.

**Does it work in Safari/Firefox/Chrome?** Yes — `storage` events, `crypto.getRandomValues`, and Custom Events are universally supported.

## 🧪 End-to-end tests (Playwright)

The `tests/` folder contains a Playwright suite covering the most important
flows of the app — including real cross-tab multiplayer interaction by
opening multiple `Page` objects inside one `BrowserContext`.

```bash
# one-time: download the chromium build Playwright drives
npx playwright install chromium

# run the whole suite (headless, parallel)
npm test

# debug visually
npm run test:ui          # interactive mode
npm run test:headed      # watch the browsers
npm run test:report      # open the last HTML report
```

Playwright spawns the Vite dev server automatically (or reuses one if
already running on `:5173`), so a single `npm test` is enough.

### Coverage

19 tests across 4 files. Roughly half of every flow in the app is covered:

| File                              | Scenarios                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/home.spec.js`              | Headline + CTAs render · Join PIN routing · "Room not found" · Theme toggle persists across reload                                         |
| `tests/quiz-creator.spec.js`      | Title-required validation · 2-option-minimum validation · Save → library · Add/remove question · "Save & host" persists quiz + 6-char PIN |
| `tests/quiz-list.spec.js`         | Empty state · Saved-quiz listing · Edit pre-fills creator · Delete (with confirm) · Host → lobby                                           |
| `tests/multiplayer.spec.js`       | Player join syncs to host lobby · Duplicate nickname rejected · Spectator-only second host tab · **Full game**: 2 players, answer, reveal, sync results, leaderboard order, self-row highlight · Locked answer can't be re-clicked |

The **full-game test** is the headline scenario — it spins up a host plus
two player tabs, drives a real question end-to-end, and asserts that the
correct answerer beats the wrong one and that results show up live in
every tab.

## 🧪 Optional features included

- Dark mode (default) and light mode toggle (top-right).
- Player avatars (emoji picker on join).
- Animated transitions (chips pop in, leaderboard rows fade up).

Sound effects are intentionally omitted to keep the project zero-asset.

## 📜 License

MIT — do whatever, no warranty.

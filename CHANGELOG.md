# Changelog

Every release of convex-meetings, newest first. Entries follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-22

The first release. It covers every pull request merged from 2026-11-15 to 2026-11-22, #1 through #70.

### Added

#### Calls

- Meetings on Cloudflare RealtimeKit, as calls, webinars, classrooms or audio rooms ([#17](https://github.com/saranatour1/convex-meetings/pull/17))
- Call controls, live calls, screen-share annotations and protected meetings ([#22](https://github.com/saranatour1/convex-meetings/pull/22))
- See and manage your other devices in a call ([#27](https://github.com/saranatour1/convex-meetings/pull/27))
- Each person's join and leave times are recorded ([#40](https://github.com/saranatour1/convex-meetings/pull/40))
- Meetings end two minutes after their call empties ([#39](https://github.com/saranatour1/convex-meetings/pull/39))
- Ring a teammate from Members ([#43](https://github.com/saranatour1/convex-meetings/pull/43))
- People can ask to join a meeting, and hosts let them in ([#47](https://github.com/saranatour1/convex-meetings/pull/47))
- Public rooms with a waiting room, slow mode and automatic moderation ([#50](https://github.com/saranatour1/convex-meetings/pull/50))
- The live transcript shows on the signed-in meeting page ([#61](https://github.com/saranatour1/convex-meetings/pull/61))
- Hosts can turn the live transcript off per meeting ([#66](https://github.com/saranatour1/convex-meetings/pull/66))
- Excalidraw-style annotation tools on screen shares ([#67](https://github.com/saranatour1/convex-meetings/pull/67))
- Hosts can edit a meeting from its page ([#68](https://github.com/saranatour1/convex-meetings/pull/68))
- New link gives a meeting a fresh link and keeps calendar invites, inbox links and recaps working ([#69](https://github.com/saranatour1/convex-meetings/pull/69))
- Inviting someone who is already a guest emails them another personal link ([#69](https://github.com/saranatour1/convex-meetings/pull/69))

#### Scheduling and calendar

- Organizations, email invites, time zones and real people in Find a time ([#8](https://github.com/saranatour1/convex-meetings/pull/8))
- Pick invitees, email calendar invites, and a richer calendar ([#42](https://github.com/saranatour1/convex-meetings/pull/42))
- Schedule meetings from the calendar, with a slimmer schedule card ([#49](https://github.com/saranatour1/convex-meetings/pull/49))
- Create and edit meetings from the calendar ([#55](https://github.com/saranatour1/convex-meetings/pull/55))
- Guest emails carry calendar invites, and updates arrive in order ([#59](https://github.com/saranatour1/convex-meetings/pull/59))

#### Recaps, chat and inbox

- Meetings page, recaps with saved transcripts and R2 recordings, and an inbox ([#20](https://github.com/saranatour1/convex-meetings/pull/20))
- Chat built on COSS UI's chat components ([#28](https://github.com/saranatour1/convex-meetings/pull/28))
- Reactions on chat messages ([#29](https://github.com/saranatour1/convex-meetings/pull/29))

#### Organizations and accounts

- Member actions, roles and permissions, and organization settings ([#19](https://github.com/saranatour1/convex-meetings/pull/19))
- Org access, an admin role, invite links, domain join, an audit log and sessions ([#21](https://github.com/saranatour1/convex-meetings/pull/21))
- Meeting access settings, and guests without accounts ([#24](https://github.com/saranatour1/convex-meetings/pull/24))
- Settings menu, account and meeting preferences, and light and dark themes ([#18](https://github.com/saranatour1/convex-meetings/pull/18))
- Sign up with Google or GitHub, then confirm with a passkey ([#36](https://github.com/saranatour1/convex-meetings/pull/36))
- Free usage limits keep Cloudflare usage within the included amounts ([#41](https://github.com/saranatour1/convex-meetings/pull/41))

#### AI agents

- WebMCP tools for agents in a signed-in browser ([#48](https://github.com/saranatour1/convex-meetings/pull/48))
- AI agents join calls as watchers with their app icon and a live transcript ([#58](https://github.com/saranatour1/convex-meetings/pull/58))
- AI agents stay in a call through Convex presence instead of a RealtimeKit connection ([#64](https://github.com/saranatour1/convex-meetings/pull/64))

#### Site and analytics

- Databuddy analytics with session replay ([#23](https://github.com/saranatour1/convex-meetings/pull/23))
- Key product events tracked in Databuddy ([#37](https://github.com/saranatour1/convex-meetings/pull/37))
- Landing page, logo, Open Graph images, robots.txt and llms.txt ([#45](https://github.com/saranatour1/convex-meetings/pull/45))
- The Worker reports AI crawler reads to Databuddy ([#46](https://github.com/saranatour1/convex-meetings/pull/46))
- Live now in the sidebar, and one New meeting menu in the header ([#53](https://github.com/saranatour1/convex-meetings/pull/53))
- Public rooms are listed in the sitemap, and crawlers stay off secret links ([#56](https://github.com/saranatour1/convex-meetings/pull/56))

### Changed

- Every sign-in requires Google or GitHub ([#38](https://github.com/saranatour1/convex-meetings/pull/38))
- Redesigned call flow, from Home to after the call ([#51](https://github.com/saranatour1/convex-meetings/pull/51))
- Redesigned public rooms directory and room page ([#52](https://github.com/saranatour1/convex-meetings/pull/52))
- Clean URLs, recap numbers, an active org setting and unique org names ([#26](https://github.com/saranatour1/convex-meetings/pull/26))
- The call loads only on join, which slims the first load ([#30](https://github.com/saranatour1/convex-meetings/pull/30))
- Call presence and busy times are read by time window, including repeating meetings ([#32](https://github.com/saranatour1/convex-meetings/pull/32))
- Production is served on convex-meetings.stream ([#35](https://github.com/saranatour1/convex-meetings/pull/35))
- Worker logs, traces and Issues are on ([#54](https://github.com/saranatour1/convex-meetings/pull/54))
- Every Convex query is read through TanStack DB ([#64](https://github.com/saranatour1/convex-meetings/pull/64), [#65](https://github.com/saranatour1/convex-meetings/pull/65))
- Moved from SvelteKit to TanStack Start ([#1](https://github.com/saranatour1/convex-meetings/pull/1))
- Toolchain moved from Vite to Vite+ ([#2](https://github.com/saranatour1/convex-meetings/pull/2))
- The repo is split into apps/web, packages/backend and packages/ui ([#3](https://github.com/saranatour1/convex-meetings/pull/3))
- Convex code is organized into api, internal, models, tables and lib ([#4](https://github.com/saranatour1/convex-meetings/pull/4))
- The web app is route-driven, with a shared layout, URL state and TanStack Form ([#5](https://github.com/saranatour1/convex-meetings/pull/5))
- Data model with Zod-validated tables and org middleware ([#7](https://github.com/saranatour1/convex-meetings/pull/7))
- The meetings model is split into smaller files ([#33](https://github.com/saranatour1/convex-meetings/pull/33))
- Cloudflare builds pin pnpm 12.6.0 ([#34](https://github.com/saranatour1/convex-meetings/pull/34))

### Fixed

- Turning the annotation pen on no longer crashes the call ([#25](https://github.com/saranatour1/convex-meetings/pull/25))
- Failures show up, protected recordings stay with hosts, and repeated reads are gone ([#31](https://github.com/saranatour1/convex-meetings/pull/31))
- Databuddy tracks in production, where the build had no client ID ([#37](https://github.com/saranatour1/convex-meetings/pull/37))
- Typing a meeting title on the calendar keeps its spaces ([#57](https://github.com/saranatour1/convex-meetings/pull/57))
- AI agents can follow calls they can't connect to, and "Claude (…assistant)" is recognized as an agent ([#60](https://github.com/saranatour1/convex-meetings/pull/60))
- Bots no longer flicker in and out of calls ([#62](https://github.com/saranatour1/convex-meetings/pull/62))
- Live transcription stays on instead of switching off to save Workers AI usage ([#63](https://github.com/saranatour1/convex-meetings/pull/63))
- Guest tabs stop throwing errors when a host cancels the meeting ([#69](https://github.com/saranatour1/convex-meetings/pull/69))
- A guest's links from earlier emails keep working after a reschedule or resend ([#69](https://github.com/saranatour1/convex-meetings/pull/69))
- Join no longer hangs on "Connecting…" when RealtimeKit times out ([#69](https://github.com/saranatour1/convex-meetings/pull/69))

### Removed

- Unused groups, teams and fields ([#33](https://github.com/saranatour1/convex-meetings/pull/33))
- apps/web/.env.production is no longer committed ([#44](https://github.com/saranatour1/convex-meetings/pull/44))
- The every-minute usage cron. Joins still enforce the limits ([#70](https://github.com/saranatour1/convex-meetings/pull/70))

[Unreleased]: https://github.com/saranatour1/convex-meetings/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/saranatour1/convex-meetings/releases/tag/v0.1.0

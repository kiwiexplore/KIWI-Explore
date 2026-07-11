# CURRENT SPRINT

Sprint 003 - Foundation for Scale

## Current Goal

Build the scaffolding needed to add widgets and features without
creating duplicated logic, before chasing visual parity with the
KIWI HQ mockup.

## Completed

- Dashboard
- Brain
- Command Bar
- Command Engine
- Status Bar
- Command output
- Reactive state store (Zustand) — see CHANGELOG.md
- Widget system (WidgetDefinition + registry + generic Widget renderer)

## Next

- Layout pass: 3-column dashboard matching KIWI HQ mockup
  (left panel / Brain center / right panel)
- Animated Brain (pulsing network, per mockup/video reference)
- Command history
- Terminal-style UI for command output
- Design tokens (colors/spacing/typography as variables)
- AI integration
- Fix: Send button wraps below input (missing flex on .command-bar form)
- Fix: StatusBar spans need spacing
- Visual pass: colors/cards to match KIWI HQ mockup
- Brain: orbiting module icons (Travel, News, Calendar...)
- Bottom widget row (Weather, Top News, Space Missions...)
# CHANGELOG

## Sprint 001 - Project Foundation

Completed:
- Project initialized
- React + TypeScript
- Vite configured
- Git repository initialized
- First commit created
- Dashboard created
- Brain component created
- Widget layout created
- Command Bar created
- Command Engine created
- Status Bar created
- ROADMAP.md created
- VISION.md created

## Sprint 002 - KIWI Core

Completed:
- Command Engine connected to Command Bar
- First command execution
- Command output displayed in UI

## Sprint 003 - Foundation for Scale (In Progress)

Completed:
- State management migrated from a plain mutable object to a reactive
  Zustand store (`state/kiwi.ts`). Reason: CommandEngine.ts runs outside
  the React component tree and needs to update shared state; React
  Context alone cannot be read from plain functions. Zustand supports
  both reactive component subscriptions (`useKiwiStore`) and plain
  read/write access from non-component code (`kiwiStore`).
- StatusBar now re-renders automatically on state changes (previously
  it read a static snapshot and never updated).
- Widget system introduced: `types/widget.ts` defines a WidgetDefinition
  contract, `state/widgets.ts` holds the widget registry, and
  `components/widget/Widget.tsx` renders any definition generically.
  Dashboard now maps over the registry instead of hardcoding each panel.
  Adding a simple new widget going forward means adding one entry to
  `defaultWidgets`, not writing a new component.
- Minor fix: unknown commands in CommandEngine now correctly set
  status to "Error" (previously this branch was unreachable).
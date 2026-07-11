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

## Sprint 003 - Foundation for Scale

Completed:
- Reactive state store (Zustand) - state/kiwi.ts
- StatusBar now updates automatically on state changes
- Widget system: types/widget.ts, state/widgets.ts, Widget.tsx
- Bugfix: unknown commands now correctly set status to "Error"

## Sprint 004 - KIWI HQ Layout & Visual System (In Progress)

Completed:
- Fixed broken theme.css (nested :root bug, variables weren't applying)
- TopBar component created (logo, search bar, system status)
- CommandBar moved from footer into TopBar
- Dashboard restructured into 3-column layout (left / Brain / right)
- Widgets can now target a column via WidgetDefinition.column
- Removed dead code: old CSS classes, CommandTest.tsx
- Brain system: OrbitRing component with 10 module icons around Brain
- New data files: types/orbitModule.ts, state/orbitModules.ts
- New BrainSystem component (combines Brain + OrbitRing)
- CSS fixes: CommandBar button wrap, StatusBar spacing
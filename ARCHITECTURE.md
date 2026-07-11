# Architecture

The project follows modular architecture.

src/

components/
layout/
ui/
widget/

features/
command/
brain/
explore/
youtube/
projects/

services/

hooks/

state/

types/

utils/

Every feature should be isolated.

Business logic belongs inside Features.

UI belongs inside Components.

Global data belongs inside State.

No business logic inside UI components.

All code should remain reusable.
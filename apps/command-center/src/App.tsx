import { useState } from "react";
import BrainScene3D from "./components/brain/BrainScene3D";
import Laboratory from "./components/laboratory/Laboratory";
import { useAccountState } from "./state/account";
import { useCalendarState } from "./state/calendar";

type View = "dashboard" | "laboratory";

// No router library — just a top-level view switch, same "no
// unnecessary dependencies" philosophy as the rest of this app's mock
// systems. Worth revisiting once Laboratory needs real deep-linkable
// URLs (e.g. shareable project pages) behind a real backend.
//
// Account identity (useAccountState) and calendar events
// (useCalendarState) both live here, above both scenes, so signing in/
// changing your avatar or plan, and any event added from either scene,
// are still in effect after switching between Dashboard and Laboratory
// — both used to be (or would otherwise have been) local to one scene,
// resetting every time that component unmounted.
export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const account = useAccountState();
  const calendar = useCalendarState();

  if (view === "laboratory") {
    return <Laboratory onBack={() => setView("dashboard")} account={account} calendar={calendar} />;
  }
  return <BrainScene3D onOpenLaboratory={() => setView("laboratory")} account={account} calendar={calendar} />;
}

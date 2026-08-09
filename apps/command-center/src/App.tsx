import { useState } from "react";
import BrainScene3D from "./components/brain/BrainScene3D";
import Laboratory from "./components/laboratory/Laboratory";
import { useAccountState } from "./state/account";

type View = "dashboard" | "laboratory";

// No router library — just a top-level view switch, same "no
// unnecessary dependencies" philosophy as the rest of this app's mock
// systems. Worth revisiting once Laboratory needs real deep-linkable
// URLs (e.g. shareable project pages) behind a real backend.
//
// Account identity (useAccountState) lives here, above both scenes,
// so signing in/changing your avatar or plan on the Dashboard is still
// in effect after switching to Laboratory and back — it used to be
// local to BrainScene3D, which meant it reset every time that
// component unmounted.
export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const account = useAccountState();

  if (view === "laboratory") {
    return <Laboratory onBack={() => setView("dashboard")} account={account} />;
  }
  return <BrainScene3D onOpenLaboratory={() => setView("laboratory")} account={account} />;
}

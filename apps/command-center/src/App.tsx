import { useState } from "react";
import BrainScene3D from "./components/brain/BrainScene3D";
import Laboratory from "./components/laboratory/Laboratory";

type View = "dashboard" | "laboratory";

// No router library — just a top-level view switch, same "no
// unnecessary dependencies" philosophy as the rest of this app's mock
// systems. Worth revisiting once Laboratory needs real deep-linkable
// URLs (e.g. shareable project pages) behind a real backend.
export default function App() {
  const [view, setView] = useState<View>("dashboard");

  if (view === "laboratory") {
    return <Laboratory onBack={() => setView("dashboard")} />;
  }
  return <BrainScene3D onOpenLaboratory={() => setView("laboratory")} />;
}

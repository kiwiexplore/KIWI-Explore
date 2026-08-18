import { useState } from "react";
import BrainScene3D from "./components/brain/BrainScene3D";
import Laboratory from "./components/laboratory/Laboratory";
import { useAccountState } from "./state/account";
import { useCalendarState } from "./state/calendar";
import { useLaboratoryDataState } from "./state/laboratoryData";
import { useSpotifyState } from "./state/spotify";

type View = "dashboard" | "laboratory";

// No router library — just a top-level view switch, same "no
// unnecessary dependencies" philosophy as the rest of this app's mock
// systems. Worth revisiting once Laboratory needs real deep-linkable
// URLs (e.g. shareable project pages) behind a real backend.
//
// Account identity (useAccountState), calendar events
// (useCalendarState), Laboratory's own project/notes/research data
// (useLaboratoryDataState), and the Spotify connection (useSpotifyState)
// all live here, above both scenes, so signing in/changing your avatar
// or plan, any event added from either scene, any project/note/finding
// created in Laboratory, and the Spotify player are still in effect
// after switching between Dashboard and Laboratory — all of these used
// to be (or would otherwise have been) local to one scene, resetting
// every time that component unmounted. useSpotifyState in particular
// needs this: connecting is a full-page redirect to Spotify and back,
// which would tear down anything scoped to a single view.
export default function App() {
  const [view, setView] = useState<View>("dashboard");
  // Set only when the dashboard is being returned TO from the
  // Laboratory, so the brain scene knows to start the camera out at the
  // Moon and fly it home rather than opening in its usual orbit. A
  // first load doesn't come from anywhere, so it doesn't fly.
  const [arriving, setArriving] = useState(false);
  const account = useAccountState();
  const calendar = useCalendarState();
  const laboratoryData = useLaboratoryDataState();
  const spotify = useSpotifyState();

  if (view === "laboratory") {
    return <Laboratory onBack={() => { setArriving(true); setView("dashboard"); }} account={account} calendar={calendar} data={laboratoryData} spotify={spotify} />;
  }
  return (
    <BrainScene3D
      onOpenLaboratory={() => setView("laboratory")}
      arriving={arriving}
      calendar={calendar}
      laboratoryData={laboratoryData}
      spotify={spotify}
    />
  );
}

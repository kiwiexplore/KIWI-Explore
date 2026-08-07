import { useEffect, useRef, useState } from "react";
import { AudioLines, Search } from "lucide-react";
import "./VoiceBar.css";

// The Web Speech API isn't part of TypeScript's standard DOM lib, so
// these are just the minimal shapes actually used here rather than a
// full ambient declaration.
interface SpeechRecognitionResultLike {
    isFinal: boolean;
    [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
    resultIndex: number;
    results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
    const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Real browser speech-to-TEXT (Web Speech API) — no backend, no API key,
 * per explicit request to land this step before wiring an actual AI
 * reply. Click the mic to start listening; what you say replaces the
 * "Hey Kiwi..." placeholder live as you speak. Not every browser
 * supports it (Firefox notably doesn't) — the mic button is simply
 * disabled there rather than pretending to work.
 */
export default function VoiceBar() {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    // Computed once, lazily, rather than set from inside the effect below
    // (calling setState synchronously in an effect body trips the
    // react-hooks/set-state-in-effect rule) — whether the browser has
    // this API never changes over the component's lifetime anyway.
    const [supported] = useState(() => Boolean(getSpeechRecognitionCtor()));
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const finalTextRef = useRef("");

    useEffect(() => {
        const Ctor = getSpeechRecognitionCtor();
        if (!Ctor) return;
        const recognition = new Ctor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || "en-US";

        recognition.onresult = (event) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTextRef.current = `${finalTextRef.current} ${result[0].transcript}`.trim();
                } else {
                    interim += result[0].transcript;
                }
            }
            setTranscript(`${finalTextRef.current} ${interim}`.trim());
        };
        recognition.onend = () => setListening(false);
        recognition.onerror = () => setListening(false);

        recognitionRef.current = recognition;
        return () => recognition.stop();
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return;
        if (listening) {
            recognitionRef.current.stop();
            setListening(false);
        } else {
            finalTextRef.current = "";
            setTranscript("");
            recognitionRef.current.start();
            setListening(true);
        }
    };

    return (
        <div className="voice-bar">
            <div className="voice-bar-left">
                <Search size={18} color="#8fd6ff" strokeWidth={1.75} />
                <span className="voice-bar-text">{transcript || "Hey Kiwi..."}</span>
            </div>
            <button
                type="button"
                className={`voice-bar-mic${listening ? " voice-bar-mic-active" : ""}`}
                onClick={toggleListening}
                disabled={!supported}
                aria-label={supported ? "Voice input" : "Voice input isn't supported in this browser"}
                aria-pressed={listening}
            >
                <AudioLines size={18} strokeWidth={1.75} />
            </button>
        </div>
    );
}

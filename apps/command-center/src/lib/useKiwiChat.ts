import { useEffect, useRef, useState } from "react";

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

export interface KiwiMessage {
    id: number;
    text: string;
}

/**
 * Shared "Hey Kiwi" chat logic — real browser speech-to-text (Web
 * Speech API, no backend/API key), a typed/spoken transcript, and a
 * running list of sent messages. Used by both VoiceBar (the Dashboard's
 * floating bar below the brain) and KiwiPanel (Laboratory's side
 * panel) — extracted here once KiwiPanel needed the exact same
 * non-trivial speech-recognition setup/teardown rather than
 * duplicating it. Each caller owns its own JSX/layout entirely; this
 * only owns the state and the two actions (toggleListening,
 * sendMessage).
 *
 * There's still no AI behind this — sendMessage only appends the
 * user's own message, nothing replies yet.
 */
export function useKiwiChat(onListeningChange?: (listening: boolean) => void) {
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [messages, setMessages] = useState<KiwiMessage[]>([]);
    // Computed once, lazily, rather than set from inside the effect below
    // (calling setState synchronously in an effect body trips the
    // react-hooks/set-state-in-effect rule) — whether the browser has
    // this API never changes over the component's lifetime anyway.
    const [supported] = useState(() => Boolean(getSpeechRecognitionCtor()));
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const finalTextRef = useRef("");
    const nextMessageId = useRef(0);

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

    useEffect(() => {
        onListeningChange?.(listening);
    }, [listening, onListeningChange]);

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

    const sendMessage = () => {
        const text = transcript.trim();
        if (!text) return;
        setMessages((prev) => [...prev, { id: nextMessageId.current++, text }]);
        finalTextRef.current = "";
        setTranscript("");
    };

    return { listening, transcript, setTranscript, messages, supported, toggleListening, sendMessage };
}

import { Suspense, useRef, useState, type ChangeEvent } from "react";
import { Canvas } from "@react-three/fiber";
import { Center, OrbitControls, useGLTF } from "@react-three/drei";
import { Box, Trash2, Upload } from "lucide-react";
import type { ProjectModel } from "../../state/laboratoryProjects";
import "./Model3DViewer.css";

function GLTFModel({ url }: { url: string }) {
    const { scene } = useGLTF(url);
    return <primitive object={scene} />;
}

interface Model3DViewerProps {
    models: ProjectModel[];
    onAddModel: (name: string, blobUrl: string) => string;
    onRemoveModel: (modelId: string) => void;
}

/**
 * A real, self-contained 3D viewer — no server, no external asset
 * fetches (deliberately skips drei's Stage/Environment HDRI presets,
 * which pull from a remote CDN; hand-rolled lighting instead so this
 * works fully offline once a file is uploaded). .glb/.gltf files are
 * held as blob URLs (URL.createObjectURL), not data URLs — cheaper for
 * large 3D files — and revoked on removal by the caller.
 * @react-three/fiber and @react-three/drei were already project
 * dependencies (used by the Dashboard's brain scene), so this needed
 * no new packages.
 */
export default function Model3DViewer({ models, onAddModel, onRemoveModel }: Model3DViewerProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [selectedId, setSelectedId] = useState<string | null>(models[0]?.id ?? null);
    const selected = models.find((m) => m.id === selectedId) ?? models[0] ?? null;

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        const blobUrl = URL.createObjectURL(file);
        setSelectedId(onAddModel(file.name, blobUrl));
    };

    const handleRemove = (modelId: string) => {
        onRemoveModel(modelId);
        if (modelId === selectedId) setSelectedId(null);
    };

    return (
        <div className="model-viewer">
            <div className="model-viewer-canvas-wrap">
                {selected ? (
                    <Canvas key={selected.id} camera={{ position: [3, 2, 4], fov: 45 }}>
                        <ambientLight intensity={0.7} />
                        <directionalLight position={[5, 8, 5]} intensity={1.4} />
                        <directionalLight position={[-5, -3, -4]} intensity={0.35} />
                        <Suspense fallback={null}>
                            <Center>
                                <GLTFModel url={selected.blobUrl} />
                            </Center>
                        </Suspense>
                        <OrbitControls makeDefault autoRotate autoRotateSpeed={0.6} />
                    </Canvas>
                ) : (
                    <div className="model-viewer-empty">
                        <Box size={26} strokeWidth={1.5} />
                        <p>Upload a .glb or .gltf file to view it here.</p>
                    </div>
                )}
            </div>

            <div className="model-viewer-list">
                {models.map((model) => (
                    <div key={model.id} className={`model-viewer-item${model.id === selected?.id ? " model-viewer-item-active" : ""}`}>
                        <button type="button" className="model-viewer-item-name" onClick={() => setSelectedId(model.id)}>
                            {model.name}
                        </button>
                        <button
                            type="button"
                            className="model-viewer-item-remove"
                            onClick={() => handleRemove(model.id)}
                            aria-label="Remove model"
                        >
                            <Trash2 size={13} strokeWidth={1.75} />
                        </button>
                    </div>
                ))}

                <button type="button" className="model-viewer-upload-btn" onClick={() => inputRef.current?.click()}>
                    <Upload size={14} strokeWidth={2} />
                    Upload .glb / .gltf
                </button>
                <input ref={inputRef} type="file" accept=".glb,.gltf" onChange={handleChange} style={{ display: "none" }} />
            </div>
        </div>
    );
}

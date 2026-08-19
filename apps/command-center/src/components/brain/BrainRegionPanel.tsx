import { useState, type CSSProperties } from "react";
import { ArrowLeft, ChevronRight, Maximize2, Minimize2, X } from "lucide-react";
import { ModuleContent, type RegionContentContext } from "./regionContent";
import { hasModuleContent } from "./regionContent/moduleCatalog";
import type { BrainRegionDefinition, BrainRegionModule } from "../../state/brainRegions";
import "./BrainRegionPanel.css";

interface BrainRegionPanelProps {
    region: BrainRegionDefinition;
    context: RegionContentContext;
    // Which module is open, owned by BrainScene3D rather than by this
    // panel: the pins scattered over the brain itself open modules too
    // (see RegionDataPins), and two places driving the same thing means
    // the state belongs above both of them.
    openModuleId: string | null;
    onOpenModule: (moduleId: string | null) => void;
    onClose: () => void;
    // Fired for modules that aren't content at all but a jump somewhere
    // else — Laboratory being the only one today.
    onModuleAction: (module: BrainRegionModule) => void;
}

/**
 * What you get pulled into once a region is picked — from the nav rail
 * or by clicking that spot on the brain. Floats on the right while the
 * camera flies inside the brain, so the area you opened and its contents
 * are on screen together.
 *
 * Two levels, deliberately not more:
 *
 *   1. The region overview lists its modules, and each row carries that
 *      module's LIVE state, not just its name — the weather right now,
 *      the next event, how far a project has got. The point is that the
 *      common question is answered without clicking anything; clicking
 *      is for the detail behind the answer.
 *   2. Opening a module replaces the panel's body with its full
 *      contents, with a back arrow to the overview. Same panel, same
 *      spot on screen — the brain never gets covered by a modal and you
 *      never lose your place. Content that needs room (a week of
 *      forecasts, a list of stories) can be widened with the expand
 *      button rather than being cramped into the rail's width.
 *
 * The contents themselves live in regionContent/ — modules with real
 * data behind them render it, modules without say so plainly (see
 * ModuleContent's own comment on why that's a switch with holes rather
 * than placeholder text per module).
 *
 * Which module is open is owned by BrainScene3D (a pin on the brain can
 * open one too); the widened/narrow choice is local, and resets by
 * remounting on region change — BrainScene3D keys this component by
 * region id — rather than by an effect watching for it.
 */
export default function BrainRegionPanel({ region, context, openModuleId, onOpenModule, onClose, onModuleAction }: BrainRegionPanelProps) {
    const [wide, setWide] = useState(false);

    const openModule = region.modules.find((module) => module.id === openModuleId) ?? null;

    const handleModuleClick = (module: BrainRegionModule) => {
        if (module.id === "laboratory") {
            onModuleAction(module);
            return;
        }
        onOpenModule(module.id);
    };

    return (
        <section
            className={`region-panel${wide ? " region-panel-wide" : ""}`}
            style={{ "--region-color": region.color } as CSSProperties}
        >
            <header className="region-panel-header">
                {openModule ? (
                    <button
                        type="button"
                        className="region-panel-back"
                        // Back goes up ONE level: out of an open story
                        // to the module's list first, and only then out
                        // of the module to the region.
                        onClick={() => (context.openStoryId ? context.openStory(null) : onOpenModule(null))}
                        aria-label={context.openStoryId ? "Back to the list" : "Back to region"}
                    >
                        <ArrowLeft size={15} strokeWidth={2} />
                    </button>
                ) : (
                    <span className="region-panel-icon">{region.icon}</span>
                )}

                <div className="region-panel-titles">
                    <h2 className="region-panel-title">{openModule ? openModule.label : region.domain}</h2>
                    <span className="region-panel-subtitle">{openModule ? region.domain : region.label}</span>
                </div>

                {openModule && (
                    <button
                        type="button"
                        className="region-panel-icon-btn"
                        onClick={() => setWide((current) => !current)}
                        aria-label={wide ? "Shrink panel" : "Expand panel"}
                    >
                        {wide ? <Minimize2 size={14} strokeWidth={2} /> : <Maximize2 size={14} strokeWidth={2} />}
                    </button>
                )}

                <button type="button" className="region-panel-icon-btn" onClick={onClose} aria-label="Close region">
                    <X size={15} strokeWidth={2} />
                </button>
            </header>

            {openModule ? (
                <div className="region-panel-body">
                    <p className="region-panel-description">{openModule.description}</p>
                    {hasModuleContent(openModule.id)
                        ? <ModuleContent moduleId={openModule.id} mode="detail" context={context} />
                        : <p className="region-panel-empty">Not connected yet — this one lights up once its data source is wired in.</p>}
                </div>
            ) : (
                <div className="region-panel-body">
                    <p className="region-panel-description">{region.description}</p>

                    <div className="region-panel-modules">
                        {region.modules.map((module) => (
                            <button
                                key={module.id}
                                type="button"
                                className="region-panel-module"
                                onClick={() => handleModuleClick(module)}
                            >
                                <span className="region-panel-module-icon">{module.icon}</span>
                                <span className="region-panel-module-text">
                                    <span className="region-panel-module-label">{module.label}</span>
                                    <span className="region-panel-module-summary">
                                        {hasModuleContent(module.id)
                                            ? <ModuleContent moduleId={module.id} mode="summary" context={context} />
                                            : module.description}
                                    </span>
                                </span>
                                <ChevronRight size={14} strokeWidth={2} className="region-panel-module-chevron" />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

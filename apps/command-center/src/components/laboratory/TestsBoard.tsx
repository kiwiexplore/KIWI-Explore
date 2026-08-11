import { useState, type KeyboardEvent } from "react";
import { Plus, TestTube2, Trash2 } from "lucide-react";
import { TEST_STATUS_META, type LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectWorkspace.css";
import "./GlobalBoard.css";

interface TestsBoardProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onAddTest: (projectId: string, title: string) => void;
    onCycleTestStatus: (projectId: string, testId: string) => void;
    onRemoveTest: (projectId: string, testId: string) => void;
}

function ProjectTestGroup({ project, onSelectProject, onAddTest, onCycleTestStatus, onRemoveTest }: {
    project: LaboratoryProject;
    onSelectProject: (id: string) => void;
    onAddTest: (projectId: string, title: string) => void;
    onCycleTestStatus: (projectId: string, testId: string) => void;
    onRemoveTest: (projectId: string, testId: string) => void;
}) {
    const [newTitle, setNewTitle] = useState("");
    const passingCount = project.tests.filter((t) => t.status === "passing").length;

    const handleAdd = () => {
        if (!newTitle.trim()) return;
        onAddTest(project.id, newTitle.trim());
        setNewTitle("");
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleAdd();
        }
    };

    return (
        <div className="global-board-group">
            <div className="global-board-group-header">
                <button type="button" className="global-board-group-name" onClick={() => onSelectProject(project.id)}>
                    {project.name}
                </button>
                {project.tests.length > 0 && (
                    <span className="global-board-group-count">{passingCount}/{project.tests.length} passing</span>
                )}
            </div>

            {project.tests.length > 0 && (
                <div className="project-workspace-task-list">
                    {project.tests.map((test) => {
                        const statusMeta = TEST_STATUS_META[test.status];
                        return (
                            <div key={test.id} className="project-workspace-task">
                                <span className="project-workspace-idea-icon">
                                    <TestTube2 size={13} strokeWidth={1.75} />
                                </span>
                                <span className="project-workspace-task-title project-workspace-idea-title">{test.title}</span>
                                <button
                                    type="button"
                                    className="project-workspace-stage-pill"
                                    style={{ color: statusMeta.color, borderColor: statusMeta.color }}
                                    onClick={() => onCycleTestStatus(project.id, test.id)}
                                    title="Click to advance status"
                                >
                                    {statusMeta.label}
                                </button>
                                <button
                                    type="button"
                                    className="project-workspace-task-remove"
                                    onClick={() => onRemoveTest(project.id, test.id)}
                                    aria-label="Remove test"
                                >
                                    <Trash2 size={13} strokeWidth={1.75} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="project-workspace-task-add">
                <input
                    type="text"
                    className="project-workspace-task-input"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Add a test case for ${project.name}...`}
                />
                <button type="button" className="project-workspace-task-add-btn" onClick={handleAdd} disabled={!newTitle.trim()}>
                    <Plus size={15} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
}

/**
 * Global Tests — a manual test-case tracker per project, grouped
 * together. New per-project state (project.tests) — click the status
 * pill to cycle untested -> passing -> failing, same click-to-advance
 * interaction as prototype stages. No real test runner, just a
 * checklist (same mock-data honesty as everything else here).
 */
export default function TestsBoard({ projects, onSelectProject, onAddTest, onCycleTestStatus, onRemoveTest }: TestsBoardProps) {
    const totalTests = projects.reduce((sum, p) => sum + p.tests.length, 0);
    const totalPassing = projects.reduce((sum, p) => sum + p.tests.filter((t) => t.status === "passing").length, 0);

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Tests</h1>
                </div>
                {totalTests > 0 && <span className="global-board-summary">{totalPassing}/{totalTests} passing</span>}
            </div>

            {projects.length === 0 ? (
                <div className="global-board-empty">No projects yet — create one to start tracking tests.</div>
            ) : (
                <div className="global-board-groups">
                    {projects.map((project) => (
                        <ProjectTestGroup
                            key={project.id}
                            project={project}
                            onSelectProject={onSelectProject}
                            onAddTest={onAddTest}
                            onCycleTestStatus={onCycleTestStatus}
                            onRemoveTest={onRemoveTest}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

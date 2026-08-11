import { useState, type KeyboardEvent } from "react";
import { Package, Plus, Ruler, Trash2 } from "lucide-react";
import { PRODUCT_STAGE_META, type LaboratoryProject } from "../../state/laboratoryProjects";
import "./ProjectWorkspace.css";
import "./GlobalBoard.css";

interface ProductsBoardProps {
    projects: LaboratoryProject[];
    onSelectProject: (id: string) => void;
    onAddProduct: (projectId: string, name: string, price: string) => void;
    onCycleProductStage: (projectId: string, productId: string) => void;
    onRemoveProduct: (projectId: string, productId: string) => void;
    onUpdateProductSpecs: (projectId: string, productId: string, specs: string) => void;
}

function ProjectProductGroup({ project, onSelectProject, onAddProduct, onCycleProductStage, onRemoveProduct, onUpdateProductSpecs }: {
    project: LaboratoryProject;
    onSelectProject: (id: string) => void;
    onAddProduct: (projectId: string, name: string, price: string) => void;
    onCycleProductStage: (projectId: string, productId: string) => void;
    onRemoveProduct: (projectId: string, productId: string) => void;
    onUpdateProductSpecs: (projectId: string, productId: string, specs: string) => void;
}) {
    const [newName, setNewName] = useState("");
    const [newPrice, setNewPrice] = useState("");
    const [expandedSpecs, setExpandedSpecs] = useState<Set<string>>(new Set());

    const toggleSpecs = (productId: string) => {
        setExpandedSpecs((prev) => {
            const next = new Set(prev);
            if (next.has(productId)) next.delete(productId);
            else next.add(productId);
            return next;
        });
    };

    const handleAdd = () => {
        if (!newName.trim()) return;
        onAddProduct(project.id, newName.trim(), newPrice.trim());
        setNewName("");
        setNewPrice("");
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
                {project.products.length > 0 && <span className="global-board-group-count">{project.products.length}</span>}
            </div>

            {project.products.length > 0 && (
                <div className="project-workspace-task-list">
                    {project.products.map((product) => {
                        const stageMeta = PRODUCT_STAGE_META[product.stage];
                        const specsOpen = expandedSpecs.has(product.id) || Boolean(product.specs);
                        return (
                            <div key={product.id}>
                                <div className="project-workspace-task">
                                    <span className="project-workspace-idea-icon">
                                        <Package size={13} strokeWidth={1.75} />
                                    </span>
                                    <span className="project-workspace-design-ref">
                                        <span className="project-workspace-task-title">{product.name}</span>
                                        {product.price && (
                                            <span className="project-workspace-note-card-source">{product.price}</span>
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        className="project-workspace-stage-pill"
                                        style={{ color: stageMeta.color, borderColor: stageMeta.color }}
                                        onClick={() => onCycleProductStage(project.id, product.id)}
                                        title="Click to advance stage"
                                    >
                                        {stageMeta.label}
                                    </button>
                                    <button
                                        type="button"
                                        className={`project-product-specs-toggle${specsOpen ? " project-product-specs-toggle-active" : ""}`}
                                        onClick={() => toggleSpecs(product.id)}
                                        aria-label="Toggle specs/dimensions"
                                        title="Specs / dimensions"
                                    >
                                        <Ruler size={13} strokeWidth={1.75} />
                                    </button>
                                    <button
                                        type="button"
                                        className="project-workspace-task-remove"
                                        onClick={() => onRemoveProduct(project.id, product.id)}
                                        aria-label="Remove product"
                                    >
                                        <Trash2 size={13} strokeWidth={1.75} />
                                    </button>
                                </div>
                                {specsOpen && (
                                    <textarea
                                        className="project-product-specs-textarea"
                                        value={product.specs}
                                        onChange={(e) => onUpdateProductSpecs(project.id, product.id, e.target.value)}
                                        placeholder="Measurements, materials, dimensions..."
                                        rows={3}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="project-workspace-task-add project-workspace-design-add">
                <input
                    type="text"
                    className="project-workspace-task-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Product name..."
                />
                <input
                    type="text"
                    className="project-workspace-task-input"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Price (optional)"
                />
                <button type="button" className="project-workspace-task-add-btn" onClick={handleAdd} disabled={!newName.trim()}>
                    <Plus size={15} strokeWidth={2} />
                </button>
            </div>
        </div>
    );
}

/**
 * Global Products — what each project is actually shipping, grouped by
 * project. Click the stage pill to advance idea -> building ->
 * launched, same interaction as prototype stages. New per-project
 * state (project.products); price is a freeform label, no commerce
 * logic behind it.
 */
export default function ProductsBoard({ projects, onSelectProject, onAddProduct, onCycleProductStage, onRemoveProduct, onUpdateProductSpecs }: ProductsBoardProps) {
    const totalProducts = projects.reduce((sum, p) => sum + p.products.length, 0);
    const totalLaunched = projects.reduce((sum, p) => sum + p.products.filter((prod) => prod.stage === "launched").length, 0);

    return (
        <div className="global-board-page">
            <div className="global-board-header">
                <div>
                    <span className="global-board-eyebrow">Laboratory</span>
                    <h1>Products</h1>
                </div>
                {totalProducts > 0 && <span className="global-board-summary">{totalLaunched}/{totalProducts} launched</span>}
            </div>

            {projects.length === 0 ? (
                <div className="global-board-empty">No projects yet — create one to start tracking products.</div>
            ) : (
                <div className="global-board-groups">
                    {projects.map((project) => (
                        <ProjectProductGroup
                            key={project.id}
                            project={project}
                            onSelectProject={onSelectProject}
                            onAddProduct={onAddProduct}
                            onCycleProductStage={onCycleProductStage}
                            onRemoveProduct={onRemoveProduct}
                            onUpdateProductSpecs={onUpdateProductSpecs}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

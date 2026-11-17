import { boxesOverlap, strokeHit, unionBounds } from "../domain/geometry.js";
import { exportToJsonCanvas, importFromJsonCanvas, } from "../adapters/json-canvas.js";
// ============================================================================
// Canvas Store (In-Memory State Store)
// ============================================================================
export class CanvasStore {
    elements = new Map();
    edges = new Map();
    bible;
    constructor(initialDocument) {
        if (initialDocument) {
            this.loadDocument(initialDocument);
        }
    }
    // Element Operations
    getElement(id) {
        return this.getElementById(id);
    }
    getElementById(id) {
        return this.elements.get(id);
    }
    getAllElements() {
        return Array.from(this.elements.values());
    }
    getElements(filter) {
        const all = Array.from(this.elements.values());
        return filter ? all.filter(filter) : all;
    }
    setElement(element) {
        this.elements.set(element.id, element);
        return element;
    }
    createElement(element) {
        return this.setElement(element);
    }
    updateElement(id, patch) {
        const existing = this.elements.get(id);
        if (!existing)
            return undefined;
        const updated = { ...existing, ...patch, id };
        this.elements.set(id, updated);
        return updated;
    }
    deleteElements(ids) {
        const targetSet = new Set(ids);
        const deletedElements = [];
        const deletedEdges = [];
        for (const id of targetSet) {
            if (this.elements.delete(id)) {
                deletedElements.push(id);
            }
        }
        for (const [edgeId, edge] of this.edges.entries()) {
            if (targetSet.has(edge.fromNode) || targetSet.has(edge.toNode)) {
                this.edges.delete(edgeId);
                deletedEdges.push(edgeId);
            }
        }
        return { deletedElements, deletedEdges };
    }
    deleteElement(id) {
        return this.deleteElements([id]);
    }
    // Edge Operations
    getEdge(id) {
        return this.edges.get(id);
    }
    getAllEdges() {
        return Array.from(this.edges.values());
    }
    addEdge(edge) {
        const id = edge.id ||
            `edge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const fullEdge = { ...edge, id };
        this.edges.set(id, fullEdge);
        return fullEdge;
    }
    connect(edge) {
        return this.addEdge(edge);
    }
    deleteEdge(id) {
        return this.edges.delete(id);
    }
    disconnect(id) {
        return this.deleteEdge(id);
    }
    getConnectedEdges(nodeId) {
        return Array.from(this.edges.values()).filter((e) => e.fromNode === nodeId || e.toNode === nodeId);
    }
    // Spatial Queries & Hit Testing
    getBounds() {
        const boxes = [];
        for (const el of this.elements.values()) {
            boxes.push({
                minX: el.x,
                minY: el.y,
                maxX: el.x + el.width,
                maxY: el.y + el.height,
            });
        }
        return unionBounds(boxes);
    }
    queryBounds(box) {
        const result = [];
        for (const el of this.elements.values()) {
            const elBox = {
                minX: el.x,
                minY: el.y,
                maxX: el.x + el.width,
                maxY: el.y + el.height,
            };
            if (boxesOverlap(box, elBox)) {
                result.push(el);
            }
        }
        return result;
    }
    hitTest(pos, tolerance = 2) {
        const hits = [];
        let order = 0;
        for (const el of this.elements.values()) {
            const currentOrder = order++;
            const z = el.zIndex ?? 0;
            if (el.kind === "stroke") {
                const strokeData = {
                    v: 1,
                    size: el.strokeWidth,
                    w: el.origWidth,
                    h: el.origHeight,
                    points: el.points,
                };
                if (strokeHit(el, strokeData, pos, tolerance)) {
                    hits.push({ element: el, zIndex: z, order: currentOrder });
                }
            }
            else {
                if (pos.x >= el.x - tolerance &&
                    pos.x <= el.x + el.width + tolerance &&
                    pos.y >= el.y - tolerance &&
                    pos.y <= el.y + el.height + tolerance) {
                    hits.push({ element: el, zIndex: z, order: currentOrder });
                }
            }
        }
        hits.sort((a, b) => b.zIndex - a.zIndex || b.order - a.order);
        return hits.map((h) => h.element);
    }
    // Series Bible Management
    getBible() {
        return this.bible;
    }
    updateBible(patch) {
        if (!this.bible) {
            this.bible = {
                worldview: patch.worldview,
                style: patch.style,
                styleAnchor: patch.styleAnchor,
                characters: patch.characters ? [...patch.characters] : [],
                scenes: patch.scenes ? [...patch.scenes] : [],
                props: patch.props ? [...patch.props] : [],
            };
        }
        else {
            this.bible = {
                worldview: patch.worldview ?? this.bible.worldview,
                style: patch.style ?? this.bible.style,
                styleAnchor: patch.styleAnchor ?? this.bible.styleAnchor,
                characters: patch.characters
                    ? [...patch.characters]
                    : this.bible.characters,
                scenes: patch.scenes ? [...patch.scenes] : this.bible.scenes,
                props: patch.props ? [...patch.props] : this.bible.props,
            };
        }
        return this.bible;
    }
    // JSON Canvas 1.0 Import / Export
    exportJsonCanvas() {
        const elementsObj = {};
        for (const [id, el] of this.elements.entries()) {
            elementsObj[id] = el;
        }
        const edgesObj = {};
        for (const [id, edge] of this.edges.entries()) {
            edgesObj[id] = edge;
        }
        return exportToJsonCanvas(elementsObj, edgesObj);
    }
    toJSONCanvas() {
        return this.exportJsonCanvas();
    }
    importJsonCanvas(doc) {
        const { elements, edges } = importFromJsonCanvas(doc);
        for (const el of Object.values(elements)) {
            this.elements.set(el.id, el);
        }
        for (const edge of Object.values(edges)) {
            this.edges.set(edge.id, edge);
        }
        const nodeCount = Object.keys(elements).length;
        const edgeCount = Object.keys(edges).length;
        return {
            nodeCount,
            edgeCount,
            importedNodes: nodeCount,
            importedEdges: edgeCount,
        };
    }
    fromJSONCanvas(doc) {
        return this.importJsonCanvas(doc);
    }
    // Document Snapshot
    toDocument(id = "default", title = "Untitled Canvas") {
        const elements = {};
        for (const [k, v] of this.elements.entries())
            elements[k] = v;
        const edges = {};
        for (const [k, v] of this.edges.entries())
            edges[k] = v;
        return {
            id,
            title,
            version: 1,
            elements,
            edges,
            bible: this.bible,
            updatedAt: Date.now(),
            createdAt: Date.now(),
        };
    }
    loadDocument(doc) {
        this.elements.clear();
        this.edges.clear();
        for (const el of Object.values(doc.elements)) {
            this.elements.set(el.id, el);
        }
        for (const edge of Object.values(doc.edges)) {
            this.edges.set(edge.id, edge);
        }
        this.bible = doc.bible;
    }
    clear() {
        this.elements.clear();
        this.edges.clear();
        this.bible = undefined;
    }
}

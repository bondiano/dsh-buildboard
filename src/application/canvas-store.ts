import type {
	BoundingBox,
	CanvasDocument,
	CanvasEdge,
	CanvasElement,
	JSONCanvasDocument,
	JSONCanvasEdge,
	JSONCanvasNode,
	MarkerStrokeData,
	Point,
	SeriesBible,
} from "../domain/types.js";
import { boxesOverlap, strokeHit, unionBounds } from "../domain/geometry.js";
import {
	exportToJsonCanvas,
	importFromJsonCanvas,
} from "../adapters/json-canvas.js";

// ============================================================================
// Canvas Store (In-Memory State Store)
// ============================================================================

export class CanvasStore {
	private elements = new Map<string, CanvasElement>();
	private edges = new Map<string, CanvasEdge>();
	private bible?: SeriesBible;

	constructor(initialDocument?: CanvasDocument) {
		if (initialDocument) {
			this.loadDocument(initialDocument);
		}
	}

	// Element Operations
	public getElement<T = CanvasElement>(id: string): T | undefined {
		return this.getElementById<T>(id);
	}

	public getElementById<T = CanvasElement>(id: string): T | undefined {
		return this.elements.get(id) as unknown as T | undefined;
	}

	public getAllElements<T = CanvasElement>(): T[] {
		return Array.from(this.elements.values()) as unknown as T[];
	}

	public getElements(filter?: (el: CanvasElement) => boolean): CanvasElement[] {
		const all = Array.from(this.elements.values());
		return filter ? all.filter(filter) : all;
	}

	public setElement(element: CanvasElement): CanvasElement {
		this.elements.set(element.id, element);
		return element;
	}

	public createElement(element: CanvasElement): CanvasElement {
		return this.setElement(element);
	}

	public updateElement(
		id: string,
		patch: Partial<CanvasElement>,
	): CanvasElement | undefined {
		const existing = this.elements.get(id);
		if (!existing) return undefined;

		const updated = { ...existing, ...patch, id } as CanvasElement;
		this.elements.set(id, updated);
		return updated;
	}

	public deleteElements(ids: string[]): {
		deletedElements: string[];
		deletedEdges: string[];
	} {
		const targetSet = new Set(ids);
		const deletedElements: string[] = [];
		const deletedEdges: string[] = [];

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

	public deleteElement(id: string): {
		deletedElements: string[];
		deletedEdges: string[];
	} {
		return this.deleteElements([id]);
	}

	// Edge Operations
	public getEdge(id: string): CanvasEdge | undefined {
		return this.edges.get(id);
	}

	public getAllEdges(): CanvasEdge[] {
		return Array.from(this.edges.values());
	}

	public addEdge(edge: CanvasEdge): CanvasEdge {
		const id =
			edge.id ||
			`edge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		const fullEdge: CanvasEdge = { ...edge, id };
		this.edges.set(id, fullEdge);
		return fullEdge;
	}

	public connect(edge: CanvasEdge): CanvasEdge {
		return this.addEdge(edge);
	}

	public deleteEdge(id: string): boolean {
		return this.edges.delete(id);
	}

	public disconnect(id: string): boolean {
		return this.deleteEdge(id);
	}

	public getConnectedEdges(nodeId: string): CanvasEdge[] {
		return Array.from(this.edges.values()).filter(
			(e) => e.fromNode === nodeId || e.toNode === nodeId,
		);
	}

	// Spatial Queries & Hit Testing
	public getBounds(): BoundingBox | null {
		const boxes: BoundingBox[] = [];
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

	public queryBounds<T = CanvasElement>(box: BoundingBox): T[] {
		const result: CanvasElement[] = [];
		for (const el of this.elements.values()) {
			const elBox: BoundingBox = {
				minX: el.x,
				minY: el.y,
				maxX: el.x + el.width,
				maxY: el.y + el.height,
			};
			if (boxesOverlap(box, elBox)) {
				result.push(el);
			}
		}
		return result as unknown as T[];
	}

	public hitTest(pos: Point, tolerance = 2): CanvasElement[] {
		const hits: Array<{
			element: CanvasElement;
			zIndex: number;
			order: number;
		}> = [];
		let order = 0;

		for (const el of this.elements.values()) {
			const currentOrder = order++;
			const z = el.zIndex ?? 0;
			if (el.kind === "stroke") {
				const strokeData: MarkerStrokeData = {
					v: 1,
					size: el.strokeWidth,
					w: el.origWidth,
					h: el.origHeight,
					points: el.points,
				};
				if (strokeHit(el, strokeData, pos, tolerance)) {
					hits.push({ element: el, zIndex: z, order: currentOrder });
				}
			} else {
				if (
					pos.x >= el.x - tolerance &&
					pos.x <= el.x + el.width + tolerance &&
					pos.y >= el.y - tolerance &&
					pos.y <= el.y + el.height + tolerance
				) {
					hits.push({ element: el, zIndex: z, order: currentOrder });
				}
			}
		}

		hits.sort((a, b) => b.zIndex - a.zIndex || b.order - a.order);
		return hits.map((h) => h.element);
	}

	// Series Bible Management
	public getBible(): SeriesBible | undefined {
		return this.bible;
	}

	public updateBible(patch: Partial<SeriesBible>): SeriesBible {
		if (!this.bible) {
			this.bible = {
				worldview: patch.worldview,
				style: patch.style,
				styleAnchor: patch.styleAnchor,
				characters: patch.characters ? [...patch.characters] : [],
				scenes: patch.scenes ? [...patch.scenes] : [],
				props: patch.props ? [...patch.props] : [],
			};
		} else {
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
	public exportJsonCanvas(): JSONCanvasDocument & {
		nodes: JSONCanvasNode[];
		edges: JSONCanvasEdge[];
	} {
		const elementsObj: Record<string, CanvasElement> = {};
		for (const [id, el] of this.elements.entries()) {
			elementsObj[id] = el;
		}
		const edgesObj: Record<string, CanvasEdge> = {};
		for (const [id, edge] of this.edges.entries()) {
			edgesObj[id] = edge;
		}
		return exportToJsonCanvas(elementsObj, edgesObj);
	}

	public toJSONCanvas(): JSONCanvasDocument & {
		nodes: JSONCanvasNode[];
		edges: JSONCanvasEdge[];
	} {
		return this.exportJsonCanvas();
	}

	public importJsonCanvas(doc: JSONCanvasDocument): {
		nodeCount: number;
		edgeCount: number;
		importedNodes: number;
		importedEdges: number;
	} {
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

	public fromJSONCanvas(doc: JSONCanvasDocument): {
		nodeCount: number;
		edgeCount: number;
		importedNodes: number;
		importedEdges: number;
	} {
		return this.importJsonCanvas(doc);
	}

	// Document Snapshot
	public toDocument(id = "default", title = "Untitled Canvas"): CanvasDocument {
		const elements: Record<string, CanvasElement> = {};
		for (const [k, v] of this.elements.entries()) elements[k] = v;
		const edges: Record<string, CanvasEdge> = {};
		for (const [k, v] of this.edges.entries()) edges[k] = v;

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

	public loadDocument(doc: CanvasDocument): void {
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

	public clear(): void {
		this.elements.clear();
		this.edges.clear();
		this.bible = undefined;
	}
}

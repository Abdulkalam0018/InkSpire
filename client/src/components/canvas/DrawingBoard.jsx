import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, PencilBrush } from "fabric";

const DEFAULT_BRUSH_COLOR = "#171717";
const DEFAULT_BRUSH_SIZE = 6;
const UPDATE_DEBOUNCE_MS = 80;

function getDrawPermission(gameState) {
	return Boolean(
		gameState?.isPresenter &&
			gameState?.status === "in-round" &&
			typeof gameState?.word === "string" &&
			gameState.word.trim()
	);
}

export default function DrawingBoard({ socket, gameState, onError }) {
	const canvasElementRef = useRef(null);
	const canvasContainerRef = useRef(null);
	const fabricCanvasRef = useRef(null);
	const isApplyingRemoteRef = useRef(false);
	const pendingUpdateTimeoutRef = useRef(null);
	const latestCanvasVersionRef = useRef(0);
	const lastCanvasSizeRef = useRef({ width: 0, height: 0 });

	const [brushColor, setBrushColor] = useState(DEFAULT_BRUSH_COLOR);
	const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);

	const canDraw = useMemo(() => getDrawPermission(gameState), [gameState]);
	const isRoundActive = gameState?.status === "in-round";

	const reportError = useCallback((message) => {
		if (!message || typeof onError !== "function") return;
		onError(message);
	}, [onError]);

	useEffect(() => {
		if (!canvasElementRef.current) return undefined;

		const instance = new Canvas(canvasElementRef.current, {
			isDrawingMode: false,
			selection: false,
			backgroundColor: "#ffffff"
		});

		instance.freeDrawingBrush = new PencilBrush(instance);

		fabricCanvasRef.current = instance;

		const resizeCanvas = () => {
			const container = canvasContainerRef.current;
			if (!container) return;

			const styles = window.getComputedStyle(container);
			const horizontalPadding =
				(parseFloat(styles.paddingLeft || "0") || 0) +
				(parseFloat(styles.paddingRight || "0") || 0);

			const availableWidth = Math.max(0, container.clientWidth - horizontalPadding);
			const width = Math.max(320, Math.floor(availableWidth));
			const height = Math.max(220, Math.floor(width * 0.58));

			if (
				lastCanvasSizeRef.current.width === width &&
				lastCanvasSizeRef.current.height === height
			) {
				return;
			}

			lastCanvasSizeRef.current = { width, height };

			instance.setDimensions({ width, height });
			instance.renderAll();
		};

		resizeCanvas();

		const resizeObserver = new ResizeObserver(() => {
			resizeCanvas();
		});

		if (canvasContainerRef.current) {
			resizeObserver.observe(canvasContainerRef.current);
		}

		return () => {
			if (pendingUpdateTimeoutRef.current) {
				clearTimeout(pendingUpdateTimeoutRef.current);
			}
			resizeObserver.disconnect();
			instance.dispose();
			fabricCanvasRef.current = null;
		};
	}, []);

	useEffect(() => {
		const canvas = fabricCanvasRef.current;
		if (!canvas) return;

		if (!canvas.freeDrawingBrush) {
			canvas.freeDrawingBrush = new PencilBrush(canvas);
		}

		canvas.isDrawingMode = canDraw;
		canvas.selection = false;
		canvas.skipTargetFind = true;

		if (canvas.freeDrawingBrush) {
			canvas.freeDrawingBrush.color = brushColor;
			canvas.freeDrawingBrush.width = Number(brushSize);
		}

		canvas.forEachObject((obj) => {
			obj.selectable = false;
			obj.evented = false;
		});

		canvas.renderAll();
	}, [brushColor, brushSize, canDraw]);

    // Handle local drawing changes and emit updates to server with debounce
	useEffect(() => {
		if (!socket) return undefined;

		const canvas = fabricCanvasRef.current;
		if (!canvas) return undefined;

		const handlePathCreated = () => {

			if (!canDraw || isApplyingRemoteRef.current) return;

			if (pendingUpdateTimeoutRef.current) {
				clearTimeout(pendingUpdateTimeoutRef.current);
			}

			pendingUpdateTimeoutRef.current = setTimeout(() => {
				const snapshot = canvas.toJSON();
				socket.emit("game:canvas:update", { canvas: snapshot }, (res) => {
					if (res?.ok === false) {
						reportError(res?.error || "Unable to sync drawing");
					}
				});
			}, UPDATE_DEBOUNCE_MS);
		};

		canvas.on("path:created", handlePathCreated);

		return () => {
			canvas.off("path:created", handlePathCreated);
			if (pendingUpdateTimeoutRef.current) {
				clearTimeout(pendingUpdateTimeoutRef.current);
			}
		};
	}, [socket, canDraw, reportError]); 

	useEffect(() => {
		if (!socket) return undefined;

		const canvas = fabricCanvasRef.current;
		if (!canvas) return undefined;

		const applyRemoteCanvas = async (payload = {}) => {
			const incomingVersion = Number(payload.version) || 0;
			if (incomingVersion < latestCanvasVersionRef.current) return;
			latestCanvasVersionRef.current = incomingVersion;

			if (pendingUpdateTimeoutRef.current) {
				clearTimeout(pendingUpdateTimeoutRef.current);
			}

			isApplyingRemoteRef.current = true;
			try {
				canvas.clear();
				canvas.backgroundColor = "#ffffff";

				if (payload.canvas) {
					const loadResult = canvas.loadFromJSON(payload.canvas);
					if (loadResult && typeof loadResult.then === "function") {
						await loadResult;
					}
				}

				canvas.forEachObject((obj) => {
					obj.selectable = false;
					obj.evented = false;
				});

				canvas.renderAll();
			} catch {
				reportError("Unable to apply remote canvas state");
			} finally {
				isApplyingRemoteRef.current = false;
			}
		};

		const handleCanvasState = (payload) => {
			void applyRemoteCanvas(payload);
		};

		socket.on("game:canvasState", handleCanvasState);
		socket.emit("game:canvas:sync", {}, (res) => {
			if (res?.ok === false) {
				reportError(res?.error || "Unable to sync canvas");
			}
		});

		return () => {
			socket.off("game:canvasState", handleCanvasState);
		};
	}, [socket, reportError]);

	function handleClearCanvas() {
		if (!socket || !canDraw) return;

		if (pendingUpdateTimeoutRef.current) {
			clearTimeout(pendingUpdateTimeoutRef.current);
		}

		socket.emit("game:canvas:clear", {}, (res) => {
			if (res?.ok === false) {
				reportError(res?.error || "Unable to clear canvas");
			}
		});
	}

	return (
		<div className="drawing-board grid">
			{canDraw ? (
				<div className="drawing-toolbar">
				<label className="field compact">
					<span>Brush</span>
					<input
						type="color"
						value={brushColor}
						onChange={(event) => setBrushColor(event.target.value)}
						disabled={!canDraw}
					/>
				</label>

				<label className="field compact grow">
					<span>Size: {brushSize}px</span>
					<input
						type="range"
						min="2"
						max="24"
						value={brushSize}
						onChange={(event) => setBrushSize(Number(event.target.value))}
						disabled={!canDraw}
					/>
				</label>

				<button className="secondary" onClick={handleClearCanvas} disabled={!canDraw}>
					Clear
				</button>
				</div>
			) : null}

			<div className="canvas-frame" ref={canvasContainerRef}>
				<canvas ref={canvasElementRef} />
			</div>

			<p className="note">
				{canDraw
					? "You are presenting. Draw now and others will see updates in real time."
					: isRoundActive
						? "Presenter is drawing. You can watch updates in real time."
						: "Canvas unlocks once the presenter chooses a word and the round starts."}
			</p>
		</div>
	);
}

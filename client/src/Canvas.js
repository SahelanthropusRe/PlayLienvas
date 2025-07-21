// src/Canvas.js
import React, { useRef, useEffect, useState, useCallback } from "react";

const Canvas = ({ socket, roomId, isDrawer }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#00ffff"); // Default neon blue
  const [isErasing, setIsErasing] = useState(false);
  const [lineWidth, setLineWidth] = useState(5);

  const neonColors = ["#00ffff", "#ff00ff", "#39ff14", "#ff073a", "#faff00"];

  const drawLine = useCallback((x0, y0, x1, y1, emit = false, drawColor = color, width = lineWidth) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    ctx.strokeStyle = isErasing ? "black" : drawColor;
    ctx.lineWidth = width;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.closePath();

    if (!emit) return;

    socket.emit("draw", {
      roomId,
      x0,
      y0,
      x1,
      y1,
      color: isErasing ? "black" : drawColor,
      width,
    });
  }, [socket, roomId, color, isErasing, lineWidth]);

  useEffect(() => {
    const handleDrawFromServer = ({ x0, y0, x1, y1, color, width }) => {
      drawLine(x0, y0, x1, y1, false, color, width);
    };

    const handleClearCanvas = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    socket.on("draw", handleDrawFromServer);
    socket.on("clearCanvas", handleClearCanvas);

    return () => {
      socket.off("draw", handleDrawFromServer);
      socket.off("clearCanvas", handleClearCanvas);
    };
  }, [socket, drawLine]);

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e) => {
    if (!isDrawer) return;
    setIsDrawing(true);
    const { x, y } = getMousePos(e);
    canvasRef.current.lastX = x;
    canvasRef.current.lastY = y;
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !isDrawer) return;
    const { x, y } = getMousePos(e);
    const { lastX, lastY } = canvasRef.current;
    drawLine(lastX, lastY, x, y, true);
    canvasRef.current.lastX = x;
    canvasRef.current.lastY = y;
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Toolbar */}
      <div className="toolbar" style={{ marginBottom: 10, display: "flex", gap: 10 }}>
        <label>
          <input
            type="checkbox"
            checked={isErasing}
            onChange={() => setIsErasing(!isErasing)}
          />
          Eraser
        </label>

        <label>
          Line Width:
          <input
            type="range"
            min="1"
            max="30"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
          />
        </label>

        <label>Color:</label>
        {neonColors.map((c, i) => (
          <button
            key={i}
            style={{
              backgroundColor: c,
              border: c === color ? "2px solid white" : "none",
              width: 24,
              height: 24,
              cursor: "pointer",
              borderRadius: "50%",
            }}
            onClick={() => {
              setColor(c);
              setIsErasing(false);
            }}
          />
        ))}

        <input
          type="color"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            setIsErasing(false);
          }}
        />
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="drawing-canvas"
        style={{ border: "2px solid #0ff", backgroundColor: "black" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};

export default Canvas;

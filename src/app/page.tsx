// @ts-nocheck
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
// KaTeX is imported and used in FormulaCard component
import FormulaCard from "./components/FormulaCard";

export default function Home() {
  const [grid, setGrid] = useState(() =>
    Array(35)
      .fill(0)
      .map(() => Array(35).fill(-1))
  );
  const [patterns, setPatterns] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [slideshowInterval, setSlideshowInterval] =
    useState<NodeJS.Timeout | null>(null);
  const [slideshowSpeed, setSlideshowSpeed] = useState(100); // Default speed
  const [visualizationMode, setVisualizationMode] = useState<
    "pixels" | "numbers"
  >("pixels");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [captureSpeed, setCaptureSpeed] = useState(100); // Capture every 1 second
  const [autoTrain, setAutoTrain] = useState(false);

  const memoRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const cellLength = 10;

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const numCells = grid.length;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= numCells; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellLength, 0);
      ctx.lineTo(i * cellLength, numCells * cellLength);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * cellLength);
      ctx.lineTo(numCells * cellLength, i * cellLength);
      ctx.stroke();
    }

    // Render cells based on visualization mode
    for (let row = 0; row < numCells; row++) {
      for (let col = 0; col < numCells; col++) {
        const val = grid[row][col];
        if (val === 1) {
          if (visualizationMode === "pixels") {
            // Fill with black squares
            ctx.fillStyle = "#000"; // Pure black
            ctx.fillRect(
              col * cellLength,
              row * cellLength,
              cellLength,
              cellLength
            );
          } else if (visualizationMode === "numbers") {
            // Render as numbers
            ctx.fillStyle = "#000";
            ctx.font = "12px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
              val.toString(),
              col * cellLength + cellLength / 2,
              row * cellLength + cellLength / 2
            );
          }
        }
      }
    }
  }, [grid, cellLength, visualizationMode]);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsWebcamActive(true);
      }
    } catch (error) {
      console.error("Error accessing webcam:", error);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);

    // Safely clear the interval
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  };

  // Track if we're currently memorizing to prevent overlapping API calls
  const [isMemorizing, setIsMemorizing] = useState(false);
  const [lastPatternFetch, setLastPatternFetch] = useState(0);

  // Define fetchPatterns before using it in memorizeGrid
  const fetchPatterns = useCallback(async () => {
    try {
      const response = await axios.get("/api/hopfield/get-patterns");
      const patternCount = response.data.patterns;
      setPatterns([...Array(patternCount).keys()]);
    } catch (error) {
      console.error("Error fetching patterns:", error);
    }
  }, []);

  // Wrap in useCallback to prevent recreation on every render
  const memorizeGrid = useCallback(
    async (gridToMemorize: number[][]) => {
      // Prevent concurrent memorization operations
      if (isMemorizing) return;

      try {
        setIsMemorizing(true);

        const response = await axios.post("/api/hopfield/memorize", {
          grid: gridToMemorize,
        });
        console.log("Memorization response:", response.data);

        // Throttle pattern fetching to prevent too many UI updates
        const now = Date.now();
        if (now - lastPatternFetch > 1000) {
          // Only fetch patterns once per second
          await fetchPatterns();
          setLastPatternFetch(now);
        }
      } catch (error) {
        console.error("Error memorizing pattern:", error);
      } finally {
        setIsMemorizing(false);
      }
    },
    [isMemorizing, lastPatternFetch, fetchPatterns]
  );

  // Debounced memorization implementation removed to fix ESLint warnings
  // Will be reimplemented in a future update if needed

  // Add a throttling mechanism to prevent too frequent updates
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const [processingFrame, setProcessingFrame] = useState(false);

  // Wrap in useCallback to prevent recreation on every render
  const processWebcamFrame = useCallback(async () => {
    if (!isWebcamActive || !canvasRef.current || !videoRef.current) return;

    // Prevent concurrent processing and throttle updates
    if (processingFrame) return;

    const now = Date.now();
    // Limit updates to once every 200ms during auto-train to prevent UI thrashing
    if (autoTrain && now - lastUpdateTime < 200) return;

    setProcessingFrame(true);
    setLastUpdateTime(now);

    try {
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      tempCanvas.width = 35;
      tempCanvas.height = 35;

      tempCtx.drawImage(videoRef.current, 0, 0, 35, 35);

      const imageData = tempCtx.getImageData(0, 0, 35, 35);
      const newGrid = Array(35)
        .fill(0)
        .map(() => Array(35).fill(-1));

      for (let y = 0; y < 35; y++) {
        for (let x = 0; x < 35; x++) {
          const index = (y * 35 + x) * 4;
          const r = imageData.data[index];
          const g = imageData.data[index + 1];
          const b = imageData.data[index + 2];
          const gray = (r + g + b) / 3;

          newGrid[y][x] = gray < 128 ? 1 : -1;
        }
      }

      setGrid(newGrid);

      // Only train if auto-train is enabled and enough time has passed
      if (autoTrain) {
        await memorizeGrid(newGrid);
      }
    } catch (error) {
      console.error("Error processing webcam frame:", error);
    } finally {
      setProcessingFrame(false);
    }
  }, [
    isWebcamActive,
    canvasRef,
    videoRef,
    processingFrame,
    autoTrain,
    lastUpdateTime,
    setProcessingFrame,
    setLastUpdateTime,
    setGrid,
    memorizeGrid,
  ]);

  const startCapturing = () => {
    if (!isWebcamActive) return;
    captureIntervalRef.current = setInterval(processWebcamFrame, captureSpeed);
  };

  const stopCapturing = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  };

  const startAutoTrain = () => {
    if (isLoading || isMemorizing || !isWebcamActive) return;

    // Stop any existing capture interval
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }

    setAutoTrain(true);

    // Start capturing with a slight delay to allow state to update
    setTimeout(() => {
      captureIntervalRef.current = setInterval(
        processWebcamFrame,
        captureSpeed
      );
    }, 100);
  };

  const stopAutoTrain = () => {
    setAutoTrain(false);

    // Safely clear the interval
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopWebcam();
      stopCapturing();
    };
  }, []);

  // Mouse event handlers
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    handleDraw(event.clientX, event.clientY);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      handleDraw(event.clientX, event.clientY);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  // Touch event handlers for mobile
  const handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault(); // Prevent scrolling while drawing
    setIsDrawing(true);
    if (event.touches.length > 0) {
      handleDraw(event.touches[0].clientX, event.touches[0].clientY);
    }
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
    event.preventDefault(); // Prevent scrolling while drawing
    if (isDrawing && event.touches.length > 0) {
      handleDraw(event.touches[0].clientX, event.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    setIsDrawing(false);
  };

  // Common drawing logic for both mouse and touch events
  const handleDraw = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / cellLength);
    const y = Math.floor((clientY - rect.top) / cellLength);
    if (x >= 0 && x < grid.length && y >= 0 && y < grid.length) {
      const newGrid = grid.map((row) => [...row]);
      newGrid[y][x] = 1;
      setGrid(newGrid);
    }
  };

  const memorize = async () => {
    // Reuse the memorizeGrid function with the current grid
    await memorizeGrid(grid);
  };

  // Using the constant NUM_CELLS = 35 throughout the code

  const recallAll = async () => {
    console.log("Recall All - Current Patterns:", patterns);

    if (patterns.length === 0) {
      console.warn("No patterns available for slideshow");
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.post("/api/hopfield/recallAll");
      console.log("RecallAll response:", response.data);

      const grids = response.data.grids;
      console.log("Retrieved grids for slideshow:", grids);

      // Stop any existing slideshow
      if (slideshowInterval) {
        clearInterval(slideshowInterval);
      }

      let currentIndex = 0;
      const interval = setInterval(() => {
        setGrid(grids[currentIndex]);
        setSlideshowIndex(currentIndex);
        currentIndex = (currentIndex + 1) % grids.length;
      }, slideshowSpeed);

      setSlideshowInterval(interval);
    } catch (error) {
      console.error("Error during recallAll:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMemory = async () => {
    try {
      const response = await axios.post("/api/hopfield/clear");
      console.log(response.data.message);
      setPatterns([]);
      clearGrid();
    } catch (error) {
      console.error("Error clearing memory:", error);
    }
  };

  const stopSlideshow = () => {
    if (slideshowInterval) {
      clearInterval(slideshowInterval);
      setSlideshowInterval(null);
    }
  };

  const [energy, setEnergy] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const recallLocal = async (index: number) => {
    console.log("Recall Local - Current Patterns:", patterns);

    if (patterns.length === 0) {
      console.warn("No patterns available for recall");
      return;
    }

    try {
      setIsLoading(true);
      const response = await axios.post("/api/hopfield/recallAll");
      console.log("RecallAll response:", response.data);
      const grids = response.data.grids;
      console.log("Retrieved grids for preview:", grids);

      if (grids && grids[index]) {
        setGrid(grids[index]);
      }
    } catch (error) {
      console.error("Error during recallLocal:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const recall = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post("/api/hopfield/recall", {
        grid,
      });

      if (response.data.grid) {
        setGrid(response.data.grid);
      }

      // Display the energy value from the response
      const energy = response.data.energy;
      setEnergy(energy);
    } catch (error) {
      console.error("Error recalling pattern:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoise = () => {
    const noisyGrid = grid.map(
      (row) => row.map((cell) => (Math.random() > 0.8 ? -cell : cell)) // Add random noise
    );
    setGrid(noisyGrid);
  };

  // fetchPatterns is now defined earlier with useCallback

  const clearGrid = () => {
    setGrid(
      Array(35)
        .fill(0)
        .map(() => Array(35).fill(-1))
    );
    stopSlideshow();
  };

  useEffect(() => {
    renderCanvas();
  }, [grid, renderCanvas]);

  // Restart auto-train with new capture speed if it's active
  useEffect(() => {
    if (autoTrain && isWebcamActive) {
      // Clear existing interval
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }

      // Start a new interval with the updated speed
      captureIntervalRef.current = setInterval(
        processWebcamFrame,
        captureSpeed
      );

      // Cleanup on unmount
      return () => {
        if (captureIntervalRef.current) {
          clearInterval(captureIntervalRef.current);
          captureIntervalRef.current = null;
        }
      };
    }
  }, [captureSpeed, autoTrain, isWebcamActive, processWebcamFrame]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  useEffect(() => {
    if (memoRefs.current[slideshowIndex]) {
      memoRefs.current[slideshowIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [slideshowIndex]);

  // Equation component is defined in FormulaCard.tsx and used there

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-5xl">
      <h1 className="text-xl sm:text-2xl font-light text-center mb-1 text-gray-800">
        Hopfield Network Visualization (1.225 neurons)
      </h1>
      <div className="energy-display text-center mb-4 sm:mb-6 min-h-[24px]">
        <h3 className="text-sm sm:text-base">
          {isLoading ? (
            <span className="inline-block animate-pulse">Processing...</span>
          ) : (
            <span>Energy: {energy !== null ? energy : "Not calculated"}</span>
          )}
        </h3>
        {isMemorizing && (
          <div className="text-xs text-gray-500 mt-1">
            Training in progress...
          </div>
        )}
      </div>

      {/* Main content area - compact layout to fit in viewport */}
      <div className="flex flex-row items-start justify-center gap-4 max-w-6xl mx-auto">
        {/* Left sidebar - Memories */}
        <div className="flex flex-col w-[180px] h-[420px] border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <h2 className="text-sm font-medium text-center text-gray-700 py-2 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 flex items-center justify-center">
            <span className="mr-1">🗃️</span> memo{" "}
            {patterns.length > 0 ? `(${patterns.length})` : ""}
          </h2>

          {/* Fixed height container with scrolling */}
          <div className="flex-1 overflow-hidden relative">
            {/* Loading overlay */}
            {(isLoading || isMemorizing) && (
              <div className="absolute inset-0 bg-white bg-opacity-30 z-10 flex items-center justify-center">
                <div className="text-xs text-gray-500 animate-pulse">
                  Loading...
                </div>
              </div>
            )}

            {/* Scrollable content - Single column layout with proper scrolling */}
            <div className="h-full overflow-y-auto p-1 flex flex-col space-y-1">
              {patterns.length > 0 ? (
                patterns.map((index) => (
                  <button
                    key={index}
                    ref={(el) => {
                      memoRefs.current[index] = el;
                    }}
                    className="btn btn-sm w-full flex items-center justify-start px-2 py-2 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 rounded-md h-[40px]"
                    onClick={() => recallLocal(index)}
                    disabled={isLoading || isMemorizing}
                  >
                    <div className="flex items-center w-full">
                      <div className="w-6 h-6 bg-gray-800 text-white rounded-full flex items-center justify-center text-xs mr-2 font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 flex justify-center">
                        <span className="text-[8px] text-gray-400">▀▄▀</span>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-gray-500 p-2 w-full text-center">
                  No memories yet
                </div>
              )}
            </div>
          </div>

          {/* Clear All Button */}
          <div className="p-1 border-t border-gray-200">
            <button
              className="btn btn-sm w-full bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 py-1 text-xs rounded"
              onClick={clearMemory}
              title="Clear all memories"
            >
              <span className="flex items-center justify-center">
                <span className="mr-1">🗑️</span> Clear All
              </span>
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex flex-col w-full gap-3">
          {/* Canvases and controls in a row */}
          <div className="flex flex-row gap-4">
            {/* Left column with canvas */}
            <div className="flex flex-col gap-2">
              {/* Visualization mode toggle */}
              <div className="flex justify-center mb-1">
                <div className="inline-flex rounded-md shadow-sm" role="group">
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-medium rounded-l-lg border ${
                      visualizationMode === "pixels"
                        ? "bg-blue-50 text-blue-700 border-blue-300"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => setVisualizationMode("pixels")}
                  >
                    <span className="flex items-center">
                      <span className="mr-1">⬛</span> Pixels
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 text-xs font-medium rounded-r-lg border ${
                      visualizationMode === "numbers"
                        ? "bg-blue-50 text-blue-700 border-blue-300"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => setVisualizationMode("numbers")}
                  >
                    <span className="flex items-center">
                      <span className="mr-1">1️⃣</span> Numbers
                    </span>
                  </button>
                </div>
              </div>

              <div className="relative w-[350px] h-[420px] flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={35 * cellLength}
                  height={35 * cellLength}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="border border-gray-300 rounded-lg shadow-sm max-w-full h-auto touch-manipulation"
                  style={{ maxHeight: "420px", maxWidth: "350px" }}
                />
                {(isLoading || isMemorizing) && (
                  <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center pointer-events-none rounded-lg">
                    <div className="animate-pulse text-gray-700 bg-white px-4 py-2 rounded-full shadow-sm">
                      {isMemorizing ? "Training..." : "Processing..."}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right column with controls */}
            <div className="flex flex-col gap-3 w-full">
              {/* Speed Controls */}
              <div className="flex flex-row gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                <div className="w-1/2">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Capture Speed (ms)
                  </label>
                  <input
                    type="number"
                    value={captureSpeed}
                    onChange={(e) => setCaptureSpeed(Number(e.target.value))}
                    min="100"
                    max="2000"
                    className="w-full text-xs p-1 border rounded-md text-gray-800 bg-white"
                  />
                </div>

                <div className="w-1/2">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Slideshow Speed (ms)
                  </label>
                  <input
                    type="number"
                    value={slideshowSpeed}
                    onChange={(e) => setSlideshowSpeed(Number(e.target.value))}
                    min="100"
                    max="2000"
                    className="w-full text-xs p-1 border rounded-md text-gray-800 bg-white"
                  />
                </div>
              </div>

              {/* Pattern Controls */}
              <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-xs font-medium text-gray-700 mb-2 border-b pb-1">
                  Pattern Controls
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    className="btn btn-sm control-btn h-[36px] text-xs"
                    onClick={memorize}
                    disabled={isLoading || isMemorizing}
                    title="Train the network with current pattern"
                  >
                    <span className="flex items-center justify-center">
                      <span className="mr-1">🧠</span> Train
                    </span>
                  </button>
                  <button
                    className="btn btn-sm control-btn h-[36px] text-xs"
                    onClick={handleNoise}
                    disabled={isLoading || isMemorizing}
                    title="Add random noise to pattern"
                  >
                    <span className="flex items-center justify-center">
                      <span className="mr-1">🔀</span> Noise
                    </span>
                  </button>
                  <button
                    className="btn btn-sm control-btn h-[36px] text-xs"
                    onClick={clearGrid}
                    disabled={isLoading || isMemorizing}
                    title="Clear the grid"
                  >
                    <span className="flex items-center justify-center">
                      <span className="mr-1">🧹</span> Clear
                    </span>
                  </button>
                </div>
              </div>

              {/* Prediction Controls */}
              <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-xs font-medium text-gray-700 mb-2 border-b pb-1">
                  Prediction Controls
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    className="btn btn-sm control-btn bg-blue-500 border-blue-600 text-white hover:bg-blue-600 active:bg-blue-700 h-[36px] text-xs"
                    onClick={recall}
                    disabled={isLoading || isMemorizing}
                    title="Predict pattern from current input"
                  >
                    <span className="flex items-center justify-center">
                      <span className="mr-1">🔮</span> Predict
                    </span>
                  </button>
                  <button
                    className="btn btn-sm control-btn h-[36px] text-xs"
                    onClick={recallAll}
                    disabled={
                      isLoading || isMemorizing || patterns.length === 0
                    }
                    title="Play slideshow of all patterns"
                  >
                    <span className="flex items-center justify-center">
                      <span className="mr-1">▶️</span> Play
                    </span>
                  </button>
                  <button
                    className="btn btn-sm control-btn h-[36px] text-xs"
                    onClick={stopSlideshow}
                    disabled={!slideshowInterval}
                    title="Stop slideshow"
                  >
                    <span className="flex items-center justify-center">
                      <span className="mr-1">⏹️</span> Stop
                    </span>
                  </button>
                </div>
              </div>

              {/* Webcam Controls */}
              <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                <h3 className="text-xs font-medium text-gray-700 mb-2 border-b pb-1">
                  Webcam Controls
                </h3>

                {/* Webcam row */}
                <div className="flex items-center mb-2 p-1 bg-gray-50 rounded-md">
                  <div className="w-1/4 text-xs text-gray-500 font-medium pl-1">
                    Webcam:
                  </div>
                  <div className="w-3/4 grid grid-cols-2 gap-1">
                    <button
                      className="btn btn-sm control-btn h-[32px] text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      onClick={startWebcam}
                      disabled={isWebcamActive}
                      title="Start webcam"
                    >
                      <span className="flex items-center justify-center">
                        <span className="mr-1">📷</span> Start
                      </span>
                    </button>
                    <button
                      className="btn btn-sm control-btn h-[32px] text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                      onClick={stopWebcam}
                      disabled={!isWebcamActive}
                      title="Stop webcam"
                    >
                      <span className="flex items-center justify-center">
                        <span className="mr-1">⏹️</span> Stop
                      </span>
                    </button>
                  </div>
                </div>

                {/* Capture row */}
                <div className="flex items-center mb-2 p-1 bg-gray-50 rounded-md">
                  <div className="w-1/4 text-xs text-gray-500 font-medium pl-1">
                    Capture:
                  </div>
                  <div className="w-3/4 grid grid-cols-2 gap-1">
                    <button
                      className="btn btn-sm control-btn h-[32px] text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                      onClick={startCapturing}
                      disabled={!isWebcamActive}
                      title="Start capturing frames"
                    >
                      <span className="flex items-center justify-center">
                        <span className="mr-1">📸</span> Start
                      </span>
                    </button>
                    <button
                      className="btn btn-sm control-btn h-[32px] text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                      onClick={stopCapturing}
                      title="Stop capturing frames"
                      disabled={!isWebcamActive}
                    >
                      <span className="flex items-center justify-center">
                        <span className="mr-1">⏹️</span> Stop
                      </span>
                    </button>
                  </div>
                </div>

                {/* Auto-train row */}
                <div className="flex items-center p-1 bg-gray-50 rounded-md">
                  <div className="w-1/4 text-xs text-gray-500 font-medium pl-1">
                    Auto-train:
                  </div>
                  <div className="w-3/4 grid grid-cols-2 gap-1">
                    <button
                      className={`btn btn-sm control-btn h-[32px] text-xs ${
                        autoTrain
                          ? "bg-green-500 border-green-600 text-white"
                          : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      }`}
                      onClick={startAutoTrain}
                      disabled={!isWebcamActive || isLoading || isMemorizing}
                      title="Start auto-training from webcam"
                    >
                      {autoTrain ? (
                        <span className="flex items-center justify-center">
                          <span className="inline-block w-2 h-2 rounded-full bg-white mr-1 animate-pulse"></span>
                          Start
                        </span>
                      ) : (
                        <span className="flex items-center justify-center">
                          <span className="mr-1">🔄</span> Start
                        </span>
                      )}
                    </button>
                    <button
                      className="btn btn-sm control-btn h-[32px] text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                      onClick={stopAutoTrain}
                      disabled={!autoTrain || isLoading}
                      title="Stop auto-training"
                    >
                      <span className="flex items-center justify-center">
                        <span className="mr-1">⏹️</span> Stop
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden video element */}
        <video ref={videoRef} style={{ display: "none" }} />
      </div>

      {/* Formula Cards Section */}
      <div className="flex flex-col w-full mt-4">
        <div className="text-center my-4">
          <h2 className="text-lg font-medium">Hopfield Facts</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormulaCard
            title="Energy"
            formula="= \sum_{i<j} w_{ij} x_i x_j"
            code={`Neuron update rule:
sum_input = sum(weights[i][j] * vector[j] for j in range(len(vector)))
vector[i] = 1 if sum_input > 0 else -1`}
          />

          <FormulaCard
            title="Update"
            formula="= \text{sign}\left( \sum_j w_{ij} x_j \right)"
            code={`Neuron update rule:
sum_input = sum(weights[i][j] * vector[j] for j in range(len(vector)))
vector[i] = 1 if sum_input > 0 else -1`}
          />

          <FormulaCard
            title="Hebbian Learning"
            formula="w_{ij} \propto x_i x_j"
            code={`Hebbian learning rule:
wij += learning_rate * xi * xj`}
          />

          <FormulaCard
            title="Convergence"
            formula="E_{t+1} \leq E_t"
            code={`Convergence check:
Et+1 <= Et`}
          />
        </div>
      </div>
    </div>
  );
}

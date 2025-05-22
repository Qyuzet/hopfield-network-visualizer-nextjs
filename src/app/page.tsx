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
  const [slideshowSpeed, setSlideshowSpeed] = useState(500); // Default speed
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasOutRef = useRef<HTMLCanvasElement>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [captureSpeed, setCaptureSpeed] = useState(1000); // Capture every 1 second
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

    // Fill active cells
    for (let row = 0; row < numCells; row++) {
      for (let col = 0; col < numCells; col++) {
        if (grid[row][col] === 1) {
          ctx.fillStyle = "#000"; // Pure black
          ctx.fillRect(
            col * cellLength,
            row * cellLength,
            cellLength,
            cellLength
          );
        }
      }
    }
  }, [grid, cellLength]);

  const renderCanvasOutput = useCallback(() => {
    const canvas = canvasOutRef.current;
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

    // Render numbers only for cells with value 1
    for (let row = 0; row < numCells; row++) {
      for (let col = 0; col < numCells; col++) {
        const val = grid[row][col];
        if (val === 1) {
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
  }, [grid, cellLength]);

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

  const memorizeGrid = async (gridToMemorize: number[][]) => {
    try {
      const response = await axios.post("/api/hopfield/memorize", {
        grid: gridToMemorize,
      });
      console.log("Memorization response:", response.data);
      await fetchPatterns();
    } catch (error) {
      console.error("Error memorizing pattern:", error);
    }
  };

  // Debounced memorization implementation removed to fix ESLint warnings
  // Will be reimplemented in a future update if needed

  const processWebcamFrame = async () => {
    if (!isWebcamActive || !canvasRef.current || !videoRef.current) return;

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
    renderCanvas();

    if (autoTrain) {
      await memorizeGrid(newGrid);
    }
  };

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
    setAutoTrain(true);
    startCapturing();
  };

  const stopAutoTrain = () => {
    setAutoTrain(false);
    stopCapturing();
  };

  useEffect(() => {
    return () => {
      stopWebcam();
      stopCapturing();
    };
  }, []);

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    handleDraw(event);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      handleDraw(event);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleDraw = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / cellLength);
    const y = Math.floor((event.clientY - rect.top) / cellLength);
    if (x >= 0 && x < grid.length && y >= 0 && y < grid.length) {
      const newGrid = grid.map((row) => [...row]);
      newGrid[y][x] = 1;
      setGrid(newGrid);
    }
  };

  const memorize = async () => {
    try {
      const response = await axios.post("/api/hopfield/memorize", {
        grid,
      });
      console.log(response.data.message);
      fetchPatterns(); // Refresh patterns list
    } catch (error) {
      console.error("Error memorizing pattern:", error);
    }
  };

  // Using the constant NUM_CELLS = 35 throughout the code

  const recallAll = async () => {
    console.log("Recall All - Current Patterns:", patterns);

    if (patterns.length === 0) {
      console.warn("No patterns available for slideshow");
      return;
    }

    try {
      const response = await axios.post("/api/hopfield/recallAll");
      console.log("RecallAll response:", response.data);

      const grids = response.data.grids;
      console.log("Retrieved grids for slideshow:", grids);

      let currentIndex = 0;
      const interval = setInterval(() => {
        setGrid(grids[currentIndex]);
        setSlideshowIndex(currentIndex);
        currentIndex = (currentIndex + 1) % grids.length;
      }, slideshowSpeed);

      setSlideshowInterval(interval);
    } catch (error) {
      console.error("Error during recallAll:", error);
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

  const recallLocal = async (index: number) => {
    console.log("Recall Local - Current Patterns:", patterns);

    if (patterns.length === 0) {
      console.warn("No patterns available for recall");
      return;
    }

    try {
      const response = await axios.post("/api/hopfield/recallAll");
      console.log("RecallAll response:", response.data);
      const grids = response.data.grids;
      console.log("Retrieved grids for preview:", grids);
      setGrid(grids[index]);
    } catch (error) {
      console.error("Error during recallLocal:", error);
    }
  };

  const recall = async () => {
    try {
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
    }
  };

  const handleNoise = () => {
    const noisyGrid = grid.map(
      (row) => row.map((cell) => (Math.random() > 0.8 ? -cell : cell)) // Add random noise
    );
    setGrid(noisyGrid);
  };

  const fetchPatterns = async () => {
    try {
      const response = await axios.get("/api/hopfield/get-patterns");
      const patternCount = response.data.patterns;
      setPatterns([...Array(patternCount).keys()]);
    } catch (error) {
      console.error("Error fetching patterns:", error);
    }
  };

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
    renderCanvasOutput();
  }, [grid, renderCanvas, renderCanvasOutput]);

  useEffect(() => {
    fetchPatterns();
  }, []);

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
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-2xl font-light text-center mb-1 text-gray-800">
        Hopfield Network Visualization (1.225 neurons)
      </h1>
      <div className="energy-display text-center mb-6">
        <h3>Energy: {energy !== null ? energy : "Not calculated"}</h3>
      </div>

      <div className="flex items-center justify-center gap-4">
        {/* Memories */}
        {patterns.length > 0 && (
          <div className="flex text-center flex-col gap-2 w-full md:w-auto mr-4 h-full">
            <h2 className="text-sm font-light text-center text-gray-700 w-20">
              🗃️ memo
            </h2>
            <div className="max-h-80 overflow-y-auto">
              {patterns.map((index) => (
                <button
                  key={index}
                  ref={(el) => {
                    memoRefs.current[index] = el;
                  }}
                  className="btn btn-sm text-[0.6em] bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors py-1 px-1 my-1 rounded"
                  onClick={() => recallLocal(index)}
                >
                  ▀▄▀ {index + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-center justify-center">
              <div className="mt-4 w-full">
                <label className="block text-xs text-gray-700 mb-2">
                  Capture Speed (ms)
                </label>
                <input
                  type="number"
                  value={captureSpeed}
                  onChange={(e) => setCaptureSpeed(Number(e.target.value))}
                  min="100"
                  max="2000"
                  className="w-full text-xs input-sm p-2 border rounded text-gray-800 bg-gray-100"
                />
              </div>

              {/* Slideshow Speed Control */}
              <div className="mt-4 w-full">
                <label className="block text-xs text-gray-700 mb-2">
                  Slideshow Speed (ms)
                </label>
                <input
                  type="number"
                  value={slideshowSpeed}
                  onChange={(e) => setSlideshowSpeed(Number(e.target.value))}
                  min="100"
                  max="2000"
                  className="w-full text-xs input-sm p-2 border rounded text-gray-800 bg-gray-100"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full max-h-[260px] flex-wrap mr-64 ">
            <button
              className="btn btn-sm bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors py-2 px-4 rounded"
              onClick={memorize}
            >
              Train
            </button>
            <button
              className="btn btn-sm bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors py-2 px-2 rounded"
              onClick={handleNoise}
            >
              + Noise
            </button>

            <button
              className="btn btn-sm bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors py-2 px-2 rounded"
              onClick={clearGrid}
            >
              ⌗ Clear
            </button>
            <button
              className="btn btn-sm bg-blue-200 text-gray-500 hover:bg-gray-300 transition-colors py-2 px-4 rounded"
              onClick={recall}
            >
              Predict
            </button>
            <button
              className="btn btn-sm bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors py-2 px-4 rounded"
              onClick={recallAll}
            >
              🎞️
            </button>
            <button
              className="btn btn-sm bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors py-2 px-4 rounded"
              onClick={stopSlideshow}
            >
              ▐▐
            </button>
            <button
              className="btn btn-sm text-xs bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors py-2 px-1 rounded"
              onClick={startWebcam}
              disabled={isWebcamActive}
            >
              🔗 Webcam
            </button>
            <button
              className="btn btn-sm text-xs bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors py-2 px-1 rounded"
              onClick={stopWebcam}
              disabled={!isWebcamActive}
            >
              ◼ Webcam
            </button>
            <button
              className="btn btn-sm bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors py-2 px-1 rounded"
              onClick={startCapturing}
              disabled={!isWebcamActive}
            >
              ▶ [◉¯]
            </button>
            <button
              className="btn btn-sm text-center bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors py-2 px-1 rounded"
              onClick={stopCapturing}
            >
              ▐▐ [◉¯]
            </button>
            <button
              className="btn btn-sm text-xs bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors py-2 px-0 rounded"
              onClick={startAutoTrain}
              disabled={!isWebcamActive}
            >
              ✦ Auto Train
            </button>
            <button
              className="btn btn-sm text-xs bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors py-2 px-0 rounded"
              onClick={stopAutoTrain}
            >
              ◼ Auto Train
            </button>
          </div>
          <div>
            <button
              className="btn btn-sm bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors py-2 px-4 w-full rounded"
              onClick={clearMemory}
            >
              🗑️ All
            </button>
          </div>
        </div>
        <video
          ref={videoRef}
          style={{ display: isWebcamActive ? "none" : "none" }}
        />

        {/* Canvases */}
        <div className="flex gap-4 items-center justify-center">
          <canvas
            ref={canvasRef}
            width={35 * cellLength}
            height={35 * cellLength}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="border border-gray-300 rounded shadow-sm"
          />
          <canvas
            ref={canvasOutRef}
            width={35 * cellLength}
            height={35 * cellLength}
            className="border border-gray-300 rounded shadow-sm"
          />
        </div>
      </div>

      <div className="flex flex-col w-full mt-4">
        <div className="text-center my-4">
          <h2>Hopfield Fact</h2>
        </div>
        <div className="flex flex-wrap gap-4 max-w-full">
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

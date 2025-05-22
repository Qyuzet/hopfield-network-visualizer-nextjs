import { NextResponse } from "next/server";

// Global state for the Hopfield network
// In a production app, you might want to use a database or a more persistent solution
const NUM_CELLS = 35;

// Define global variables for state persistence across API routes
declare global {
  let weights: number[][];
  let memorizedPatterns: number[][];
}

// Initialize global state if not already initialized
if (!global.weights) {
  global.weights = Array(NUM_CELLS * NUM_CELLS)
    .fill(0)
    .map(() => Array(NUM_CELLS * NUM_CELLS).fill(0));
}
if (!global.memorizedPatterns) {
  global.memorizedPatterns = [];
}

// Helper function to convert 2D grid to 1D vector
// Exported for potential future use in other modules
export function gridToVector(grid: number[][]): number[] {
  return grid.flat();
}

// Helper function to convert 1D vector to 2D grid
// Exported for potential future use in other modules
export function vectorToGrid(vector: number[]): number[][] {
  const grid: number[][] = [];
  for (let i = 0; i < vector.length; i += NUM_CELLS) {
    grid.push(vector.slice(i, i + NUM_CELLS));
  }
  return grid;
}

// Get the count of memorized patterns
export async function GET() {
  return NextResponse.json({ patterns: global.memorizedPatterns.length });
}

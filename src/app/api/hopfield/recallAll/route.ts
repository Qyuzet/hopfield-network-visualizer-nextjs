import { NextRequest, NextResponse } from "next/server";

// Access the global state
const NUM_CELLS = 35;
// These are declared in the parent route file but we need to redeclare them here
declare global {
  let weights: number[][];
  let memorizedPatterns: number[][];
}

// Initialize if not already initialized
if (!global.weights) {
  global.weights = Array(NUM_CELLS * NUM_CELLS)
    .fill(0)
    .map(() => Array(NUM_CELLS * NUM_CELLS).fill(0));
}
if (!global.memorizedPatterns) {
  global.memorizedPatterns = [];
}

export async function POST() {
  if (!global.memorizedPatterns || global.memorizedPatterns.length === 0) {
    return NextResponse.json(
      { error: "No patterns memorized" },
      { status: 400 }
    );
  }

  // Convert flat vectors into 2D grids
  const grids = global.memorizedPatterns.map((pattern) => {
    const grid = [];
    for (let i = 0; i < pattern.length; i += NUM_CELLS) {
      grid.push(pattern.slice(i, i + NUM_CELLS));
    }
    return grid;
  });

  return NextResponse.json({ grids });
}

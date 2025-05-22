import { NextResponse } from "next/server";

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
  // Reset the weights and memorized patterns
  global.weights = Array(NUM_CELLS * NUM_CELLS)
    .fill(0)
    .map(() => Array(NUM_CELLS * NUM_CELLS).fill(0));
  global.memorizedPatterns = [];

  return NextResponse.json({ message: "Memory cleared successfully" });
}

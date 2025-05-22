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

export async function POST(request: NextRequest) {
  const { grid } = await request.json();

  if (!grid) {
    return NextResponse.json(
      { error: "No grid data received" },
      { status: 400 }
    );
  }

  // Convert 2D grid to flat vector
  const vector = grid.flat();

  // Calculate the energy of the initial state
  let energy = 0;
  for (let i = 0; i < vector.length; i++) {
    for (let j = i + 1; j < vector.length; j++) {
      energy -= global.weights[i][j] * vector[i] * vector[j];
    }
  }

  // Iteratively update the vector until convergence
  const maxIterations = 50;
  for (let iter = 0; iter < maxIterations; iter++) {
    // We don't need to track the previous vector since we're using energy for convergence
    for (let i = 0; i < vector.length; i++) {
      let sumInput = 0;
      for (let j = 0; j < vector.length; j++) {
        sumInput += global.weights[i][j] * vector[j];
      }
      vector[i] = sumInput > 0 ? 1 : -1;
    }

    // Recalculate energy after each update
    let newEnergy = 0;
    for (let i = 0; i < vector.length; i++) {
      for (let j = i + 1; j < vector.length; j++) {
        newEnergy -= global.weights[i][j] * vector[i] * vector[j];
      }
    }

    // If energy converges, break the loop
    if (newEnergy === energy) {
      break;
    }

    energy = newEnergy; // Update the energy
  }

  // Reshape the vector back into a 2D grid
  const recalledGrid = [];
  for (let i = 0; i < vector.length; i += NUM_CELLS) {
    recalledGrid.push(vector.slice(i, i + NUM_CELLS));
  }

  return NextResponse.json({ grid: recalledGrid, energy });
}

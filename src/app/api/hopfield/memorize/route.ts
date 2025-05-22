import { NextRequest, NextResponse } from 'next/server';

// Access the global state
const NUM_CELLS = 35;
// These are declared in the parent route file but we need to redeclare them here
declare global {
  var weights: number[][];
  var memorizedPatterns: number[][];
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
    return NextResponse.json({ error: 'Invalid grid data' }, { status: 400 });
  }

  const vector = grid.flat();
  global.memorizedPatterns.push(vector);

  // Update weights with Hebbian learning
  for (let i = 0; i < vector.length; i++) {
    for (let j = 0; j < vector.length; j++) {
      if (i !== j) {
        global.weights[i][j] += vector[i] * vector[j];
      }
    }
  }

  return NextResponse.json({ message: 'Pattern memorized successfully' });
}

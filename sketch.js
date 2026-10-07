// Physical constants
const v_max = 20.0;
const v_min = 2.0;
const drag = 0.01; // Drag coefficient (0-1)
const elast = 0.9; // Collision elasticity (0-1)
const grav = 1.0; // Acceleration due to gravity (pixels per frame^2)

class Ball {
  constructor(randomize = true) {
    // Radius
    this.r = 10;

    // Spatial vectors
    this.pos = createVector(0.0, 0.0);
    this.vel = createVector(0.0, 0.0);

    // Color
    this.red = 0;
    this.blue = 0;
    this.green = 0;

    if (randomize) {
      // Random size
      // this.r = random(r_min, r_max);

      // Random position
      this.pos.x = random(this.r, width - this.r);
      this.pos.y = random(this.r, height - this.r);

      // Random color
      this.red = random(0, 255);
      this.blue = random(0, 255);
      this.green = random(0, 255);
    }
  }

  update() {
    // Move
    this.pos.add(this.vel);

    // Gravity (deactivates when ball is roughly in contact with ground)
    if (this.pos.y < height - this.r * 1.2) {
      this.vel.y += grav;
    }

    // Drag
    this.vel.mult(1.0 - drag);
  }

  render() {
    noStroke();
    fill(color(this.red, this.green, this.blue));
    circle(this.pos.x, this.pos.y, this.r * 2);
  }
}

function staticCollision(ball) {
  // x bounds
  if (ball.pos.x >= width - ball.r) {
    ball.vel.x = -ball.vel.x * elast;
    ball.pos.x = width - ball.r;
  }
  if (ball.pos.x <= ball.r) {
    ball.vel.x = -ball.vel.x * elast;
    ball.pos.x = ball.r;
  }

  // y bound (no top edge)
  if (ball.pos.y >= height - ball.r) {
    // Clamp velocity to avoid infinite bouncing
    if (Math.abs(ball.vel.y) < v_min) {
      ball.vel.y = 0;
    }
    ball.vel.y = -ball.vel.y * elast;
    ball.pos.y = height - ball.r;
  }
}

let ball;
let freeze = false;

let soundsL = [];
let soundsR = [];

function adjustAudio(x, y) {
  // Horizontal pan weight: 0.0 = left edge, 1.0 = right edge
  let panR = Math.max(0.0, Math.min(1.0, x / width));
  let panL = 1.0 - panR;

  // Bottom half play base track only
  if (y >= height / 2) {
    soundsL[0].amp(1.0, 0.05);
    for (let i = 1; i < soundsL.length; i++) {
      soundsL[i].amp(0.0, 0.05);
      soundsR[i].amp(0.0, 0.05);
    }
    return;
  }

  // Ceiling where the top row (rows - 1) is reached
  const yMin = (height / 2) * (1 - (rows - 2) / 4);


  let t = (y - height / 2) / (yMin - height / 2);
  t = Math.max(0.0, Math.min(1.0, t));

  let pos = t * soundsL.length - 1;

  for (let i = 0; i < 4; i++) {
    let layerWeight = Math.max(0.0, 1.0 - Math.abs(pos - i));
    if (i === 0) {
      soundsL[0].amp(layerWeight, 0.05);
    } else {
      // Crossfade between L and R via horizontal position
      soundsL[i].amp(layerWeight * panL, 0.05);
      soundsR[i].amp(layerWeight * panR, 0.05);
    }
  }
}

const factors = [1, 0.5, 0, -0.5, -1, -1.5, -2, -2.5, -3, -3.5, -4];
const columns = 5;
const rows = factors.length; // 11 rows

let frames = [];

function getFrame(x, y, frames) {
  if (y < height / 2) {
    // Determine row iy [0, rows - 1]
    let iy = Math.min(int((1 - (y / (height / 2))) * 4) + 1, rows - 1);
    iy = Math.max(0, iy);

    // Determine col ix [0, columns - 1]
    let normX = Math.max(0.0, Math.min(1.0, x / width));
    let col = Math.min(int(normX * columns), columns - 1);

    return frames[iy][col];
  }

  // Below baseline: return bottom-most row, leftmost entry
  return frames[0][0];
}

async function setup() {
  createCanvas(512, 512);

  // Cache by filename to re-downloadind duplicates
  const imageCache = {};

  for (let iy = 0; iy < rows; iy++) {
    frames[iy] = [];

    for (let c = 0; c < columns; c++) {

      let normX = columns > 1 ? c / (columns - 1) : 0;
      let ix = Math.round(normX * iy);

      let i = iy - ix;
      let j = ix;
      let path = `frames/f${factors[i]}_f${factors[j]}.png`;

      // Load or reuse duplicate frame
      if (!imageCache[path]) {
        imageCache[path] = await loadImage(path);
      }
      frames[iy][c] = imageCache[path];
    }
  }

  // Load shared base sound (index 0)
  soundsL[0] = await loadSound('audio/l0.mp3');
  soundsR[0] = soundsL[0]; // Shared track for bottom half

  // Load directional layers 1 through 3
  for (let i = 1; i < 4; i++) {
    soundsL[i] = await loadSound('audio/l' + i + '.mp3');
    soundsR[i] = await loadSound('audio/r' + i + '.mp3');
  }

  // Start all unique sound files looping in parallel
  soundsL[0].loop();
  soundsL[0].play();
  for (let i = 1; i < 4; i++) {
    soundsL[i].loop();
    soundsL[i].play();
    soundsR[i].loop();
    soundsR[i].play();
  }

  // Initialize ball
  ball = new Ball(false);
  ball.pos.x = width / 2;
  ball.pos.y = height / 2;
  ball.red = 255;
}

function draw() {
  background(120);
  fill(140);

  // Do ball physics unless frozen
  if (!freeze) {
    ball.update();
    staticCollision(ball);
  }

  // Choose and display frame
  let frame = getFrame(ball.pos.x, ball.pos.y, frames);
  if (frame) {
    image(frame, 0, 0);
  }

  // Display ball
  ball.render();

  // Update audio
  adjustAudio(ball.pos.x, ball.pos.y);
}

const accel = 0.1; // Click acceleration factor
const v = 100; // Random variability of click location

function mousePressed() {
  // Move toward mouse
  ball.vel.x += (mouseX - ball.pos.x + random(-v, v)) * accel;
  ball.vel.y += (mouseY - ball.pos.y + random(-v, v)) * accel;
}

function keyPressed() {
  // Toggle ball movement
  if (key === ' ') {
    freeze = !freeze;
  }
}

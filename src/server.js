// server.js - Simplified Bun server using serve function

import { serve } from "bun";
import { spawn } from "child_process";

const V4L2_DEVICE = "/dev/video10";
const BASE_PATH = "./public";
const DEBUG = {
  ffmpeg: false,
};

// Initialize FFmpeg process
let ffmpegProcess = null;

// Setup FFmpeg to pipe received frames to v4l2loopback
function setupFFmpeg() {
  try {
    // prettier-ignore
    const process = spawn('ffmpeg', [
      '-f', 'mjpeg',         // Input format as Motion JPEG
      '-i', 'pipe:0',        // Read from stdin
      '-pix_fmt', 'yuv420p', // Convert to YUV420P format
      '-f', 'v4l2',          // Output to V4L2 device
      V4L2_DEVICE            // Output device
    ]);

    if (DEBUG.ffmpeg) {
      process.stderr.on("data", (data) => {
        console.log(`FFmpeg: ${data.toString()}`);
      });
    }

    process.on("close", (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
      ffmpegProcess = null;
    });

    console.log("FFmpeg started for v4l2loopback");
    return process;
  } catch (error) {
    console.error("Failed to start FFmpeg:", error);
    return null;
  }
}

function killFFmpeg() {
  if (ffmpegProcess) {
    console.log("Killing FFmpeg process");
    ffmpegProcess.kill("SIGINT");
  }
}

serve({
  port: 8000,
  fetch(req, server) {
    // Handle websocket connections
    if (server.upgrade(req)) {
      return; // Upgraded to WebSocket
    }
    const url = new URL(req.url);

    return new Response(
      Bun.file(
        BASE_PATH + (url.pathname === "/" ? "/index.html" : url.pathname),
      ),
    );
  },

  websocket: {
    open(ws) {
      console.log("Client connected");
      if (!ffmpegProcess) {
        ffmpegProcess = setupFFmpeg();
      }
    },

    message(ws, message) {
      if (ffmpegProcess && ffmpegProcess.stdin.writable) {
        ffmpegProcess.stdin.write(message);
      }
    },

    close(ws) {
      killFFmpeg();
      console.log("Client disconnected");
    },
  },
});

// Cleanup on server exit
process.on("SIGINT", () => {
  killFFmpeg();
  process.exit(0);
});

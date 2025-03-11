const SERVER_URL = "wss://webcam.proxy.example.com";
const FPS = {
  30: 33,
  60: 16, // afaik iPhone allows to use only 30fps in browser
};
const DIMENSIONS = {
  width: 640,
  height: 480,
};
const CAMERA_FACING_MODE = "environment"; // or "user"
const IMAGE_QUALITY = 0.9; // 0..1 higher is better

let localStream;
let websocket;
let isStreaming = false;
let frameInterval;

const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const statusDiv = document.getElementById("status");
const videoElement = document.getElementById("localVideo");

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

// Start camera and stream
startButton.addEventListener("click", async () => {
  try {
    const constraints = {
      video: {
        facingMode: { ideal: CAMERA_FACING_MODE },
        width: { ideal: DIMENSIONS.width },
        height: { ideal: DIMENSIONS.height },
      },
    };

    // Get camera stream
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = localStream;

    // Handle video metadata loaded
    videoElement.onloadedmetadata = () => {
      // Set canvas size
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      // Connect to server
      connectToServer();
    };

    startButton.disabled = true;
    stopButton.disabled = false;
    statusDiv.textContent = "Starting...";
  } catch (error) {
    console.error("Camera error:", error);
    statusDiv.textContent = `Error: ${error.message}`;
  }
});

// Stop streaming
stopButton.addEventListener("click", () => {
  stopStreaming();
  startButton.disabled = false;
  stopButton.disabled = true;
  statusDiv.textContent = "Disconnected";
});

function connectToServer() {
  websocket = new WebSocket(SERVER_URL);
  websocket.binaryType = "arraybuffer";

  websocket.onopen = () => {
    statusDiv.textContent = "Connected";
    isStreaming = true;
    startCapturing();
  };

  websocket.onclose = () => {
    statusDiv.textContent = "Disconnected";
    stopStreaming();
  };

  websocket.onerror = (error) => {
    console.error("Connection error:", error);
    statusDiv.textContent = "Connection error";
    stopStreaming();
  };
}

// Start frame capture
function startCapturing() {
  if (!isStreaming) return;

  frameInterval = setInterval(() => {
    if (!isStreaming || websocket.readyState !== WebSocket.OPEN) {
      clearInterval(frameInterval);
      return;
    }

    // Draw video frame to canvas
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Get JPEG data as blob
    canvas.toBlob(
      (blob) => {
        // Convert to binary data
        blob.arrayBuffer().then((buffer) => {
          websocket.send(buffer);
        });
      },
      "image/jpeg",
      IMAGE_QUALITY,
    );
  }, FPS[30]);
}

// Stop all streaming components
function stopStreaming() {
  isStreaming = false;

  if (frameInterval) {
    clearInterval(frameInterval);
    frameInterval = null;
  }

  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    videoElement.srcObject = null;
  }

  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.close();
    websocket = null;
  }
}

// Firebase configurations
const firebaseConfig = {
  apiKey: "AIzaSyCB_Gz5ADmjLxxxBYZ0OS7k_C03Wo42xFY",
  authDomain: "doorsure-sd25.firebaseapp.com",
  databaseURL: "https://doorsure-sd25-default-rtdb.firebaseio.com/",
  projectId: "doorsure-sd25",
  storageBucket: "doorsure-sd25.firebasestorage.app",
  messagingSenderId: "417711210584",
  appId: "1:417711210584:web:cec2421dafb4a19f008a2d",
  measurementId: "G-ZWNQT99F1Y",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const statusRef = db.ref('door-status');
const ipRef = db.ref('servo-ip_address');

let socket = null;

// Update UI with current status
function updateStatusUI(value) {
  document.getElementById("curr_status").textContent = value === 1 ? "Open" : "Closed";
}

// Control buttons
function openAction() {
  statusRef.set(1);
}

function closeAction() {
  statusRef.set(0);
}

function viewLiveFeed() {
  window.location.href = "https://esp32-object-detection-d863a.web.app";
}

// Set up WebSocket once IP is known
function setupWebSocket(ip) {
  const wsUrl = `ws://${ip}/ws`;
  console.log("Connecting to WebSocket at:", wsUrl);

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('WebSocket connection established');
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.onclose = () => {
    console.warn("WebSocket connection closed. Retrying in 5s...");
    setTimeout(() => connectToServoWebSocket(), 5000); // Retry connection
  };

  socket.onmessage = (event) => {
    console.log('Message from ESP32:', event.data);
  };
}

// Fetch IP and connect to WebSocket
function connectToServoWebSocket() {
  ipRef.once('value')
    .then((snapshot) => {
      const ip = snapshot.val();
      if (ip) {
        setupWebSocket(ip);
      } else {
        console.error('No IP address found in Firebase');
      }
    })
    .catch((error) => {
      console.error('Failed to retrieve IP address from Firebase:', error);
    });
}

// Listen to status changes and send command if WebSocket is ready
statusRef.on('value', (snapshot) => {
  const status = snapshot.val();
  if (status !== null) {
    updateStatusUI(status);

    if (socket && socket.readyState === WebSocket.OPEN) {
      const command = status === 1 ? 'open' : 'close';
      console.log('Sending status to ESP32:', command);
      socket.send(command);
    } else {
      console.log('WebSocket is not open');
    }
  } else {
    console.log("No status data found!");
  }
});

document.addEventListener('DOMContentLoaded', () => {
  connectToServoWebSocket();
});

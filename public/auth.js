// Firebase config
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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

console.log("auth.js loaded");

// LOGIN with username and password
function login() {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  // Look up the email by username
  db.ref('usernames/' + username).once('value')
    .then(snapshot => {
      const email = snapshot.val();
      if (email) {
        return auth.signInWithEmailAndPassword(email, password);
      } else {
        throw new Error("Username not found.");
      }
    })
    .then(userCredential => {
      // Get the username from the database using email
      const email = userCredential.user.email;
      return db.ref('emails/' + btoa(email)).once('value')
        .then(snapshot => {
          const username = snapshot.val();
          if (username) {
            localStorage.setItem('username', username); // store in localStorage
          }
          document.getElementById('message').innerText = "Login successful!";
          window.location.href = "home.html";
        });
    })
    .catch(error => {
      document.getElementById('message').innerText = error.message || "Login failed.";
    });
}

// SIGN UP with username, email, and password
function signup() {
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!username) {
    document.getElementById('message').innerText = "Username is required.";
    return;
  }

  // Check if username already exists
  db.ref('usernames/' + username).once('value')
    .then(snapshot => {
      if (snapshot.exists()) {
        throw new Error("Username is already taken.");
      }

      // Create user with email & password
      return auth.createUserWithEmailAndPassword(email, password);
    })
    .then(userCredential => {
      const uid = userCredential.user.uid;

      // Write username→email, email→username, and centralized user node with prefs
      return Promise.all([
        db.ref('usernames/' + username).set(email),
        db.ref('emails/' + btoa(email)).set(username),
        db.ref('users/' + uid).set({
          email: email,
          username: username,
          preferences: {
            notifyGarageOpen: true,
            notifyGarageClose: true,
            notifyOpenTimeout: 1 // Default to 1 minute
          }
        })
      ]);
    })
    .then(() => {
      document.getElementById('message').innerText = "Signup successful!";
    })
    .catch(error => {
      console.error("Signup error:", error);
      document.getElementById('message').innerText = error.message;
    });
}


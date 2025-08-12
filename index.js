import { Server } from "socket.io";
import { createServer } from "http";
import { randomUUID } from "crypto";

// Users Map: userId -> { geoJSON }
const users = new Map();

// Username validatsiyasi
function isValidUsername(username) {
  if (typeof username !== "string") return false;
  if (username.length < 3 || username.length > 20) return false;
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return false;
  return true;
}

// Username bandligini tekshirish
function isUsernameTaken(username) {
  const lowerCaseUsername = username.toLowerCase();
  for (const user of users.values()) {
    if (user.geoJSON.properties.username.toLowerCase() === lowerCaseUsername) {
      return true;
    }
  }
  return false;
}

// Avatar validatsiyasi
function isValidAvatar(file) {
  if (!file || typeof file.type !== "string" || !file.arrayBuffer) return false;
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
  if (!allowedTypes.includes(file.type)) return false;
  // Max 1MB
  if (file.arrayBuffer.length > 1024 * 1024) return false;
  return true;
}

// Koordinata validatsiyasi
function isValidCoordinates(coords) {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number"
  );
}

// Xabar validatsiyasi
function isValidMessage(msg) {
  return typeof msg === "string" && msg.length > 0 && msg.length <= 500;
}

// GeoJSON kolleksiyasi
function getUsersAsGeoJSON() {
  const features = Array.from(users.values()).map((user) => user.geoJSON);
  features.sort(
    (a, b) =>
      new Date(b.properties.joinedAt) - new Date(a.properties.joinedAt)
  );
  return {
    type: "FeatureCollection",
    features: features,
  };
}

// Barcha foydalanuvchilarga yangilanishlarni yuborish
function broadcastUpdates() {
  const usersGeoJSON = getUsersAsGeoJSON();
  io.emit("update_users", usersGeoJSON);
}

const httpServer = createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Socket.IO server is running");
  } else if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", users: users.size }));
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

const io = new Server(httpServer, {
  cors: {
    origin: [
      "https://friends-web2.vercel.app",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});

io.on("connection", (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.emit("update_users", getUsersAsGeoJSON());

  socket.on("new_user", (user) => {
    // Validatsiya
    if (!isValidUsername(user.username)) {
      socket.emit("username_invalid", {
        message:
          "Username must be 3-20 characters, only letters, numbers, and underscores.",
      });
      return;
    }
    if (isUsernameTaken(user.username)) {
      socket.emit("username_taken", {
        message: "This username is already taken. Please choose another.",
      });
      return;
    }
    if (!isValidAvatar(user.file)) {
      socket.emit("avatar_invalid", {
        message: "Avatar must be PNG/JPEG and less than 1MB.",
      });
      return;
    }
    if (!isValidCoordinates(user.coordinates)) {
      socket.emit("coordinates_invalid", {
        message: "Invalid coordinates.",
      });
      return;
    }

    const userId = randomUUID();
    socket.userId = userId;

    const userGeoJSON = {
      type: "Feature",
      properties: {
        userId: userId,
        username: user.username,
        avatar: {
          type: user.file.type,
          arrayBuffer: user.file.arrayBuffer,
        },
        joinedAt: new Date().toISOString(),
      },
      geometry: {
        type: "Point",
        coordinates: user.coordinates,
      },
    };

    users.set(userId, { geoJSON: userGeoJSON });
    socket.emit("you_joined", userGeoJSON);
    broadcastUpdates();
  });

  socket.on("send_message", ({ recipientId, message }) => {
    const senderId = socket.userId;
    if (!senderId) return;
    if (!isValidMessage(message)) return;

    for (const [id, targetSocket] of io.sockets.sockets) {
      if (targetSocket.userId === recipientId) {
        targetSocket.emit("receive_message", { senderId, message });
        break;
      }
    }
  });

  socket.on("user_exit", () => {
    socket.disconnect(true);
  });

  socket.on("disconnect", () => {
    const userId = socket.userId;
    if (userId && users.has(userId)) {
      const username = users.get(userId).geoJSON.properties.username;
      console.log(`User ${username} (${userId}) disconnected`);
      users.delete(userId);
      broadcastUpdates();
    }
  });
});
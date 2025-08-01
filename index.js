import { Server } from "socket.io"
import { createServer } from "http"
import { randomUUID } from "crypto"

// Users Map: userId -> { geoJSON }
const users = new Map()

// Helper function to check if a username is already taken (case-insensitive)
function isUsernameTaken(username) {
	const lowerCaseUsername = username.toLowerCase()
	for (const user of users.values()) {
		if (user.geoJSON.properties.username.toLowerCase() === lowerCaseUsername) {
			return true
		}
	}
	return false
}

// Helper function to get all users as a GeoJSON Feature Collection
function getUsersAsGeoJSON() {
	const features = Array.from(users.values()).map(user => user.geoJSON)
	features.sort((a, b) => new Date(b.properties.joinedAt) - new Date(a.properties.joinedAt))
	return {
		type: "FeatureCollection",
		features: features,
	}
}

// Helper function to broadcast updates to all users
function broadcastUpdates() {
	const usersGeoJSON = getUsersAsGeoJSON()
	io.emit("update_users", usersGeoJSON)
}

const httpServer = createServer((req, res) => {
	if (req.url === '/') {
		res.writeHead(200, { 'Content-Type': 'text/plain' })
		res.end('Socket.IO server is running')
	} else if (req.url === '/health') {
		res.writeHead(200, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ status: 'ok', users: users.size }))
	} else {
		res.writeHead(404, { 'Content-Type': 'text/plain' })
		res.end('Not Found')
	}
})

const io = new Server(httpServer, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"],
	}
})

const PORT = process.env.PORT || 3000

httpServer.listen(PORT, '0.0.0.0', () => {
	console.log(`Server listening on port ${PORT}`)
})

io.on("connection", socket => {
	console.log(`New connection: ${socket.id}`)

	socket.emit("update_users", getUsersAsGeoJSON())

	socket.on("new_user", user => {
		// --- Username Validation ---
		if (isUsernameTaken(user.username)) {
			socket.emit("username_taken", { message: "This username is already taken. Please choose another." })
			return // Stop execution
		}
		// --- End Validation ---

		const userId = randomUUID()
		socket.userId = userId

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
			}
		}

		users.set(userId, { geoJSON: userGeoJSON })
		socket.emit("you_joined", userGeoJSON)
		broadcastUpdates()
	})

	socket.on("send_message", ({ recipientId, message }) => {
		const senderId = socket.userId
		if (!senderId) return

		for (const [id, targetSocket] of io.sockets.sockets) {
			if (targetSocket.userId === recipientId) {
				targetSocket.emit("receive_message", { senderId, message })
				break
			}
		}
	})

	socket.on("user_exit", () => {
		socket.disconnect(true)
	})

	socket.on("disconnect", () => {
		const userId = socket.userId
		if (userId && users.has(userId)) {
			const username = users.get(userId).geoJSON.properties.username
			console.log(`User ${username} (${userId}) disconnected`)
			users.delete(userId)
			broadcastUpdates()
		}
	})
})

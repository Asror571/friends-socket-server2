import { Server } from "socket.io"
import { createServer } from "http"

const websockets = []

const usersGeoJSONCollection = {
	type: "FeatureCollection",
	features: [],
}

// HTTP server uchun basic routing
const httpServer = createServer((req, res) => {
	if (req.url === '/') {
		res.writeHead(200, { 'Content-Type': 'text/plain' })
		res.end('Socket.IO server is running')
	} else if (req.url === '/health') {
		res.writeHead(200, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ status: 'ok', users: usersGeoJSONCollection.features.length }))
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

io.on("connection", websocket => {
	websockets.push(websocket)

	websocket.on("new_user", user => {

		console.log( user )

		const userGeoJSON = {
			type: "Feature",
			properties: {
				username: user.username,
				avatar: {
					type: user.file.type,
					arrayBuffer: user.file.arrayBuffer,
				},
			},
			geometry: {
				type: "Point",
				coordinates: user.coordinates,
			}
		}

		usersGeoJSONCollection.features.push(userGeoJSON)
		websocket.emit("new_user", usersGeoJSONCollection)

		for (const _websocket of websockets) {
			if (websocket.id !== _websocket.id) {
				_websocket.emit("new_user", userGeoJSON)
			}
		}
	})

	websocket.on("disconnect", () => {
		const index = websockets.indexOf(websocket)
		if (index > -1) {
			websockets.splice(index, 1)
		}
	})

	console.log("New user connected")
})

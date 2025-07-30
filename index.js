import { Server } from "socket.io"
import { createServer } from "http"

const MAX_ONLINE_USERS = 100

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

	websocket.on( "init", () => {

		websocket.emit( "init", usersGeoJSONCollection )
	} )

	websocket.on("new_user", user => {

		const userGeoJSON = {
			type: "Feature",
			properties: {
				username: user.username,
				avatar: {
					type: user.file.type,
					arrayBuffer: user.file.arrayBuffer,
				},
				joinedAt: new Date(),
			},
			geometry: {
				type: "Point",
				coordinates: user.coordinates,
			}
		}

		usersGeoJSONCollection.features.push(userGeoJSON)

		usersGeoJSONCollection.features.sort( ( user1, user2 ) => user2.properties.joinedAt.getTime() - user1.properties.joinedAt.getTime() )

		let updated = false

		if ( usersGeoJSONCollection.features.length > MAX_ONLINE_USERS ) {

			usersGeoJSONCollection.features.pop()
			updated = true
		}

		websocket.emit("new_user", usersGeoJSONCollection)
		
		if ( updated ) {

			websocket.emit("update_users", usersGeoJSONCollection)
		}

		for (const _websocket of websockets) {
			if (websocket.id !== _websocket.id) {
				_websocket.emit("new_user", userGeoJSON)
				
				if ( updated ) {

					_websocket.emit("update_users", usersGeoJSONCollection)
				}
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

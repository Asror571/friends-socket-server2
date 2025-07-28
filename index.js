import { Server } from "socket.io"
import { createServer } from "http"

const websockets = []

const httpServer = createServer()
const io = new Server( httpServer, {
	cors: {
		origin: "*",
		methods: [ "GET", "POST" ],
	}
} )

httpServer.listen( 3_000, () => {

	console.log( "Server listening on port 3000" )
} )

io.on( "connection", user => {

	websockets.push( user )

	user.on( "new_user", user => {

		const geoJSON = {
			type: "Feature",
			properties: {
				username: user.username,
				avatar: user.avatar,
			},
			geometry: {
				type: "Point",
				coordinates: user.coordinates,
			}
		}

		for ( const websocket of websockets ) {

			websocket.emit( "new_user", geoJSON )
		}
	} )

	console.log( "New user..." )
} )

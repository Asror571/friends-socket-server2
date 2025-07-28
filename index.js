import { Server } from "socket.io"
import { createServer } from "http"

const websockets = []

const usersGeoJSONCollection = {
	type: "FeatureCollection",
	features: [],
}

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

io.on( "connection", websocket => {

	websockets.push( websocket )

	websocket.on( "new_user", user => {

		const userGeoJSON = {
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

		usersGeoJSONCollection.features.push( userGeoJSON )

		websocket.emit( "new_user", usersGeoJSONCollection )

		for ( const _websocket of websockets ) {

			if ( websocket.id !== _websocket.id ) {

				_websocket.emit( "new_user", userGeoJSON )
			}
		}
	} )

	console.log( "New user..." )
} )

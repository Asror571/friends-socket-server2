const users = [
	{
		id: 1,
		username: "A",
		date: Math.random(),
	},
	{
		id: 2,
		username: "B",
		date: Math.random()
	},
	{
		id: 3,
		username: "C",
		date: Math.random()
	},
	{
		id: 4,
		username: "D",
		date: Math.random()
	},
	{
		id: 5,
		username: "E",
		date: Math.random()
	},
	{
		id: 6,
		username: "F",
		date: Math.random()
	},
]

users.sort( ( a, b ) => b.date - a.date ) // Desc
// users.sort( ( a, b ) => a.date - b.date ) // Asc

console.log( users.slice( 1, users.length ) )

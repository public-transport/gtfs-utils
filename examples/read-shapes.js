'use strict'

const readCsv = require('../read-csv')
const readShapes = require('../read-shapes')

const readFile = async (file) => {
	return await readCsv(require.resolve(`sample-gtfs-feed/gtfs/${file}.txt`))
}

;(async () => {
	const shapes = readShapes(readFile, {
		shapesRow: s => s.shape_id === 'a-downtown-all-day-s0',
	})
	for await (const [shapeId, points] of shapes) {
		console.log(shapeId, points)
	}
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})

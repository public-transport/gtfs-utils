'use strict'

const test = require('tape')

const readCsv = require('../read-csv')
const readShapes = require('../read-shapes')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

test('read-shapes', async (t) => {
	const shapes = await readShapes(readFile)
	const byShapeId = {}
	for await (const [shapeId, points] of shapes) {
		byShapeId[shapeId] = points
	}

	t.ok(Array.isArray(byShapeId['a-downtown-all-day-s0']))
	t.ok(Array.isArray(byShapeId['a-outbound-all-day-s0']))
})

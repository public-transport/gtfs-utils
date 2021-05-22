'use strict'

const expectSorting = require('./lib/expect-sorting')

const readShapes = async function* (readFile, filters = {}) {
	if ('function' !== typeof readFile) {
		throw new Error('readFile must be a function.')
	}

	const {
		shapesRow: shapesRowFilter,
	} = {
		shapesRow: () => true,
		...filters,
	}
	if ('function' !== typeof shapesRowFilter) {
		throw new Error('filters.shapesRow must be a function.')
	}

	const shapes = await readFile('shapes')
	const checkShapesSorting = expectSorting('shapes', (a, b) => {
		if (a.shape_id < b.shape_id) return -1
		if (a.shape_id > b.shape_id) return 1
		const seqA = parseInt(a.shape_pt_sequence)
		const seqB = parseInt(b.shape_pt_sequence)
		if (seqA === seqB) return 0
		return seqA < seqB ? -1 : 1
	})

	let shape_id = NaN, points = []
	for await (const s of shapes) {
		if (!shapesRowFilter(s)) continue
		checkShapesSorting(s)

		if (s.shape_id !== shape_id) {
			if (points.length > 0) {
				yield [shape_id, points]
				points = []
			}
			shape_id = s.shape_id
		}

		points.push({
			shape_pt_lat: parseFloat(s.shape_pt_lat),
			shape_pt_lon: parseFloat(s.shape_pt_lon),
			shape_pt_sequence: parseInt(s.shape_pt_sequence),
			shape_dist_traveled: parseFloat(s.shape_dist_traveled),
		})
	}

	if (points.length > 0) {
		yield [shape_id, points]
	}
}

module.exports = readShapes

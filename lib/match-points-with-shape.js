'use strict'

const debug = require('debug')('gtfs-utils:match-points-with-shape')
const {default: distance} = require('@turf/distance')
const {default: bearing} = require('@turf/bearing')
const {default: destination} = require('@turf/destination')
const {default: linesIntersection} = require('@turf/line-intersect')

// adapted from @turf/nearest-point-on-line
// https://github.com/Turfjs/turf/blob/8411070/packages/turf-nearest-point-on-line/index.ts#L67-L126
// returns [distToSegment, nearestPoint]
const nearestOnSegment = (pt, segPtA, segPtB) => {
	const distToA = distance({type: 'Point', coordinates: segPtA}, pt)
	if (distToA === 0) return [segPtA, distToA]
	const distToB = distance({type: 'Point', coordinates: segPtB}, pt)
	if (distToB === 0) return [segPtB, distToB]

	const perpLength = Math.max(distToA, distToB)
	const dir = bearing(segPtA, segPtB)
	const isect = linesIntersection({
		type: 'LineString',
		coordinates: [
			destination(pt, perpLength, dir + 90).geometry.coordinates,
			destination(pt, perpLength, dir - 90).geometry.coordinates,
		],
	}, {
		type: 'LineString',
		coordinates: [segPtA, segPtB],
	})
	if (isect.features.length > 0) { // there is an intersection
		const intersectionPt = isect.features[0]
		const dist = distance(pt, intersectionPt)
		if (dist <= distToA && dist <= distToB) {
			// create coords array with correct nr of dimensions
			const isectCoords = new Array(segPtA.length).fill(null)
			for (let i = 0, l = intersectionPt.geometry.coordinates.length; i < l; i++) {
				isectCoords[i] = intersectionPt.geometry.coordinates[i]
			}
			return [isectCoords, dist]
		}
	}
	return distToA < distToB
		? [segPtA, distToA]
		: [segPtB, distToB]
}

const matchPointsWithShape = function* (shape, points) {
	// iterate over shape segments, identify nearby points
	let pointsIdx = 0
	let prevPrevDistance = Infinity, prevDistance = Infinity
	let iPrevNearest = NaN, prevNearest = null
	for (let i = 1; i < shape.length && pointsIdx < points.length; i++) {
		const pt = points[pointsIdx]
		const fromShapePt = shape[i - 1]
		const toShapePt = shape[i]
		const [
			nearest, distance,
		] = nearestOnSegment(pt, fromShapePt, toShapePt)
		const iNearest = nearest === fromShapePt
			? i - 1
			: (nearest === toShapePt ? i : NaN)
		debug({
			pointsIdx, nrOfPoints: points.length - 1, pt,
			i, nrOfShapePoints: shape.length,
			fromShapePt, toShapePt,
			iNearest, nearest,
			distance, prevDistance, prevPrevDistance,
			iPrevNearest, prevNearest,
		})

		if (distance === 0 && !Number.isNaN(iNearest)) {
			const shapePt = shape[iNearest]
			yield [iNearest, iNearest, shapePt, distance, pointsIdx]

			pointsIdx++
			i-- // nearest was 1 iter. ago, repeat loop with *current* segment
			prevPrevDistance = prevDistance = Infinity
			prevNearest = null
			iPrevNearest = NaN
		} else if (
			// Has the shape come closest to the stop during the last segment?
			prevDistance < prevPrevDistance
			&& distance >= prevDistance
			&& prevDistance < .3 // 300m
		) {
			// We're greedy here, we assign the stop as soon as the shape has
			// approached it even by a tiny distance.
			if (Number.isNaN(iPrevNearest)) {
				// previous nearest was perpendicular onto (previous) segment
				yield [i - 1, i, prevNearest, prevDistance, pointsIdx]
			} else {
				// previous nearest was a shape point
				const shapePt = shape[iPrevNearest]
				yield [iPrevNearest, iPrevNearest, shapePt, prevDistance, pointsIdx]
			}

			pointsIdx++
			i-- // nearest was 1 iter. ago, repeat loop with *current* segment
			prevPrevDistance = prevDistance = Infinity
			prevNearest = null
			iPrevNearest = NaN
		} else {
			prevPrevDistance = prevDistance
			prevDistance = distance
			iPrevNearest = iNearest
			prevNearest = nearest
		}
	}
}

module.exports = matchPointsWithShape

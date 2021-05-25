'use strict'

const debug = require('debug')('gtfs-utils:build-trajectory')
const {default: distance} = require('@turf/distance')
const {default: bearing} = require('@turf/bearing')
const {default: destination} = require('@turf/destination')
const {default: linesIntersection} = require('@turf/line-intersect')

// adapted from @turf/nearest-point-on-line
// https://github.com/Turfjs/turf/blob/8411070/packages/turf-nearest-point-on-line/index.ts#L67-L126
// returns [distToSegment, nearestPoint]
const nearestOnSegment = (pt, segPtA, segPtB) => {
	const distToA = distance({type: 'Point', coordinates: segPtA}, pt)
	const distToB = distance({type: 'Point', coordinates: segPtB}, pt)

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
			return [intersectionPt.geometry.coordinates, dist]
		}
	}
	return distToA < distToB
		? [segPtA, distToA]
		: [segPtB, distToB]
}

// assumes linear vehicle speed along the shape
const addInterpolatedTimes = (shapePt, fromI, toI) => {
	const fromDep = shapePt[fromI][4]
	const toArr = shapePt[toI][3]
	const dTime = toArr - fromDep

	const distances = new Array(toI - fromI).fill(0)
	let dDistance = 0
	for (let i = fromI + 1, j = 0; i <= toI; i++, j++) {
		distances[j] = distance(shapePt[i - 1], shapePt[i])
		dDistance += distances[j]
	}

	let dist = 0
	for (let i = 0, l = distances.length; i < l - 1; i++) {
		dist += distances[i]
		// interpolate arrival
		shapePt[fromI + 1 + i][3] = Math.round(fromDep + dTime * dist / dDistance)
		// interpolate departure
		shapePt[fromI + 1 + i][4] = Math.round(fromDep + dTime * dist / dDistance)
	}
}

const buildTrajectory = async (shapeId, shapePoints, schedule, allStopLocs) => {
	// We violate the GeoJSON spec by a certain extent here:
	// > A position is an array of numbers. There MUST be two or more
	// > elements. The first two elements are longitude and latitude, or
	// > easting and northing, precisely in that order and using decimal
	// > numbers. Altitude or elevation MAY be included as an optional third
	// > element.
	// > Implementations SHOULD NOT extend positions beyond three elements
	// > because the semantics of extra elements are unspecified and
	// > ambiguous. Historically, some implementations have used a fourth
	// > element to carry a linear referencing measure (sometimes denoted as
	// > "M") or a numerical timestamp, but in most situations a parser will
	// > not be able to properly interpret these values. The interpretation
	// > and meaning of additional elements is beyond the scope of this
	// > specification, and additional elements MAY be ignored by parsers.
	// https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.1
	const formatShapePt = ({shape_pt_lon: lon, shape_pt_lat: lat}) => [
		lon, lat,
		// altitude (always empty)
		null,
		// arrival time (added later)
		null,
		// departure time (added later)
		null,
	]
	const shapePts = shapePoints.map(formatShapePt)
	debug('before annotation', shapePts)

	const stopIds = Array.from(schedule.stops)
	const arrivals = Array.from(schedule.arrivals)
	const departures = Array.from(schedule.departures)
	const stopLocs = await Promise.all(schedule.stops.map(id => allStopLocs.get(id)))

	// iterate over shape segments, identify nearby stops, add arrival/departure times
	let stopsI = 0
	let prevPrevDistance = Infinity, prevDistance = Infinity
	let iPrevNearest = NaN, prevNearest = null
	for (let i = 1; i < shapePts.length && stopsI < stopLocs.length; i++) {
		const stopLoc = stopLocs[stopsI]
		const fromShapePt = shapePts[i - 1]
		const toShapePt = shapePts[i]
		const [
			nearest, distance,
		] = nearestOnSegment(stopLoc, fromShapePt, toShapePt)
		debug({
			stopsI, stopId: stopIds[stopsI], stopLoc,
			i, fromShapePt: shapePts[i - 1], toShapePt: shapePts[i],
			nearest: nearest === fromShapePt ? 'fromShapePt' : (nearest === toShapePt ? 'toShapePt' : 'intersection'),
			distance, prevDistance, prevPrevDistance,
			iPrevNearest, prevNearest,
		})

		// Has the shape just approached the stop?
		if (
			prevDistance < prevPrevDistance
			&& distance >= prevDistance
			&& prevDistance < .3 // 300m
		) {
			// We're greedy here, we assign the stop as soon as the shape has
			// approached it even by a tiny distance.
			if (Number.isNaN(iPrevNearest)) {
				// previous nearest was perpendicular onto (previous) segment
				iPrevNearest = i - 1
				const newShapePt = [
					prevNearest[0], // longitude
					prevNearest[1], // latitude
					null, // altitude
					arrivals[stopsI],
					departures[stopsI],
				]
				debug('adding perpendicular as shape pt', newShapePt, 'at', iPrevNearest)
				shapePts.splice(iPrevNearest, 0, newShapePt)
				i++
			} else {
				// previous nearest was a shape point
				debug('adding times to shape pt', shapePts[iPrevNearest], 'at', iPrevNearest)
				shapePts[iPrevNearest][3] = arrivals[stopsI]
				shapePts[iPrevNearest][4] = departures[stopsI]
			}

			i-- // nearest was 1 iter. ago, repeat loop with *current* segment
			prevPrevDistance = prevDistance = Infinity
			prevNearest = null
			iPrevNearest = NaN
			stopsI++
		} else {
			prevPrevDistance = prevDistance
			prevDistance = distance
			if (nearest === fromShapePt) {
				prevNearest = fromShapePt
				iPrevNearest = i - 1
			} else if (nearest === toShapePt) {
				prevNearest = toShapePt
				iPrevNearest = i
			} else { // nearest is perpendicular into segment
				prevNearest = nearest
				iPrevNearest = NaN
			}
		}
	}

	// compute missing times by interpolating
	debug('before interpolation', shapePts)
	let prevIWithArrival = -1
	for (let i = 0, l = shapePts.length; i < l; i++) {
		const coord = shapePts[i]

		// todo: what about points before first timed point?
		// todo: what about points after last timed point?
		if (coord[3] !== null) {
			if (prevIWithArrival !== -1 && (i - prevIWithArrival) > 1) {
				debug('interpolating between', prevIWithArrival, i)
				addInterpolatedTimes(shapePts, prevIWithArrival, i)
			}
			prevIWithArrival = i
		}
	}

	return {
		type: 'Feature',
		properties: {
			shapeId,
			scheduleId: schedule.id,
		},
		geometry: {
			type: 'LineString',
			coordinates: shapePts,
		},
	}
}

module.exports = buildTrajectory

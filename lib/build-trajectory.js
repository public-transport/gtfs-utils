'use strict'

const debug = require('debug')('gtfs-utils:build-trajectory')
const {default: distance} = require('@turf/distance')
const {default: nearestPointOnLine} = require('@turf/nearest-point-on-line')
const {default: length} = require('@turf/length')

// assumes linear vehicle speed along the shape
const addInterpolatedTimes = (coords, fromI, toI) => {
	const fromDep = coords[fromI][4]
	const toArr = coords[toI][3]
	const dTime = toArr - fromDep

	const distances = new Array(toI - fromI).fill(0)
	let dDistance = 0
	for (let i = fromI + 1, j = 0; i <= toI; i++, j++) {
		distances[j] = distance(coords[i - 1], coords[i])
		dDistance += distances[j]
	}

	let dist = 0
	for (let i = 0, l = distances.length; i < l - 1; i++) {
		dist += distances[i]
		// interpolate arrival
		coords[fromI + 1 + i][3] = Math.round(fromDep + dTime * dist / dDistance)
		// interpolate departure
		coords[fromI + 1 + i][4] = Math.round(fromDep + dTime * dist / dDistance)
	}
}

const buildTrajectory = async (shapeId, shapePoints, schedule, stopLocs) => {
	const tStart = schedule.departures[0]
	const tEnd = schedule.arrivals[schedule.arrivals.length - 1]

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
	const geometry = {
		type: 'LineString',
		coordinates: shapePoints.map(formatShapePt),
	}
	const coords = geometry.coordinates
	const L = length(geometry)

	// match stops with shape, add arrival/departure times to points
	debug('before annotation', coords)
	for (let i = 0, l = schedule.stops.length; i < l; i++) {
		const stopId = schedule.stops[i]
		const arrival = schedule.arrivals[i]
		const departure = schedule.departures[i]
		const stopLoc = await stopLocs.get(stopId)
		debug({i, stopId, stopLoc, arrival, departure})

		const nearest = nearestPointOnLine(geometry, {
			type: 'Point',
			coordinates: stopLoc,
		})
		const {index, dist: distToShape, location: distOnShape} = nearest.properties

		// todo: if (distanceToShape > .3) continue // 300m
		if (distToShape === 0) { // stop is directly on a shape point
			debug('adding time to shape point', index)
			coords[index][3] = arrival
			coords[index][4] = departure
		} else {
			const isBeforeFirst = distOnShape === 0
			const isAfterLast = index === coords.length - 1
			const insertIdx = isBeforeFirst ? 0 : index + 1
			const coord = [
				// longitude
				isBeforeFirst || isAfterLast
					? stopLoc[0]
					: nearest.coords[0],
				// latitude
				isBeforeFirst || isAfterLast
					? stopLoc[1]
					: nearest.coords[1],
				null, // altitude
				arrival,
				departure,
			]
			debug('inserting timed shape point at', insertIdx, coord)
			coords.splice(insertIdx, 0, coord)
		}
	}

	// compute missing times by interpolating
	debug('before interpolation', coords)
	let prevIWithArrival = -1
	for (let i = 0, l = coords.length; i < l; i++) {
		const coord = coords[i]

		// todo: what about points before first timed point?
		// todo: what about points after last timed point?
		if (coord[3] !== null) {
			if (prevIWithArrival !== -1 && (i - prevIWithArrival) > 1) {
				debug('interpolating between', prevIWithArrival, i)
				addInterpolatedTimes(coords, prevIWithArrival, i)
			}
			prevIWithArrival = i
		}
	}

	// todo: remove inserted timed points?

	return {
		type: 'Feature',
		properties: {
			shapeId,
			scheduleId: schedule.id,
		},
		geometry,
	}
}

module.exports = buildTrajectory

'use strict'

const debug = require('debug')('gtfs-utils:build-trajectory')
const {default: distance} = require('@turf/distance')
const {default: bearing} = require('@turf/bearing')
const {default: destination} = require('@turf/destination')
const {default: linesIntersection} = require('@turf/line-intersect')
const {notEqual} = require('assert')
const matchPointsWithShape = require('./match-points-with-shape')

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
			return [intersectionPt.geometry.coordinates, dist]
		}
	}
	return distToA < distToB
		? [segPtA, distToA]
		: [segPtB, distToB]
}

// assumes linear vehicle speed along the shape
const interpolateBetween = (shapePt, fromI, toI) => {
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

// assumes linear vehicle speed along the shape
const extrapolateBetween = (shapePts, measureFromI, measureToI, startI, endI) => {
	notEqual(measureFromI, measureToI)
	notEqual(startI, endI)
	const fromDep = shapePts[measureFromI][4]
	const toArr = shapePts[measureToI][3]
	const dTime = toArr - fromDep

	let dDistance = 0
	for (let i = measureFromI + 1; i <= measureToI; i++) {
		dDistance += distance(shapePts[i - 1], shapePts[i])
	}

	const sign = startI > endI ? -1 : 1
	let dist = 0
	for (let i = startI; i !== endI; i += sign) {
		dist += distance(shapePts[i], shapePts[i + sign])
		// interpolate arrival
		shapePts[i + sign][3] = Math.round(fromDep + sign * dTime * dist / dDistance)
		// interpolate departure
		shapePts[i + sign][4] = Math.round(fromDep + sign * dTime * dist / dDistance)
	}
}

// todo: use shape_dist_traveled if available
const buildTrajectory = async (shapeId, shapePoints, schedule, allStopLocs, timeOffset = 0) => {
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
	let shapePts = shapePoints.map(formatShapePt)
	debug('before annotation', shapePts)

	const stopIds = Array.from(schedule.stops)
	const arrivals = Array.from(schedule.arrivals)
	const departures = Array.from(schedule.departures)
	const stopLocs = await Promise.all(schedule.stops.map(id => allStopLocs.get(id)))
	const insertedShapePts = new Set()

	// handle 1st stop if before 1st segment
	const [firstNearest, firstDistance] = nearestOnSegment(stopLocs[0], shapePts[0], shapePts[1])
	if (firstNearest === shapePts[0] && firstDistance > 0) {
		// 1st stop is neither closer to 2nd shape pt nor to perpendicular into 1st segment
		const stopId = stopIds.shift()
		const arrival = arrivals.shift()
		const departure = departures.shift()
		const stopLoc = stopLocs.shift()
		const newShapePt = [
			stopLoc[0], // longitude
			stopLoc[1], // latitude
			null, // altitude
			arrival + timeOffset,
			departure + timeOffset,
		]
		debug('adding helper shape segment', newShapePt, 'for', stopId, 'at 0')
		shapePts.unshift(newShapePt)
		insertedShapePts.add(newShapePt)
	}

	// handle last stop if after last segment
	const [lastNearest, lastDistance] = nearestOnSegment(
		stopLocs[stopLocs.length - 1],
		shapePts[shapePts.length - 2],
		shapePts[shapePts.length - 1],
	)
	if (lastNearest === shapePts[shapePts.length - 1] && lastDistance > 0) {
		// last stop is neither closer to 2nd-last shape pt nor to perpendicular into last segment
		const stopId = stopIds.pop()
		const arrival = arrivals.pop()
		const departure = departures.pop()
		const stopLoc = stopLocs.pop()
		const newShapePt = [
			stopLoc[0], // longitude
			stopLoc[1], // latitude
			null, // altitude
			arrival + timeOffset,
			departure + timeOffset,
		]
		debug('adding helper shape segment', newShapePt, 'for', stopId, 'at', shapePts.length)
		shapePts.push(newShapePt)
		insertedShapePts.add(newShapePt)
	}

	// iterate over shape segments, identify nearby stops, add arrival/departure times
	let shapePtsIdxDrift = 0
	// We can't mutate `shapePts` while `matchPointsWithShape` iterates over it, so we
	// clone `shapePts`, do the mutations there, and finally replace original with the
	// mutated clone.
	const modifiedShapePts = Array.from(shapePts)
	for (const [i, i2, shapePt, distance, stopsI] of matchPointsWithShape(shapePts, stopLocs)) {
		const stopId = stopIds[stopsI]
		const shapePtWithTimes = [
			shapePt[0], // longitude
			shapePt[1], // latitude
			shapePt[2], // altitude
			arrivals[stopsI] + timeOffset, // arrival time
			departures[stopsI] + timeOffset, // departure time
		]

		if (i === i2) {
			debug('adding times for', stopId, 'to shape pt', shapePt, 'at', i)
			modifiedShapePts[i + shapePtsIdxDrift] = shapePtWithTimes
		} else {
			debug('adding new shape pt', shapePt, 'for', stopId, 'between', i, 'and', i2)
			modifiedShapePts.splice(i + shapePtsIdxDrift, 0, shapePtWithTimes)
			insertedShapePts.add(shapePtWithTimes)
			shapePtsIdxDrift++
		}
	}
	shapePts = modifiedShapePts

	// compute missing times by interpolating
	debug('before interpolation', shapePts)
	let firstIWithArrival = -1, prevIWithArr = -1, nrWithArr = 0
	for (let i = 0, l = shapePts.length; i < l; i++) {
		const coord = shapePts[i]
		if (coord[3] === null) continue

		if (prevIWithArr === -1) {
			firstIWithArrival = i
		} else if ((i - prevIWithArr) > 1) {
			debug('interpolating between', prevIWithArr, i)
			interpolateBetween(shapePts, prevIWithArr, i)
		}
		prevIWithArr = i
		nrWithArr++
	}
	const lastIWithArr = prevIWithArr

	const lastI = shapePts.length - 1
	if (lastIWithArr !== lastI && nrWithArr > 1) {
		debug('extrapolating end between', lastIWithArr, 'and', lastI)
		extrapolateBetween(
			shapePts,
			lastIWithArr - 1, lastIWithArr, // measure
			lastIWithArr, lastI, // extrapolate
		)
	}
	if (firstIWithArrival > 0 && nrWithArr > 1) {
		debug('extrapolating start between', 0, 'and', firstIWithArrival)
		extrapolateBetween(
			shapePts,
			firstIWithArrival, firstIWithArrival + 1, // measure
			firstIWithArrival, 0, // extrapolate
		)
	}

	debug('before removal of helper shape points', shapePts)
	for (let i = 0, l = shapePts.length; i < l; i++) {
		if (insertedShapePts.has(shapePts[i])) {
			shapePts.splice(i, 1) // remove it
			i--
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

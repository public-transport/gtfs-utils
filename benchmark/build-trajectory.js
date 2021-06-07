'use strict'

const inMemoryStore = require('../lib/in-memory-store')
const buildTrajectory = require('../lib/build-trajectory')

const stopLocs = inMemoryStore()
stopLocs.raw.set('de:03255:43633::7', [9.453118, 51.820517])
stopLocs.raw.set('de:03255:43651::2', [9.450299, 51.827289])
stopLocs.raw.set('de:03255:43693::2', [9.461404, 51.827777])
stopLocs.raw.set('de:03255:43643::2', [9.482121, 51.825886])
stopLocs.raw.set('de:03255:43669::3', [9.470128, 51.827976])
stopLocs.raw.set('de:03255:43678::1', [9.474612, 51.827568])
stopLocs.raw.set('de:03255:43680::2', [9.487562, 51.819148])
stopLocs.raw.set('de:03255:43681::1', [9.484809, 51.823526])
stopLocs.raw.set('de:03255:65768::2', [9.521271, 51.75306])
stopLocs.raw.set('de:03255:84673::2', [9.542856, 51.765074])
stopLocs.raw.set('de:03255:84670::2', [9.544986, 51.767456])
stopLocs.raw.set('de:03255:84674::2', [9.541251, 51.770171])
stopLocs.raw.set('de:03255:84672::2', [9.535901, 51.772434])
stopLocs.raw.set('de:03255:84671::2', [9.529166, 51.772851])
stopLocs.raw.set('de:03255:63479::2', [9.513741, 51.795416])

const schedule = {
	id: 'ZimPNw',
	trips: [
		{tripId: '1062817478', start: 35580},
	],
	stops: [
		'de:03255:65768::2',
		'de:03255:84673::2',
		'de:03255:84670::2',
		'de:03255:84674::2',
		'de:03255:84672::2',
		'de:03255:84671::2',
		'de:03255:63479::2',
		'de:03255:43680::2',
		'de:03255:43681::1',
		'de:03255:43643::2',
		'de:03255:43678::1',
		'de:03255:43669::3',
		'de:03255:43693::2',
		'de:03255:43651::2',
		'de:03255:43633::7'
	],
	arrivals: [0, 180, 240, 300, 360, 420, 600, 840, 900, 960, 1020, 1080, 1140, 1260, 1500],
	departures: [0, 180, 240, 300, 360, 420, 600, 840, 900, 960, 1020, 1080, 1140, 1260, 1500],
	headwayBasedStarts: [],
	headwayBasedEnds: [],
	headwayBasedHeadways: []
}

const shapeId = '190067'
const shapePoints = [
	[9.521271, 51.75306, 0],
	[9.542856, 51.765074, 1],
	[9.544986, 51.767456, 3],
	[9.541251, 51.770171, 5],
	[9.535901, 51.772434, 7],
	[9.529166, 51.772851, 9],
	[9.513741, 51.795416, 11],
	[9.487562, 51.819148, 13],
	[9.484809, 51.823526, 15],
	[9.482121, 51.825886, 17],
	[9.474612, 51.827568, 19],
	[9.470128, 51.827976, 21],
	[9.461404, 51.827777, 23],
	[9.450299, 51.827289, 25],
	[9.453118, 51.820517, 27],
].map(([shape_pt_lon, shape_pt_lat, shape_pt_sequence]) => ({
	shape_pt_lat,
	shape_pt_lon,
	shape_pt_sequence,
	shape_dist_traveled: null,
}))

const benchmarkBuildTrajectory = (suite) => {
	suite.add('buildTrajectory: simple real-world shape', (deferred) => {
		buildTrajectory(shapeId, shapePoints, schedule, stopLocs)
		.then(
			() => deferred.resolve(),
			(err) => deferred.reject(err),
		)
	}, {defer: true})
}

module.exports = benchmarkBuildTrajectory

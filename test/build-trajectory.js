'use strict'

const test = require('tape')

const inMemoryStore = require('../lib/in-memory-store')
const buildTrajectory = require('../lib/build-trajectory')

test('buildTrajectory works with imaginary shape & schedule', async (t) => {
	const stopLocs = inMemoryStore()
	stopLocs.raw.set('airport', [1.0, 1.0])
	stopLocs.raw.set('train', [1.02, 1.02])
	stopLocs.raw.set('museum', [1.1, 1.1])
	stopLocs.raw.set('mall', [1.2, 1.2])
	stopLocs.raw.set('center', [1.3, 1.3])
	stopLocs.raw.set('foo', [-1, -1])

	const schedule = {
		id: '12',
		trips: [{tripId: 'A', start: 1234}],
		stops: ['airport', 'train', 'museum', 'mall', 'center'],
		arrivals: [0, 60, 210, 510, 600],
		departures: [30, 80, 240, 540, 720],
		headwayBasedStarts: [],
		headwayBasedEnds: [],
		headwayBasedHeadways: []
	}

	const shapeId = 's0'
	const shapePoints = [
		// <-- airport is here, at 1.0 | 1.0
		[1.01, 1.01, 0],
		// <-- train is here, at 1.02 | 1.02
		[1.04, 1.04, 1],
		[1.05, 1.05, 2],
		[1.08, 1.08, 4],
		// <-- museum is here, at 1.1 | 1.1
		[1.11, 1.11, 5],
		[1.20, 1.20, 6], // <-- mall is right here, at 1.2 | 1.2
		[1.29, 1.29, 7],
		// <-- center is here, at 1.3 | 1.3
	].map(([shape_pt_lon, shape_pt_lat, shape_pt_sequence]) => ({
		shape_pt_lat,
		shape_pt_lon,
		shape_pt_sequence,
		shape_dist_traveled: null,
	}))

	const trajectory = await buildTrajectory(shapeId, shapePoints, schedule, stopLocs)

	t.deepEqual(trajectory.properties, {
		shapeId,
		scheduleId: '12',
	})
	const coords = trajectory.geometry.coordinates
	.map(([lon, lat, ...r]) => [
		parseFloat(lon.toFixed(7)),
		parseFloat(lat.toFixed(7)),
		...r,
	])
	t.deepEqual(coords, [
		[1.00,      1.00,      null,   0,  30],
		[1.01,      1.01,      null,  45,  45],
		[1.0199999, 1.0199999, null,  60,  80],
		[1.04,      1.04,      null, 113, 113],
		[1.05,      1.05,      null, 129, 129],
		[1.08,      1.08,      null, 178, 178],
		[1.0999999, 1.0999999, null, 210, 240],
		[1.11,      1.11,      null, 267, 267],
		[1.20,      1.20,      null, 510, 540],
		[1.29,      1.29,      null, 594, 594],
		[1.30,      1.30,      null, 600, 720],
	])
})

test('buildTrajectory works with shape `190067` & schedule `ZimPNw` from DELFI feed', async (t) => {
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

	const trajectory = await buildTrajectory(shapeId, shapePoints, schedule, stopLocs)

	t.deepEqual(trajectory.properties, {
		shapeId,
		scheduleId: 'ZimPNw',
	})
	const coords = trajectory.geometry.coordinates
	.map(([lon, lat, ...r]) => [
		parseFloat(lon.toFixed(7)),
		parseFloat(lat.toFixed(7)),
		...r,
	])
	t.deepEqual(coords, [
		[9.521271, 51.75306,  null,    0,    0],
		[9.542856, 51.765074, null,  180,  180],
		[9.544986, 51.767456, null,  240,  240],
		[9.541251, 51.770171, null,  300,  300],
		[9.535901, 51.772434, null,  360,  360],
		[9.529166, 51.772851, null,  420,  420],
		[9.513741, 51.795416, null,  600,  600],
		[9.487562, 51.819148, null,  840,  840],
		[9.484809, 51.823526, null,  900,  900],
		[9.482121, 51.825886, null,  960,  960],
		[9.474612, 51.827568, null, 1020, 1020],
		[9.470128, 51.827976, null, 1080, 1080],
		[9.461404, 51.827777, null, 1140, 1140],
		[9.450299, 51.827289, null, 1260, 1260],
		[9.453118, 51.820517, null, 1500, 1500],
	])
})

test.skip('buildTrajectory works with shape `todo` & schedule `todo` from VVS feed', async (t) => {
	// const stopLocs = inMemoryStore()
	// stopLocs.raw.set('de:03255:43633::7', [9.453118, 51.820517])
	// stopLocs.raw.set('de:03255:43651::2', [9.450299, 51.827289])
	// stopLocs.raw.set('de:03255:43693::2', [9.461404, 51.827777])
	// stopLocs.raw.set('de:03255:43643::2', [9.482121, 51.825886])
	// stopLocs.raw.set('de:03255:43669::3', [9.470128, 51.827976])
	// stopLocs.raw.set('de:03255:43678::1', [9.474612, 51.827568])
	// stopLocs.raw.set('de:03255:43680::2', [9.487562, 51.819148])
	// stopLocs.raw.set('de:03255:43681::1', [9.484809, 51.823526])
	// stopLocs.raw.set('de:03255:65768::2', [9.521271, 51.75306])
	// stopLocs.raw.set('de:03255:84673::2', [9.542856, 51.765074])
	// stopLocs.raw.set('de:03255:84670::2', [9.544986, 51.767456])
	// stopLocs.raw.set('de:03255:84674::2', [9.541251, 51.770171])
	// stopLocs.raw.set('de:03255:84672::2', [9.535901, 51.772434])
	// stopLocs.raw.set('de:03255:84671::2', [9.529166, 51.772851])
	// stopLocs.raw.set('de:03255:63479::2', [9.513741, 51.795416])

	// const schedule = {
	// 	id: 'todo',
	// 	trips: [
	// 		{tripId: '1062817478', start: 35580},
	// 	],
	// 	stops: [
	// 		'de:03255:65768::2',
	// 		'de:03255:84673::2',
	// 		'de:03255:84670::2',
	// 		'de:03255:84674::2',
	// 		'de:03255:84672::2',
	// 		'de:03255:84671::2',
	// 		'de:03255:63479::2',
	// 		'de:03255:43680::2',
	// 		'de:03255:43681::1',
	// 		'de:03255:43643::2',
	// 		'de:03255:43678::1',
	// 		'de:03255:43669::3',
	// 		'de:03255:43693::2',
	// 		'de:03255:43651::2',
	// 		'de:03255:43633::7'
	// 	],
	// 	arrivals: [0, 180, 240, 300, 360, 420, 600, 840, 900, 960, 1020, 1080, 1140, 1260, 1500],
	// 	departures: [0, 180, 240, 300, 360, 420, 600, 840, 900, 960, 1020, 1080, 1140, 1260, 1500],
	// 	headwayBasedStarts: [],
	// 	headwayBasedEnds: [],
	// 	headwayBasedHeadways: []
	// }

	// const shapeId = 'todo'
	// const shapePoints = [
	// 	[9.521271, 51.75306, 0],
	// 	[9.542856, 51.765074, 1],
	// 	[9.544986, 51.767456, 3],
	// 	[9.541251, 51.770171, 5],
	// 	[9.535901, 51.772434, 7],
	// 	[9.529166, 51.772851, 9],
	// 	[9.513741, 51.795416, 11],
	// 	[9.487562, 51.819148, 13],
	// 	[9.484809, 51.823526, 15],
	// 	[9.482121, 51.825886, 17],
	// 	[9.474612, 51.827568, 19],
	// 	[9.470128, 51.827976, 21],
	// 	[9.461404, 51.827777, 23],
	// 	[9.450299, 51.827289, 25],
	// 	[9.453118, 51.820517, 27],
	// ].map(([shape_pt_lon, shape_pt_lat, shape_pt_sequence]) => ({
	// 	shape_pt_lat,
	// 	shape_pt_lon,
	// 	shape_pt_sequence,
	// 	shape_dist_traveled: null,
	// }))

	// const trajectory = await buildTrajectory(shapeId, shapePoints, schedule, stopLocs)

	// t.deepEqual(trajectory.properties, {
	// 	shapeId: 'todo',
	// 	scheduleId: 'todo',
	// })
	// const coords = trajectory.geometry.coordinates
	// .map(([lon, lat, ...r]) => [
	// 	parseFloat(lon.toFixed(7)),
	// 	parseFloat(lat.toFixed(7)),
	// 	...r,
	// ])
	// t.deepEqual(coords, [
	// 	[9.521271, 51.75306,  null,    0,    0],
	// 	[9.542856, 51.765074, null,  180,  180],
	// 	[9.544986, 51.767456, null,  240,  240],
	// 	[9.541251, 51.770171, null,  300,  300],
	// 	[9.535901, 51.772434, null,  360,  360],
	// 	[9.529166, 51.772851, null,  420,  420],
	// 	[9.513741, 51.795416, null,  600,  600],
	// 	[9.487562, 51.819148, null,  840,  840],
	// 	[9.484809, 51.823526, null,  900,  900],
	// 	[9.482121, 51.825886, null,  960,  960],
	// 	[9.474612, 51.827568, null, 1020, 1020],
	// 	[9.470128, 51.827976, null, 1080, 1080],
	// 	[9.461404, 51.827777, null, 1140, 1140],
	// 	[9.450299, 51.827289, null, 1260, 1260],
	// 	[9.453118, 51.820517, null, 1500, 1500],
	// ])
})

'use strict'

const test = require('tape')

const readCsv = require('../read-csv')
const readStopTimes = require('../lib/read-stop-times')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

const noFilter = {
	trip: () => true,
	stopTime: () => true,
	frequenciesRow: () => true,
}

test('read-stop-times works', async (t) => {
	const stopTimes = readStopTimes(readFile, noFilter)
	const res = []
	for await (const st of stopTimes) res.push(st)

	t.deepEqual(res, [
		{
			tripId: 'a-downtown-all-day',
			stops: [ 'airport', 'museum', 'center' ],
			arrivals: [ 55380, 55800, 56100 ],
			departures: [ 55440, 55860, 56160 ],
			headwayBasedStarts: [],
			headwayBasedEnds: [],
			headwayBasedHeadways: []
		},
		{
			tripId: 'a-outbound-all-day',
			stops: [ 'center', 'museum', 'airport' ],
			arrivals: [ 61980, 62400, 62700 ],
			departures: [ 62040, 62460, 62760 ],
			headwayBasedStarts: [],
			headwayBasedEnds: [],
			headwayBasedHeadways: []
		},
		{
			tripId: 'b-downtown-on-weekends',
			stops: [ 'airport', 'lake', 'center' ],
			arrivals: [ 47580, 48120, 48600 ],
			departures: [ 47640, 48240, 48660 ],
			headwayBasedStarts: [],
			headwayBasedEnds: [],
			headwayBasedHeadways: []
		},
		{
			tripId: 'b-downtown-on-working-days',
			stops: [ 'airport', 'lake', 'center', 'airport', 'lake', 'center' ],
			arrivals: [ 32100, 32520, 33120, 47580, 48000, 48600 ],
			departures: [ 32160, 32640, 33180, 47640, 48120, 48660 ],
			headwayBasedStarts: [],
			headwayBasedEnds: [],
			headwayBasedHeadways: []
		},
		{
			tripId: 'b-outbound-on-weekends',
			stops: [ 'center', 'lake', 'airport' ],
			arrivals: [ 65580, 66120, 66600 ],
			departures: [ 65640, 66240, 66660 ],
			headwayBasedStarts: [],
			headwayBasedEnds: [],
			headwayBasedHeadways: []
		},
		{
			tripId: 'b-outbound-on-working-days',
			stops: [ 'center', 'lake', 'airport' ],
			arrivals: [ 65580, 66000, 66600 ],
			departures: [ 65640, 66120, 66660 ],
			headwayBasedStarts: [ 54000 ],
			headwayBasedEnds: [ 57600 ],
			headwayBasedHeadways: [ 600 ]
		},
		{
			tripId: 'c-downtown-all-day',
			stops: [ 'airport', 'center' ],
			arrivals: [ 55620, 55980 ],
			departures: [ 55680, 56100 ],
			headwayBasedStarts: [],
			headwayBasedEnds: [],
			headwayBasedHeadways: []
		},
	])
	t.deepEqual(Array.from(arrivalsByTripId.raw.entries()), [
		['a-downtown-all-day', [55380, 55800, 56100]],
		['a-outbound-all-day', [61980, 62400, 62700]],
		['b-downtown-on-working-days', [32100, 32520, 33120, 47580, 48000, 48600]],
		['b-downtown-on-weekends', [47580, 48120, 48600]],
		['b-outbound-on-working-days', [65580, 66000, 66600]],
		['b-outbound-on-weekends', [65580, 66120, 66600]],
		['c-downtown-all-day', [55620, 55980]],
	])
	t.deepEqual(Array.from(departuresByTripId.raw.entries()), [
		['a-downtown-all-day', [55440, 55860, 56160]],
		['a-outbound-all-day', [62040, 62460, 62760]],
		['b-downtown-on-working-days', [32160, 32640, 33180, 47640, 48120, 48660]],
		['b-downtown-on-weekends', [47640, 48240, 48660]],
		['b-outbound-on-working-days', [65640, 66120, 66660]],
		['b-outbound-on-weekends', [65640, 66240, 66660]],
		['c-downtown-all-day', [55680, 56100]],
	])
	t.deepEqual(Array.from(headwayBasedStarts.raw.entries()), [
		['b-outbound-on-working-days', [54000]],
	])
	t.deepEqual(Array.from(headwayBasedEnds.raw.entries()), [
		['b-outbound-on-working-days', [57600]],
	])
	t.deepEqual(Array.from(headwayBasedHeadways.raw.entries()), [
		['b-outbound-on-working-days', [600]],
	])
})

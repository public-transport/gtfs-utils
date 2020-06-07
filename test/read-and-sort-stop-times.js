'use strict'

const test = require('tape')
const {createReadStream} = require('fs')

const inMemoryStore = require('../lib/in-memory-store')
const readCsv = require('../read-csv')
const readAndSortStopTimes = require('../lib/read-and-sort-stop-times')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

test('read-csv: accept a readable stream as input', async (t) => {
	const {
		stopsByTripId,
		arrivalsByTripId,
		departuresByTripId,
		headwayBasedStarts, headwayBasedEnds, headwayBasedHeadways,
	} = await readAndSortStopTimes(readFile, {
		trip: () => true,
		stopover: () => true,
		frequenciesRow: () => true,
	}, {
		createStore: inMemoryStore,
	})

	t.deepEqual(Array.from(stopsByTripId.map.entries()), [
		['a-downtown-all-day', ['airport', 'museum', 'center']],
		['a-outbound-all-day', ['center', 'museum', 'airport']],
		['b-downtown-on-working-days', ['airport', 'lake', 'center', 'airport', 'lake', 'center']],
		['b-downtown-on-weekends', ['airport', 'lake', 'center']],
		['b-outbound-on-working-days', ['center', 'lake', 'airport']],
		['b-outbound-on-weekends', ['center', 'lake', 'airport']],
		['c-downtown-all-day', ['airport', 'center']],
	])
	t.deepEqual(Array.from(arrivalsByTripId.map.entries()), [
		['a-downtown-all-day', [55380, 55800, 56100]],
		['a-outbound-all-day', [61980, 62400, 62700]],
		['b-downtown-on-working-days', [32100, 32520, 33120, 47580, 48000, 48600]],
		['b-downtown-on-weekends', [47580, 48120, 48600]],
		['b-outbound-on-working-days', [65580, 66000, 66600]],
		['b-outbound-on-weekends', [65580, 66120, 66600]],
		['c-downtown-all-day', [55620, 55980]],
	])
	t.deepEqual(Array.from(departuresByTripId.map.entries()), [
		['a-downtown-all-day', [55440, 55860, 56160]],
		['a-outbound-all-day', [62040, 62460, 62760]],
		['b-downtown-on-working-days', [32160, 32640, 33180, 47640, 48120, 48660]],
		['b-downtown-on-weekends', [47640, 48240, 48660]],
		['b-outbound-on-working-days', [65640, 66120, 66660]],
		['b-outbound-on-weekends', [65640, 66240, 66660]],
		['c-downtown-all-day', [55680, 56100]],
	])
	t.deepEqual(Array.from(headwayBasedStarts.map.entries()), [
		['b-outbound-on-working-days', [54000]],
	])
	t.deepEqual(Array.from(headwayBasedEnds.map.entries()), [
		['b-outbound-on-working-days', [57600]],
	])
	t.deepEqual(Array.from(headwayBasedHeadways.map.entries()), [
		['b-outbound-on-working-days', [600]],
	])
})

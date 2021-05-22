'use strict'

const test = require('tape')

const readCsv = require('../read-csv')
const readPathways = require('../read-pathways')

const readFile = async (file) => {
	return await readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

const pw = (id, a, b, data = {}) => ({
	pathway_id: id,
	from_stop_id: a,
	to_stop_id: b,
	// default empty fields
	pathway_mode: '',
	is_bidirectional: '',
	signposted_as: '',
	length: '',
	traversal_time: '',
	max_slope: '',
	min_width: '',
	reversed_signposted_as: '',
	...data
})

const o = fields => Object.assign(Object.create(null), fields)

const AIRPORT_ENTRANCE = 'airport-entrance'
const AIRPORT_1_ACCESS = 'airport-1-access'
const AIRPORT_1 = 'airport-1'
const AIRPORT_2_ACCESS = 'airport-2-access'
const AIRPORT_2_BOARDING = 'airport-2-boarding'
const MUSEUM = 'museum'

const pw0 = pw('0', AIRPORT_ENTRANCE, AIRPORT_1_ACCESS, {
	pathway_mode: '4', // escalator
	is_bidirectional: '0',
})
const pw1 = pw('1', AIRPORT_1_ACCESS, AIRPORT_1, {
	pathway_mode: '2', // stairs
	is_bidirectional: '1',
})
const pw2 = pw('2', AIRPORT_1_ACCESS, AIRPORT_ENTRANCE, {
	pathway_mode: '7', // exit gate
	is_bidirectional: '0',
	signposted_as: 'exit',
})
const pw3 = pw('3', AIRPORT_ENTRANCE, AIRPORT_2_ACCESS, {
	pathway_mode: '1', // walkway
	is_bidirectional: '1',
	length: '200',
	traversal_time: '200',
	max_slope: '0.06',
	min_width: '2',
	signposted_as: 'towards platform 2 boarding',
	reversed_signposted_as: 'main hall',
})
const pw4 = pw('4', AIRPORT_2_ACCESS, AIRPORT_2_BOARDING, {
	pathway_mode: '5', // elevator
	is_bidirectional: '1',
})
const pw5 = pw('5', AIRPORT_ENTRANCE, MUSEUM, {
	pathway_mode: '1', // walkway
	is_bidirectional: '1',
	length: '1250',
})

const expectedAirport = (() => {
	const airportEntrance = {id: AIRPORT_ENTRANCE, connectedTo: Object.create(null)}
	const airport1Access = {id: AIRPORT_1_ACCESS, connectedTo: Object.create(null)}
	const airport1 = {id: AIRPORT_1, connectedTo: Object.create(null)}
	const airport2Access = {id: AIRPORT_2_ACCESS, connectedTo: Object.create(null)}
	const airport2Boarding = {id: AIRPORT_2_BOARDING, connectedTo: Object.create(null)}
	const museum = {id: MUSEUM, connectedTo: Object.create(null)}

	airportEntrance.connectedTo[AIRPORT_1_ACCESS] = o({
		'0': [pw0, airport1Access],
	})
	airportEntrance.connectedTo[AIRPORT_2_ACCESS] = o({
		'3': [pw3, airport2Access],
	})
	airportEntrance.connectedTo[MUSEUM] = o({
		'5': [pw5, museum],
	})

	airport1Access.connectedTo[AIRPORT_1] = o({
		'1': [pw1, airport1],
	})
	airport1Access.connectedTo[AIRPORT_ENTRANCE] = o({
		'2': [pw2, airportEntrance],
	})

	airport1.connectedTo[AIRPORT_1_ACCESS] = o({
		'1': [pw1, airport1Access],
	})

	airport2Access.connectedTo[AIRPORT_ENTRANCE] = o({
		'3': [pw3, airportEntrance],
	})
	airport2Access.connectedTo[AIRPORT_2_BOARDING] = o({
		'4': [pw4, airport2Boarding],
	})

	airport2Boarding.connectedTo[AIRPORT_2_ACCESS] = o({
		'4': [pw4, airport2Access],
	})

	museum.connectedTo[AIRPORT_ENTRANCE] = o({
		'5': [pw5, airportEntrance],
	})

	return o({
		[AIRPORT_ENTRANCE]: airportEntrance,
		[AIRPORT_1_ACCESS]: airport1Access,
		[AIRPORT_1]: airport1,
		[AIRPORT_2_ACCESS]: airport2Access,
		[AIRPORT_2_BOARDING]: airport2Boarding,
		[MUSEUM]: museum,
	})
})()

const expectedMuseum = (() => {
	const airportEntrance = {id: AIRPORT_ENTRANCE, connectedTo: Object.create(null)}
	const museum = {id: MUSEUM, connectedTo: Object.create(null)}

	airportEntrance.connectedTo[MUSEUM] = o({
		'5': [pw5, museum],
	})
	museum.connectedTo[AIRPORT_ENTRANCE] = o({
		'5': [pw5, airportEntrance],
	})

	return o({
		[AIRPORT_ENTRANCE]: airportEntrance,
		[MUSEUM]: museum,
	})
})()

test('read-pathways', async (t) => {
	const pathways = await readPathways(readFile)
	const byStation = {}
	for await (const [station, node, allNodes] of pathways) {
		byStation[station] = allNodes
	}

	t.deepEqual(byStation.airport, expectedAirport)
	t.ok(byStation.airport['airport-2-access'] === byStation.airport['airport-2-boarding'].connectedTo['airport-2-access']['4'][1])
	t.deepEqual(byStation.museum, expectedMuseum)
	t.ok(byStation.museum.museum === byStation.museum['airport-entrance'].connectedTo.museum['5'][1])
})

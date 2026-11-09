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

const stationStops = [
	{stop_id: 'station', parent_station: '', location_type: '1'},
	{stop_id: 'a', parent_station: 'station', location_type: '0'},
	{stop_id: 'b', parent_station: 'station', location_type: '0'},
	{stop_id: 'c', parent_station: 'station', location_type: '0'},
]
const readStation = (pathways, stops = stationStops) => async (file) => {
	if (file === 'stops') return stops
	if (file === 'pathways') return pathways
	throw new Error('unexpected file: ' + file)
}
const collectPathways = async (readFile, filters = {}) => {
	const triples = []
	for await (const triple of readPathways(readFile, filters)) triples.push(triple)
	return triples
}

test('read-pathways emits one station triple with shared directional nodes', async (t) => {
	const both = pw('two-way', 'a', 'b', {pathway_mode: '1', is_bidirectional: '1'})
	const exit = pw('exit', 'b', 'c', {pathway_mode: '1', is_bidirectional: '0'})
	const triples = await collectPathways(readStation([both, exit]))
	t.equal(triples.length, 1, 'multiple pathways in a station emit only one triple')
	const [station, node, nodes] = triples[0]
	t.equal(station, 'station')
	t.equal(node, nodes.a, 'entry node is the first pathway endpoint in the node map')
	t.deepEqual(Object.keys(nodes).sort(), ['a', 'b', 'c'])
	t.equal(nodes.a.connectedTo.b['two-way'][1], nodes.b)
	t.equal(nodes.b.connectedTo.a['two-way'][1], nodes.a, 'reverse edge reuses the same node')
	t.equal(nodes.b.connectedTo.c.exit[1], nodes.c)
	t.deepEqual(Object.keys(nodes.c.connectedTo), [], 'one-way pathway has no reverse edge')
})

test('read-pathways filters pathways before building the graph', async (t) => {
	const keep = pw('keep', 'a', 'b', {pathway_mode: '1', is_bidirectional: '0'})
	const drop = pw('drop', 'b', 'c', {pathway_mode: '1', is_bidirectional: '1'})
	const seen = []
	const triples = await collectPathways(readStation([keep, drop]), {
		pathway: (pathway) => {
			seen.push(pathway.pathway_id)
			return pathway.pathway_id === 'keep'
		},
	})
	t.deepEqual(seen, ['keep', 'drop'], 'filter sees both original pathway rows')
	t.equal(triples.length, 1)
	const [station, node, nodes] = triples[0]
	t.equal(station, 'station')
	t.equal(node, nodes.a)
	t.deepEqual(Object.keys(nodes).sort(), ['a', 'b'], 'excluded pathway adds no node')
	t.deepEqual(Object.keys(nodes.a.connectedTo.b), ['keep'])
	t.deepEqual(Object.keys(nodes.b.connectedTo), [], 'excluded bidirectional edge adds no connection')
})

test('read-pathways emits nothing when all pathways are filtered out', async (t) => {
	const triples = await collectPathways(readStation([pw('drop', 'a', 'b', {pathway_mode: '1'})]), {
		pathway: () => false,
	})
	t.deepEqual(triples, [])
})

test('read-pathways applies stop and pathway filters to independent stations', async (t) => {
	const stops = [
		...stationStops,
		{stop_id: 'other', parent_station: '', location_type: '1'},
		{stop_id: 'x', parent_station: 'other', location_type: '0'},
		{stop_id: 'y', parent_station: 'other', location_type: '0'},
	]
	const keep = pw('keep', 'a', 'b', {pathway_mode: '1', is_bidirectional: '1'})
	const drop = pw('drop', 'x', 'y', {pathway_mode: '1', is_bidirectional: '1'})
	const seenStops = []
	const triples = await collectPathways(readStation([keep, drop], stops), {
		stop: (stop) => {
			seenStops.push(stop)
			return stop.stop_id !== 'other' && stop.parent_station !== 'other'
		},
		pathway: pathway => pathway.pathway_id === 'keep',
	})
	t.deepEqual(seenStops, stops, 'stop predicate receives every original stop row')
	t.equal(triples.length, 1, 'excluded station and pathway produce no extra triple')
	const [station, node, nodes] = triples[0]
	t.equal(station, 'station')
	t.equal(node, nodes.a)
	t.deepEqual(Object.keys(nodes).sort(), ['a', 'b'])
	t.equal(nodes.a.connectedTo.b.keep[0], keep)
	t.equal(nodes.a.connectedTo.b.keep[1], nodes.b)
	t.equal(nodes.b.connectedTo.a.keep[1], nodes.a)
})

test('read-pathways emits nothing for stops without pathways', async (t) => {
	t.deepEqual(await collectPathways(readStation([])), [])
})

test('read-pathways emits nothing for an empty feed', async (t) => {
	t.deepEqual(await collectPathways(readStation([], [])), [])
})

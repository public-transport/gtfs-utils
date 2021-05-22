'use strict'

const debug = require('debug')('gtfs-utils:read-pathways')
const debugNodes = require('debug')('gtfs-utils:read-pathways:nodes')
const inMemoryStore = require('./lib/in-memory-store')
const readStopStations = require('./lib/read-stop-stations')

const BIDIRECTIONAL = '1'

const readPathways = async function* (readFile, filters = {}, opt = {}) {
	if (typeof readFile !== 'function') {
		throw new TypeError('readFile must be a function')
	}
	filters = {
		pathway: () => true,
		stop: () => true,
		...filters,
	}
	const {
		pathway: pathwayFilter,
		stop: stopFilter,
	} = filters
	if (typeof pathwayFilter !== 'function') {
		throw new TypeError('filters.pathway must be a function')
	}

	const {
		createStore,
	} = {
		createStore: inMemoryStore,
		...opt,
	}

	const stations = await readStopStations(readFile, filters, createStore)

	const pathways = createStore() // by node/stop ID
	const pathwaysByFrom = createStore() // pathway IDs by from_stop_id

	for await (let pw of await readFile('pathways')) {
		if (!pathwayFilter(pw)) continue
		if (
			!pw.pathway_id
			|| !pw.from_stop_id || !pw.to_stop_id || pw.from_stop_id === pw.to_stop_id
		) {
			// todo: debug-log invalid pathways
			continue
		}

		await Promise.all([
			pathways.set(pw.pathway_id, pw),
			pathwaysByFrom.map(pw.from_stop_id, (pws) => {
				if (!pws) return [pw.pathway_id]
				pws.push(pw.pathway_id)
				return pws
			}),
		])
	}

	const FORWARD = Symbol('forward') // along the "inherent" direction of a pathway
	const REVERSE = Symbol('reverse') // in the opposite direction of a bidirectional pathway

	const buildStationGraph = async (initialPw, initialDir, initialStationId) => {
		const queue = [initialPw.pathway_id, initialDir]
		const nodes = Object.create(null) // by stop ID
		const seenPathways = new Set() // by pathway ID

		let nrOfNodes = 0
		while (queue.length > 0) {
			const pwId = queue.shift()
			const dir = queue.shift()
			debug('pathway', pwId, 'direction', dir)
			// todo: incorporate direction in lookup?
			if (seenPathways.has(pwId)) continue // to prevent endless loops
			seenPathways.add(pwId)

			const pw = await pathways.get(pwId)

			let fromNode = nodes[pw.from_stop_id]
			if (!fromNode) {
				nrOfNodes++
				fromNode = nodes[pw.from_stop_id] = {
					id: pw.from_stop_id,
					connectedTo: Object.create(null), // by stop ID
				}
			}
			debug('fromNode', fromNode)

			let toNode = nodes[pw.to_stop_id]
			if (!toNode) {
				nrOfNodes++
				toNode = nodes[pw.to_stop_id] = {
					id: pw.to_stop_id,
					connectedTo: Object.create(null), // by stop ID
				}
			}
			debug('toNode', toNode)

			let edges = fromNode.connectedTo[pw.to_stop_id]
			if (!edges) {
				edges = fromNode.connectedTo[pw.to_stop_id] = Object.create(null) // by pathway ID
			}
			if (!edges[pw.pathway_id]) edges[pw.pathway_id] = [pw, toNode]

			if (pw.is_bidirectional === BIDIRECTIONAL) {
				let reverseEdges = toNode.connectedTo[pw.from_stop_id]
				if (!reverseEdges) {
					reverseEdges = toNode.connectedTo[pw.from_stop_id] = Object.create(null) // by pathway ID
				}
				if (!reverseEdges[pw.pathway_id]) reverseEdges[pw.pathway_id] = [pw, fromNode]
			}

			debugNodes(nodes)

			// find connecting edges, add them to the queue
			const connectedStopId = dir === REVERSE ? pw.from_stop_id : pw.to_stop_id
			const connectedStationId = await stations.get(connectedStopId)
			if (connectedStationId === initialStationId) {
				const connectingPwIds = (await pathwaysByFrom.get(connectedStopId)) || []
				debug('queuing connecting pathways', ...connectingPwIds)
				for (const pwId of connectingPwIds) {
					if (seenPathways.has(pwId)) continue
					if (queue.includes(pwId)) continue // todo: this is very expensive!
					queue.push(pwId, FORWARD)
				}
			}
		}

		return nodes
	}

	const coveredStations = new Set() // by station ID
	for await (const pw of pathways.values()) {
		const t0 = Date.now()

		const stationId = await stations.get(pw.from_stop_id)
		debug('initial pathway', pw.pathway_id, 'from station ID', stationId)
		// don't yield twice because we hit 2 pathways of the same graph
		if (coveredStations.has(stationId)) {
			debug(pw.pathway_id, stationId, 'already yielded before')
		} else {
			coveredStations.add(stationId)

			const nodes = await buildStationGraph(pw, FORWARD, stationId)
			yield [stationId, nodes[pw.from_stop_id], nodes]
		}

		if (pw.is_bidirectional === BIDIRECTIONAL) {
			const stationId = await stations.get(pw.to_stop_id)
			debug('bidirectional pathway', pw.pathway_id, 'to station ID', stationId)
			if (coveredStations.has(stationId)) {
				debug(pw.pathway_id, stationId, 'already yielded before')
			} else {
				coveredStations.add(stationId)

				const nodes = await buildStationGraph(pw, REVERSE, stationId)
				yield [stationId, nodes[pw.to_stop_id], nodes]
			}
		}

		debug(pw.pathway_id, Date.now() - t0, 'ms')
	}
}

module.exports = readPathways

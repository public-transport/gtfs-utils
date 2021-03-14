'use strict'

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

	for await (let pw of readFile('pathways')) {
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

	const buildStationGraph = async (initialPw, initialStationId) => {
		const queue = [initialPw.pathway_id]
		const nodes = Object.create(null) // by stop ID
		const seenPathways = new Set() // by pathway ID

		let nrOfNodes = 0
		while (queue.length > 0) {
			const pwId = queue.shift()
			if (seenPathways.has(pwId)) continue // to prevent endless loops
			seenPathways.add(pwId)

			const pw = await pathways.get(pwId)
			const stationId = await stations.get(pw.to_stop_id)

			let fromNode = nodes[pw.from_stop_id]
			if (!fromNode) {
				nrOfNodes++
				fromNode = nodes[pw.from_stop_id] = {
					id: pw.from_stop_id,
					connectedTo: Object.create(null), // by stop ID
				}
			}

			let toNode = nodes[pw.to_stop_id]
			if (!toNode) {
				nrOfNodes++
				toNode = nodes[pw.to_stop_id] = {
					id: pw.to_stop_id,
					connectedTo: Object.create(null), // by stop ID
				}
			}
			if (stationId !== initialStationId) toNode.station = stationId

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

			// find connecting edges, add them to the queue
			if (stationId === initialStationId) {
				const connectingPwIds = (await pathwaysByFrom.get(pw.to_stop_id)) || []
				for (const pwId of connectingPwIds) {
					if (seenPathways.has(pwId)) continue
					if (queue.includes(pwId)) continue // todo: this is very expensive!
					queue.push(pwId)
				}
			}
		}

		return nodes
	}

	const coveredStations = new Set() // by station ID
	for await (const pw of pathways.values()) {
		const t0 = Date.now()

		const stationId = await stations.get(pw.from_stop_id)
		// don't yield twice because we hit 2 pathways of the same graph
		if (coveredStations.has(stationId)) {
			// todo: debug-log
			continue
		}
		coveredStations.add(stationId)

		const nodes = await buildStationGraph(pw, stationId)
		yield [stationId, nodes]
	}
}

module.exports = readPathways

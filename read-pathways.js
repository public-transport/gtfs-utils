'use strict'

const inMemoryStore = require('./lib/in-memory-store')
const readStopStations = require('./lib/read-stop-stations')

const readPathways = async (readFile, filters = {}, opt = {}) => {
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
	const addPathway = async (fromNodeId, toNodeId, pw) => {
		await pathways.map(fromNodeId, (node) => {
			node = node || {
				id: fromNodeId,
				connectedTo: {},
			}
			let pathways = (
				Object.hasOwnProperty(node.connectedTo, toNodeId)
				&& node.connectedTo[toNodeId]
			)
			if (!pathways) pathways = node.connectedTo[toNodeId] = {}

			if (!Object.hasOwnProperty(pathways, pw.pathway_id)) {
				// pathway not stored yet
				pathways[pw.pathway_id] = pw
			}

			return node
		})
	}

	const parents = createStore() // parent_station by stop_id
	for await (const s of readFile('stops')) {
		const parent = s.parent_station || s.stop_id // parent or self
		await parents.set(s.stop_id, parent)
	}

	for await (let pw of readFile('pathways')) {
		if (!pathwayFilter(pw)) continue

		if (!pw.from_stop_id || !pw.to_stop_id || pw.from_stop_id === pw.to_stop_id) {
			// todo: debug-log invalid pathway
			continue
		}

		let [fromParentId, toParentId] = await Promise.all([
			await parents.get(pw.from_stop_id),
			await parents.get(pw.to_stop_id),
		])
		if (!fromParentId && !toParentId) {
			// todo: debug-log invalid pathway
			continue
		}

		await Promise.all([
			addPathway(fromParentId, toParentId, pw),
			addPathway(toParentId, fromParentId, pw), // reverse
		])

		// optionally, walk up again
		if (fromParentId !== toParentId) {
			const [fromParent2Id, toParent2Id] = await Promise.all([
				parents.get(fromParentId),
				parents.get(toParentId),
			])
			if (fromParent2Id === fromParentId && toParent2Id === toParentId) continue

			await Promise.all([
				addPathway(fromParentId, toParentId, pw),
				addPathway(toParentId, fromParentId, pw), // reverse
			])
		}
	}

	return pathways
}

module.exports = readPathways

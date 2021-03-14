'use strict'

const {inspect} = require('util')
const readCsv = require('../read-csv')
const readPathways = require('../read-pathways')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

;(async () => {
	const pathways = readPathways(readFile)
	for await (const [stationId, nodes] of pathways) {
		const node = nodes[Object.keys(nodes)[0]]

		console.log(stationId, inspect(node, {depth: 10, colors: true}))
	}
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})

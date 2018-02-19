'use strict'

const readCsv = require('../read-csv')
const computeConnections = require('../compute-connections')

const readFile = (file) => {
	return readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

computeConnections(readFile, 'Europe/Berlin')
.then((connectionSets) => {
	for (let connections of connectionSets) {
		console.log('')
		for (let connection of connections) console.log(connection)
	}
})
.catch((err) => {
	console.error(err)
	process.exitCode = 1
})

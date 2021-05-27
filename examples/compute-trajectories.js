'use strict'

const readCsv = require('../read-csv')
const computeTrajectories = require('../compute-trajectories')

const readFile = async (file) => {
	return await readCsv(require.resolve('sample-gtfs-feed/gtfs/' + file + '.txt'))
}

;(async () => {
	const trajectories = await computeTrajectories(readFile)
	for await (const trajectory of trajectories) {
		console.log(trajectory)
	}
})()
.catch((err) => {
	console.error(err)
	process.exit(1)
})

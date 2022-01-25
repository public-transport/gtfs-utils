'use strict'

const expectSorting = (filename, compareFn) => {
	if (process.env.CHECK_GTFS_SORTING === 'false') {
		return () => {}
	}

	let prevRow = null
	let rowNr = 0

	const checkRow = (row) => {
		rowNr++

		if (prevRow !== null && compareFn(prevRow, row) > 0) {
			const err = new Error(`${filename} is not sorted as needed (row ${rowNr})`)
			err.previousRow = prevRow
			err.row = row
			err.rowNr = rowNr
			throw err
		}
		prevRow = row
	}
	return checkRow
}

module.exports = expectSorting

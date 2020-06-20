'use strict'

const expectSorting = (filename, compareFn) => {
	let prevRow = null
	let rowNr = 0

	const checkRow = (row) => {
		rowNr++

		if (prevRow !== null && compareFn(prevRow, row) > 0) {
			const err = new Error(filename + ' is not sorted as needed')
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

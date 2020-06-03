'use strict'

const prod = process.env.NODE_ENV === 'production'

const withRows = (fileName, onRow) => {
	if (prod) return onRow

	let rowNr = 1 // include header line
	return function (row, enc, cb) {
		rowNr++
		try {
			return onRow.call(this, row, enc, (err, row) => {
				if (err) {
					err.row = rowNr
					err.message = `${fileName}:${rowNr} ${err.message || ''}`
				}
				cb(err, row)
			})
		} catch (err) {
			err.row = rowNr
			err.message = `${fileName}:${rowNr} ${err.message || ''}`
			throw err
		}
	}
}

module.exports = withRows

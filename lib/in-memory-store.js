'use strict'

const asyncIterator = (iterator) => {
	const asyncIterator = () => {
		const it = iterator()
		return {
			next: async () => it.next(),
			[Symbol.asyncIterator]: asyncIterator,
		}
	}
	return asyncIterator
}

const createInMemoryStore = () => {
	const map = new Map()

	const store = {
		has: async (key) => {
			return map.has(key)
		},
		get: async (key) => {
			return map.get(key)
		},
		set: async (key, val) => {
			map.set(key, val)
		},
		delete: async (key) => {
			map.delete(key)
		},
		map: async (key, fn) => {
			map.set(key, fn(map.get(key), key))
		},

		entries: asyncIterator(map.entries.bind(map)),
		[Symbol.asyncIterator]: asyncIterator(map.entries.bind(map)),
		keys: asyncIterator(map.keys.bind(map)),
		values: asyncIterator(map.values.bind(map)),

		close: async () => {},
	}

	Object.defineProperty(store, 'raw', {value: map})
	return store
}

module.exports = createInMemoryStore

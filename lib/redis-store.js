'use strict'

const Redis = require('ioredis')

let redis = null
let redisRefs = 0

// todo: add in-memory LRU cache for better latency
const createRedisStore = () => {
	const ns = Math.random().toString(16).slice(2, 5)
	if (!redis) redis = new Redis(process.env.REDIS_URL)
	redisRefs++

	const redisAsyncIterator = (chunkSize) => {
		let pCursor = Promise.resolve('0')
		let end = false
		const iterate = async () => {
			if (end) return {done: true}

			// queue additional SCAN
			const op = pCursor
			.then(cursor => redis.scan(
				cursor,
				'MATCH', ns + '*',
				'COUNT', chunkSize,
			))
			// set pCursor immediately, `await` Promise later
			pCursor = op.then(scanRes => scanRes[0])

			// process SCAN result
			// > It is important to note that the MATCH filter is applied after
			// > elements are retrieved from the collection, just before
			// > returning data to the client. This means that if the pattern
			// > matches very little elements inside the collection, SCAN will
			// > likely return no elements in most iterations.
			const [cursor, keys] = await op
			end = cursor === '0'
			return {
				done: false,
				value: keys,
			}
		}
		return {
			next: iterate,
			[Symbol.asyncIterator]: () => redisAsyncIterator(chunkSize),
		}
	}

	const entries = async function* (chunkSize = 20) {
		for await (const keys of redisAsyncIterator(chunkSize)) {
			if (keys.length === 0) continue
			const vals = await redis.mget(...keys)
			for (let i = 0; i < keys.length; i++) {
				yield [
					keys[i].slice(3), // remove namespace
					JSON.parse(vals[i]),
				]
			}
		}
	}

	return {
		has: async (key) => {
			return await redis.exists(ns + key)
		},
		get: async (key) => {
			const raw = await redis.get(ns + key)
			return raw === null ? raw : JSON.parse(raw)
		},
		set: async (key, val) => {
			await redis.set(ns + key, JSON.stringify(val))
		},
		delete: async (key) => {
			await redis.del(ns + key)
		},
		map: async (key, fn) => {
			// todo: lock key first
			const raw = await redis.get(ns + key)
			let val = raw === null ? raw : JSON.parse(raw)
			// console.error('map', 'old val', val)
			val = fn(val, key)
			// console.error('map', 'new val', val)
			if (val === null || val === undefined) await redis.del(ns + key)
			else await redis.set(ns + key, JSON.stringify(val))
		},

		entries,
		[Symbol.asyncIterator]: entries,
		keys: async function* (chunkSize = 40) {
			for await (const keys of redisAsyncIterator(chunkSize)) {
				for (let i = 0; i < keys.length; i++) {
					yield keys[i].slice(3) // remove namespace
				}
			}
		},
		values: async function* (chunkSize = 10) {
			for await (const keys of redisAsyncIterator(chunkSize)) {
				if (keys.length === 0) continue
				const vals = await redis.mget(...keys)
				for (let i = 0; i < keys.length; i++) {
					yield JSON.parse(vals[i])
				}
			}
		},

		close: async () => {
			redisRefs--
			if (redisRefs <= 0) {
				await redis.quit()
				redis = null
			}
		},
	}
}

module.exports = createRedisStore

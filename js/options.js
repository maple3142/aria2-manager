const storage = {
	get: (key, defaultval) =>
		new Promise(res => {
			chrome.storage.sync.get([key], result => {
				res(typeof result[key] === 'undefined' ? defaultval : result[key])
			})
		}),
	set: (key, val) =>
		new Promise(res => {
			chrome.storage.sync.set({ [key]: val }, res)
		}),
	getMult: obj =>
		new Promise(res => {
			const keys = Object.keys(obj)
			chrome.storage.sync.get(keys, result => {
				for (const [k, v] of Object.entries(obj)) {
					if (typeof result[k] === 'undefined') {
						result[k] = v
					}
				}
				res(result)
			})
		}),
	setMult: obj =>
		new Promise(res => {
			chrome.storage.sync.set(obj, res)
		})
}
const defaultRPC = [{ name: 'ARIA2 RPC', url: 'http://localhost:6800/jsonrpc' }]
const dedupe = arr => Array.from(new Set(arr))
Vue.component('rpc', {
	template: '#rpc',
	props: ['value'],
	data() {
		return {
			rpc: Object.assign({}, this.value)
		}
	},
	watch: {
		rpc: {
			deep: true,
			handler(val) {
				if (!val || (val.name && val.url)) {
					this.$emit('input', val)
				}
			}
		}
	}
})
;(async () => {
	const initOpts = await storage.getMult({
		contextMenus: false,
		integration: false,
		finalUrl: false,
		captureMagnet: false,
		askBeforeDownload: false,
		fileSize: 10,
		rpc_list: defaultRPC,
		black_site: [],
		white_site: [],
		black_exts: [],
		white_exts: []
	})
	initOpts.black_site = initOpts.black_site.join('\n')
	initOpts.white_site = initOpts.white_site.join('\n')
	initOpts.black_exts = initOpts.black_exts.join('\n')
	initOpts.white_exts = initOpts.white_exts.join('\n')
	window.app = new Vue({
		el: '#app',
		data: initOpts,
		methods: {
			addRpc() {
				this.rpc_list.push({
					name: '',
					url: ''
				})
			},
			async save() {
				const obj = {}
				for (const k of [
					'contextMenus',
					'integration',
					'finalUrl',
					'captureMagnet',
					'askBeforeDownload',
					'fileSize'
				]) {
					obj[k] = this[k]
				}
				this.rpc_list = this.rpc_list.filter(rpc => rpc && rpc.name && rpc.url)
				obj.rpc_list = this.rpc_list

				const arr_black_site = dedupe(this.black_site.split('\n').filter(x => x))
				obj.black_site = arr_black_site
				this.black_site = arr_black_site.join('\n')

				const arr_white_site = dedupe(this.white_site.split('\n').filter(x => x))
				obj.white_site = arr_white_site
				this.white_site = arr_white_site.join('\n')

				const arr_black_exts = dedupe(this.black_exts.split('\n').filter(x => x))
				obj.black_exts = arr_black_exts
				this.black_exts = arr_black_exts.join('\n')

				const arr_white_exts = dedupe(this.white_exts.split('\n').filter(x => x))
				obj.white_exts = arr_white_exts
				this.white_exts = arr_white_exts.join('\n')

				await storage.setMult(obj)
			},
			reset() {
				chrome.storage.sync.clear(() => {
					location.reload()
				})
			},
			i18n(id) {
				return chrome.i18n.getMessage(id)
			},
			updaterpc(val, idx) {
				this.rpc_list[idx] = val
				this.save()
			}
		}
	})
})()

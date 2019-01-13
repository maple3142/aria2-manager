const storage = {
	get(key, defaultval) {
		const val = localStorage.getItem(key)
		return val === null ? defaultval : JSON.parse(val)
	},
	set(key, val) {
		localStorage.setItem(key, JSON.stringify(val))
	}
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
window.app = new Vue({
	el: '#app',
	data: {
		contextMenus: storage.get('contextMenus',false),
		integration: storage.get('integration',false),
		finalUrl: storage.get('finalUrl',false),
		askBeforeDownload: storage.get('askBeforeDownload',false),
		fileSize: storage.get('fileSize',10),
		rpc_list: storage.get('rpc_list',defaultRPC),
		black_site: storage.get('black_site',[]).join('\n'),
		white_site: storage.get('white_site',[]).join('\n')
	},
	methods: {
		addRpc() {
			this.rpc_list.push({
				name: '',
				url: ''
			})
		},
		save() {
			for (const k of ['contextMenus', 'integration', 'finalUrl', 'askBeforeDownload', 'fileSize']) {
				storage.set(k, this[k])
			}
			this.rpc_list = this.rpc_list.filter(rpc => rpc && rpc.name && rpc.url)
			storage.set('rpc_list',this.rpc_list)

			const arr_black_site = dedupe(this.black_site.split('\n').filter(x => x))
			storage.set('black_site', arr_black_site)
			this.black_site=arr_black_site.join('\n')

			const arr_white_site = dedupe(this.white_site.split('\n').filter(x => x))
			storage.set('white_site', arr_white_site)
			this.white_site=arr_white_site.join('\n')
		},
		reset() {
			localStorage.clear()
			location.reload()
			chrome.storage.local.clear(() => {
				console.log('Settings storage is cleared!')
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

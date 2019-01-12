const defaultRPC = JSON.stringify([{ name: 'ARIA2 RPC', url: 'http://localhost:6800/jsonrpc' }])
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
		contextMenus: localStorage.getItem('contextMenus') === 'true',
		integration: localStorage.getItem('integration') === 'true',
		finalUrl: localStorage.getItem('finalUrl') === 'true',
		askBeforeDownload: localStorage.getItem('askBeforeDownload') === 'true',
		fileSize: parseInt(localStorage.getItem('fileSize') || 10),
		rpc_list: JSON.parse(localStorage.getItem('rpc_list') || defaultRPC),
		black_site: JSON.parse(localStorage.getItem('black_site') || '[]').join('\n'),
		white_site: JSON.parse(localStorage.getItem('white_site') || '[]').join('\n')
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
				localStorage.setItem(k, JSON.stringify(this[k]))
			}
			this.rpc_list = this.rpc_list.filter(rpc => rpc && rpc.name && rpc.url)
			localStorage.setItem('rpc_list', JSON.stringify(this.rpc_list))
			this.black_site = dedupe(this.black_site.split('\n').filter(x => x))
			localStorage.setItem('black_site', JSON.stringify(this.black_site))
			this.white_site = dedupe(this.white_site.split('\n').filter(x => x))
			localStorage.setItem('white_site', JSON.stringify(this.white_site))
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

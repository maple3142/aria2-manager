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
storage.get('captureMagnet').then(cap=>{
	if(!cap)return
	document.addEventListener('click', async e => {
		const {
			target: { tagName, href }
		} = e
		if (tagName === 'A' && href.startsWith('magnet:')) {
			e.preventDefault()
			e.stopPropagation()
			chrome.runtime.sendMessage({
				action: 'magnetCaptured',
				data: href
			})
		}
	})
	
})

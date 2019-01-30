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
	getMult: (...keys) =>
		new Promise(res => {
			chrome.storage.sync.get(keys, res)
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

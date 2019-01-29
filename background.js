const IS_FIREFOX = typeof browser !== 'undefined'
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
function timeout(ms) {
	return new Promise((res, rej) => setTimeout(rej, ms))
}
function generateId() {
	return new Date().getTime().toString()
}
function showNotification(id, opt) {
	return chrome.notifications.create(id, opt, notifyId => notifyId)
}
function parse_url(url) {
	const auth_str = request_auth(url)
	let auth = null
	if (auth_str) {
		if (auth_str.startsWith('token:')) {
			auth = auth_str
		} else {
			auth = `Basic ${btoa(auth_str)}`
		}
	}
	const url_path = remove_auth(url)
	function request_auth(url) {
		return url.match(/^(?:(?![^:@]+:[^:@\/]*@)[^:\/?#.]+:)?(?:\/\/)?(?:([^:@]*(?::[^:@]*)?)?@)?/)[1]
	}
	function remove_auth(url) {
		return url.replace(/^((?![^:@]+:[^:@\/]*@)[^:\/?#.]+:)?(\/\/)?(?:(?:[^:@]*(?::[^:@]*)?)?@)?(.*)/, '$1$2$3')
	}
	return [url_path, auth]
}

function aria2Send(link, rpcUrl, downloadItem) {
	let filename = null
	let referrer = null
	let cookiesLink = null
	if (downloadItem != null) {
		filename = downloadItem.filename
		referrer = downloadItem.referrer
		cookiesLink = downloadItem.url
		if (IS_FIREFOX) {
			filename = filename.split(/(\/|\\)/).pop()
		}
	} else {
		cookiesLink = link
	}

	chrome.cookies.getAll(
		{
			url: cookiesLink
		},
		cookies => {
			const format_cookies = []
			for (const i in cookies) {
				const cookie = cookies[i]
				format_cookies.push(`${cookie.name}=${cookie.value}`)
			}
			const header = []
			header.push(`Cookie: ${format_cookies.join('; ')}`)
			header.push(`User-Agent: ${navigator.userAgent}`)
			header.push('Connection: keep-alive')

			const rpc_data = {
				jsonrpc: '2.0',
				method: 'aria2.addUri',
				id: new Date().getTime(),
				params: [
					[link],
					{
						header: header,
						referer: referrer,
						out: filename
					}
				]
			}
			const [url, auth] = parse_url(rpcUrl)
			if (auth && auth.startsWith('token:')) {
				rpc_data.params.unshift(auth)
			}
			console.log(rpc_data)
			const request = xf
				.post(url, {
					json: rpc_data,
					headers: {
						Authorization: auth
					}
				})
				.json()
			Promise.race([request, timeout(3000)])
				.then(() => {
					const title = chrome.i18n.getMessage('exportSucceedStr')
					const des = chrome.i18n.getMessage('exportSucceedDes')
					const opt = {
						type: 'basic',
						title,
						message: des,
						iconUrl: 'images/logo64.png',
						isClickable: true
					}
					const id = generateId()
					showNotification(id, opt)
				})
				.catch(async err => {
					let msg
					if (typeof err === 'undefined') {
						msg = 'Timeout'
					} else if (err.response) {
						const obj = await err.response.json()
						msg = obj.error.message
					} else {
					}
					const title = chrome.i18n.getMessage('exportFailedStr')
					const des = chrome.i18n.getMessage('exportFailedDes')
					const opt = {
						type: 'basic',
						title,
						message: des + ' -- ' + msg,
						iconUrl: 'images/logo64.png'
					}
					const id = generateId()
					showNotification(id, opt)
				})
		}
	)
}
function matchRule(str, rule) {
	return new RegExp(`^${rule.split('*').join('.*')}$`).test(str)
}
function isCapture(downloadItem) {
	const fileSize = storage.get('fileSize')
	const white_site = storage.get('white_site', [])
	const black_site = storage.get('black_site', [])
	const white_exts = storage.get('white_exts', [])
	const black_exts = storage.get('black_exts', [])
	const url = downloadItem.referrer || downloadItem.url

	if (downloadItem.error || downloadItem.state != 'in_progress' || !url.startsWith('http')) {
		return false
	}

	const domain = new URL(url).hostname
	const inWhiteList = white_site.some(rule => domain.endsWith(rule))
	const inBlackList = black_site.some(rule => domain.endsWith(rule))
	const inWhiteExtsList = white_exts.some(rule => domain.endsWith(rule))
	const inBlackExtsList = black_exts.some(rule => domain.endsWith(rule))
	const okWithFileSize = downloadItem.fileSize >= fileSize * 1024 * 1024
	const filesizeUnknownIsAcceptable = IS_FIREFOX && downloadItem.fileSize === -1
	const isDownloadableFileNotInWhiteList =
		(okWithFileSize || filesizeUnknownIsAcceptable) && !inBlackList && !inBlackExtsList
	return inWhiteList || inWhiteExtsList || isDownloadableFileNotInWhiteList
}

function isCaptureFinalUrl() {
	return storage.get('finalUrl')
}

// Firefox support of `onDeterminingFilename`: https://bugzilla.mozilla.org/show_bug.cgi?id=1439992
const downloadListener = chrome.downloads.onDeterminingFilename || chrome.downloads.onCreated
downloadListener.addListener((downloadItem, suggestion) => {
	const integrationEnabled = storage.get('integration')
	const askBeforeDownload = storage.get('askBeforeDownload')
	const isStartedByMySelf = downloadItem.byExtensionName === 'Aria2 manager'
	if (IS_FIREFOX) {
		// firefox doesn't support it
		downloadItem.finalUrl = downloadItem.url
	}
	if (isStartedByMySelf || (integrationEnabled && isCapture(downloadItem))) {
		chrome.downloads.cancel(downloadItem.id)
		if (askBeforeDownload) {
			if (isCaptureFinalUrl()) {
				launchUI(downloadItem.finalUrl, downloadItem.referrer)
			} else {
				launchUI(downloadItem.url, downloadItem.referrer)
			}
		} else {
			const rpc_list = storage.get('rpc_list', defaultRPC)
			if (isCaptureFinalUrl()) {
				aria2Send(downloadItem.finalUrl, rpc_list[0]['url'], downloadItem)
			} else {
				aria2Send(downloadItem.url, rpc_list[0]['url'], downloadItem)
			}
		}
	}
})

chrome.browserAction.onClicked.addListener(launchUI)

function launchUI(downloadURL, referrer) {
	const indexUrl = chrome.extension.getURL('ui/ariang/index.html')
	let url = indexUrl
	if (typeof downloadURL === 'string') {
		const params = new URLSearchParams()
		params.set('url', btoa(downloadURL))
		if (typeof referrer === 'string' && referrer.length) {
			params.set('referer', referrer)
		}
		url += `#!/new?${params.toString()}`
	}
	chrome.tabs.query({ currentWindow: true }, tabs => {
		for (const tab of tabs.filter(tab => tab.url && tab.url.startsWith(indexUrl))) {
			if (tab.url && tab.url.startsWith(indexUrl)) {
				chrome.tabs.update(tab.id, {
					selected: true,
					url
				})
				return
			}
		}
		chrome.tabs.create({
			url
		})
	})
}

// Add Context Menu
function addContextMenu(id, title) {
	chrome.contextMenus.create({
		id,
		title,
		contexts: ['link']
	})
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	const strExport = chrome.i18n.getMessage('contextmenuTitle')
	if (changeInfo.status === 'loading') {
		chrome.contextMenus.removeAll()
		const contextMenusEnabled = storage.get('contextMenus')
		if (contextMenusEnabled) {
			const rpc_list = storage.get('rpc_list', defaultRPC)
			for (const rpc of rpc_list) {
				addContextMenu(rpc.url, strExport + rpc.name)
			}
		}
	}
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
	const uri = decodeURIComponent(info.linkUrl)
	const referrer = info.frameUrl || info.pageUrl
	if (IS_FIREFOX) {
		aria2Send(uri, info.menuItemId, {
			url: uri,
			referrer,
			filename: ''
		})
	} else {
		// start a download, and it will be catch by download handler above
		chrome.downloads.download({
			url: uri
		})
	}
})

chrome.notifications.onClicked.addListener(id => {
	launchUI()
	chrome.notifications.clear(id, () => {})
})

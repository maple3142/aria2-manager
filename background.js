const defaultRPC = JSON.stringify([{ name: 'ARIA2 RPC', url: 'http://localhost:6800/jsonrpc' }])
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
		if (auth_str.indexOf('token:') == 0) {
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
			if (auth && auth.indexOf('token:') == 0) {
				rpc_data.params.unshift(auth)
			}
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
						iconUrl: 'images/logo64.png',
						requireInteraction: false
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
	const fileSize = localStorage.getItem('fileSize')
	const white_site = JSON.parse(localStorage.getItem('white_site'))
	const black_site = JSON.parse(localStorage.getItem('black_site'))
	const url = downloadItem.referrer || downloadItem.url

	if (downloadItem.error || downloadItem.state != 'in_progress' || url.startsWith('http') == false) {
		return false
	}

	const domain = new URL(url).hostname
	const inWhiteList = white_site.some(rule => domain.endsWith(rule))
	const inBlackList = black_site.some(rule => domain.endsWith(rule))
	const okWithList = inWhiteList || !inBlackList
	const okWithFileSize = downloadItem.fileSize >= fileSize * 1024 * 1024
	return okWithFileSize && okWithList
}

function isCaptureFinalUrl() {
	const finalUrl = localStorage.getItem('finalUrl')
	return finalUrl == 'true'
}

chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggestion) => {
	const integration = localStorage.getItem('integration')
	const askBeforeDownload = localStorage.getItem('askBeforeDownload')
	const isStartedByMySelf = downloadItem.byExtensionName === 'YAAW for Chrome'

	if (isStartedByMySelf || (integration == 'true' && isCapture(downloadItem))) {
		chrome.downloads.cancel(downloadItem.id)
		if (askBeforeDownload == 'true') {
			if (isCaptureFinalUrl()) {
				launchUI(downloadItem.finalUrl, downloadItem.referrer)
			} else {
				launchUI(downloadItem.url, downloadItem.referrer)
			}
		} else {
			const rpc_list = JSON.parse(localStorage.getItem('rpc_list') || defaultRPC)
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
	const index = chrome.extension.getURL('ui/ariang/index.html')
	if (typeof downloadURL === 'string') {
		url = `${index}#!/new?url=${btoa(downloadURL)}`
		if (typeof referrer === 'string' && referrer != '') {
			url = `${url}&referer=${referrer}`
		}
	} else {
		url = index //clicked from notification or sbrowserAction icon, only launch UI.
	}
	chrome.tabs.getAllInWindow(undefined, tabs => {
		for (let i = 0, tab; (tab = tabs[i]); i++) {
			if (tab.url && tab.url.startsWith(index)) {
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

//add Context Menu
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
		const contextMenus = localStorage.getItem('contextMenus')
		if (contextMenus == 'true' || contextMenus == null) {
			const rpc_list = JSON.parse(localStorage.getItem('rpc_list') || defaultRPC)
			for (const rpc of rpc_list) {
				addContextMenu(rpc.url, strExport + rpc.name)
			}
			localStorage.setItem('contextMenus', true)
		}
	}
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
	// start a download, and it will be catch by download handler above
	chrome.downloads.download({
		url: decodeURIComponent(info.linkUrl)
	})
})

chrome.notifications.onClicked.addListener(id => {
	launchUI()
	chrome.notifications.clear(id, () => {})
})

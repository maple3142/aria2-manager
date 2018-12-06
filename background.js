const defaultRPC = '[{"name":"ARIA2 RPC","url":"http://localhost:6800/jsonrpc"}]'
const HttpSendRead = info => {
	Promise.prototype.done = Promise.prototype.then
	Promise.prototype.fail = Promise.prototype.catch
	return new Promise((resolve, reject) => {
		const http = new XMLHttpRequest()
		let contentType = 'application/x-www-form-urlencoded; charset=UTF-8'
		let timeout = 3000
		if (info.contentType != null) {
			contentType = info.contentType
		}
		if (info.timeout != null) {
			timeout = info.timeout
		}
		const timeId = setTimeout(httpclose, timeout)
		function httpclose() {
			http.abort()
		}
		http.onreadystatechange = () => {
			if (http.readyState == 4) {
				if ((http.status == 200 && http.status < 300) || http.status == 304) {
					clearTimeout(timeId)
					if (info.dataType == 'json') {
						resolve(JSON.parse(http.responseText), http.status, http)
					} else if (info.dataType == 'SCRIPT') {
						// eval(http.responseText);
						resolve(http.responseText, http.status, http)
					}
				} else {
					clearTimeout(timeId)
					reject(http, http.statusText, http.status)
				}
			}
		}
		http.open(info.type, info.url, true)
		http.setRequestHeader('Content-type', contentType)
		for (h in info.headers) {
			if (info.headers[h]) {
				http.setRequestHeader(h, info.headers[h])
			}
		}
		if (info.type == 'POST') {
			http.send(info.data)
		} else {
			http.send()
		}
	})
}

//弹出chrome通知
function showNotification(id, opt) {
	const notification = chrome.notifications.create(id, opt, notifyId => notifyId)
}
//解析RPC地址
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
			const result = parse_url(rpcUrl)
			const auth = result[1]
			if (auth && auth.indexOf('token:') == 0) {
				rpc_data.params.unshift(auth)
			}

			const parameter = {
				url: result[0],
				dataType: 'json',
				type: 'POST',
				data: JSON.stringify(rpc_data),
				headers: {
					Authorization: auth
				}
			}
			HttpSendRead(parameter)
				.done((json, textStatus, jqXHR) => {
					const title = chrome.i18n.getMessage('exportSucceedStr')
					const des = chrome.i18n.getMessage('exportSucceedDes')
					const opt = {
						type: 'basic',
						title,
						message: des,
						iconUrl: 'images/logo64.png',
						isClickable: true
					}
					const id = new Date().getTime().toString()
					showNotification(id, opt)
				})
				.fail((jqXHR, textStatus, errorThrown) => {
					console.log(jqXHR)
					const title = chrome.i18n.getMessage('exportFailedStr')
					const des = chrome.i18n.getMessage('exportFailedDes')
					const opt = {
						type: 'basic',
						title,
						message: des,
						iconUrl: 'images/logo64.png',
						requireInteraction: false
					}
					const id = new Date().getTime().toString()
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

	const parse_url = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/
	const result = parse_url.exec(url)[3]

	for (var i = 0; i < white_site.length; i++) {
		if (matchRule(result, white_site[i])) {
			return true
		}
	}

	for (var i = 0; i < black_site.length; i++) {
		if (matchRule(result, black_site[i])) {
			return false
		}
	}

	if (downloadItem.fileSize >= fileSize * 1024 * 1024) {
		return true
	} else {
		return false
	}
}

function isCaptureFinalUrl() {
	const finalUrl = localStorage.getItem('finalUrl')
	return finalUrl == 'true'
}

//chrome.downloads.onChanged.addListener(function (downloadItem){
//	console.log("onChanged");
//    console.log(downloadItem);
//});

chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggestion) => {
	const integration = localStorage.getItem('integration')
	const askBeforeDownload = localStorage.getItem('askBeforeDownload')

	if (downloadItem.byExtensionId == 'gbdinbbamaniaidalikeiclecfbpgphh') {
		//workaround for filename ignorant assigned by extension "音视频下载"
		return true
	}
	if (integration == 'true' && isCapture(downloadItem)) {
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

function createOptionMenu() {
	const strAddtoWhiteList = chrome.i18n.getMessage('addToWhiteListStr')
	chrome.contextMenus.create({
		type: 'normal',
		id: 'updateWhiteSite',
		title: strAddtoWhiteList,
		contexts: ['browser_action']
	})
	const strAddtoBlackList = chrome.i18n.getMessage('addToBlackListStr')
	chrome.contextMenus.create({
		type: 'normal',
		id: 'updateBlackSite',
		title: strAddtoBlackList,
		contexts: ['browser_action']
	})
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	const strExport = chrome.i18n.getMessage('contextmenuTitle')
	if (changeInfo.status === 'loading') {
		chrome.contextMenus.removeAll()
		createOptionMenu()
		updateOptionMenu(tab)
		const contextMenus = localStorage.getItem('contextMenus')
		if (contextMenus == 'true' || contextMenus == null) {
			const rpc_list = JSON.parse(localStorage.getItem('rpc_list') || defaultRPC)
			for (const i in rpc_list) {
				addContextMenu(rpc_list[i]['url'], strExport + rpc_list[i]['name'])
			}
			localStorage.setItem('contextMenus', true)
		}
	}
})

chrome.tabs.onActivated.addListener(activeInfo => {
	chrome.tabs.get(activeInfo.tabId, tab => {
		updateOptionMenu(tab)
	})
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
	const uri = decodeURIComponent(info.linkUrl)
	const referrer = info.frameUrl || info.pageUrl
	// mock a DownloadItem
	const downloadItem = {
		url: uri,
		referrer,
		filename: ''
	}

	if (info.menuItemId == 'updateBlackSite') {
		updateBlackSite(tab)
		updateOptionMenu(tab)
	} else if (info.menuItemId == 'updateWhiteSite') {
		updateWhiteSite(tab)
		updateOptionMenu(tab)
	} else {
		aria2Send(uri, info.menuItemId, downloadItem)
	}
})

function updateOptionMenu(tab) {
	const black_site = JSON.parse(localStorage.getItem('black_site'))
	const black_site_set = new Set(black_site)
	const white_site = JSON.parse(localStorage.getItem('white_site'))
	const white_site_set = new Set(white_site)
	if (tab == null || tab.url == null) {
		console.warn('Could not get active tab url, update option menu failed.')
	}
	if (!tab.active || tab.url.startsWith('chrome')) return
	const url = new URL(tab.url)
	if (black_site_set.has(url.hostname)) {
		var updateBlackSiteStr = chrome.i18n.getMessage('removeFromBlackListStr')
		chrome.contextMenus.update(
			'updateBlackSite',
			{
				title: updateBlackSiteStr
			},
			() => {}
		)
	} else {
		var updateBlackSiteStr = chrome.i18n.getMessage('addToBlackListStr')
		chrome.contextMenus.update(
			'updateBlackSite',
			{
				title: updateBlackSiteStr
			},
			() => {}
		)
	}
	if (white_site_set.has(url.hostname)) {
		var updateWhiteSiteStr = chrome.i18n.getMessage('removeFromWhiteListStr')
		chrome.contextMenus.update(
			'updateWhiteSite',
			{
				title: updateWhiteSiteStr
			},
			() => {}
		)
	} else {
		var updateWhiteSiteStr = chrome.i18n.getMessage('addToWhiteListStr')
		chrome.contextMenus.update(
			'updateWhiteSite',
			{
				title: updateWhiteSiteStr
			},
			() => {}
		)
	}
}
function updateWhiteSite(tab) {
	if (tab == null || tab.url == null) {
		console.warn('Could not get active tab url, update option menu failed.')
	}
	if (!tab.active || tab.url.startsWith('chrome')) return
	const white_site = JSON.parse(localStorage.getItem('white_site'))
	const white_site_set = new Set(white_site)
	const url = new URL(tab.url)
	if (white_site_set.has(url.hostname)) {
		white_site_set.delete(url.hostname)
	} else {
		white_site_set.add(url.hostname)
	}
	localStorage.setItem('white_site', JSON.stringify(Array.from(white_site_set)))
}
function updateBlackSite(tab) {
	if (tab == null || tab.url == null) {
		console.warn('Could not get active tab url, update option menu failed.')
	}
	if (!tab.active || tab.url.startsWith('chrome')) return
	const black_site = JSON.parse(localStorage.getItem('black_site'))
	const black_site_set = new Set(black_site)
	const url = new URL(tab.url)
	if (black_site_set.has(url.hostname)) {
		black_site_set.delete(url.hostname)
	} else {
		black_site_set.add(url.hostname)
	}
	localStorage.setItem('black_site', JSON.stringify(Array.from(black_site_set)))
}
chrome.notifications.onClicked.addListener(id => {
	launchUI()
	chrome.notifications.clear(id, () => {})
})

//软件版本更新提示
const manifest = chrome.runtime.getManifest()
const previousVersion = localStorage.getItem('version')
if (previousVersion == '' || previousVersion != manifest.version) {
	const opt = {
		type: 'basic',
		title: '更新',
		message: `YAAW2版本更新到${manifest.version}啦\n更新内容：AriaNG升级到1.0.0。`,
		iconUrl: 'images/logo64.png',
		requireInteraction: true
	}
	const id = new Date().getTime().toString()
	showNotification(id, opt)
	localStorage.setItem('version', manifest.version)
}

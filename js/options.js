$(() => {
	const config = (() => ({
		init() {
			const self = this
			const contextMenus = localStorage.getItem('contextMenus')
			if (contextMenus == 'true') {
				$('#contextMenus').prop('checked', true)
			}
			const integration = localStorage.getItem('integration')
			if (integration == 'true') {
				$('#integration').prop('checked', true)
			}
			const finalUrl = localStorage.getItem('finalUrl')
			if (finalUrl == 'true') {
				$('#finalUrl').prop('checked', true)
			}
			const askBeforeDownload = localStorage.getItem('askBeforeDownload')
			if (askBeforeDownload == 'true') {
				$('#askBeforeDownload').prop('checked', true)
			}

			const fileSize = localStorage.getItem('fileSize') || 10
			$('#fileSize').val(fileSize)
			const rpc_list = JSON.parse(
				localStorage.getItem('rpc_list') || '[{"name":"ARIA2 RPC","url":"http://localhost:6800/jsonrpc"}]'
			)
			for (const i in rpc_list) {
				const addBtn = 0 == i ? '<button class="btn" id="add-rpc">Add RPC</button>' : ''
				const row = `<div class="control-group rpc_list"><label class="control-label">JSON-RPC</label><div class="controls"><input type="text" class="input-small" value="${
					rpc_list[i]['name']
				}" placeholder="RPC Name"><input type="text" class="input-xlarge rpc-path" value="${
					rpc_list[i]['url']
				}" placeholder="RPC Path">${addBtn}</div></div>`
				if ($('.rpc_list').length > 0) {
					$(row).insertAfter($('.rpc_list').eq(i - 1))
				} else {
					$(row).insertAfter(
						$('fieldset')
							.children()
							.eq(2)
					)
				}
			}
			const black_site = JSON.parse(localStorage.getItem('black_site'))
			if (black_site) {
				$('#black-site').val(black_site.join('\n'))
			}
			const white_site = JSON.parse(localStorage.getItem('white_site'))
			if (white_site) {
				$('#white-site').val(white_site.join('\n'))
			}
			$('#add-rpc').on('click', () => {
				const rpc_form =
					'<div class="control-group rpc_list">' +
					'<label class="control-label">JSON-RPC</label>' +
					'<div class="controls">' +
					'<input type="text" class="input-small"  placeholder="RPC Name">' +
					'<input type="text" class="input-xlarge rpc-path"  placeholder="RPC Path"></div></div>'
				$(rpc_form).insertAfter($('.rpc_list')[0])
			})
			$('#save').on('click', () => {
				self.save()
			})
			$('#reset').on('click', () => {
				localStorage.clear()
				location.reload()
				chrome.storage.local.clear(() => {
					console.log('Settings storage is cleared!')
				})
			})
		},

		save() {
			const rpc_list = []
			const jsonrpc_history = []
			for (let i = 0; i < $('.rpc_list').length; i++) {
				const child = $('.rpc_list')
					.eq(i)
					.children()
					.eq(1)
					.children()
				if (child.eq(0).val() != '' && child.eq(1).val() != '') {
					rpc_list.push({
						name: child.eq(0).val(),
						url: child.eq(1).val()
					})
					jsonrpc_history.push(child.eq(1).val())
				}
			}
			localStorage.setItem('rpc_list', JSON.stringify(rpc_list))
			localStorage.setItem('jsonrpc_history', JSON.stringify(jsonrpc_history))
			if ($('#contextMenus').prop('checked') == true) {
				localStorage.setItem('contextMenus', true)
			} else {
				localStorage.setItem('contextMenus', false)
			}
			if ($('#integration').prop('checked') == true) {
				localStorage.setItem('integration', true)
			} else {
				localStorage.setItem('integration', false)
			}
			if ($('#finalUrl').prop('checked') == true) {
				localStorage.setItem('finalUrl', true)
			} else {
				localStorage.setItem('finalUrl', false)
			}
			if ($('#askBeforeDownload').prop('checked') == true) {
				localStorage.setItem('askBeforeDownload', true)
			} else {
				localStorage.setItem('askBeforeDownload', false)
			}
			const fileSize = $('#fileSize').val()
			localStorage.setItem('fileSize', fileSize)
			const black_site = $('#black-site')
				.val()
				.split('\n')
			const black_site_set = new Set(black_site)
			// clear the repeat record using Set object
			if (black_site_set.has('')) black_site_set.delete('')
			localStorage.setItem('black_site', JSON.stringify(Array.from(black_site_set)))
			const white_site = $('#white-site')
				.val()
				.split('\n')
			const white_site_set = new Set(white_site)
			// clear the repeat record using Set object
			if (white_site_set.has('')) white_site_set.delete('')
			localStorage.setItem('white_site', JSON.stringify(Array.from(white_site_set)))
		}
	}))()
	config.init()
})
localizeHtmlPage()

function localizeHtmlPage() {
	//Localize by replacing __MSG_***__ meta tags
	const objects = document.getElementsByTagName('html')

	for (const obj of objects) {
		const valStrH = obj.innerHTML.toString()
		const valNewH = valStrH.replace(/__MSG_(\w+)__/g, (match, v1) => (v1 ? chrome.i18n.getMessage(v1) : ''))

		if (valNewH != valStrH) {
			obj.innerHTML = valNewH
		}
	}
}

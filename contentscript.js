document.addEventListener('click', e => {
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

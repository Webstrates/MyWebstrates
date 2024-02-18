module.exports = {
	modules: [
		'globalObject',
		'loadedEvent'
		/*'nodeObjects',
		'protectedMode',
		'domEvents',
		'transclusionEvent',
		'signaling',
    //'assets',
		'tagging',
    'clientManager',
    'userObject',
		'data'*/
	],
	// Supports selector syntax, i.e. 'div.not-persisted' to not persist all DIV elements with the
	// class 'not-persisted'.
	isTransientElement: (DOMNode) => DOMNode.matches('transient'),
	// Any attributeName starting with 'transient-' should be transient.
	isTransientAttribute: (DOMNode, attributeName) => attributeName.startsWith('transient-'),
	// Peer Connection configuration used for the WebRTC-based signal streaming.
};

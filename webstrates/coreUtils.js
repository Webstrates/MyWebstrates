'use strict';

// Source: https://github.com/Webstrates/Webstrates/blob/master/client/webstrates/coreUtils.js

import * as diffMatchPatch from "diff-match-patch";
const coreUtilsModule = {};

let document;

coreUtilsModule.setDocument = (_document) => {
	document = _document;
}

let locationObject;
/**
 * Parses a query string and returns a more friendly object.
 * @param  {Location} location Location object.
 * @return {object}            Object with webstrateId, tagOrVersion and parameters.
 */
coreUtilsModule.getLocationObject = () => {
	if (locationObject) {
		return locationObject;
	}

	let pathname = '/s/' + window.location.pathname.split('/s/')[1];
	const pathRegex = /^\/s\/([A-Z0-9._-]+)(?:@([A-Z0-9.-:]+))?\/?(?:([A-Z0-9_-]+)\/)?/i.exec(pathname);
	if (!pathRegex) return null;
	let [ , webstrateId, remoteHost, tagOrVersion] = pathRegex;
	if(remoteHost) remoteHost = remoteHost.replace('/', '');

	const parameters = {};
	const queryRegex =  /([^&=]+)=?([^&]*)/g;
	const query = window.location.search.substring(1);

	let match;
	while ((match = queryRegex.exec(query))) {
		const [, key, value] = match;
		parameters[key] = decodeURIComponent(value);
	}

	let tag, version;
	if (/^\d/.test(tagOrVersion) && Number(tagOrVersion)) {
		version = Number(tagOrVersion);
	} else {
		tag = tagOrVersion;
	}

	locationObject = {
		webstrateId,
		remoteHost,
		staticMode: !!tagOrVersion,
		tagOrVersion,
		tag, version, // Only one of tag/version will be set
		parameters
	};

	return locationObject;
};

/**
 * Creates a throttled version of a function, i.e. one that only runs at most once every N
 * milliseconds.
 * @param  {Function} fn         Source function.
 * @param  {Number}   limit      Execution delay in milliseconds.
 * @return {Function}            Throttled source function.
 * @public
 */
coreUtilsModule.throttleFn = (fn, limit) => {
	let timeout, lastCall = 0;
	return function(...args) {
		let now = Date.now();
		let delay = lastCall + limit - now;
		if (delay <= 0) {
			fn(...args);
			lastCall = now;
		} else {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				fn(...args);
				lastCall = now;
			}, delay);
		}
	};
};

/**
 * Checks for literal equality of objects. This is a stupid way, but it works.
 * @param  {obj} a First object to compare.
 * @param  {obj} b Second object to compare.
 * @return {bool}  True if objects are equal.
 * @public
 */
coreUtilsModule.objectEquals = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Shallow clones an object.
 * @param  {obj} obj Object to be copied.
 * @return {obj}     Shallow clone.
 * @public
 */
coreUtilsModule.objectClone = (obj) => Array.isArray(obj) ? obj.slice(0) : Object.assign({}, obj);

/**
 * Returns a locked, shallow clone of an object.
 * @param  {obj} obj Object to lock and clone.
 * @return {obj}     Cloned object.
 * @public
 */
coreUtilsModule.objectCloneAndLock = (obj) => Object.freeze(coreUtilsModule.objectClone(obj));

/**
 * Get random integer from interval [min, max). Unbiased and evenly distributed (or close to).
 * @param  {int} min Minimum number, inclusive.
 * @param  {int} max Maximum number, exclusive.
 * @return {int}     Random number in interval [min, max)
 * @public
 */
coreUtilsModule.random = (min, max) => {
	return Math.floor(min + Math.random() * (max - min));
};

/**
 * Get random string of size.
 * @param  {int}    size     Expected length of string (optional).
 * @param  {string} alphabet List of characters to be used in string (optional).
 * @return {string}          Generated string.
 * @public
 */
coreUtilsModule.randomString = (size = 8,
																// Does not include 0, O, o, 1, I, l for readability.
																alphabet = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ') => {
	const len = alphabet.length;
	let str = '';
	while (size--) {
		str += alphabet[coreUtilsModule.random(0, len)];
	}
	return str;
};

/**
 * Get a random UUID.
 * @returns {string}
 */
coreUtilsModule.generateUUID = () => {
	return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
		(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	);
}

/**
 * Get child nodes of an element. If the element is a fragment, get the content's child nodes.
 * @param  {DOMElement} parentElement Element to get child nodes of.
 * @return {array}                    List of child nodes.
 */
coreUtilsModule.getChildNodes = function(parentElement) {
	// This will be the case for <template> tags.
	if (parentElement.content && parentElement.content.nodeType === document.DOCUMENT_FRAGMENT_NODE) {
		parentElement = parentElement.content;
	}
	return parentElement.childNodes;
};

/**
 * Traverses a node tree and applies a callback to each node.
 * @param {DOMNode}  node     Node tree to traverse.
 * @param {DOMNode}  parent   Initial parent node.
 * @param {Function} callback Callback.
 * @public
 */
coreUtilsModule.recursiveForEach = function(node, callback, parent = null) {
	callback(node, parent);

	Array.from(coreUtilsModule.getChildNodes(node)).forEach(child => {
		coreUtilsModule.recursiveForEach(child, callback, node);
	});
};

/**
 * Append a DOM element childElement to another DOM element parentElement. If the DOM element to
 * be appended is a script, prevent the execution of the script. If the parentElement is a
 * <template>, add the child to the parentElement's documentFragment instead. If a referenceNode
 * is specified, the element is inserted before the referenceNode.
 * @param {DOMNode} parentElement Parent element.
 * @param {DOMNode} childElement  Child element.
 * @param {DOMNode} referenceNode Node to insert before.
 * @public
 */
coreUtilsModule.appendChildWithoutScriptExecution = (parentElement, childElement, referenceNode) =>
{
	// We just insert text nodes right away, we're only interested in doing fancy stuff with elements
	// that may have scripts as children.
	if (!(childElement instanceof HTMLElement)) {
		return parentElement.insertBefore(childElement, referenceNode || null);
	}

	// To prevent scripts from being executed when inserted, we use a little hack. Before inserting
	// the script, we replace the actual script with dummy content, causing that to be executed
	// instead of the actual script. If it's an inline script, we insert a script with dummy content
	// ('// Execution prevention'), and then replace the innerHTML afterwards.
	// To prevent issues with any other attributes (e.g. crossorigin and integrity), we also remove
	// all those attributes and insert them later.
	const scriptMap = new Map();
	const scripts = (childElement instanceof HTMLScriptElement) ? [ childElement ]
		: [ ...childElement.querySelectorAll('script') ];

	scripts.forEach(script => {
		const attrs = [];
		Array.from(script.attributes).forEach(attr => {
			attrs.push([ attr.nodeName, attr.nodeValue ]);
			script.removeAttribute(attr.nodeName);
		});
		const text = script.innerHTML;
		script.innerHTML = '// Execution prevention';
		scriptMap.set(script, [ attrs, text ]);
	});

	parentElement.insertBefore(childElement, referenceNode || null);

	scripts.forEach(script => {
		const [ attrs, text ] = scriptMap.get(script);
		attrs.forEach(attr => {
			const [nodeName, nodeValue] = attr;
			script.setAttribute(nodeName, nodeValue);
		});
		script.innerHTML = text;
	});
};

/**
 * Reinsert and execute an array of scripts in order.
 * @param {array}    scripts  Array of script DOM elements.
 * @param {Function} callback Function to call once all scripts have been executed.
 * @public
 */
coreUtilsModule.executeScripts = (scripts, callback) => {
	const script = scripts.shift();
	if (!script) {
		return callback();
	}

	// Scripts in templates shouldn't get executed. If we didn't do this, we could also run into
	// issues a little later in the function when we'd attempt to reinsert the element into its
	// parent if the script is a direct child of the template, as such children don't actually have
	// parents.
	if (coreUtilsModule.elementIsTemplateDescendant(script)) {
		return coreUtilsModule.executeScripts(scripts, callback);
	}

	const executeImmediately = !script.src;
	const newScript = document.createElementNS(script.namespaceURI, 'script');
	if (!executeImmediately) {
		newScript.onload = newScript.onerror = function() {
			coreUtilsModule.executeScripts(scripts, callback);
		};
	}

	// Copy over all attribtues.
	for (let i = 0; i < script.attributes.length; i++) {
		const attr = script.attributes[i];
		newScript.setAttribute(attr.nodeName, attr.nodeValue);
	}

	// Copy over all other properties.
	Object.assign(newScript, script);

	// We're defining the wid with defineProperty to make it non-modifiable, but assign will just copy
	// over the value, leaving it modifiable otherwise.
	coreUtilsModule.setWidOnElement(newScript, script.__wid);

	newScript.innerHTML = script.innerHTML;
	script.parentElement.insertBefore(newScript, script);
	script.remove();

	if (executeImmediately) {
		coreUtilsModule.executeScripts(scripts, callback);
	}
};


/**
 * Check whether a DOM Node is a descendant of a template tag (or actually a documentFragment).
 * One might assume this could be done with `element.closest("template")`, but that won't be the
 * case, because a documentFragment technically isn't a parent (and also doesn't have any parent),
 * so there will be no tree to search upwards through after we reach the documentFragment.
 * @param  {DOMNode} DOMNode DOM Node to check.
 * @return {boolean}         True if the DOM Node is a descendant of a template.
 * @private
 */
coreUtilsModule.elementIsTemplateDescendant = element =>
	document.documentElement.ownerDocument !== element.ownerDocument;

/**
 * Check if the current page has been transcluded (i.e. is an iframe)
 * @return {bool} True if this frame is transcluded.
 * @public
 */
coreUtilsModule.isTranscluded = () => window.frameElement && window.parent !== window;

/**
 * Check whether the current frame shares domain with the outer frame. Only useful when called
 * when transcluded (i.e. called from an iframe). This is used to determine whether accessing the
 * outer frame will cause CORS errors.
 * @return {bool} True if current and outer frame share domain.
 * @public
 */
coreUtilsModule.sameParentDomain = () => {
	const a = window.document.createElement('a');
	a.href = window.document.referrer;
	return a.host === location.host;
};

/**
 * Removes characters that are illegal in attributes and tag names.
 * @param  {string} tagName Unsanitized string.
 * @return {string}         Sanitized string.
 * @public
 */
coreUtilsModule.sanitizeString = (string) => {
	// See https://www.w3.org/TR/html5/syntax.html#tag-name and
	// https://www.w3.org/TR/html5/syntax.html#elements-attributes
	// These regex test does not fully adhere to either, but is more stringent to avoid serialization
	// issues.
	var NAME_START_CHAR_REGEX = /:|[A-Z]|_|[a-z]/;
	var NAME_CHAR_REGEX = /-|\.|[0-9]/;

	return string.split('').map(function(char, index) {
		if (NAME_START_CHAR_REGEX.test(char) || (index > 0 && NAME_CHAR_REGEX.test(char))) {
			return char;
		}
		return '_';
	}).join('');
};

/**
 * Replaces ampersands (&) and double-quotes (") with their respective HTML entities.
 * @param  {string} value Unescaped string.
 * @return {string}       Escaped string.
 * @public
 */
coreUtilsModule.escape = value => value && value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/**
 * Replaces &amp; and &quot; with their respective characters (& and ").
 * @param  {string} value Escaped string.
 * @return {string}       Unescaped string.
 * @public
 */
coreUtilsModule.unescape = value => value && value.replace(/&amp;/g, '&').replace(/&quot;/g, '"');

/**
 * Replaces "." with &dot;.
 * @param  {string} value Unescaped string.
 * @return {string}       Escaped string.
 * @public
 */
coreUtilsModule.escapeDots = value => value && value.replace(/\./g, '&dot;');

/**
 * Replaces &dot; with ".".
 * @param  {string} value Escaped string.
 * @return {string}       Unescaped string.
 * @public
 */
coreUtilsModule.unescapeDots = value => value && value.replace(/&dot;/g, '.');

const widMap = new Map();
/**
 * Add a wid to a node and make it (easily) non-modifiable.
 * @param  {DOMNode} node Node to set wid on.
 * @param  {string} wid  wid.
 * @public
 */
coreUtilsModule.setWidOnElement = (node, wid) => {
	widMap.set(wid, node);
	Object.defineProperty(node, '__wid', {
		value: wid,
		writable: false, // No overwriting
		enumerable: true, // Let iterators and Object.assign see the wid.
		configurable: true // Allow us to redefine it in rare race condition scenarios.
	});
};

const dmp = new diffMatchPatch.diff_match_patch();
/**
 * Convert a number of string patches to OT operations.
 * @param  {JsonMLPath} path Base path for patches to apply to.
 * @param  {string} oldValue Old value.
 * @param  {string} newValue New value.
 * @return {Ops}             List of resulting operations.
 */
coreUtilsModule.patchesToOps = function(path, oldValue, newValue) {
	const ops = [];
	let patches = dmp.patch_make(oldValue, newValue);
	Object.keys(patches).forEach(function(i) {
		let patch = patches[i], offset = patch.start1;
		patch.diffs.forEach(function([type, value]) {
			switch (type) {
				case diffMatchPatch.DIFF_DELETE:
					ops.push({ sd: value, p: [...path, offset] });
					break;
				case diffMatchPatch.DIFF_INSERT:
					ops.push({ si: value, p: [...path, offset] });
				// falls through intentionally
				case diffMatchPatch.DIFF_EQUAL:
					offset += value.length;
					break;
				default: throw Error(`Unsupported operation type: ${type}`);
			}
		});
	});
	return ops;
}

/**
 * Remove element from wid map. Bye, bye, memory leak!
 * @param  {string} wid wid.
 * @public
 */
coreUtilsModule.removeWidFromElement = wid => widMap.delete(wid);

/**
 * Get element by wid.
 * @param  {string} wid wid.
 * @return {DOMNode}     DOM Element with given wid.
 * @public
 */
coreUtilsModule.getElementByWid = wid => widMap.get(wid);

coreUtilsModule.stripPathOfInitialPath = (path, initialPath) => {
	let newArr1 = [...path];
	let newArr2 = [...initialPath];
	while(newArr1.length > 0 && newArr2.length > 0 && newArr1[0] === newArr2[0]) {
		newArr1.shift();
		newArr2.shift();
	}
	return newArr1;
}

coreUtilsModule.hasEmptyArrays = (array) => {
	let result = false;
	for (let a in array) {
		if (Array.isArray(a)) {
			if (a.length === 0) return true;
		}
		result = result || coreUtils.hasEmptyArrays(a);
	}
	return result;

}

coreUtilsModule.applyOpToJsonML = (op, jsonML, parent, childIndex) => {
	if (op.p.length > 1) {
		let index = op.p.pop();
		coreUtilsModule.applyOpToJsonML(op, jsonML[index], jsonML, index);
	} else {
		if (op.li) {
			jsonML[op.p[0]] = op.li;
		} else if (op.si) {
			let strIndex = op.p[0];
			parent[childIndex] = parent[childIndex].slice(0, strIndex) + op.si + parent[childIndex].slice(strIndex);
		}
	}
}

coreUtilsModule.pathStartsWith = (path, start) => {
	return path.join().startsWith(start.join());
}

/**
 * This method takes a list of patches and consolidates all inserts of empty strings or empty arrays with subsequent inserts and splices of the actual values. The resulting array will be of equal length or smaller to the original.
 * @param patches
 * @returns patches
 */
coreUtilsModule.consolidateAutomergePatches = (patches) => {
	// Array of patches that are consolidated into earlier patches and discarded
	let discard = [];

	// This function is used to handle del patches that might impact the search path in the forward direction
	let handleDelInForwardPatches = function(forwardPatch, searchPath) {
		// Let's start by assuming the patch is relevant
		let relevant = true;
		// We check if the forward patch is relevant to our search path
		for (let y=0; y<forwardPatch.path.length-1; y++) {
			relevant = forwardPatch.path[y] === searchPath[y];
			if (!relevant) break;
		}
		if (!relevant) return;
		// If it is relevant we, we check if the deleted item is before items in the search path.
		// If not, it's not relevant.
		// If it is, we have to adjust the search path to reflect the deletion
		if (forwardPatch.path[forwardPatch.path.length-1] < searchPath[forwardPatch.path.length-1]) {
			searchPath[forwardPatch.path.length-1] -= !forwardPatch.length ? 1 : forwardPatch.length;
		}
	}

	// This function is used to handle insert patches that might impact the search path in the forward direction
	let handleInsertInForwardPatches = function(forwardPatch, searchPath) {
		// Let's start by assuming the patch is relevant
		let relevant = true;
		// All but the last index in the path has to match
		for (let z=0; z<forwardPatch.path.length-1; z++) {
			relevant = forwardPatch.path[z] === searchPath[z];
			if (!relevant) break;
		}
		if (!relevant) return;
		//The last index has to be smaller or equal to the last index in the search path
		if (forwardPatch.path[forwardPatch.path.length-1] <= searchPath[forwardPatch.path.length-1]) {
			// If it is, we increment it with the length of the values we are inserting
			searchPath[forwardPatch.path.length-1] += forwardPatch.values.length;
		}
	}

	// We run through the patches in reverse order
	for (let i=patches.length-1; i>=0; i--) {
		let patch = patches[i];
		// When we scan forward, we might run into del or inserts so we will need to modify the search path
		let searchPath = structuredClone(patch.path);
		// We first handle insert patches that are empty strings or arrays
		if (patch.action === 'insert') {
			// Given an insert patch, we run iterate through values looking for empty inserts of strings or arrays
			for (let j=0; j<patch.values.length; j++) {
				let value = patch.values[j];
				let isString = (value === "");
				let isArray = (Array.isArray(value) && value.length === 0);
				if(isString || isArray) {
					// We found an empty insert, now we look forward to see if there's patches we can consolidate into it
					for (let x=i+1; x<patches.length; x++) {
						let forwardPatch = patches[x];
						// If the forward patch is a delete, we need to figure out if it impacts our search path
						if (forwardPatch.action === 'del') {
							handleDelInForwardPatches(forwardPatch, searchPath);
							continue;
						}
						// The path we are looking for is the same as the search path, but with the second to last index increased by j, which represents the value we've reached
						let newPath = structuredClone(searchPath);
						newPath[searchPath.length-1] = searchPath[searchPath.length-1]+j;
						// We are looking for inserts and splices at the beginning of an array or string so we append 0
						newPath.push(0);
						if (forwardPatch.path.join() === newPath.join()) {
							// We found a patch that we can consolidate into the patch we started with
							if (isString && forwardPatch.action === 'splice') {
								// We copy over the string if it's a splice
								patch.values[j] = forwardPatch.value;
								// Now we don't need this patch anymore
								discard.push(forwardPatch);
							}
							if (isArray && forwardPatch.action === 'insert') {
								// If it's a list insert, we have to copy over all the values that are inserted
								forwardPatch.values.forEach(v => patch.values[j].push(v));
								discard.push(forwardPatch);
							}
						} else if (forwardPatch.action === 'insert') {
							// If it wasn't an insert that should be consolidated, we have to check if it impacts our search path
							handleInsertInForwardPatches(forwardPatch, searchPath);
						}
					}
				}
			}
		} else if (patch.action === 'put') { //This is, e.g., relevant when creating a __wid attribute
			for (let x=i+1; x<patches.length; x++) {
				let forwardPatch = patches[x];
				// If the forward patch is a delete, we need to figure out if it impacts our search path
				if (forwardPatch.action === 'del') {
					handleDelInForwardPatches(forwardPatch, searchPath);
					continue;
				}
				let newPath = structuredClone(searchPath);
				// We are looking for splices at the beginning of a string, so we append 0
				newPath.push(0);
				if (forwardPatch.path.join() === newPath.join()) {
					// We found a patch that we can consolidate into the patch we started with
					if (forwardPatch.action === 'splice') {
						patch.value = forwardPatch.value;
						discard.push(forwardPatch);
					}
				} else if (forwardPatch.action === 'insert') {
					//We also have to handle inserts here that might impact the search path
					handleInsertInForwardPatches(forwardPatch, searchPath);
				}
			}
		}
	}
	return patches.filter(p => !discard.includes(p));
}

coreUtilsModule.generateOpsFromAutomergePatch = (patch) => {

	if (patch.action === 'del') {
		if (typeof(patch.path[patch.path.length-1]) === 'string') return [{p: patch.path, od: patch.value}];
		return [{p: patch.path, d: !patch.length ? 1 : patch.length}];
	}
	if (patch.action === 'put') {
		return [{p: patch.path, oi: patch.value}];
	}
	if (patch.action === 'splice') {
		return [{p: patch.path, si: patch.value}];
	}
	if (patch.action === 'insert') {
		let ops = [];
		let indexInPath = patch.path[patch.path.length-1];

		for (let i = 0; i<patch.values.length; i++) {
			let op = {};
			op.p = Array.from(patch.path);
			op.p[op.p.length-1] = indexInPath;
			op.li = patch.values[i];
			ops.push(op);
			indexInPath++;
		}
		return ops;
	}
	if (patch.action === 'inc') {
		console.warn('Webstrates DOM does not support numbers');
	}
}

export const coreUtils = coreUtilsModule;

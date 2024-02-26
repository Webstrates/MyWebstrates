'use strict';

// Map from elements to their parents.
const parentMap = new Map();

// Map from elements to their namespaceURI.
const namespaceMap = new Map();

const adapter = {};

adapter.createDocument = () => [];
adapter.createDocumentFragment = () => [];

adapter.createElement = (tagName, namespaceURI, attrArray) => {
	const attrs = {};
	attrArray.forEach(({ name, value }) => attrs[name] = value.replace(/"/g, '&quot;'));
	const node = [ tagName, attrs ];
	namespaceMap.set(node, namespaceURI);
	return node;
};

adapter.createCommentNode = data => [ '!', data ];

adapter.appendChild = (parentNode, newNode) => {
	parentMap.set(newNode, parentNode);
	parentNode.push(newNode);
};

adapter.insertBefore = (parentNode, newNode, referenceNode) => {
	const referenceNodeIndex = parentNode.findIndex(el => el === referenceNode);
	parentNode.splice(referenceNodeIndex, 0, newNode);
};

adapter.setTemplateContent = (templateElement, contentElement) =>
	templateElement.concat(contentElement);

adapter.getTemplateContent = templateElement => templateElement;
adapter.setDocumentType = (document, name, publicId, systemId) => null;
adapter.setDocumentMode = (document, mode) => null;
adapter.getDocumentMode = () => 'no-quirks';

adapter.insertText = (parentNode, text) => {
	const i = parentNode.length - 1;
	if (typeof parentNode[i] === 'string') {
		parentNode[i] += text;
	} else {
		parentNode.push(text);
	}
};

adapter.insertTextBefore = (parentNode, text, referenceNode) => {
	const i = parentNode.indexOf(referenceNode) - 1;
	if (typeof parentNode[i] === 'string') {
		parentNode[i] += text;
	} else {
		parentNode.push(text);
	}
};

adapter.adoptAttributes = (recipient, attrArray) =>
	attrArray.forEach(({ name, value }) => recipient[1][name] = value);

adapter.getFirstChild = node => { throw new Error('getFirstChild not implemented'); };
adapter.getChildNodes = node => { throw new Error('getChildNodes not implemented'); };
adapter.getParentNode = node => parentMap.get(node);
adapter.getAttrList = element => typeof element[1] === 'object' ? element[1] : {};
adapter.getTagName = element => element[0];
adapter.getNamespaceURI = element => namespaceMap.get(element);

export const jsonmlAdapter = adapter;

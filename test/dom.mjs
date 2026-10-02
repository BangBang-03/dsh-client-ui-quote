/**
 * A very small DOM, just enough to run the transcript capsule enhancer.
 *
 * The capsule code touches a narrow slice of the DOM: element and text nodes,
 * class/attribute/dataset/style, insertBefore/remove, closest and the two
 * query selectors, plus a MutationObserver. Implementing that slice keeps the
 * enhancer testable with plain `node` — no browser, no dependencies — while a
 * real browser still gets the real thing.
 *
 * Supported selectors: tag, `*`, `.class`, `#id`, `[attr]`, `[attr="value"]`,
 * and descendant combinators between them.
 */

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

class ShimNode {
	constructor(nodeType) {
		this.nodeType = nodeType;
		this.parentNode = null;
		this.childNodes = [];
	}

	get parentElement() {
		return this.parentNode !== null && this.parentNode.nodeType === ELEMENT_NODE ? this.parentNode : null;
	}

	get isConnected() {
		let node = this;
		while (node.parentNode !== null) node = node.parentNode;
		return node.nodeType === 9 || node === this.ownerDocument?.documentElement;
	}

	get lastChild() {
		return this.childNodes.length === 0 ? null : this.childNodes[this.childNodes.length - 1];
	}

	append(child) {
		this.insertBefore(child, null);
	}

	insertBefore(child, reference) {
		if (child.parentNode !== null) child.parentNode.childNodes.splice(child.parentNode.childNodes.indexOf(child), 1);
		const index = reference === null || reference === undefined ? this.childNodes.length : this.childNodes.indexOf(reference);
		this.childNodes.splice(index === -1 ? this.childNodes.length : index, 0, child);
		child.parentNode = this;
		this.ownerDocument?.record({ type: 'childList', target: this, addedNodes: [child], removedNodes: [] });
		return child;
	}

	remove() {
		if (this.parentNode === null) return;
		const parent = this.parentNode;
		parent.childNodes.splice(parent.childNodes.indexOf(this), 1);
		this.parentNode = null;
		parent.ownerDocument?.record({ type: 'childList', target: parent, addedNodes: [], removedNodes: [this] });
	}

	contains(node) {
		let current = node;
		while (current !== null && current !== undefined) {
			if (current === this) return true;
			current = current.parentNode;
		}
		return false;
	}
}

class ShimText extends ShimNode {
	constructor(document, value) {
		super(TEXT_NODE);
		this.nodeValue = value;
		this.ownerDocument = document;
	}

	get textContent() {
		return this.nodeValue;
	}

	set textContent(value) {
		this.nodeValue = String(value);
		this.ownerDocument?.record({ type: 'characterData', target: this });
	}
}

class ShimElement extends ShimNode {
	constructor(document, tagName) {
		super(ELEMENT_NODE);
		this.ownerDocument = document;
		this.tagName = String(tagName).toUpperCase();
		this.attributes = new Map();
		this.listeners = new Map();
		this.style = {
			display: '',
			removeProperty: (name) => {
				if (name === 'display') this.style.display = '';
			},
		};
		const attributes = this.attributes;
		this.dataset = new Proxy(
			{},
			{
				get: (_, key) => attributes.get('data-' + String(key)),
				set: (_, key, value) => {
					attributes.set('data-' + String(key), String(value));
					return true;
				},
				has: (_, key) => attributes.has('data-' + String(key)),
			},
		);
	}

	get className() {
		return this.attributes.get('class') ?? '';
	}

	set className(value) {
		this.attributes.set('class', String(value));
	}

	get textContent() {
		return this.childNodes.map((child) => child.textContent).join('');
	}

	set textContent(value) {
		for (const child of this.childNodes.slice()) child.parentNode = null;
		this.childNodes.length = 0;
		if (value !== '') this.append(new ShimText(this.ownerDocument, String(value)));
	}

	get innerHTML() {
		return this.textContent;
	}

	set innerHTML(value) {
		this.textContent = value;
	}

	getAttribute(name) {
		return this.attributes.has(name) ? this.attributes.get(name) : null;
	}

	setAttribute(name, value) {
		this.attributes.set(name, String(value));
	}

	removeAttribute(name) {
		this.attributes.delete(name);
	}

	addEventListener(type, handler) {
		const list = this.listeners.get(type) ?? [];
		list.push(handler);
		this.listeners.set(type, list);
	}

	dispatch(type, event) {
		for (const handler of this.listeners.get(type) ?? []) handler(event);
	}

	matches(selector) {
		return matchesSelector(this, selector);
	}

	closest(selector) {
		let node = this;
		while (node !== null && node.nodeType === ELEMENT_NODE) {
			if (matchesSelector(node, selector)) return node;
			node = node.parentNode;
		}
		return null;
	}

	querySelector(selector) {
		return this.querySelectorAll(selector)[0] ?? null;
	}

	querySelectorAll(selector) {
		const found = [];
		const walk = (node) => {
			for (const child of node.childNodes) {
				if (child.nodeType !== ELEMENT_NODE) continue;
				if (matchesSelector(child, selector)) found.push(child);
				walk(child);
			}
		};
		walk(this);
		return found;
	}
}

function matchesSimple(element, part) {
	if (part === '' || part === '*') return true;
	const attribute = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(part);
	if (attribute !== null) {
		const value = element.getAttribute(attribute[1]);
		if (value === null) return false;
		return attribute[2] === undefined || value === attribute[2];
	}
	const id = /^#([\w-]+)$/.exec(part);
	if (id !== null) return element.getAttribute('id') === id[1];
	const classes = part.split('.').filter((piece) => piece !== '');
	if (classes.length > 1 || part.startsWith('.')) {
		const names = element.className.split(/\s+/).filter((name) => name !== '');
		return classes.every((name) => names.includes(name));
	}
	return element.tagName === part.toUpperCase();
}

function matchesSelector(element, selector) {
	const chain = String(selector).trim().split(/\s+/).filter((piece) => piece !== '');
	if (chain.length === 0) return false;
	if (!matchesSimple(element, chain[chain.length - 1])) return false;
	let node = element.parentNode;
	let index = chain.length - 2;
	while (index >= 0) {
		let matched = false;
		while (node !== null && node.nodeType === ELEMENT_NODE) {
			if (matchesSimple(node, chain[index])) {
				matched = true;
				node = node.parentNode;
				break;
			}
			node = node.parentNode;
		}
		if (!matched) return false;
		index -= 1;
	}
	return true;
}

class ShimDocument extends ShimNode {
	constructor() {
		super(9);
		this.ownerDocument = this;
		this.mutations = [];
		this.observers = [];
		this.documentElement = new ShimElement(this, 'html');
		this.head = new ShimElement(this, 'head');
		this.body = new ShimElement(this, 'body');
		this.documentElement.append(this.head);
		this.documentElement.append(this.body);
		this.childNodes.push(this.documentElement);
		this.documentElement.parentNode = this;
	}

	record(mutation) {
		if (this.observers.length > 0) this.mutations.push(mutation);
	}

	/** Hand pending mutations to every observer, the way the browser would. */
	deliver() {
		const records = this.mutations;
		this.mutations = [];
		if (records.length === 0) return 0;
		for (const observer of this.observers) observer.callback(records);
		return records.length;
	}

	createElement(tag) {
		return new ShimElement(this, tag);
	}

	createTextNode(value) {
		return new ShimText(this, value);
	}

	getElementById(id) {
		for (const element of this.documentElement.querySelectorAll('*')) {
			if (element.getAttribute('id') === id) return element;
		}
		if (this.documentElement.getAttribute('id') === id) return this.documentElement;
		return null;
	}

	querySelector(selector) {
		if (matchesSelector(this.documentElement, selector)) return this.documentElement;
		return this.documentElement.querySelector(selector);
	}

	querySelectorAll(selector) {
		const found = this.documentElement.querySelectorAll(selector);
		if (matchesSelector(this.documentElement, selector)) found.unshift(this.documentElement);
		return found;
	}

	addEventListener() {}

	removeEventListener() {}

	getSelection() {
		return { isCollapsed: true };
	}
}

class ShimMutationObserver {
	constructor(callback) {
		this.callback = callback;
		this.target = null;
	}

	observe(target) {
		this.target = target;
		target.ownerDocument.observers.push(this);
	}

	disconnect() {
		if (this.target === null) return;
		const owner = this.target.ownerDocument;
		const index = owner.observers.indexOf(this);
		if (index !== -1) owner.observers.splice(index, 1);
		this.target = null;
	}
}

/** Create a fresh document plus the globals the bundle expects. */
export function createDom() {
	const document = new ShimDocument();
	const clipboard = [];
	return {
		document,
		Element: ShimElement,
		MutationObserver: ShimMutationObserver,
		navigator: { clipboard: { writeText: (text) => clipboard.push(text) } },
		getComputedStyle: () => ({ backgroundColor: 'rgb(20, 21, 24)' }),
		window: { addEventListener() {}, removeEventListener() {} },
		clipboard,
	};
}

export { ShimElement, ShimText };

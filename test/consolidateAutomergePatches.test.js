import { expect, test } from 'vitest'
import { coreUtils } from '../webstrates/coreUtils.js';

/* Test list
 - Handle insert + splice
 - Handle insert + put
 - Handle insert + splice + insert + splice
 */

test('insert + splice 1', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,2], values: [[]]}, {action: 'insert', path: [5,2,0], values: ["", {}, ""]}, {action: 'splice', path: [5,2,0,0], value: "h1"}]
	)).toMatchObject(
		[{action: "insert", path: [5,2], values: [["h1", {}, ""]]}]
	);
});


test('insert + splice 2', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,4], values: [[]]}, {action: 'insert', path: [5,4,0], values: ["", {}, ""]}, {action: 'splice', path: [5,4,0,0], value: "h2"}]
	)).toMatchObject(
		[{action: "insert", path: [5,4], values: [["h2", {}, ""]]}]
	);
});

test('insert + splice + insert + splice', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,4], values: [[]]}, {action: 'insert', path: [5,4,0], values: ["", {}, []]}, {action: 'splice', path: [5,4,0,0], value: "h2"}, {action: 'insert', path: [5,4,2,0], values: ["", {}, ""]}, {action: 'splice', path: [5,4,2,0,0], value: "strong"}]
	)).toMatchObject(
		[{action: "insert", path: [5,4], values: [["h2", {}, ["strong", {}, ""]]]}]
	);
});

test('insert + splice 3', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,4], values: [[], []]}, {action: 'insert', path: [5,4,0], values: ["", {}, ""]}, {action: 'splice', path: [5,4,0,0], value: "h2"}, {action: 'splice', path: [5,4,2,0], value: "Hello, world"}]
	)).toMatchObject(
		[{action: "insert", path: [5,4], values: [["h2", {}, "Hello, world"], []]}]
	);
});

test('insert + splice 4', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,4], values: [[], []]}, {action: 'insert', path: [5,5,0], values: ["", {}, ""]}, {action: 'splice', path: [5,5,0,0], value: "h2"}, {action: 'splice', path: [5,5,2,0], value: "Hello, world"}]
	)).toMatchObject(
		[{action: "insert", path: [5,4], values: [[], ["h2", {}, "Hello, world"]]}]
	);
});


/*test('insert + put', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,2], values: [[]]}, {action: 'insert', path: [5,2,0], values: ["", {}, ""]}, {action: 'put', path: [5,2,1, '__wid'], value: ""}]
	)).toMatchObject(
		[{action: "insert", path: [5,2], values: [["", {"__wid": ""}, ""]]}]
	);
});


test('insert + put 2', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,4], values: [[]]}, {action: 'insert', path: [5,4, 0], values: ["", {}, ""]}, {action: 'put', path: [5,4,1, '__wid'], value: ""}]
	)).toMatchObject(
		[{action: "insert", path: [5,4], values: [["", {"__wid": ""}, ""]]}]
	);
});

test('insert + put + splice', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,4], values: [[]]}, {action: 'insert', path: [5,4, 0], values: ["", {}, ""]}, {action: 'put', path: [5,4,1, '__wid'], value: ""}, {action: 'splice', path: [5,4,1, '__wid', 0], value: "nrbPL2Ai"}]
	)).toMatchObject(
		[{action: "insert", path: [5,4], values: [["", {"__wid": "nrbPL2Ai"}, ""]]}]
	);
});

test('insert + insert + splice', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,6], values: [[]]}, {action: 'insert', path: [5,6,0], values: ["", {}, [], ""]}, {action: 'splice', path: [5,6,3,0], value: "Hello, world"}]
	)).toMatchObject(
		[{action: "insert", path: [5,6], values: [["", {}, [], "Hello, world"]]}]
	);
});

test('insert + insert + splice 2', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,6], values: [[]]}, {action: 'insert', path: [5,6,0], values: ["", {}, [], ""]}, {action: 'splice', path: [5,6,0,0], value: "h1"}]
	)).toMatchObject(
		[{action: "insert", path: [5,6], values: [["h1", {}, [], ""]]}]
	);
});

test('insert + splice ', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,6,0], values: ["", {}, [], ""]}, {action: 'splice', path: [5,6,0,0], value: "h1"}]
	)).toMatchObject(
		[{action: "insert", path: [5,6,0], values: ["h1", {}, [], ""]}]
	);
});*/



test('insert empty string + splice in content', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,2], values: [""]}, {action: 'splice', path: [5,2,0], value: "a"}]
	)).toMatchObject(
		[{action: "insert", path: [5,2], values: ["a"]}]
	);
})


test('insert empty string + splice in content', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,4], values: [""]}, {action: 'splice', path: [5,4,0], value: "b"}]
	)).toMatchObject(
		[{action: "insert", path: [5,4], values: ["b"]}]
	);
})

test('insert two empty arrays + splice 1', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,2], values: [[], []]}, {action: 'insert', path: [5,3,0], values: ["", {}, ""]}, {action: 'splice', path: [5,3,0,0], value: "h1"}]
	)).toMatchObject(
		[{action: "insert", path: [5,2], values: [[], ["h1", {}, ""]]}]
	);
});

test('insert two empty arrays and an empty string + splice', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [5,2], values: [[], "", []]}, {action: 'insert', path: [5,2,0], values: ["", {}, ""]}, {action: 'splice', path: [5,3,0], value: "Hello"}]
	)).toMatchObject(
		[{action: "insert", path: [5,2], values: [["", {}, ""], "Hello", []]}]
	);
});

test('insert + del + splice 1', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [4,5,4], values: [[]]}, {action: 'insert', path: [4,5,4,0], values: ["", {}, ""]}, {action: 'del', path: [4,3]}, {action: 'splice', path: [4,4,4,0,0], value: "h2"}]
	)).toMatchObject(
		[{action: "insert", path: [4,5,4], values: [["h2", {}, ""]]},  { action: 'del', path: [ 4, 3 ] }]
	);
})

test('insert + not relevant del + splice 1', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [4,5,4], values: [[]]}, {action: 'insert', path: [4,5,4,0], values: ["", {}, ""]}, {action: 'del', path: [4,10]}, {action: 'splice', path: [4,5,4,0,0], value: "h2"}]
	)).toMatchObject(
		[{action: "insert", path: [4,5,4], values: [["h2", {}, ""]]},  { action: 'del', path: [ 4,10 ] }]
	);
})

test('insert + del 2 + splice 1', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [4,5,4], values: [[]]}, {action: 'insert', path: [4,5,4,0], values: ["", {}, ""]}, {action: 'del', path: [4,2], length: 2}, {action: 'splice', path: [4,3,4,0,0], value: "h2"}]
	)).toMatchObject(
		[{action: "insert", path: [4,5,4], values: [["h2", {}, ""]]},  { action: 'del', path: [ 4, 2 ], length: 2}]
	);
})

test('insert + conflicting insert + splice 1', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [4,5,4], values: [[]]}, {action: 'insert', path: [4,5,4,0], values: ["", {}, ""]}, {action: 'insert', path: [4,2], values: ['foo', 'bar']}, {action: 'splice', path: [4,7,4,0,0], value: "h2"}]
	)).toMatchObject(
		[{action: "insert", path: [4,5,4], values: [["h2", {}, ""]]},  {action: 'insert', path: [4,2], values: ['foo', 'bar']}]
	);
})

test('insert + conflicting insert + splice 2', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [4,5,4], values: [[]]}, {action: 'insert', path: [4,5,4,0], values: ["", {}, ""]}, {action: 'insert', path: [4,5], values: ['foo', 'bar']}, {action: 'splice', path: [4,7,4,0,0], value: "h2"}]
	)).toMatchObject(
		[{action: "insert", path: [4,5,4], values: [["h2", {}, ""]]},  {action: 'insert', path: [4,5], values: ['foo', 'bar']}]
	);
})

test('insert + irrelevant insert + splice', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [4,5,4], values: [[]]}, {action: 'insert', path: [4,5,4,0], values: ["", {}, ""]}, {action: 'insert', path: [4,10], values: ['foo', 'bar']}, {action: 'splice', path: [4,5,4,0,0], value: "h2"}]
	)).toMatchObject(
		[{action: "insert", path: [4,5,4], values: [["h2", {}, ""]]},  {action: 'insert', path: [4,10], values: ['foo', 'bar']}]
	);
})

test('insert + irrelevant insert 2 + splice', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [4,5,4], values: [[]]}, {action: 'insert', path: [4,5,4,0], values: ["", {}, ""]}, {action: 'insert', path: [4,10], values: ['foo', 'bar']}, {action: 'splice', path: [4,5,4,2,0], value: "h2"}]
	)).toMatchObject(
		[{action: "insert", path: [4,5,4], values: [["", {}, "h2"]]},  {action: 'insert', path: [4,10], values: ['foo', 'bar']}]
	);
})

test('insert + irrelevant insert 3 + splice', () => {
	expect(coreUtils.consolidateAutomergePatches(
		[{action: 'insert', path: [4,5,4], values: [[]]}, {action: 'insert', path: [4,5,4,0], values: ["", {}, ""]}, {action: 'insert', path: [4,5,5,0], values: ["", {}, ""]}, {action: 'splice', path: [4,5,4,2,0], value: "h2"}]
	)).toMatchObject(
		[{action: "insert", path: [4,5,4], values: [["", {}, "h2"]]},  {action: 'insert', path: [4,5,5,0], values: ["", {}, ""]}]
	);
})

test('put + splice', () => {
expect(coreUtils.consolidateAutomergePatches(
		[{action: 'put', path: [5,2,1, '__wid'], value: ""}, {action: 'splice', path: [5,2,1, '__wid', 0], value: "nrbPL2Ai"}]
	)).toMatchObject(
		[{action: "put", path: [5,2,1, '__wid'], value: "nrbPL2Ai"}]
	);
})

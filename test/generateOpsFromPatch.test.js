import { expect, test } from 'vitest'
import { coreUtils } from '../webstrates/coreUtils.js';

/* Test list
 √ Inserting into a string
 √ Deleting from a string
 √ Inserting an empty string
 √ Inserting a string
 √ Removing a node
 - Inserting a node
 - Inserting a textnode
 - Adding an attribute
 √ Setting the value of an attribute

*/

test('insert "" at 5,2 should give {p: [5,2], li: ""}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'insert', path: [5,2], values: [""]})[0]
	).toMatchObject(
		{p: [5,2], li: ""}
	);
});

test('insert "foo" at 8,4,2 should give {p: [8,4,2], li: "foo"}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'insert', path: [8,4,2], values: ["foo"]})[0]
	).toMatchObject(
		{p: [8,4,2], li: "foo"}
	);
});

test('insert "Hello, world!" at 8,4,2,5,2 should give {p: [8,4,2,5,2], li: "Hello, world!"}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'insert', path: [8,4,2,5,2], values: ["Hello, world!"]})[0]
	).toMatchObject(
		{p: [8,4,2,5,2], li: "Hello, world!"}
	);
});

test('delete 1 at 5,2,5 should give {p: [5,2,5], sd: 1}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'del', path: [5,2,5]})[0]
	).toMatchObject(
		{p: [5,2,5], d: 1}
	);
});

test('delete 5 at 5,2,5 should give {p: [5,2,5], sd: 5}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'del', path: [5,2,5], length: 5})[0]
	).toMatchObject(
		{p: [5,2,5], d: 5}
	);
});

test('delete 1 at 2,3,4 should give {p: [2,3,4], sd: 1}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'del', path: [2,3,4]})[0]
	).toMatchObject(
		{p: [2,3,4], d: 1}
	);
});

test('delete at 2,3,4 should give {p: [2,3,4], ld: true}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'del', path: [2,3,4]})[0]
	).toMatchObject(
		{p: [2,3,4], d: 1}
	);
});

test('delete at 2,3 should give {p: [2,3], ld: true}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'del', path: [2,3]})[0]
	).toMatchObject(
		{p: [2,3], d: 1}
	);
});

test('put "bar" at 2,3,"foo" should give {p: [2,3,"foo"], oi: "bar"}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'put', path: [2,3,"foo"], value: "bar"})[0]
	).toMatchObject(
		{p: [2,3,"foo"], oi: "bar"}
	);
});

test('put "" at 6,5,3,"data-info" should give {p: [6,5,3,"data-info"], oi: ""}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'put', path: [6,5,3,"data-info"], value: ""})[0]
	).toMatchObject(
		{p: [6,5,3,"data-info"], oi: ""}
	);
});

test('splice "," in "Hello world" at 5,2,5 should give {p: [5,2,5], si: ","}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'splice', path: [5,2,5], value: ","})[0]
	).toMatchObject(
		{p: [5,2,5], si: ","}
	);
});

test('splice "two " in "one three" at 4,3 should give {p: [4,3], li: "two "}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'splice', path: [4,3], value: "two "})[0]
	).toMatchObject(
		{p: [4,3], si: "two "}
	);
});

test ('insert ["B", {}, ""] at 9,4,5 should give {p: [9,4,5], li: ["B", {}, ""]}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'insert', path: [9,4,5], values: ["B", {}, ""]})
	).toEqual(
		[{p: [9,4,5], li: "B"},
			{p: [9,4,6], li: {}},
			{p: [9,4,7], li: ""}]
	);
});

test ('insert [[], [], []] at 5,2,0 should give {p: [5,2, 0], li: []}, {p: [5,2,1], li: []}, {p: [5,2,2], li: []}', () => {
	expect(coreUtils.generateOpsFromAutomergePatch(
		{action: 'insert', path: [5,2,0], values: [[], [], []]})
	).toEqual(
		[{p: [5,2,0], li: []},
			{p: [5,2,1], li: []},
			{p: [5,2,2], li: []}]
	);
})








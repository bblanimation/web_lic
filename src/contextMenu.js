/* global Vue: false, util: false, LDParse: false */

// eslint-disable-next-line no-implicit-globals, no-undef
ContextMenu = (function() {
'use strict';

let undoStack, app, store;

const contextMenu = {
	page: [
		{text: 'Auto Layout (NYI)', cb: () => {}},
		{
			text: 'Use Vertical Layout',
			cb() {
				const page = app.selectedItemLookup;
				undoStack.commit('layoutPage', {page, layout: 'vertical'}, this.text);
				app.redrawUI(true);
			}
		},
		{
			text: 'Layout By Row and Column (NYI)',
			cb() {
				const page = app.selectedItemLookup;
				undoStack.commit('layoutPage', {page, layout: {rows: 5, cols: 2, direction: 'vertical'}}, this.text);
				app.redrawUI(true);
			}
		},
		{text: 'separator'},
		{text: 'Prepend Blank Page (NYI)', cb: () => {}},
		{
			text: 'Append Blank Page',
			cb() {
				const prevPage = app.selectedItemLookup;
				undoStack.commit('appendPage', {prevPage}, this.text);
				app.redrawUI(true);
			}
		},
		{text: 'separator'},
		{text: 'Hide Step Separators (NYI)', cb: () => {}},
		{text: 'Add Blank Step (NYI)', cb: () => {}},
		{text: 'Add Annotation (NYI)', cb: () => {}},
		{
			text: 'Delete This Blank Page',
			shown() {
				if (app && app.selectedItemLookup && app.selectedItemLookup.type === 'page') {
					const page = store.get.lookupToItem(app.selectedItemLookup);
					return page.steps.length < 1;
				}
				return false;
			},
			cb() {
				const page = store.get.lookupToItem(app.selectedItemLookup);
				const nextPage = store.get.isLastPage(page) ? store.get.prevPage(page, true) : store.get.nextPage(page);
				undoStack.commit('deletePage', page, 'Delete Page');
				Vue.nextTick(() => {
					app.setCurrentPage(nextPage);
				});
			}
		}
	],
	pageNumber: [
		{text: 'Change Page Number (NYI)', cb: () => {}}
	],
	step: [
		{
			text: 'Convert to Callout (NYI)',
			shown() {
				if (app && app.selectedItemLookup && app.selectedItemLookup.type === 'step') {
					const step = store.get.lookupToItem(app.selectedItemLookup);
					return !util.isEmpty(step.submodel);
				}
				return false;
			},
			cb() {
				// const step = store.get.lookupToItem(app.selectedItemLookup);
				// undoStack.commit('convertSubmodelToCallout', step, 'Convert to Callout');
			}
		},
		{
			text: 'Move Step to...',
			children: [
				{
					text: 'Previous Page',
					shown() {
						if (app && app.selectedItemLookup && app.selectedItemLookup.type === 'step') {
							const page = store.get.pageForItem(app.selectedItemLookup);
							if (store.get.isFirstPage(page) || store.get.isTitlePage(page)) {
								return false;  // Previous page doesn't exist
							} else if (page.steps.indexOf(app.selectedItemLookup.id) !== 0) {
								return false;  // Can only move first step on a page to the previous page
							}
							return true;
						}
						return false;
					},
					cb() {
						undoStack.commit('moveStepToPreviousPage', app.selectedItemLookup, this.text);
						app.redrawUI(true);
					}
				},
				{
					text: 'Next Page',
					shown() {
						if (app && app.selectedItemLookup && app.selectedItemLookup.type === 'step') {
							const page = store.get.pageForItem(app.selectedItemLookup);
							if (store.get.isLastPage(page)) {
								return false;  // Previous page doesn't exist
							} else if (page.steps.indexOf(app.selectedItemLookup.id) !== page.steps.length - 1) {
								return false;  // Can only move last step on a page to the next page
							}
							return true;
						}
						return false;
					},
					cb() {
						undoStack.commit('moveStepToNextPage', app.selectedItemLookup, this.text);
						app.redrawUI(true);
					}
				}
			]
		},
		{
			text: 'Merge Step with...',
			children: [
				{
					text: 'Previous Step',
					shown() {
						if (app && app.selectedItemLookup && app.selectedItemLookup.type === 'step') {
							return store.get.prevStep(app.selectedItemLookup, true) != null;
						}
						return false;
					},
					cb() {
						const sourceStepID = app.selectedItemLookup.id;
						const destStepID = store.get.prevStep(app.selectedItemLookup).id;
						undoStack.commit('mergeSteps', {sourceStepID, destStepID}, this.text);
						app.redrawUI(true);
					}
				},
				{
					text: 'Next Step',
					shown() {
						if (app && app.selectedItemLookup && app.selectedItemLookup.type === 'step') {
							return store.get.nextStep(app.selectedItemLookup, true) != null;
						}
						return false;
					},
					cb() {
						const sourceStepID = app.selectedItemLookup.id;
						const destStepID = store.get.nextStep(app.selectedItemLookup).id;
						undoStack.commit('mergeSteps', {sourceStepID, destStepID}, this.text);
						app.redrawUI(true);
					}
				}
			]
		}
	],
	stepNumber: [
		{text: 'Change Step Number (NYI)', cb: () => {}}
	],
	csi: [
		{text: 'Rotate CSI (NYI)', cb: () => {}},
		{text: 'Scale CSI (NYI)', cb: () => {}},
		{text: 'separator'},
		{
			text: 'Select Part (NYI)',
			shown() {
				if (app && app.selectedItemLookup && app.selectedItemLookup.type === 'csi') {
					const step = store.get.parent(app.selectedItemLookup);
					return step && step.parts && step.parts.length;
				}
				return false;
			},
			children() {
				if (app && app.selectedItemLookup && app.selectedItemLookup.type === 'csi') {
					const step = store.get.parent(app.selectedItemLookup);
					return step.parts.map(partID => {
						const part = LDParse.model.get.partFromID(partID, store.model, step.submodel);
						const abstractPart = LDParse.partDictionary[part.filename];
						return {
							text: abstractPart.name,
							cb() {
								app.setSelected({type: 'part', id: partID, stepID: step.id});
							}
						};
					});
				}
				return null;
			}
		},
		{text: 'Add New Part (NYI)', cb: () => {}}
	],
	pli: [],
	pliItem: [
		{text: 'Rotate PLI Part (NYI)', cb: () => {}},
		{text: 'Scale PLI Part (NYI)', cb: () => {}}
	],
	label: [
		{
			text: 'Set...',
			children: [
				{text: 'Text (NYI)', cb: () => {}},
				{text: 'Font (NYI)', cb: () => {}},
				{text: 'Color (NYI)', cb: () => {}}
			]
		}
	],
	part: [
		{
			text: 'Displace Part...',
			children: [
				{text: 'Up', cb: displacePart('up')},
				{text: 'Down', cb: displacePart('down')},
				{text: 'Left', cb: displacePart('left')},
				{text: 'Right', cb: displacePart('right')},
				{text: 'Forward', cb: displacePart('forward')},
				{text: 'Backward', cb: displacePart('backward')},
				{
					text: 'None',
					shown() {
						if (app && app.selectedItemLookup && app.selectedItemLookup.type === 'part') {
							const step = store.get.step({type: 'step', id: app.selectedItemLookup.stepID});
							if (step.displacedParts) {
								return step.displacedParts.some(p => p.partID === app.selectedItemLookup.id);
							}
						}
						return false;
					},
					cb: displacePart(null)
				}
			]
		},
		{
			text: 'Move Part to Previous Step',
			shown() {
				if (app && app.selectedItemLookup && app.selectedItemLookup.type === 'part') {
					const step = store.get.step({type: 'step', id: app.selectedItemLookup.stepID});
					return store.get.prevStep(step) != null;
				}
				return false;
			},
			cb() {
				const srcStep = store.get.step({type: 'step', id: app.selectedItemLookup.stepID});
				const destStep = store.get.prevStep(srcStep);
				undoStack.commit(
					'movePartToStep',
					{partID: app.selectedItemLookup.id, srcStep, destStep},
					this.text
				);
				app.redrawUI(true);
			}
		},
		{
			text: 'Move Part to Next Step',
			shown() {
				if (app && app.selectedItemLookup && app.selectedItemLookup.type === 'part') {
					const step = store.get.step({type: 'step', id: app.selectedItemLookup.stepID});
					return store.get.nextStep(step) != null;
				}
				return false;
			},
			cb() {
				const srcStep = store.get.step({type: 'step', id: app.selectedItemLookup.stepID});
				const destStep = store.get.nextStep(srcStep);
				undoStack.commit(
					'movePartToStep',
					{partID: app.selectedItemLookup.id, srcStep, destStep},
					this.text
				);
				app.redrawUI(true);
			}
		}
	]
};

function displacePart(direction) {
	return () => {
		const step = store.get.step({type: 'step', id: app.selectedItemLookup.stepID});
		undoStack.commit(
			'displacePart',
			{partID: app.selectedItemLookup.id, step, direction},
			`Dispalce Part ${util.prettyPrint(direction || 'None')}`
		);
		app.redrawUI(true);
	};
}

return function(menuEntry, localApp, localStore, localUndoStack) {
	app = localApp;
	store = localStore;
	undoStack = localUndoStack;
	return contextMenu[menuEntry];
};

})();

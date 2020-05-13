/* Web Lic - Copyright (C) 2018 Remi Gagne */

import _ from './util';
import Storage from './storage';

const defaultState = {
	locale: null,
	lastUsedVersion: null,
	dialog: {
		importModel: {
			stepsPerPage: 1,
			partsPerStep: null,
			useMaxSteps: true,
			firstPageNumber: 1,
			firstStepNumber: 1,
			addStepsForSubmodels: true,
			include: {
				titlePage: true,
				// submodelBreakdown: false,
				pli: true,
				partListPage: true
			}
		},
		'export': {
			images: {
				scale: 1,
				dpi: 96,
				maintainPrintSize: true
			},
			pdf: {
				// Don't cache physical page size because it should initially match current pixel page size
				dpi: 96,
				units: 'point',  // One of 'point', 'mm', 'cm', 'in'
				imageType: 'png' // 'png' or 'jpeg'
			}
		},
		multiBook: {
			firstPageNumber: 'start_page_1'  // or preserve_page_count
		}
	},
	template: null,  // NYI
	navTree: {
		expandedNodes: [],
		checkedItems: {
			all: true, page_step_part: false, group_parts: false,
			step: true, submodelImage: true, csi: true, part: true,
			pli: true, pliItem: true, callout: true, calloutArrow: true,
			annotation: true, numberLabel: true, quantityLabel: true, divider: true
		}
	},
	pageView: {
		facingPage: false,
		scroll: false
	},
	zoom: 1,  // NYI
	grid: {
		enabled: false,
		spacing: 100,
		offset: {
			top: 50,
			left: 50
		},
		line: {
			width: 1,
			color: 'auto',
			dash: []
		}
	},
	splitter: 20,
	guides: [],
	guideStyle: {  // NYI
		width: 1,
		color: 'black'
	}
};

Storage.initialize(defaultState);

let currentState = _.cloneDeep(defaultState);

const api = {
	get(key) {
		return _.get(currentState, key);
	},
	set(key, prop) {
		_.set(currentState, key, prop);
	},
	getCurrentState() {
		return currentState;
	},
	getDefaultState() {
		// Return clone so we don't accidentally modify it; default state is immutable
		return _.cloneDeep(defaultState);
	},
	resetUIState() {
		currentState = _.cloneDeep(defaultState);
	},
	setUIState(newState) {
		currentState = _.cloneDeep(newState);
	},
	mutations: {
		// TODO: Move more ui state mutations here (menu grid & guide bits, etc)
		guides: {
			setPosition(guideID, newPosition) {
				const originalPosition = currentState.guides[guideID].position;
				const path = `/${guideID}/position`, root = currentState.guides;
				return {
					redo: [{root, op: 'replace', path, value: newPosition}],
					undo: [{root, op: 'replace', path, value: originalPosition}]
				};
			}
		}
	}
};

// Load UI state from storage just once here. uiState module itself keeps a copy for fast lookup everywhere
api.setUIState(Storage.get.ui());

export default api;

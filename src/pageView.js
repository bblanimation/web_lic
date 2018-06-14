/* global Vue: false */
'use strict';

import _ from './util';
import Draw from './draw';
import store from './store';
import undoStack from './undoStack';

Vue.component('pageView', {
	render(createElement) {

		let pageOffset, pageIDsToDraw;
		const pageWidth = this.pageSize.width, pageHeight = this.pageSize.height;
		const scrolling = this.isScrollingView, facing = this.isFacingView;

		function renderOnePage(idx, pageID, locked) {

			let marginTop, marginBottom, marginLeft;
			if (scrolling) {
				// Pad the first & last pages so they show up in the center of the screen when scrolled all the way
				marginTop = (idx === 0) ? pageOffset : null;
				marginBottom = (idx === pageIDsToDraw.length - 1) ? pageOffset : null;
			}
			if (facing && !_.isEven(idx)) {
				marginLeft = '40px';
			}

			const canvas = createElement(
				'canvas',
				{
					attrs: {
						id: 'pageCanvas' + pageID,
						width: pageWidth,
						height: pageHeight
					},
					class: ['pageCanvas', {multipleEntries: scrolling}],
					style: {
						marginTop, marginBottom, marginLeft,
						visibility: (pageID == null) ? 'hidden' : null
					}
				}
			);

			let lockIcon, lockSwitch;
			if (pageID != null && pageID !== 'templatePage' && pageID !== 'titlePage') {
				lockIcon = createElement(
					'i',
					{
						class: ['pageLockIcon', 'fas', {'fa-lock': locked, 'fa-lock-open': !locked}],
						style: {marginBottom}
					}
				);
				lockSwitch = createElement(
					'el-switch',
					{
						props: {width: 20},
						class: 'pageLockSwitch',
						style: {marginBottom},
						domProps: {value: locked},
						on: {input: setPageLocked(pageID)}
					}
				);
			}

			return createElement(
				'div',
				{style: {position: 'relative', display: facing ? 'inline' : null}},
				[canvas, lockIcon, lockSwitch]
			);
		}

		if (scrolling) {
			pageOffset = getPageOffset() + 'px';
			pageIDsToDraw = store.state.pages.map(page => page.id);
			if (store.state.titlePage) {
				pageIDsToDraw.unshift('titlePage');
			}
		} else if (this.currentPageLookup && this.currentPageLookup.type === 'templatePage') {
			pageIDsToDraw = ['templatePage'];
		} else if (this.currentPageLookup && this.currentPageLookup.type === 'titlePage') {
			pageIDsToDraw = facing ? [null, 'titlePage'] : ['titlePage'];
		} else if (facing) {
			pageIDsToDraw = getAdjacentPages(this.currentPageLookup).map(page => (page || {}).id);
		} else {
			pageIDsToDraw = [(this.currentPageLookup || {}).id];
		}

		const containerList = [];
		pageIDsToDraw.forEach((pageID, idx) => {
			const locked = this.pageLockStatus[pageID];
			containerList.push(renderOnePage(idx, pageID, locked));
		});

		const width = facing ? pageWidth + pageWidth + 70 + 'px' : pageWidth + 'px';
		const height = scrolling ? null : pageHeight + 'px';
		const subRoot = createElement(
			'div',
			{style: {width, height}},
			containerList
		);

		return createElement(
			'div',
			{
				class: {singleEntry: !scrolling},
				attrs: {id: 'rightSubPane'},
				on: {
					mousedown: this.mouseDown,
					mousemove: this.mouseMove,
					mouseup: this.mouseUp,
					scroll: this.handleScroll
				}
			},
			[subRoot]
		);
	},
	props: ['app', 'selectedItem', 'currentPageLookup'],
	data() {
		return {
			pageSize: {
				width: store.state.template.page.width,
				height: store.state.template.page.height
			},
			pageCount: 0,
			pageLockStatus: [],
			facingPage: false,
			scroll: false
		};
	},
	watch: {
		selectedItem(newItem, prevItem) {
			const prevPage = store.get.pageForItem(prevItem);
			const newPage = store.get.pageForItem(newItem);
			if (prevPage && (!newPage || !_.itemEq(prevPage, newPage))) {
				this.drawPage(prevPage);
			}
			if (newPage) {
				this.drawPage(newPage);
				this.scrollToPage(newPage);
			}
		},
		currentPageLookup(newPage, prevPage) {
			Vue.nextTick(() => {
				if (this.scroll && prevPage && prevPage.type === 'templatePage') {
					// When switching from template's single-page view to scrolling multi-page view, need to reset all pages, as they're blank
					store.mutations.page.setDirty({includeTitlePage: true});
				}
				this.drawCurrentPage();
				this.scrollToPage(newPage);
			});
		}
	},
	methods: {
		forceUpdate() {
			const pageSize = store.state.template.page;
			if ((this.pageSize.width !== pageSize.width) || (this.pageSize.height !== pageSize.height)) {
				this.pageSize.width = store.state.template.page.width;
				this.pageSize.height = store.state.template.page.height;
			}
			const latestPageCount = store.get.pageCount(true);
			if (this.pageCount !== latestPageCount) {
				this.pageCount = latestPageCount;
				store.mutations.page.setDirty({includeTitlePage: true});
			}

			this.pageLockStatus = store.state.pages.map(page => page.locked);

			Vue.nextTick(() => {
				this.drawCurrentPage();
			});
		},
		mouseDown(e) {
			if (e.button !== 0 || e.target.nodeName !== 'CANVAS') {
				return;
			}
			// Record mouse down pos so we can check if mouse up is close enough to down to trigger a 'click' for selection
			this.mouseDownPt = {x: e.offsetX, y: e.offsetY};
			if (this.selectedItem) {
				const item = store.get.lookupToItem(this.selectedItem);
				if (store.get.isMoveable(this.selectedItem) && inBox(e.offsetX, e.offsetY, item)) {
					// If mouse down is inside a selected item, store item & down pos in case mouse move follows, to support dragging items
					this.mouseDragItem = {item, x: e.offsetX, y: e.offsetY};
				}
			}
		},
		mouseMove(e) {
			if (!this.mouseDragItem || e.target.nodeName !== 'CANVAS') {
				return;
			}
			const dx = Math.floor(e.offsetX - this.mouseDragItem.x);
			const dy = Math.floor(e.offsetY - this.mouseDragItem.y);
			if (dx === 0 && dy === 0) {
				return;
			}
			// TODO: Some items can't be dragged about freely, like callout arrow base points
			// TODO: Update parent bounding boxes for children like PLI, CSI, etc
			store.mutations.item.reposition({item: this.mouseDragItem.item, dx, dy});
			this.mouseDragItem.x = e.offsetX;
			this.mouseDragItem.y = e.offsetY;
			this.mouseDragItem.moved = true;
			this.drawCurrentPage();
		},
		mouseUp(e) {
			if (e.button !== 0) {
				return;
			}
			const up = {x: e.offsetX, y: e.offsetY};
			if (this.mouseDownPt && _.geom.distance(this.mouseDownPt, up) < 10 && e.target.nodeName === 'CANVAS') {
				// If simple mouse down + mouse up with very little movement, handle as if 'click' for selection
				const page = getPageForCanvas(e.target);
				const target = findClickTargetInPage(page, e.offsetX, e.offsetY);
				if (target) {
					this.app.setSelected(target);
				} else {
					this.app.clearSelected();
				}
			} else if (this.mouseDragItem && this.mouseDragItem.moved) {
				// Mouse drag is complete; add undo event to stack
				undoStack.commit(null, null, `Move ${_.prettyPrint(this.mouseDragItem.item.type)}`);
			} else if (e.target.nodeName !== 'CANVAS') {
				this.app.clearSelected();
			}
			this.mouseDownPt = this.mouseDragItem = null;
		},
		handleScroll() {
			const container = document.getElementById('rightSubPane');
			const topOffset = container.querySelector('canvas').offsetTop;
			const pageHeight = store.state.template.page.height + 30;
			let pageIndex = Math.ceil((container.scrollTop - topOffset) / pageHeight);
			pageIndex -= store.get.titlePage() ? 1 : 0;
			const page = (pageIndex < 0) ? store.get.titlePage() : store.state.pages[pageIndex];
			this.drawNearbyPages(page);
		},
		scrollToPage(page) {
			if (!this.isScrollingView) {
				return;
			}
			page = store.get.lookupToItem(page);
			if (page) {
				const pageCanvas = this.getCanvasForPage(page);
				if (pageCanvas) {
					const container = document.getElementById('rightSubPane');
					const dy = (container.offsetHeight - pageCanvas.offsetHeight) / 2;
					container.scrollTop = pageCanvas.parentElement.offsetTop - dy;
				}
			}
		},
		clearPageCanvas() {
			const canvasList = document.querySelectorAll('canvas[id^="pageCanvas"]');
			_.toArray(canvasList).forEach(canvas => {
				canvas.width = canvas.width;
			});
		},
		drawCurrentPage() {
			if (this.currentPageLookup) {
				if (this.currentPageLookup.type === 'templatePage') {
					this.drawPage(this.currentPageLookup);
				} else if (this.facingPage) {
					this.drawAdjacentPages(this.currentPageLookup);
				} else {
					this.drawPage(this.currentPageLookup);
					if (this.scroll ) {
						this.drawNearbyPages(this.currentPageLookup);
					}
				}
			}
		},
		drawAdjacentPages(page) {
			getAdjacentPages(page).forEach(page => this.drawPage(page));
		},
		drawNearbyPages(page) {
			page = store.get.lookupToItem(page);
			let currentPageIdx;
			if (page.type === 'titlePage') {
				currentPageIdx = 0;
			} else {
				currentPageIdx = store.state.pages.findIndex(el => el.id === page.id);
			}
			if (currentPageIdx < 0) {
				return;
			}
			const firstPage = Math.max(0, currentPageIdx - 2);
			for (let i = firstPage; i < firstPage + 5; i++) {
				page = store.state.pages[i];
				if (page && page.needsDrawing) {
					this.drawPage(page);
				}
			}
			if (currentPageIdx < 3 && store.state.titlePage && store.state.titlePage.needsDrawing) {
				this.drawPage({id: 0, type: 'titlePage'});
			}
		},
		drawPage(page, canvas, scale = 1) {
			page = store.get.lookupToItem(page);
			if (page == null) {
				return;  // This can happen if, say, a page got deleted without updating the current page (like in undo / redo)
			}
			if (canvas == null) {
				canvas = this.getCanvasForPage(page);
			}
			if (canvas == null) {
				return;  // Can't find a canvas for this page - ignore draw call.  Happens when we're transitioning between view modes
			}
			const selectedPart = (this.selectedItem && this.selectedItem.type === 'part') ? this.selectedItem : null;
			Draw.page(page, canvas, scale, selectedPart);
			delete page.needsDrawing;
			if (this.currentPageLookup && _.itemEq(page, this.currentPageLookup)) {
				const itemPage = store.get.pageForItem(this.selectedItem);
				if (_.itemEq(itemPage, this.currentPageLookup)) {
					const box = itemHighlightBox(this.selectedItem, this.pageSize);
					Draw.highlight(canvas, box.x, box.y, box.width, box.height);
				}
			}
		},
		getCanvasForPage(page) {
			let id = 'pageCanvas';
			if (page) {
				if (page.type === 'titlePage' || page.type === 'templatePage') {
					id += page.type;
				} else {
					id += page.id;
				}
			} else if (this.currentPageLookup) {
				id += this.currentPageLookup.id;
			}
			return document.getElementById(id);
		},
		pageCoordsToCanvasCoords(point) {
			const canvas = this.getCanvasForPage(this.currentPageLookup);
			const box = canvas.getBoundingClientRect();
			return {
				x: Math.floor(point.x - box.x),
				y: Math.floor(point.y - box.y)
			};
		}
	},
	computed: {
		isFacingView() {
			return this.facingPage
				&& (this.currentPageLookup == null || this.currentPageLookup.type !== 'templatePage');
		},
		isScrollingView() {
			return this.scroll && this.pageCount > 1
				&& (this.currentPageLookup == null || this.currentPageLookup.type !== 'templatePage');
		}
	}
});

function getAdjacentPages(page) {
	page = store.get.lookupToItem(page);
	if (page.type === 'titlePage') {
		return [null, page];
	} else if (_.isEven(page.number)) {
		return [page, store.get.nextPage(page)];
	}
	return [store.get.prevPage(page, false, false), page];
}

function setPageLocked(pageID) {
	if (pageID == null) {
		return function() {};
	}
	return function(locked) {
		const opts = {page: {type: 'page', id: pageID}, locked};
		undoStack.commit('page.setLocked', opts, locked ? 'Lock Page' : 'Unlock Page');
	};
}

function getPageOffset() {
	const pageHeight = store.state.template.page.height;
	const container = document.getElementById('rightSubPane');
	return container ? (container.offsetHeight - pageHeight) / 2 : 0;
}

function getPageForCanvas(canvas) {
	const pageID = canvas.id.replace('pageCanvas', '');
	if (pageID.endsWith('Page')) {
		return store.get.page({id: 0, type: pageID});
	}
	return store.get.page(parseInt(pageID, 10));
}

function itemHighlightBox(selItem, pageSize) {
	selItem = store.get.lookupToItem(selItem);
	if (!selItem || selItem.type === 'part') {
		return {display: 'none'};
	}
	const type = selItem.type;
	const page = store.get.pageForItem(selItem);
	if (page.needsLayout) {
		store.mutations.page.layout({page});
	}
	let box;
	if (type === 'page' || type === 'titlePage' || type === 'templatePage') {
		box = {x: 6, y: 6, width: pageSize.width - 10, height: pageSize.height - 10};
	} else if (type === 'calloutArrow') {
		box = store.get.calloutArrowBoundingBox(selItem);
	} else if (type === 'divider') {
		let pointBox = _.geom.bbox([selItem.p1, selItem.p2]);
		pointBox = _.geom.expandBox(pointBox, 8, 8);
		box = store.get.targetBox({...selItem, ...pointBox});
	} else {
		box = store.get.targetBox(selItem);
		if (type === 'point') {
			box = {x: box.x - 2, y: box.y - 2, width: 4, height: 4};
		}
	}
	return {
		x: box.x - 4,
		y: box.y - 4,
		width: 4 + box.width + 4,
		height: 4 + box.height + 4
	};
}

function inBox(x, y, t) {
	const box = store.get.targetBox(t);
	return x > box.x && x < (box.x + box.width) && y > box.y && y < (box.y + box.height);
}

// TODO: abstract the details in here better.  Shouldn't have to add more code here for each simple box container
function findClickTargetInStep(step, mx, my) {

	if (step.numberLabelID != null) {
		const lbl = store.get.numberLabel(step.numberLabelID);
		if (inBox(mx, my, lbl)) {
			return lbl;
		}
	}
	if (step.rotateIconID != null) {
		const icon = store.get.rotateIcon(step.rotateIconID);
		if (inBox(mx, my, icon)) {
			return icon;
		}
	}
	const csi = store.get.csi(step.csiID);
	if (step.csiID != null && inBox(mx, my, csi)) {
		return csi;
	}
	if (step.steps.length) {
		for (let i = 0; i < step.steps.length; i++) {
			const innerStep = store.get.step(step.steps[i]);
			const innerTarget = findClickTargetInStep(innerStep, mx, my);
			if (innerTarget) {
				return innerTarget;
			}
		}
	}
	if (step.submodelImages.length) {
		for (let i = 0; i < step.submodelImages.length; i++) {
			const submodelImage = store.get.submodelImage(step.submodelImages[i]);
			if (inBox(mx, my, submodelImage)) {
				if (submodelImage.quantityLabelID != null) {
					const quantityLabel = store.get.quantityLabel(submodelImage.quantityLabelID);
					if (inBox(mx, my, quantityLabel)) {
						return quantityLabel;
					}
				}
				const submodelCSI = store.get.csi(submodelImage.csiID);
				if (inBox(mx, my, submodelCSI)) {
					return submodelCSI;
				}
				return submodelImage;
			}
		}
	}
	if (step.pliID != null && store.state.plisVisible) {
		const pli = store.get.pli(step.pliID);
		if (inBox(mx, my, pli)) {
			for (let i = 0; i < pli.pliItems.length; i++) {
				const pliItem = store.get.pliItem(pli.pliItems[i]);
				if (inBox(mx, my, pliItem)) {
					return pliItem;
				}
				const quantityLabel = store.get.quantityLabel(pliItem.quantityLabelID);
				if (inBox(mx, my, quantityLabel)) {
					return quantityLabel;
				}
			}
			return pli;
		}
	}
	if (step.callouts.length) {
		for (let i = 0; i < step.callouts.length; i++) {
			const callout = store.get.callout(step.callouts[i]);
			if (inBox(mx, my, callout)) {
				for (let j = 0; j < callout.steps.length; j++) {
					const step = store.get.step(callout.steps[j]);
					const innerTarget = findClickTargetInStep(step, mx, my);
					if (innerTarget) {
						return innerTarget;
					}
				}
				return callout;
			}
			for (let k = 0; k < callout.calloutArrows.length; k++) {
				const arrow = store.get.calloutArrow(callout.calloutArrows[k]);
				const arrowBox = store.get.calloutArrowBoundingBox(arrow);
				if (inBox(mx, my, arrowBox)) {
					return arrow;
				}
			}
		}
	}
	if (inBox(mx, my, step)) {
		return step;
	}
	return null;
}

function findClickTargetInPage(page, mx, my) {
	page = store.get.lookupToItem(page);
	if (!page) {
		return null;
	}
	if (page.numberLabelID != null) {
		const lbl = store.get.numberLabel(page.numberLabelID);
		if (inBox(mx, my, lbl)) {
			return lbl;
		}
	}
	if (page.annotations != null) {
		for (let i = 0; i < page.annotations.length; i++) {
			const a = store.get.annotation(page.annotations[i]);
			if (inBox(mx, my, a)) {
				return a;
			}
		}
	}
	for (let i = 0; i < page.dividers.length; i++) {
		const divider = store.get.divider(page.dividers[i]);

		let box = _.geom.bbox([divider.p1, divider.p2]);
		box = _.geom.expandBox(box, 8, 8);
		if (inBox(mx, my, {...divider, ...box})) {
			return divider;
		}
	}
	for (let i = 0; i < page.steps.length; i++) {
		const step = store.get.step(page.steps[i]);
		const innerTarget = findClickTargetInStep(step, mx, my);
		if (innerTarget) {
			return innerTarget;
		}
	}
	return page;
}

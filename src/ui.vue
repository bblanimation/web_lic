/* Web Lic - Copyright (C) 2018 Remi Gagne */

<template>
	<div id="container" @click="closeMenus()">
		<div v-cloak id="busyOverlay" :class="{hidden: busyText === ''}">
			<!--<div id="busyText">{{busyText}}<div id="spinner"></div></div>-->
			<div id="busyContainer">
				<div class="busyText">
					{{busyText}}
				</div>
				<div class="progress">
					<div id="progressbar" class="progress-bar" role="progressbar" style="width: 0%">
						0%
					</div>
				</div>
			</div>
		</div>

		<nav-bar
			id="navMenu"
			ref="navMenuComponent"
			:menu-entry-list="navBarContent"
			:filename="{name: filename, isDirty}"
			@close-menus="closeMenus"
		/>

		<div class="mainBody" @contextmenu.stop.prevent="rightClick($event)">
			<div id="leftPane" class="split split-horizontal">
				<nav-tree-container
					ref="navTreeContainer"
					:current-item="selectedItemLookup"
					@select-item="setSelected"
				/>
			</div>

			<div id="rightPane" class="split split-horizontal">
				<page-view
					ref="pageView"
					:app="this"
					:selected-item="selectedItemLookup"
					:current-page-id="currentPageId"
				/>
				<getting-started-panel v-if="!haveModel()" :app="this" />
				<template-panel
					v-if="isTemplatePageCurrent"
					id="templatePanelContainer"
					ref="templatePanel"
					:app="this"
					:selected-item="selectedItemLookup"
				/>
			</div>
		</div>

		<popup-menu
			id="contextMenu"
			ref="contextMenuComponent"
			class="dropdown"
			tabindex="-1"
			:menu-entries="contextMenu"
			:selected-item="selectedItemLookup"
		/>

		<dialog-manager />

		<div v-cloak id="statusBar">
			{{statusText}}
		</div>
	</div>
</template>

<script>

// TODO:
// - Make all dialogs that affect page rendering moveable, so they can be moved to unobscure stuff
// - add 'culled' versions of popular parts, with their inside bits removed
// - auto add a 'rotate back' CSI rotation icon on the step after the currently rotated one
// - Undo / redo stack bakes action text into itself, which breaks translations
// - Add ability to upload a custom ldconfig file, to customize all colors in one shot
// - Put submodels inline then move submodel merge step to previous page
//     as the only step on row 2; arrow is wrong
// - Shrunken submodel images need to be centered (move lots of steps onto alligator head step to see)
// - Change page numbers to 'even left odd right' (or 'odd left even right') then append a page:
//     pages after new page have badly positioned page numbers
// - Fix import progress bar for models with one base model like basic x-wing
// - Check localStorage.set to ensure it doesn't go over browser limit. If it does, use lzstring to compress
// - Need submodel + bag breakdown page and final 'no step' complete model page
// - Add double click on annotation support: pop up the 'edit annotation' dialog
// - When edit annotation dialogs open, set focus somewhere useful
// - Grid config dialog is atrociously ugly
// - Title page CSI includes rotate context menu but it doesn't work
// - Remove all default rotation from X-Wing and get nutso horizontal lines
// - Balance part list columns better, so instead of 9-7-5 we get 7-7-7 kinda thing
// - first add support for multiple selection, then add support for merging two parts in a PLI,
//     like for antenna base and stick, or left / right hinge parts or 2x2 turntables
// - When displacing a part, check if it has exactly one stud; if so, stick arrow in stud
// - Convert alligator tail to callout, merge step 4 & 5; callout grid layout busted, steps 2 & 3 collide
// - Title Page CSI rotation is broken
// - Insert a new first page then add a step to it they try moving a part to step: crash
// - No way to unstretch a stretched step
// - Merging the first step of a submodel with the second step loses the submodel image

/* global Split: false */
import Vue from 'vue';
import _ from './util';
import uiState from './ui_state';
import store from './store';
import undoStack from './undo_stack';
import openFileHandler from './file_uploader';
import LDParse from './ld_parse';
import Menu from './menu';
import ContextMenu from './context_menu';
import Storage from './storage';
import LocaleManager from './components/translate.vue';
import packageInfo from '../package.json';
import backwardCompat from './backward_compat';
import DialogManager from './dialog';
import NavBar from './components/nav_bar.vue';
import NavTree from './navtree';
import NavTreeContainer from './components/nav_tree_container.vue';
import PopupMenu from './components/popup_menu.vue';
import TemplatePanel from './components/template_panel.vue';
import GettingStartedPanel from './components/getting_started.vue';
import './page_view';
import EventBus from './event_bus';

const UI = {
	components: {NavBar, NavTreeContainer, PopupMenu, TemplatePanel, GettingStartedPanel},
	data() {
		return {
			// Store transient UI state data here.  Do *not* store state items here; Vue turns these
			// into observers, which destroys performance for big stores like we have here
			currentPageId: null,
			selectedItemLookup: null,
			statusText: '',
			busyText: '',
			contextMenu: null,
			filename: null,
			dirtyState: {
				undoIndex: 0,
				lastSaveIndex: 0,
			},
			lastRightClickPos: {
				x: null,
				y: null,
			},
			disableLocalStorage: false,
		};
	},
	methods: {
		importBuiltInModel(url) {
			url = './static/models/' + url;
			this.importModel(() => LDParse.loadRemotePart(url, this.updateProgress));
		},
		importCustomModel() {
			const importContent = (content, filename) => {
				this.importModel(() => LDParse.loadModelContent(content, filename, this.updateProgress));
			};
			openFileHandler('.ldr, .mpd', 'text', importContent);
		},
		async importModel(modelGenerator) {

			const start = Date.now();
			if (store.model) {
				this.closeModel();
			}

			await LDParse.loadLDConfig();  // Forcefully reload color table, to clear previous color table

			this.busyText = this.tr('dialog.busy_indicator.loading_model');
			const model = await modelGenerator();

			if (!_.isEmpty(LDParse.missingParts)) {
				await DialogManager('missingPartsDialog');
			}

			await store.mutations.templatePage.add();
			store.setModel(model);
			this.filename = store.state.licFilename;
			store.render.adjustCameraZoom();

			DialogManager('importModelDialog', dialog => {
				if (_.isEmpty(model.steps)) {
					const partCount = LDParse.model.get.partCount(model);
					dialog.newState.partsPerStep = _.clamp(Math.floor(partCount / 10), 1, 20);
					dialog.includePartsPerStep = true;
				} else {
					dialog.newState.partsPerStep = null;
					dialog.includePartsPerStep = false;
				}
				dialog.$on('ok', async layoutChoices => {

					// TODO: Add option to start new page for each submodel
					store.mutations.pli.toggleVisibility({visible: layoutChoices.include.pli});
					store.mutations.addInitialPages({partsPerStep: layoutChoices.partsPerStep});
					store.mutations.addInitialSubmodelImages();
					if (layoutChoices.useMaxSteps) {
						this.busyText = this.tr('dialog.busy_indicator.merging_steps');
						await store.mutations.mergeInitialPages(this.updateProgress);
					}
					if (layoutChoices.include.partListPage) {
						store.mutations.inventoryPage.add();
					}
					if (layoutChoices.include.titlePage) {
						// Add title page after regular pages so title page labels comes out correct
						store.mutations.titlePage.add();
					}
					store.saveLocal();

					const firstPage = store.get.firstPage();
					this.currentPageId = firstPage.id;
					undoStack.saveBaseState();
					this.forceUIUpdate();

					this.updateProgress({clear: true});
					const time = _.formatTime(start, Date.now());
					const filename = store.get.modelFilename();
					this.statusText = this.tr('action.file.import_model.success_message_@mf',
						{filename, time});
					Vue.nextTick(this.drawCurrentPage);
				});
			});
		},
		openLicFile() {
			openFileHandler('.lic', 'text', this.openLicFileFromContent);
		},
		openLicFileFromContent(content) {
			const start = Date.now();
			if (typeof content === 'string') {
				content = JSON.parse(content);
			}

			backwardCompat.fixLicSaveFile(content);

			if (store.model) {
				this.closeModel();
			}
			store.load(content);
			this.filename = store.state.licFilename;
			const firstPage = store.get.firstPage();
			this.currentPageId = firstPage.id;
			store.saveLocal();
			undoStack.saveBaseState();
			this.clearSelected();
			const time = _.formatTime(start, Date.now());
			const filename = store.model.filename;
			this.statusText = this.tr('action.file.open_lic.success_message_@mf', {filename, time});
			Vue.nextTick(() => {
				this.forceUIUpdate();
				this.drawCurrentPage();
			});
		},
		save() {
			store.saveToFile();
			this.dirtyState.lastSaveIndex = undoStack.getIndex();
		},
		saveAs() {
			DialogManager('stringChooserDialog', dialog => {
				dialog.$on('ok', newString => {
					const fn = newString.replace(/[^a-zA-Z0-9 _]/ig, '').replace(/li[ct]$/ig, '');
					this.filename = store.state.licFilename = fn;
					this.save();
				});
				dialog.title = this.tr('dialog.save_as.title');
				dialog.label = this.tr('dialog.save_as.fn');
				dialog.newString = this.filename;
			});
		},
		saveTemplate(filename) {
			store.saveTemplate(filename, '\t');
		},
		saveTemplateAs() {
			DialogManager('stringChooserDialog', dialog => {
				dialog.$on('ok', newString => {
					const fn = newString.replace(/[^a-zA-Z0-9 _]/ig, '').replace(/li[ct]$/ig, '');
					this.saveTemplate(fn);
				});
				dialog.title = this.tr('dialog.save_template_as.title');
				dialog.label = this.tr('dialog.save_template_as.fn');
				dialog.newString = this.filename;
			});
		},
		importTemplate() {
			const importTemplate = (result, filename) => {
				const content = JSON.parse(result);
				backwardCompat.fixLicTemplate(content);
				undoStack.commit('templatePage.load', content, 'Load Template', ['page']);
				this.statusText = this.tr('action.file.template.load.success_message_@mf', {filename});
				Vue.nextTick(() => {
					this.drawCurrentPage();
					this.forceUIUpdate();
				});
			};
			openFileHandler('.lit', 'text', importTemplate);
		},
		closeModel() {
			store.resetState();
			undoStack.clear();
			Storage.clear.model();
			this.clearState();
			store.render.clearCanvasCache();
			Vue.nextTick(() => {
				this.clearSelected();
			});
		},
		setCurrentPage(page) {
			if (page.id !== this.currentPageId) {
				this.currentPageId = page.id;
				this.$refs.pageView.scrollToPage(page.id);
			}
		},
		setSelected(target, page) {
			this.closeMenus();
			if (_.itemEq(target, this.selectedItemLookup)
				&& (page == null || page.id === this.currentPageId)
			) {
				return;
			}
			let targetPage;
			if (page) {
				targetPage = page;
			} else if (target.type === 'submodel') {
				targetPage = store.get.pageForItem({type: 'step', id: target.stepID});
			} else {
				targetPage = store.get.pageForItem(target);
			}
			if (targetPage != null && targetPage.id !== this.currentPageId) {
				this.currentPageId = targetPage.id;
			}
			this.selectedItemLookup = store.get.itemToLookup(target);
			NavTree.selectItem(target);
		},
		clearSelected() {
			this.contextMenu = null;
			this.selectedItemLookup = null;
			this.drawCurrentPage();
			NavTree.clearSelected();
		},
		updateProgress: (() => {
			let progress = 0, count = 0, text = '';
			return function(opts) {
				if (opts == null) {
					progress++;
				} else if (typeof opts === 'string') {
					progress++;
					text = opts;
				} else {
					if (opts.stepCount) {
						count = opts.stepCount;
						progress = 0;
					}
					if (opts.clear) {
						this.busyText = text = '';
						progress = count = 0;
					}
					if (opts.text) {
						text = opts.text;
					}
				}
				// This gets called several times a second, as long-lived processes progress.
				// Vue's reactivity is too slow and resource intensive to use here.
				const bar = document.getElementById('progressbar');
				const pct = Math.floor(progress / count * 100) || 0;
				bar.style.width = `${pct}%`;
				bar.innerText = text || bar.style.width;
			};
		})(),
		forceUIUpdate() {
			NavTree.update();
			Object.values(this.$refs).forEach(ref => {
				if (ref && typeof ref.forceUpdate === 'function') {
					ref.forceUpdate();
				}
			});
			if (this.selectedItemLookup && this.selectedItemLookup.id != null) {
				this.selectedItemLookup.id++;
				this.selectedItemLookup.id--;
			}
		},
		redrawUI(clearSelection) {
			Vue.nextTick(() => {
				if (clearSelection) {
					this.clearSelected();
				}
				this.forceUIUpdate();
				this.drawCurrentPage();
			});
		},
		clearState() {
			this.clearSelected();
			this.currentPageId = null;
			this.statusText = '';
			this.updateProgress({clear: true});
			this.contextMenu = null;
			this.filename = null;
			this.dirtyState.undoIndex = 0;
			this.dirtyState.lastSaveIndex = 0;
			this.forceUIUpdate();
		},
		rightClick(e) {
			this.closeMenus();
			this.lastRightClickPos.x = e.clientX;
			this.lastRightClickPos.y = e.clientY;
			this.contextMenu = null;
			if (this.selectedItemLookup != null
				&& this.currentPageId != null
				// Template page doesn't have any right click menus
				&& !store.get.isTemplatePage(this.currentPageId)
			) {
				Vue.nextTick(() => {
					// Delay menu creation so that earlier menu clear has time to take effect
					// This is necessary as menu content may change without selected item changing
					const menu = ContextMenu(this.selectedItemLookup, this);
					if (menu && menu.length) {
						this.contextMenu = menu;
						this.$refs.contextMenuComponent.show(e);
					}
				});
			}
		},
		pageCoordsToCanvasCoords(point) {
			return this.$refs.pageView.pageCoordsToCanvasCoords(point);
		},
		closeMenus() {
			this.$refs.contextMenuComponent.hide();
			this.$refs.navMenuComponent.hide();
		},
		globalKeyPress(e, metaKeyDown) {
			// console.log(this.metaKeyDown, e.key);
			this.closeMenus();
			const selItem = this.selectedItemLookup;
			if (e.key === 'PageDown') {
				this.$refs.pageView.pageDown();
			} else if (e.key === 'PageUp') {
				this.$refs.pageView.pageUp();
			} else if (e.key === 'Enter') {
				DialogManager.ok();
			} else if (e.key === 'Escape') {
				DialogManager.cancel();
			} else if (e.key === 'Delete' || e.key === 'Backspace') {
				if (selItem
					&& !store.get.isTemplatePage(store.get.pageForItem(selItem))
					&& store.mutations[selItem.type]
					&& store.mutations[selItem.type].delete
				) {
					const opts = {doLayout: true};
					opts[selItem.type] = selItem;
					const undoText = this.tr('action.edit.item.delete.undo_@mf',
						{item: this.tr('glossary.' + selItem.type.toLowerCase())});
					try {
						this.clearSelected();
						undoStack.commit(`${selItem.type}.delete`, opts, undoText);
					} catch (error) {  // eslint-disable-line no-empty
						// TODO: Intentionally empty; need to change each store.mutation.foo.delete that
						// throws an error if delete can't happen to just returning instead.
					}
				}
			} else if (e.key.startsWith('Arrow')) {
				if (selItem && store.get.isMoveable(selItem)) {
					let dx = 0, dy = 0, dv = 1;
					dv *= e.shiftKey ? 5 : 1;
					dv *= e.ctrlKey ? 20 : 1;
					if (e.key === 'ArrowUp') {
						dy = -dv;
					} else if (e.key === 'ArrowDown') {
						dy = dv;
					} else if (e.key === 'ArrowLeft') {
						dx = -dv;
					} else if (e.key === 'ArrowRight') {
						dx = dv;
					}
					const item = store.get.lookupToItem(selItem);
					if (item.type === 'point') {
						const arrow = store.get.lookupToItem(item.parent);
						if (arrow.points.indexOf(item.id) === 0) {
							const newPos = {x: item.x + dx, y: item.y + dy};
							const dt = _.geom.distance;
							if (arrow.type === 'calloutArrow') {
								// Special case: first point in callout arrow can't move away from callout
								// TODO: doesn't prevent arrow base from coming off rounded callout corners
								const callout = store.get.callout(arrow.parent.id);
								if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
									if (dt(newPos.y, 0) < 2 || dt(newPos.y, callout.height) < 2) {
										dx = Math.min(callout.width - item.x, Math.max(dx, -item.x));
									} else {
										dx = 0;  // Prevent movement from pulling arrow base off callout
									}
								} else {
									if (dt(newPos.x, 0) < 2 || dt(newPos.x, callout.width) < 2) {
										dy = Math.min(callout.height - item.y, Math.max(dy, -item.y));
									} else {
										dx = 0;  // Prevent movement from pulling arrow base off callout
									}
								}
							}
						}
					}

					if (dx !== 0 || dy !== 0) {
						const undoText = this.tr('action.edit.item.move.undo_@mf',
							{item: this.tr('glossary.' + selItem.type.toLowerCase())},
						);
						undoStack.commit('item.reposition', {item, dx, dy}, undoText);
					}
				}
			} else {
				// Check if key is a menu shortcut
				const menu = this.navBarContent;
				const key = ((e.ctrlKey || metaKeyDown) ? 'ctrl+' : '') + e.key;
				for (let i = 0; i < menu.length; i++) {
					for (let j = 0; j < menu[i].children.length; j++) {
						const entry = menu[i].children[j];
						if (entry.shortcut === key) {
							entry.cb();
						}
					}
				}
			}
		},
		setPageView({facingPage = false, scroll = false}) {
			this.clearSelected();
			this.$refs.pageView.facingPage = facingPage;
			this.$refs.pageView.scroll = scroll;
			uiState.set('pageView', {facingPage, scroll});

			if (scroll) {
				this.$refs.pageView.scrollToPage(this.currentPageId);
			} else {
				Vue.nextTick(() => {
					this.$refs.pageView.drawVisiblePages();
				});
			}
		},
		drawCurrentPage() {
			if (this.currentPageId != null) {
				let page = store.get.lookupToItem(this.currentPageId, 'page');
				if (page == null) {
					// This happens if, say, the current page is deleted without
					// updating the current page first, like during undo / redo
					page = store.get.firstPage();
					this.currentPageId = page ? page.id : null;
				}
				Vue.nextTick(() => {
					this.$refs.pageView.drawVisiblePages();
				});
			}
		},
		haveModel() {
			return store && store.model != null;
		},
	},
	computed: {
		isDirty() {
			return this.dirtyState.undoIndex !== this.dirtyState.lastSaveIndex;
		},
		navBarContent() {
			return Menu(this);
		},
		isTemplatePageCurrent() {
			return (this.currentPageId == null)
				? false
				: store.get.isTemplatePage(this.currentPageId);
		},
	},
	async mounted() {

		// TODO: grey out progress bar when 'Model Import' dialog is visible; otherwise it's confusing
		//		 if progress bar isn't at 100 but its done loading and waiting for user to click
		// TODO: progress bar should never stop at less than 100; clear it when model is imported
		// TODO: show some kind of 'getting started' content when model not yet loaded.
		// TODO: show template page always, even when no model loaded.
		// 		This lets you import a model with the desired template already in place.
		document.body.addEventListener('keyup', e => {
			this.globalKeyPress(e, false);
		});
		document.body.addEventListener('keydown', e => {
			if (e.metaKey && e.key !== 'Meta') {
				this.globalKeyPress(e, true);
			}
		});
		document.body.addEventListener('keydown', e => {
			if ((e.key === 'PageDown' || e.key === 'PageUp'
				|| e.key.startsWith('Arrow') || (e.key === 's' && e.ctrlKey))
				&& e.target.nodeName !== 'INPUT'
			) {
				e.preventDefault();
			}
		});

		window.addEventListener('beforeunload', e => {

			if (!this.disableLocalStorage) {
				const splitStyle = document.getElementById('leftPane').style;
				uiState.set('splitter', parseFloat(splitStyle.width.match(/calc\(([0-9.]*)%/)[1]));

				uiState.set('lastUsedVersion', packageInfo.version);

				Storage.replace.ui(uiState.getCurrentState());

				if (0 && this && this.isDirty) {
					const msg = 'You have unsaved changes. Leave anyway?';
					e.returnValue = msg;
					return msg;
				}
			}

			return null;
		});

		EventBus.$on('set-selected', item => {
			this.setSelected(item);
		});

		EventBus.$on('redraw-ui', (props = {}) => {
			this.redrawUI(props.clearSelection);
		});

		// EventBus.$on('state-change', () => {
		// 	Vue.nextTick(NavTree.update);
		// });

		undoStack.onChange(() => {
			this.dirtyState.undoIndex = undoStack.getIndex();
			this.redrawUI();
		});

		// Enable splitter between tree and page view
		const split = Storage.get.ui().splitter;
		Split(['#leftPane', '#rightPane'], {
			sizes: [split, 100 - split],
			minSize: [100, store.state.template.page.width + 10],
			direction: 'horizontal',
			gutterSize: 5,
			snapOffset: 0,
		});

		if (_.version.isOldVersion(uiState.get('lastUsedVersion'), packageInfo.version)) {
			await DialogManager('whatsNewDialog');
		}

		await LocaleManager.pickLanguage();

		LDParse.setCustomColorTable(Storage.get.customBrickColors());

		const localModel = Storage.get.model();
		if (!_.isEmpty(localModel)) {
			this.openLicFileFromContent(localModel);
		}
	},
};

window.__lic = {  // store a global reference to these for easier testing
	// TODO: only generate this in the debug build and in Cypress
	_, store, undoStack, LDParse, Storage, uiState,
};

export default UI;

</script>

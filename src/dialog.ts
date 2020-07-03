/* Web Lic - Copyright (C) 2018 Remi Gagne */
import Vue, {VNode} from 'vue';

// TODO: set focus to correct UI widget when showing each dialog
// TODO: make dialogs draggable, so they can be moved out of the way & see stuff behind them
let component: any;

export interface DialogInterface {
	$on: (event: string, opts: any) => void;
	show: (app: any) => void;
}

interface DialogProps {
	visible: boolean;
	currentDialog: any;
	outstandingImport: any;
	resolve: any;
}

type DialogNames =
	'localeChooserDialog' | 'stringChooserDialog' | 'numberChooserDialog'
	| 'missingPartsDialog' | 'sceneRenderingDialog' | 'ldColorPickerDialog' | 'displacePartDialog'
	| 'rotatePartImageDialog' | 'transformPartDialog' | 'pageLayoutDialog' | 'brickColorDialog'
	| 'gridDialog' | 'pdfExportDialog' | 'pngExportDialog' | 'styleDialog' | 'importModelDialog'
	| 'whatsNewDialog' | 'aboutLicDialog' | 'resizeImageDialog' | 'multiBookDialog';

Vue.component('dialogManager', {
	components: {
		localeChooserDialog: () => import(
			/* webpackChunkName: "localeChooserDialog" */
			'./components/translate.vue'
		),
		stringChooserDialog: () => import(
			/* webpackChunkName: "stringChooserDialog" */
			'./dialogs/string_chooser.vue'
		),
		numberChooserDialog: () => import(
			/* webpackChunkName: "numberChooserDialog" */
			'./dialogs/number_chooser.vue'
		),
		missingPartsDialog: () => import(
			/* webpackChunkName: "missingPartsDialog" */
			'./dialogs/missing_parts.vue'
		),
		sceneRenderingDialog: () => import(
			/* webpackChunkName: "sceneRenderingDialog" */
			'./dialogs/scene_rendering.vue'
		),
		ldColorPickerDialog: () => import(
			/* webpackChunkName: "ldColorPickerDialog" */
			'./dialogs/ld_color_picker.vue'
		),
		displacePartDialog: () => import(
			/* webpackChunkName: "displacePartDialog" */
			'./dialogs/displace_part.vue'
		),
		rotatePartImageDialog: () => import(
			/* webpackChunkName: "rotatePartImageDialog" */
			'./dialogs/rotate_part_image.vue'
		),
		transformPartDialog: () => import(
			/* webpackChunkName: "transformPartDialog" */
			'./dialogs/transform_part.vue'
		),
		pageLayoutDialog: () => import(
			/* webpackChunkName: "pageLayoutDialog" */
			'./dialogs/page_layout.vue'
		),
		brickColorDialog: () => import(
			/* webpackChunkName: "brickColorDialog" */
			'./dialogs/brick_colors.vue'
		),
		gridDialog: () => import(
			/* webpackChunkName: "gridDialog" */
			'./dialogs/grid_dialog.vue'
		),
		pdfExportDialog: () => import(
			/* webpackChunkName: "pdfExportDialog" */
			'./dialogs/export_pdf.vue'
		),
		pngExportDialog: () => import(
			/* webpackChunkName: "pngExportDialog" */
			'./dialogs/export_png.vue'
		),
		styleDialog: () => import(
			/* webpackChunkName: "styleDialog" */
			'./dialogs/style.vue'
		),
		importModelDialog: () => import(
			/* webpackChunkName: "importModelDialog" */
			'./dialogs/import_model.vue'
		),
		whatsNewDialog: () => import(
			/* webpackChunkName: "whatsNewDialog" */
			'./dialogs/whats_new.vue'
		),
		aboutLicDialog: () => import(
			/* webpackChunkName: "aboutLicDialog" */
			'./dialogs/about_lic.vue'
		),
		resizeImageDialog: () => import(
			/* webpackChunkName: "resizeImageDialog" */
			'./dialogs/resize_image.vue'
		),
		multiBookDialog: () => import(
			/* webpackChunkName: "multiBookDialog" */
			'./dialogs/multi_book.vue'
		),
	},
	data(): DialogProps {
		return {
			visible: false,
			currentDialog: null,
			outstandingImport: null,
			resolve: null,
		};
	},
	render(createElement): VNode {
		return this.visible
			? createElement(this.currentDialog, {ref: 'currentDialog', tag: 'component'})
			: createElement();
	},
	updated() {
		Vue.nextTick(() => {
			if (this.$refs && this.$refs.currentDialog) {
				const dlg: any = this.$refs.currentDialog;
				if (typeof this.outstandingImport === 'function') {
					this.outstandingImport(dlg);
					this.outstandingImport = null;
				}
				if (dlg.$refs && dlg.$refs.set_focus) {
					dlg.$refs.set_focus.focus();
				}
				dlg.$on('close', () => {
					this.visible = false;
					this.resolve();
				});
			}
		});
	},
	mounted() {
		component = this;
	},
});

function setDialog(
	dialogName: DialogNames,
	cb?: (dialog: DialogInterface) => any
) {
	component.currentDialog = null;  // This forces Vue to re-render a dialog if it was just opened
	component.outstandingImport = cb;
	return new Promise(resolve => {
		Vue.nextTick(() => {
			component.currentDialog = dialogName;
			component.resolve = resolve;
			component.visible = true;
		});
	});
}

setDialog.ok = function() {
	if (component.visible && component.$refs.currentDialog) {
		if (typeof component.$refs.currentDialog.ok === 'function') {
			component.$refs.currentDialog.ok();
		} else if (typeof component.$refs.currentDialog.cancel === 'function') {
			component.$refs.currentDialog.cancel();
		}
	}
};

setDialog.cancel = function() {
	if (component.visible
		&& component.$refs.currentDialog
		&& typeof component.$refs.currentDialog.cancel === 'function'
	) {
		component.$refs.currentDialog.cancel();
	}
};

export default setDialog;

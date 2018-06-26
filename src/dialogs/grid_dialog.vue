<template>
	<el-dialog
		class="gridDialog"
		:title="tr('dialog.grid.title')"
		width="500px"
		:modal="false"
		:show-close="false"
		:visible="visible"
	>
		<el-form label-width="140px">
			<el-form-item :label="tr('dialog.grid.enabled')">
				<el-checkbox
					v-model="newState.enabled"
					@change="update"
				/>
			</el-form-item>
			<el-form-item :label="tr('dialog.grid.spacing')" :disabled="newState.enabled">
				<input
					v-model.number="newState.spacing"
					@input="update"
					:disabled="!newState.enabled"
					min="1" max="10000"
					type="number"
					class="form-control"
				/>
			</el-form-item>
			<el-form-item :label="tr('dialog.grid.offset')" :disabled="newState.enabled">
				<span class="gridInlineLabel">{{tr("dialog.grid.offset_top")}}</span>
				<input
					v-model.number="newState.offset.top"
					@input="update"
					:disabled="!newState.enabled"
					min="-1000" max="10000"
					type="number"
					class="form-control"
				/>
				<span class="gridInlineLabel2">{{tr("dialog.grid.offset_left")}}</span>
				<input
					v-model.number="newState.offset.left"
					@input="update"
					:disabled="!newState.enabled"
					min="-1000" max="10000"
					type="number"
					class="form-control"
				/>
			</el-form-item>
			<el-form-item :label="tr('dialog.grid.line_style')">
				<el-form-item :label="tr('dialog.grid.color')" label-width="70px">
					<el-checkbox
						v-model="useAutoColor"
						@change="update"
						:disabled="!newState.enabled"
						:label="tr('dialog.grid.auto_color')"
						class="gridAutoChecbox"
					/>
					<el-color-picker
						v-model="lineColor"
						v-on:active-change="updateColor"
						:disabled="useAutoColor || !newState.enabled"
					/>
				</el-form-item>
				<el-form-item :label="tr('dialog.grid.width')" label-width="70px">
					<input
						v-model.number="newState.line.width"
						@input="update"
						:disabled="!newState.enabled"
						min="1" max="100"
						type="number"
						class="form-control"
					/>
				</el-form-item>
				<el-form-item :label="tr('dialog.grid.dash')" label-width="70px">
					<span class="gridInlineLabel">(NYI)</span>
				</el-form-item>
			</el-form-item>
		</el-form>
		<span slot="footer" class="dialog-footer">
			<el-button @click="cancel">{{tr("cancel")}}</el-button>
			<el-button type="primary" @click="ok()">{{tr("ok")}}</el-button>
		</span>
	</el-dialog>
</template>

<script>

import _ from '../util';
import store from '../store';
import undoStack from '../undoStack';
import uiState from '../uiState';

export default {
	data: function() {
		return {
			visible: false,
			useAutoColor: true,
			lineColor: '',
			newState: uiState.get('grid')
		};
	},
	methods: {
		show(app) {
			const grid = uiState.get('grid');
			const color = grid.line.color;
			this.visible = true;
			this.useAutoColor = (color === 'auto');
			this.lineColor = (color === 'auto') ? 'rgb(0, 0, 0)' : _.color.toRGB(color).toString();
			this.newState = _.clone(grid);
			this.originalState = grid;
			this.app = app;  // TODO: need easy, global way to signal to the app stuff like 'redraw page' and 'redraw UI'
		},
		update() {
			if (this.useAutoColor) {
				this.newState.line.color = 'auto';
			} else {
				this.newState.line.color = this.lineColor;
			}
			uiState.set('grid', _.clone(this.newState));
			store.cache.set('uiState', 'gridPath', null);
			this.app.drawCurrentPage();
		},
		updateColor(newColor) {
			this.newState.line.color = this.lineColor = newColor;
			this.update();
		},
		ok() {
			this.visible = false;
			const storeOp = {root: store.cache.stateCache, op: 'replace', path: '/uiState/gridPath', value: null};
			const root = uiState.getCurrentState(), op = 'replace', path = '/grid';
			const change = {
				redo: [
					{root, op, path, value: _.clone(this.newState)},
					storeOp
				],
				undo: [
					{root, op, path, value: this.originalState},
					storeOp
				]
			};
			undoStack.commit(change, null, 'Style Grid');
		},
		cancel() {
			this.visible = false;
			uiState.set('grid', this.originalState);
			store.cache.set('uiState', 'gridPath', null);
			this.app.drawCurrentPage();
		}
	}
};
</script>

<style>

.gridDialog input {
	display: inline;
	width: 80px;
}

.gridInlineLabel {
	margin-right: 10px;
}

.gridInlineLabel2 {
	margin: 0 10px;
}

.gridAutoChecbox {
	margin-right: 15px;
}

</style>
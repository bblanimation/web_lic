/* Web Lic - Copyright (C) 2018 Remi Gagne */

<template>
	<div>
		<transform-panel
			:template-entry="templateEntry"
			@new-values="newValues"
		/>
		<fill-panel
			title="template.csi.displacement_arrow_color"
			template-entry="step.csi.displacementArrow"
			@new-values="newArrowStyle"
		/>
		<!--<border-panel title="Displacement Arrow Border" v-on:new-values="newArrowStyle"></border-panel>-->
	</div>
</template>

<script>

import store from '../../store';
import TransformPanel from './transform.vue';
import FillPanel from './fill.vue';

export default {
	components: {TransformPanel, FillPanel},
	props: ['selectedItem', 'templateEntry'],
	methods: {
		apply() {
			this.$parent.applyDirtyAction('csi');
		},
		newArrowStyle() {
			store.get.csi(this.selectedItem).isDirty = true;
			this.$emit('new-values', 'csi');
		},
		newValues() {
			store.get.csi(this.selectedItem).isDirty = true;
			this.$emit('new-values', {type: 'csi', noLayout: true});
		},
	},
};

</script>

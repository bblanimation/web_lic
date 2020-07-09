/* eslint-disable max-len, no-unreachable */

describe('Test Deleting Parts ', () => {

	beforeEach(cy.reloadLicPage);

	it('Delete the last part in a step', () => {
		cy.importTrivial({excludeTitlePage: true, excludePartListPage: true});
		cy.get('#pageCanvas_1').click(220, 250).rightclick();
		cy.get('#csi_select_part_cmenu').click();
		cy.get('#select_part_0_cmenu').click();
		cy.get('#pageCanvas_1').rightclick();
		cy.get('#part_change_name_cmenu').click();
		cy.get('#part_delete_cmenu').click();
		cy.queryLic(lic => {
			assert.equal(lic.store.state.pages.length, 2);
			assert.equal(lic.store.get.inventoryPages().length, 0);
			assert.equal(lic.store.model.parts.length, 2);
			assert.equal(lic.store.state.pliItems.length, 4);
			assert.equal(lic.store.state.steps[3].parts.length, 0);
			assert.equal(lic.store.state.plis[1].pliItems.length, 0);
		});
	});

	it('Delete the last part in a step with instructions', () => {
		cy.importTrivial({excludeTitlePage: true});

		cy.get('#pageCanvas_1').click(220, 250).rightclick();
		cy.get('#csi_select_part_cmenu').click();
		cy.get('#select_part_0_cmenu').click();
		cy.get('#pageCanvas_1').rightclick();
		cy.get('#part_change_name_cmenu').click();
		cy.get('#part_delete_cmenu').click();
		cy.queryLic(lic => {
			assert.equal(lic.store.state.pages.length, 3);
			assert.equal(lic.store.model.parts.length, 2);
			assert.equal(lic.store.state.pliItems.length, 6);
			assert.equal(lic.store.state.pages[2].pliItems.length, 2);  // inventory page
			assert.equal(lic.store.state.steps[3].parts.length, 0);
			assert.equal(lic.store.state.plis[1].pliItems.length, 0);
		});
	});
});

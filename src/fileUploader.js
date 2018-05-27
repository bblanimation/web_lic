'use strict';

// fileType: 'text' or 'dataURL'
module.exports = function openChooser(acceptFileTypes, fileType, callback) {
	var input = document.getElementById('openFileChooser');
	input.onchange = function(e) {
		const reader = new FileReader();
		reader.onload = (filename => {
			return e => {
				callback(e.target.result, filename);
			};
		})(e.target.files[0].name);
		if (fileType === 'text') {
			reader.readAsText(e.target.files[0]);
		} else {
			reader.readAsDataURL(e.target.files[0]);
		}
		e.target.value = '';
	};
	input.setAttribute('accept', acceptFileTypes);
	input.click();
};

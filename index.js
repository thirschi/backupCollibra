var https = require('https');
var AWS = require('aws-sdk');
var path = require('path');
var request = require('request');
exports.handler = function () {
	var s3 = new AWS.S3({
		region: 'us-west-2'
	});
	var params = {
		Bucket: 'backupcollibra'
		, Key: 'BackupCollibra.json'
	}
	s3.getObject(params, function (err, data) {
		if (err) console.log(err, err.stack); // an error occurred
		else {
			console.log(data.Body.toString());
			var config = JSON.parse(data.Body.toString());
		} // successful response
	});
}
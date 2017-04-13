var AWS = require('aws-sdk');
var request = require('request');
var fs = require('fs');

exports.handler = function () {
    var s3 = new AWS.S3({
        region: 'us-west-2'
    });

    var params = {
        Bucket: 'backupcollibra',
        Key: 'BackupCollibra.json'
    }
    
    s3.getObject(params, function (err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
			console.log("Hello");
            var config = JSON.parse(data.Body.toString());
            console.log("This is the event=" + config);
			backupData(config);
        } // successful response
    });
}

var backupData = function (config) {
	var date = new Date();
	var day = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
	var authentication = new Buffer(config.un + ':' + config.).toString('base64');
	var fileName = 'Auto Backup-' + day;
	console.log("backing up data");
	var options = {
		method: 'POST'
		, url: 'https://console-byu-5.collibra.com/rest/backup/3Ad925b462-9ece-4dfa-932a-5d9f09989209'
		, headers: {
			'cache-control': 'no-cache'
			, 'content-type': 'application/json'
			, accept: 'application/json'
			, authorization: 'Basic ' + authentication
		}
		, body: {
			name: fileName
			, description: 'Automatic Backup-' + day
			, database: 'dgc'
			, dgcBackupOptionSet: ['CUSTOMIZATIONS']
			, repoBackupOptionSet: ['DATA', 'HISTORY', 'CONFIGURATION']
		}
		, json: true
	};
	/*
	request(options, function (error, response, body) {
		if (error) throw new Error(error);
		var s3put = new AWS.S3({
			region: 'us-west-2'
		});
		var zip;
		console.log("Made backup of file");
		setTimeout(function () {
			request({
				method: 'GET'
				, uri: 'https://console-byu-5.collibra.com/rest/backup/' + body.id
				, gzip: true
				, 'headers': {
					'content-type': 'application/zip'
					, authorization: 'Basic ' + authentication
					, 'Content-disposition': 'attachment; filename=backup' + day + ".zip"
				}
			}).pipe(fs.createWriteStream(zip));
			var bucket = {
				Bucket: 'backupcollibra.Backups'
				, Key: fileName + ".zip"
				, Body: zip
			};
			s3put.putObject(bucket, function(err, data) {
				if(err) {
					console.log("Error:" + err);
				} else {
					console.log("Successfully uploaded:" + data);
				}
			});
		}, 10000);
	});
	*/
	console.log("working here");
}
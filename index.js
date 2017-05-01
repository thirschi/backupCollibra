var AWS = require('aws-sdk');
var request = require('request');
var https = require('https');
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
			var config = JSON.parse(data.Body.toString());
			backupData(config);
		}
	});
}
var backupData = function (config) {
	console.log("Starting Backup");
	var date = new Date();
	var day = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
	var authentication = new Buffer(config.un + ':' + config.pw).toString('base64');
	var fileName = 'Auto Backup-' + day;
	var passObj = {
		day: day
		, authentication: authentication
		, fileName: fileName
		, config: config
		, user: config.un
		, pass: config.pw
	}
	var options = {
		method: 'POST'
		, url: 'https://console-byu.collibra.com/rest/backup/3Ad925b462-9ece-4dfa-932a-5d9f09989209'
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
	request(options, function (error, response, body) {
		if (error) throw new Error(error);
		getFile(body, passObj)
	});
}

function getFile(body, passObj) {
	setTimeout(function () {
		putFileInS3(body, passObj);
	}, 10000);
}

function putFileInS3(body, passObj) {
	console.log('https://console-byu.collibra.com/rest/backup/' + body.id);
	const options = {
		hostname: 'console-byu.collibra.com'
		, port: 443
		, path: '/rest/backup/' + body.id
		, method: 'GET'
		, headers: {
			'Authorization': 'Basic ' + passObj.authentication
		}
	};
	const req = https.request(options, (res) => {
		console.log('statusCode:', res.statusCode);
		console.log('headers:', res.headers);
		var bufs = [];
		res.on('data', function (d) {
			bufs.push(d);
		});
		res.on('end', function () {
			var buf = Buffer.concat(bufs);
			s3Put(buf, passObj);
		});
	});
	req.on('error', (e) => {
		console.error(e);
	});
	req.end();
}

function s3Put(buffer, passObj) {
	var s3put = new AWS.S3({
		region: 'us-west-2'
	});
	s3put.putObject({
		Body: buffer
		, Key: passObj.fileName + ".zip"
		, Bucket: 'backupcollibra/Backups'
	}, function (error, data) {
		if (error) {
			console.log("error pushing to s3");
		}
		else {
			console.log("success uploading to s3");
		}
	});
}

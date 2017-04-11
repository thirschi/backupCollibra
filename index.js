var https = require('https');
var AWS = require('aws-sdk');
var path = require('path');
var ClientOAuth2 = require('client-oauth2');
var request = require('request');
const uuid = require('node-uuid');
var request = require('request');
exports.handler = function () {
	var s3 = new AWS.S3({
		region: 'us-west-2'
	});
	var params = {
		Bucket: 'personupdatesforcollibra'
		, Key: 'PersonUpdatesForCollibra.json'
	}
	s3.getObject(params, function (err, data) {
		if (err) console.log(err, err.stack); // an error occurred
		else {
			var config = JSON.parse(data.Body.toString());
			getAllUsers(config);
		} // successful response
	});
}
var getAllUsers = function (config) {
	console.log("Client ID=" + config.clientId + " Client Secret=" + config.clientSecret);
	var wso2Auth = new ClientOAuth2({
		accessTokenUri: 'https://api.byu.edu:443/token'
		, authorizationGrants: ['credentials']
		, scopes: ['openid']
		, clientId: config.clientId
		, clientSecret: config.clientSecret
	});
	// set up options for the POST
	var collibraCall = {
		host: 'byu-5.collibra.com'
		, path: '/rest/1.0/user/all'
		, method: 'GET'
		, headers: {
			'Accept': 'application/json'
			, 'Content-Type': 'application/json'
			, 'Authorization': 'Basic ' + new Buffer(config.un + ':' + config.pw).toString('base64')
		}
	};
	// Callback for the https.request(options, callback)
	var collibraCallBack = function (response) {
		var result = '';
		//another chunk of data has been recieved, so append it to `result`
		response.on('data', function (chunk) {
			result += chunk;
		});
		//the whole response has been recieved, so we just print it out here
		response.on('end', function () {
			wso2Auth.credentials.getToken().then(function (user) {
				var accessToken = user.accessToken.toString();
				var users = JSON.parse(result);
				for (var i = 0; i < users.user.length; i++) {
					var u = users.user[i];
					if (u.activated == true) {
						updateUser(u.userName, accessToken, u.resourceId, config.un, config.pw);
					}
				}
			});
		});
	};
	var post_req = https.request(collibraCall, collibraCallBack).end();
}

function updateUser(netId, accessToken, userId, username, password) {
	if (netId.length >= 10) {
		return;
	}
	request({
		url: 'https://api.byu.edu:443/domains/legacy/identity/person/personsummary/v1/' + netId
		, auth: {
			'bearer': accessToken
		}
		, headers: {
					'Acting-for': netId
				}
	}, function (err, response) {
		var body = JSON.parse(response.body);
		var responseSummary = body['Person Summary Service'].response;
		if (responseSummary.identifier_error == "Invalid Net ID resource identifier") {
			return;
		}
		//Using work email unless empty use the regular email
		var emailAddress = responseSummary.contact_information.work_email;
		if (emailAddress == "") {
			emailAddress = responseSummary.contact_information.email;
		}
		if (emailAddress == "") {
			return;
		}
		request({
			url: 'https://api.byu.edu:443/domains/legacy/identity/person/PRO/personnames/v1/' + netId
			, auth: {
				'bearer': accessToken
			}
			, headers: {
					'Acting-for': netId
				}
		}, function (err, response) {
			var names = JSON.parse(response.body);
			var namesResponse = names.PersonNamesService.response;
			//Updating person information in Collibra
			request.post({
				url: 'https://byu-5.collibra.com/rest/1.0/user/' + userId
				, auth: {
					'user': username
					, 'pass': password
				}
				, form: {
					'userName': netId
					, 'email': emailAddress
					, 'gender': responseSummary.personal_information.gender.toUpperCase()
					, 'firstName': namesResponse.preferred_name.preferred_first_name
					, 'lastName': namesResponse.official_name.surname
				}
			}, function (err, response, body) {
				console.log("Staus Code=" + response.statusCode + " - For NetId=" + netId);
				if (err) {
					console.log("Error" + err);
				}
			});
			request({
				url: 'https://api.byu.edu:443/domains/legacy/identity/person/idphoto/v1/?N=' + netId
				, encoding: null
				, auth: {
					'bearer': accessToken
				}
				, headers: {
					'Acting-for': netId
				}
			}, function (err, responsePhoto, photoBody) {
				var extenstion = responsePhoto.headers["content-type"];
				var type = extenstion.split(";");
				var typeSplit = type[0].split('/');
				var ext = typeSplit[1];
				var workPhone = responseSummary.contact_information.work_phone;
				//Update phone only if we have one
				if (workPhone != "") {
					//Get current WORK phone
					request.get({
						url: 'https://byu-5.collibra.com/rest/1.0/user/' + userId
						, auth: {
							'user': username
							, 'pass': password
						}
					}, function (userErr, userResponse, userBody) {
						if (userResponse.statusCode == 200) {
							var bodyRes = JSON.parse(userBody);
							if (bodyRes.phoneNumbers.phone == undefined) {
								//If we don't have a current phone number
								request.post({
									url: 'https://byu-5.collibra.com/rest/latest/user/' + userId + '/phone'
									, auth: {
										'user': username
										, 'pass': password
									}
									, form: {
										'phoneNumber': workPhone
										, 'user': userId
										, 'phoneType': 'WORK'
									}
								}, function (phoneErr, phoneResponse, phoneBody) {
									console.log("Phone Success=" + phoneResponse.statusCode);
									if (phoneErr) {
										console.log("Phone Error=" + phoneErr);
									}
								});
							}
							else {
								var phones = bodyRes.phoneNumbers.phone;
								for (var i = 0; i < bodyRes.phoneNumbers.phone.length; i++) {
									//Looking for Phone Number from the Person System
									var phone = bodyRes.phoneNumbers.phone[i];
									var phoneType = phone.phoneType;
									var phoneNumber = phone.number;
									var resourceId = phone.resourceId;
									if (phoneNumber != workPhone && phoneType == "WORK") {
										//Only update the phone if it is different and its a work phone number
										request.post({
											url: 'https://byu-5.collibra.com/rest/latest/user/' + userId + '/phone/' + resourceId
											, auth: {
												'user': username
												, 'pass': password
											}
											, form: {
												'phoneNumber': workPhone
												, 'phoneType': 'WORK'
											}
										}, function (phoneErr, phoneResponse, phoneBody) {
											console.log("Phone Change Success=" + phoneResponse.statusCode);
											if (phoneErr) {
												console.log("Phone Change Error=" + phoneErr);
											}
										});
									}
								}
							}
						}
					});
				}
				//if (netId == "stone") {
				var id = uuid.v1();
				var bound = 'NodeBoundary' + id.replace(/-/g, '');
				var fileName = netId + id.replace(/-/g, '') + "." + ext;
				var bodyForm = '--' + bound + "\r\nContent-Disposition: form-data; name=\"" + fileName + "\"; filename=\"" + fileName + "\"\r\n\r\n" + photoBody.toString('binary') + "\r\n--" + bound + "--";
				var rawRequest = https.request({
					host: 'byu-5.collibra.com'
					, path: '/rest/latest/file'
					, port: 443
					, method: 'POST'
					, headers: {
						'User-Agent': 'NodeJS'
						, 'Content-Type': 'multipart/form-data; boundary=' + bound
						, 'Content-Length': bodyForm.length
						, 'Authorization': 'Basic ' + new Buffer(username + ':' + password).toString('base64')
					}
				}, function (response) {
					var reply = '';
					response.on('data', function (chunk) {
						reply += chunk;
					});
					response.on('end', function () {
						var fileReply = JSON.parse(reply);
						var fileId = fileReply.file[0];
						request.post({
							url: 'https://byu-5.collibra.com/rest/1.0/user/' + userId + '/avatar'
							, auth: {
								'user': username
								, 'pass': password
							}
							, form: {
								'file': fileId
							}
						}, function (err, response, body) {
							console.log("Avatar response=" + response.statusCode + " for netId=" + netId);
						});
					});
				});
				rawRequest.write(bodyForm, 'binary');
				rawRequest.end();
				//}
			});
		});
	});
}
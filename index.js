var https = require('https');
var AWS = require('aws-sdk');

exports.handler = function (request) {
    var s3 = new AWS.S3({
        region: 'us-west-2'
    });

    var params = {
        Bucket: 'eventhub-to-sn',
        Key: 'eventhub-config.json'
    }
    
    s3.getObject(params, function (err, data, reqeust) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
            console.log("This is the request=" + request);
            var config = JSON.parse(data.Body.toString());
             console.log("This is the event=" + request.event);
        } // successful response
    });
}
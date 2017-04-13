var AWS = require('aws-sdk');

exports.handler = function () {
    var s3 = new AWS.S3({
        region: 'us-west-2'
    });

    var params = {
        Bucket: 'ericn0temp',
        Key: 'del2.txt'
    }
    
    s3.getObject(params, function (err, data, reqeust) {
        if (err) console.log(err, err.stack); // an error occurred
        else {
			console.log("Hello");
            var config = JSON.parse(data.Body.toString());
            // console.log("This is the event=" + request.event);
        } // successful response
    });
}
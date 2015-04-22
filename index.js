'use strict';

var express = require('express');
var app = express();

var referralLinks = {};
referralLinks.data = [];
referralLinks.counter = [];
referralLinks.add = function(obj) {
	for (var type in obj) {
		if (typeof referralLinks.data[type] === "undefined") {
			referralLinks.data[type] = [];
		}
		referralLinks.data[type].push({
			'link': obj[type],
			'used': 0 // @TODO make it the smallest used count of all links in this particular type
		});
	}
};
referralLinks.get = function(type) {
	if (typeof referralLinks.data[type] === 'undefined') {
		return false;
	} else {
		var lowestUsed = 999999;
		var selectedLinkIndex;
		for (var i = 0; i < referralLinks.data[type].length; i++) {
			console.log(referralLinks.data[type][i]);
			if (referralLinks.data[type][i]['used'] < lowestUsed) {
				lowestUsed = referralLinks.data[type][i]['used'];
				selectedLinkIndex = i;
			}
		}
		++referralLinks.data[type][selectedLinkIndex]['used'];
		return referralLinks.data[type][selectedLinkIndex]['link'];
	}
};

// member - ashfame
referralLinks.add({
	'github': 'http://github.com/?ashfame',
	'linode': 'http://linode.com/?ashfame',
	'digitalocean': 'http://digitalocean.com/?ashfame'
});

// member - enigma
referralLinks.add({
	'github': 'http://github.com/?enigma',
	'linode': 'http://linode.com/?enigma',
	'digitalocean': 'http://digitalocean.com/?enigma'
});

console.log('Data for referral links are as follows:');
console.log(referralLinks.data);

app.get('/', function(req, res) {
	res.send(
		'Howdy! Here, I need to show all the available types with links ready to be used. #WorkInProgress'
	);
});

app.get('/to/:which', function(req, res) {
	var url = referralLinks.get(req.params.which);
	if (url) {
		//redirect now
		res.send('Redirection will take place - ' + url);
	} else {
		res.send('err..');
	}
});

var server = app.listen(3000, function() {
	var host = server.address().address;
	var port = server.address().port;
	console.log('Example app listening at http://%s:%s', host, port);
});

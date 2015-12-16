'use strict';

var Express = require( 'express' );
var Mustache = require( 'mustache' );
var fs = require( 'fs' );
var Datastore = require( 'nedb' );
var dummyData = require( './dummy-data.js' );

var db = new Datastore( {
	filename: 'database/data.db',
	autoload: true
} );

var app = Express();

var referralLinks = {};
referralLinks.debug = true;
referralLinks.data = [];
referralLinks.counter = [];

referralLinks.init = function () {
	// start server
	var server = app.listen( 3000, function () {
		var host = server.address().address;
		var port = server.address().port;
		console.log( 'Example app listening at http://%s:%s', host, port );
	} );

	// load data from database
	referralLinks.loadData();

	if ( referralLinks.debug ) {
		setTimeout( function () {
			referralLinks.showData()
		}, 1000 );
	}
};

referralLinks.add = function ( obj ) {
	if ( referralLinks.debug ) {
		console.log( JSON.stringify( obj.data.links, null, 4 ) );
	}

	for ( var type in obj.data.links ) {
		if ( typeof referralLinks.data[ type ] === "undefined" ) {
			referralLinks.data[ type ] = [];
		}
		referralLinks.data[ type ].push( {
			'id': obj._id,
			'link': obj.data.links[ type ],
			'used': 0 // @TODO this gets reset to 0 for "type" for each new addition of a link in that "type"
		} );
	}
};

referralLinks.get = function ( type ) {
	if ( typeof referralLinks.data[ type ] === 'undefined' ) {
		return false;
	}

	// ALGORITHM explained:
	// find all the links for this type, which has the lowest used value, and then randomly pick one of them for usage
	// this way the least used (since the last reset), would get picked up, and the randomization removes any possible bias

	var lowestUsed = 999999; // start with a very big number
	var candidates = [];

	// find lowest value of 'used'
	for ( var i = 0; i < referralLinks.data[ type ].length; i++ ) {
		if ( referralLinks.data[ type ][ i ][ 'used' ] < lowestUsed ) {
			lowestUsed = referralLinks.data[ type ][ i ][ 'used' ];
		}
	}

	// collect all candidates, for this lowest value of 'used'
	for ( var i = 0; i < referralLinks.data[ type ].length; i++ ) {
		if ( referralLinks.data[ type ][ i ][ 'used' ] == lowestUsed ) {
			candidates.push( i );
		}
	}

	// pick a random candidate
	var candidate = candidates[ Math.floor( Math.random() * candidates.length ) ];

	// get candidate's link and increase its 'used' count
	var chosenLink = referralLinks.data[ type ][ candidate ][ 'link' ];
	++referralLinks.data[ type ][ candidate ][ 'used' ];

	// record hit in database
	var id = referralLinks.data[ type ][ candidate ][ 'id' ];
	referralLinks.recordHit( id, type );

	if ( referralLinks.debug ) {
		console.log( referralLinks.data );
	}

	return chosenLink;
};

referralLinks.recordHit = function ( id, type ) {
	if ( referralLinks.debug ) {
		console.log( 'recording hit for ' + id + ' [' + type + ']' );
	}

	// get this user record (doc) from database
	db.findOne( {
			_id: id
		},
		function ( err, doc ) {
			if ( err ) throw err;

			doc.data.hits[ type ]++;

			// update the user's record (doc) inside database
			db.update( {
					_id: id
				}, {
					'data': doc.data
				},
				function ( err, rowsAffected ) {
					if ( err ) throw err;

					if ( referralLinks.debug ) {
						console.log( rowsAffected + ' entry updated' );
					}
				}
			);
		}
	);
};

referralLinks.importDummyData = function () {
	for ( var username in dummyData ) {
		db.insert( {
				'username': username,
				'data': dummyData[ username ]
			},
			function ( err, newDoc ) {
				if ( err ) throw err;

				console.log( 'adding data for ' + username );
				console.log( newDoc );
			}
		);
	}
};

referralLinks.flushDB = function () {
	// delete all records (docs)
	db.remove( {}, {
		'multi': true
	}, function ( err, response ) {
		if ( err ) throw err;
		console.log( response );
	} );
};

referralLinks.loadData = function () {
	// pick all records (docs) from database & load into variable for use in algorithm
	db.find( {}, function ( err, docs ) {
		var length = docs.length;
		for ( var i = 0; i < length; i++ ) {
			referralLinks.add( docs[ i ] );
		}

		if ( referralLinks.debug ) {
			referralLinks.showData();
		}
	} );
};

referralLinks.showData = function () {
	console.log( '##' );
	console.log( referralLinks.data );
	console.log( '##' );
	var length = referralLinks.data.length;
	for ( var i = 0; i < length; i++ ) {
		console.log( JSON.stringify( referralLinks.data[ i ], null, 4 ) );
	}
	console.log( '##' );
};

app.get( '/', function ( req, res ) {
	var services = Object.keys( referralLinks.data );
	console.log( "Rendering '/'" );

	// read home template
	fs.readFile( 'views/home.mst', 'utf8', function ( err, template ) {
		if ( err ) throw err;

		res.send( Mustache.render( template, {
			services: services
		} ) );
	} );
} );

app.get( '/to/:which', function ( req, res ) {
	var url = referralLinks.get( req.params.which );
	if ( url ) {
		// @TODO actually redirect here
		console.log( 'Redirection will take place - ' + url );
	} else {
		console.log( 'err..' );
	}
	res.end();
} );

app.get( '/import', function ( req, res ) {
	referralLinks.importDummyData();
	res.send( 'Dummy data imported!' );
} );

app.get( '/report', function ( req, res ) {
	console.log( "Rendering '/report'" );

	var services = Object.keys( referralLinks.data );

	// collect all records and change format so that can be used in rendering Mustache template
	var report = [];
	db.find( {}, function ( err, docs ) {
		console.log( 'db read: ', docs );
		var length = docs.length;
		for ( var i = 0; i < length; i++ ) {
			var doc = docs[ i ];
			console.log( doc );

			// add empty strings for services as hits, for which user is not an affiliate
			var hits = [];
			var services_count = services.length;
			for ( var j = 0; j < services.length; j++ ) {
				var service = services[ j ];
				if ( doc.data.hits[ service ] ) {
					hits.push( doc.data.hits[ service ] );
				} else {
					hits.push( 0 );
				}
			}

			report.push( {
				username: doc.username,
				hits: hits
			} );
		}

		console.log( 'collected data: ', report );

		// read home template
		fs.readFile( 'views/report.mst', 'utf8', function ( err, template ) {
			if ( err ) throw err;

			res.send( Mustache.render( template, {
				services: services,
				report: report
			} ) );
		} );
	} );
} );

referralLinks.init();

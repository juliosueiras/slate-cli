var async = require('asyncawait/async')
var await = require('asyncawait/await')
var Horseman = require('node-horseman');
var horseman = new Horseman();
var unirest = require('unirest');
var envs = require('envs');

async (function() {
	const cookies = await(horseman
		.userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
			.open('https://slate.sheridancollege.ca')
				.type('input[name="j_username"]', process.env.SLATE_USERNAME)
				.type('input[name="j_password"]', process.env.SLATE_PASSWORD)
				.click('[name="_eventId_proceed"]')
				.waitForNextPage()
				.waitForSelector('.d2l-minibar-home-text')
				.cookies()
				.close());


	await(unirest.get('https://slate.sheridancollege.ca/d2l/api/lp/1.10/logging/')
				.header('Cookie', cookies[0].name+'='+cookies[0].value+';'+cookies[1].name+'='+cookies[1].value)
				.end(function (response) {
					console.log(response.body);
				}));
})()


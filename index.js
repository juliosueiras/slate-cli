var async = require('asyncawait/async')
var await = require('asyncawait/await')
var Horseman = require('node-horseman');
var horseman = new Horseman();
var axios = require('axios');
var envs = require('envs');
var chalk = require('chalk');

const repl = require('vorpal-repl');
var Table = require('cli-table');

var globalCookie = null;
var globalCourseListing = null;

var getClassList = async(function(courseId) {
    var res = await(axios.get('https://slate.sheridancollege.ca/d2l/api/le/1.10/' + courseId + '/classlist/'))
    return res.data;
})

var courseListing = async (function () {
    if(globalCourseListing == null) {
        var res = await(axios.get('https://slate.sheridancollege.ca/d2l/api/lp/1.10/enrollments/myenrollments/'))

        globalCourseListing = res.data.Items.filter(function(i) { return i.OrgUnit.Type.Code == 'Course Offering' })
        return globalCourseListing;
    } else {
        return globalCourseListing;
    }
});

var findCourse = async(function(course) {
    courses = await(courseListing());
    return courses.find(function(i) { return i.OrgUnit.Name.split(' ')[0] == course })
})

var courseCompletion = async(function() {
    courses = await(courseListing());
    return courses.map(function(i) { return i.OrgUnit.Name.split(' ')[0] })
})

var grabCookie = function () {
		return horseman
			.userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:27.0) Gecko/20100101 Firefox/27.0')
			.open("https://slate.sheridancollege.ca")
			.type('input[name="j_username"]', process.env.SLATE_USERNAME)
			.type('input[name="j_password"]', process.env.SLATE_PASSWORD)
			.click('[name="_eventId_proceed"]')
			.waitForNextPage()
			.waitForSelector('.d2l-minibar-home-text')
			.cookies()
			.then(function(cookies) {
				console.log(chalk.green('Successfully Login'))
				globalCookie = cookies[0].name+'='+cookies[0].value+';'+cookies[1].name+'='+cookies[1].value

                axios.defaults.headers.common['Cookie'] = globalCookie;
			})
			.close();
};

async( function() { 
	const vorpal = require('vorpal')();
    await(grabCookie())

	vorpal
		.command('login', 'login to Slate Sheridan')
		.action(async(function(args, callback) {
			await(grabCookie())
			callback();
		}));

	vorpal
		.command('courses', 'list courses as a table')
		.action(async(function(args, callback) {
            courses = await(courseListing());
            var table = new Table({ head: ["Name", "Code"] });

            courses.map(function(i) {
                var results = i.OrgUnit.Name.split(' ');
                table.push(
                    [results.shift(), results.join(' ')]
                );
            })
            // table.push(
            //     { 'Name': course.OrgUnit.Name }
            // );
            vorpal.log(table.toString());
			callback();
		}));

	vorpal
		.command('course <course>', 'list course of sheridan')
        .option('--list-class', 'list the student of the course')
		.autocomplete(await(courseCompletion()))
		.action(async(function(args, callback) {
            if(args.options['list-class']) {
                course = await(findCourse(args.course));
                classlist = await(getClassList(course.OrgUnit.Id))
                var table = new Table({
                    head: ['Name']
                });

                classlist.map(function(i) {
                    table.push(
                        [ i.FirstName + " " + i.LastName ]
                    );
                })
                vorpal.log(table.toString());
            } else {
                course = await(findCourse(args.course));
                var table = new Table();
                table.push(
                    { 'Name': course.OrgUnit.Name }
                );
                vorpal.log(table.toString());
            }
			callback();
		}));

	vorpal
		.delimiter('slate$')
		.use(repl)
		.show();


})()

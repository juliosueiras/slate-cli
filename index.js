var async = require('asyncawait/async')
var await = require('asyncawait/await')
var Horseman = require('node-horseman');
var horseman = new Horseman();
var axios = require('axios');
var envs = require('envs');
var chalk = require('chalk');
var RxDB = require('rxdb');
var fs = require('fs');
var download = require('download');
axios.defaults.baseURL = 'https://slate.sheridancollege.ca/d2l/api/';


const vorpal = require('vorpal')();
RxDB.plugin(require('pouchdb-adapter-node-websql'))

const repl = require('vorpal-repl');
var Table = require('cli-table');

var globalCookie = null;
var globalCourseListing = null;

var getClassList = async(function(courseId) {
    var res = await(axios.get('/le/1.10/' + courseId + '/classlist/'))
    return res.data;
})

var getContentToc = async(function(courseId) {
    var res = await(axios.get('/le/1.10/' + courseId + '/content/toc'))
    console.log(res)
})

var getCourseGradeDetail = async(function(courseId, gradeId) {
    var res = await(axios.get('/le/1.10/' + courseId + '/grades/' + gradeId + '/values/myGradeValue').catch(function(err) {
        return { data: { "DisplayedGrade": "None" }}
    }))
    return res.data;
})

var getCourseGrade = async(function(courseId) {
    var res = await(axios.get('/le/1.10/' + courseId + '/grades/'))
    return res.data;
})

var downloadDropboxFiles = async(function(courseId, dropboxId) {
    var res = await(axios.get('/le/1.10/' + courseId + '/dropbox/folders/' + dropboxId))

    res.data.Attachments.forEach(function(i) {
        await(download('https://slate.sheridancollege.ca/d2l/api/le/1.10/' + courseId + '/dropbox/folders/' + dropboxId + '/attachments/' + i.FileId , {
            headers: {
                cookie: axios.defaults.headers.common['Cookie']
            }
        }).pipe(fs.createWriteStream(i.FileName)));
        vorpal.log("Finish Download: "+ i.FileName)
    })
})


var getCourseDropbox = async(function(courseId) {
    var res = await(axios.get('/le/1.10/' + courseId + '/dropbox/folders/'))
    return res.data;
})


var courseListing = async (function () {
    if(globalCourseListing == null) {
        var res = await(axios.get('/lp/1.10/enrollments/myenrollments/'))

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
            var table = new Table({ head: ["Name", "Code"],
                    chars: { 'top': '-' , 'top-mid': '+' , 'top-left': '+' , 'top-right': '+'
                        , 'bottom': '-' , 'bottom-mid': '+' , 'bottom-left': '+' , 'bottom-right': '+'
                        , 'left': '|' , 'left-mid': '+' , 'mid': '-' , 'mid-mid': '+'
                        , 'right': '|' , 'right-mid': '+' , 'middle': '|' }
            });

            courses.map(function(i) {
                var results = i.OrgUnit.Name.split(' ');
                table.push(
                    [results.shift(), results.join(' ')]
                );
            })

            vorpal.log(table.toString());
			callback();
		}));

	vorpal
		.command('course <course>', 'list course of sheridan')
        .option('--list-class', 'list the student of the course')
        .option('--grades', 'list grades of the course')
        .option('--dropbox', 'list dropbox/assignments')
        .option('--download <dropboxId>', 'use with dropbox files')
		.autocomplete(await(courseCompletion()))
		.action(async(function(args, callback) {
            if(args.options['list-class']) {
                course = await(findCourse(args.course));
                classlist = await(getClassList(course.OrgUnit.Id))
                var table = new Table({
                    head: ['Name'],
                    chars: { 'top': '-' , 'top-mid': '+' , 'top-left': '+' , 'top-right': '+'
                        , 'bottom': '-' , 'bottom-mid': '+' , 'bottom-left': '+' , 'bottom-right': '+'
                        , 'left': '|' , 'left-mid': '+' , 'mid': '-' , 'mid-mid': '+'
                        , 'right': '|' , 'right-mid': '+' , 'middle': '|' }
                });

                classlist.map(function(i) {
                    table.push(
                        [ i.FirstName + " " + i.LastName ]
                    );
                })
                vorpal.log(table.toString());
            } else if(args.options['dropbox']) {

                if(args.options['download']) {
                    course = await(findCourse(args.course));
                    await(downloadDropboxFiles(course.OrgUnit.Id, args.options.download));
                } else {
                    course = await(findCourse(args.course));
                    dropbox = await(getCourseDropbox(course.OrgUnit.Id))

                    var table = new Table({
                        head: ['ID', 'Name', 'Due Date', 'Dropbox Close Date'],
                        chars: { 'top': '-' , 'top-mid': '+' , 'top-left': '+' , 'top-right': '+'
                            , 'bottom': '-' , 'bottom-mid': '+' , 'bottom-left': '+' , 'bottom-right': '+'
                            , 'left': '|' , 'left-mid': '+' , 'mid': '-' , 'mid-mid': '+'
                            , 'right': '|' , 'right-mid': '+' , 'middle': '|' }
                    });

                    dropbox.map(function(i) {

                        var dueDate = new Date(i.DueDate);
                        var closeDate = new Date(i.Availability.EndDate);
                        table.push(
                            [ i.Id , i.Name, dueDate.toLocaleString(), closeDate.toLocaleString() ]
                        );
                    })

                    vorpal.log(table.toString());
                }

            } else if(args.options['grades']) {

                course = await(findCourse(args.course));
                grade = await(getCourseGrade(course.OrgUnit.Id))
                var table = new Table({
                    head: ['ID', 'Name', 'Grade'],
                    chars: { 'top': '-' , 'top-mid': '+' , 'top-left': '+' , 'top-right': '+'
                        , 'bottom': '-' , 'bottom-mid': '+' , 'bottom-left': '+' , 'bottom-right': '+'
                        , 'left': '|' , 'left-mid': '+' , 'mid': '-' , 'mid-mid': '+'
                        , 'right': '|' , 'right-mid': '+' , 'middle': '|' }
                });

                var gradeDetail;

                grade.map(function(i) {
                    gradeDetail = await(getCourseGradeDetail(course.OrgUnit.Id, i.Id));

                    table.push(
                        [ i.Id , i.Name, gradeDetail.DisplayedGrade ]
                    );
                })

                vorpal.log(table.toString());
            } else {
                course = await(findCourse(args.course));
                var table = new Table({
                    chars: { 'top': '-' , 'top-mid': '+' , 'top-left': '+' , 'top-right': '+'
                        , 'bottom': '-' , 'bottom-mid': '+' , 'bottom-left': '+' , 'bottom-right': '+'
                        , 'left': '|' , 'left-mid': '+' , 'mid': '-' , 'mid-mid': '+'
                        , 'right': '|' , 'right-mid': '+' , 'middle': '|' }
                });
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

'use strict';

require('dotenv').config()

const Botkit = require('./lib/Botkit.js');
const os = require('os');
const axios = require('axios');
const schedule = require('node-schedule');
const jsonQuery = require('json-query');

// personal DREIDEV data
const dreidevCloseGroupUNames = ['tokyo', 'naderalexan', 'drazious', 'rawanhussein'];

var controller = Botkit.slackbot({debug: true});

var bot = controller.spawn({token: process.env.SALCKBOT_TOKEN}).startRTM();

let cleverbot = new(require("cleverbot.io"))(process.env.CLEVERBOT_API_USER, process.env.CLEVERBOT_API_KEY);
cleverbot.setNick("Dry");
cleverbot.create(function(err, session) {
    if (err) {
        console.log('cleverbot create fail.');
    } else {
        console.log('cleverbot create success.');
    }
});

controller.hears([
    'call me (.*)', 'my name is (.*)'
], 'direct_message,direct_mention,mention', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user
            };
        }
        user.name = name;
        controller.storage.users.save(user, function(err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

// pants function
controller.hears([
    'what the (.*)', 'what do I miss (.*)'
], 'direct_message,direct_mention,mention', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user
            };
        }
        user.name = name;
        axios.get('https://slack.com/api/users.info', {
            params: {
                token: process.env.SALCKBOT_API_TOKEN,
                user: user.id
            }
        }).then(function(response) {
            if (dreidevCloseGroupUNames.indexOf(response.data.user.name) > -1) {
                bot.reply(message, 'T h e pants !! ');
            }
        }).catch(function(error) {
            console.log(error);
        });
    });
});

controller.hears([
    'what is my name', 'who am i'
], 'direct_message,direct_mention,mention', function(bot, message) {

    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Your name is ' + user.name);
        } else {
            bot.startConversation(message, function(err, convo) {
                if (!err) {
                    convo.say('I do not know your name yet!');
                    convo.ask('What should I call you?', function(response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            }, {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            }, {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, {'key': 'nickname'}); // store the results in a field called nickname

                    convo.on('end', function(convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function(err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function(err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                            });

                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
});

// testing function
controller.hears([
    'testruru', 'testbot'
], 'direct_message,direct_mention,mention', function(bot, message) {
    axios.get('https://slack.com/api/channels.list', {
        params: {
            token: process.env.SALCKBOT_API_TOKEN
        }
    }).then(function(response) {
        const channels = response.data.channels;
        const testChannelId = jsonQuery('[name=test-dreidev]', {data: channels}).value.id;
        console.log('channel id: ' + testChannelId);
        bot.say({
            text: 'You triggered the rorobot test command, like you need to DUH, I\'m working fine !!', channel: testChannelId // a valid slack channel, group, mpim, or im ID
        });
    }).catch(function(error) {
        console.log(error);
    });
});


// testing users function
controller.hears([
    'testUsers', 'testFunc'
], 'direct_message,direct_mention,mention', function(bot, message) {
    axios.get('https://slack.com/api/users.list', {
        params: {
            token: process.env.SALCKBOT_API_TOKEN
        }
    }).then(function(response) {
        const members = response.data.members;
        members.forEach(function(member){
            console.log(member);
            if (!member.deleted && member.name==='tokyo') {
                bot.say({
                    text: 'Hi, ' + member.name + '\nWhat are you working on today?', channel: member.id // a valid slack channel, group, mpim, or im ID
                });
            }
        });
    }).catch(function(error) {
        console.log(error);
    });
});

// FALLBACK to cleverbot

controller.hears('', 'direct_message,direct_mention,mention', function(bot, message) {
    var msg = message.text;
    cleverbot.ask(msg, function(err, response) {
        if (!err) {
            bot.reply(message, response);
        } else {
            console.log('cleverbot err: ' + err);
        }
    });
})


// Dreidev working days 10 am rule
const workingDaysMoriningRule = new schedule.RecurrenceRule();
workingDaysMoriningRule.dayOfWeek = [new schedule.Range(0, 4)];
workingDaysMoriningRule.hour = 10;
workingDaysMoriningRule.minute = 00;

let scheduleMornigWorkCheckupQuestion = schedule.scheduleJob(workingDaysMoriningRule, function() {
    axios.get('https://slack.com/api/users.list', {
        params: {
            token: process.env.SALCKBOT_API_TOKEN
        }
    }).then(function(response) {
        const members = response.data.members;
        members.forEach(function(member){
            console.log(member);
            if (!member.deleted && (member.name==='tokyo')) {
                bot.say({
                    text: 'Hi, ' + member.name + '\nWhat are you working on today?', channel: member.id // a valid slack channel, group, mpim, or im ID
                });
            }
        });
    }).catch(function(error) {
        console.log(error);
    });
});

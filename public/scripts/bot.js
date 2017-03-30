/**
 * The Bot
 */
var Bot = function Bot(_) {
  
  // List of available commands the bot can respond to.
  this.commands = [];

  // Initialize the Bot
  this.boot();

};

/**
 * Delete the command from the storage
 * 
 * @param object data
 * @return object
 */
Bot.prototype.deleteCommand = function deleteCommand(data) {
  var cmdObj = this.getCommand(cmd);
  cmdObj.delete(data);

  return this;
}

/**
 * Get the command config object from the commands
 *
 * @param string cmd
 * @return object
 */
Bot.prototype.getCommand = function getCommand(cmd) {
  return _.find(this.commands, function (cmdObj) {
    return _.eq(cmdObj.cmd, cmd);
  });

  return this;
}

/**
 * Parse a input string and execute the command
 * 
 * @param string input
 * @return object
 */
Bot.prototype.execCommand = function execCommand(input) {
  var cmd = input.split(' ')[0],
    text = input.substr(cmd.length + 1),
    cmdObj = this.getCommand(cmd);
  
  // Check if the command is valid
  if (cmdObj) {
    cmdObj.create(cmd, text);
  } else {
    this.pushAlertMessage('Oops, i do not recognize that command ¯\\_(ツ)_/¯', 'msg');
  }

  return this;
}

/**
 * Show's a browser notification at a specific period provided
 *
 * @param String title Notification title
 * @param String body Notification body
 * @param Int period Time the Notification to be shown after
 * @param String sec|min Unit for the period provided
 */
Bot.prototype.showNotificationAfter = function showNotificationAfter(title, body, period, unit) {
  if (unit === 'sec') {
    period = period * 1000;
  } else if (unit === 'min') {
    period = (period *60) * 1000;
  }
  
  if (period !== null || period !== undefined) {
    setTimeout(function () {
      if(window.Notification && Notification.permission !== "denied") {
        Notification.requestPermission(function(status) {
          var n = new Notification(title, { 
            body: body,
            icon: 'assets/bot.png'
          }); 
        });
      }
    }, period);
  }

  return this;
}

/**
 * Pushes a temporary alert message into the messages to show in the View
 *
 * @param String text The alert message to show.
 * @param String type The alert message type
 */
Bot.prototype.pushAlertMessage = function pushAlertMessage(text, type) {
  // The view instance
  var vm = app;

  vm.$data.messages.push({
    text: text,
    m_type: type,
  });
}

/**
 * The Bot initialization function, 
 *    - Initialize all the commands
 *    - Triggers permission for the Notification if not given already
 */
Bot.prototype.boot = function boot() {
  var bot = this;

  /**
   * Add a new command for the bot
   *
   * Note: This can also be made available in the bot
   * prototype publically.
   * 
   * Command Format:
   *
   * {
   *    cmd[String]: The unique command identifier e.g /yesno,
   *    desc[String]: A small description of the command,
   *    create[callback]: Will be invoked when the command is being executed
   *      It will recieve the "cmd" and "text" the user input as it's argument,
   *    load[callback]: Used to get the view data object from the data stored of this command type
   * }
   *
   * @param Object options The command config options
   */
  function addCommand(options) {
    if ( !(_.isString(options.cmd) &&
      _.startsWith(options.cmd, '/') &&
      _.isString(options.desc) && 
      _.isFunction(options.create) &&
      _.isFunction(options.load)) ) {
        console.log('Cannot add command, the command options are invalid.');
        return;
    }
    
    bot.commands.push({
      cmd: options.cmd,
      desc: options.desc,
      create: options.create,
      load: options.load
    });
  }

  /****** Add the various commands ******/
  
  addCommand({
    cmd: '/yesno',
    desc: 'Ask a question which i can answer with just "yes" or "no" ?',
    create: function create(cmd, text) {
      var question = (text.indexOf('?') === -1) ? text + ' ?' : text,
        data = null;

      // Make an ajax call to the yesno.wtf domain
      axios.get('https://yesno.wtf/api', {
          params: {
            question: question
          }
        }).then(function (response) {
          data = response.data;

          if (data !== null) {
            message = {
              text: data.answer,
              m_type: 'cmd',
              cmd: '/yesno',
              timestamp: Date.now(),
              data: data
            };
            // Add the message into the firebase database
            fireUtil.addMessage(message);
          }
        }).catch(function (error) {
          console.log('error occurred ajax yesno - ', error);
          // Add a temp message to the messages stack
          bot.pushAlertMessage('There seems to be a problem communicating with this service, can you try again later.', 'msg');
        });
    },

    load: function (message) {
      return {
        text: message.text,
        type: message.m_type,
        cmd: message.cmd,
        data: {
          image: message.data.image
        }
      }
    }

  });

  addCommand({
    cmd: '/remind',
    desc: 'Set a Reminder - format: /remind {subject} after [number] [sec|min]',
    create: function create(cmd, text) {
      var regex = /(.*)after\s([0-9]+)\s(sec|min)$/g,
        matches = [];
      
      if (matches = regex.exec(text)) {
        var message = {
          text: 'Created a reminder for you.',
          m_type: 'cmd',
          cmd: '/remind',
          timestamp: Date.now(),
          data: {
            subject: matches[1],
            period: matches[2],
            unit: matches[3],
            createdAt: Date.now()
          }
        };
        
        fireUtil.addMessage(message);
      } else {
        bot.pushAlertMessage('I could not recognize the remind command, you do know the format i understand right ?', 'msg');
      }
    },

    load: function (message) {
      var diff = Math.round((new Date(Date.now()) - new Date(message.data.createdAt)) / 1000),
        period = 0;

      if (message.data.unit === 'sec') {
        period = message.data.period - diff;
      } else if (message.data.unit === 'min') {
        period = Math.round(message.data.period - (diff / 60));
      }

      if (period > 0) {
        bot.showNotificationAfter('Bot Reminder', 
          message.data.subject, period, message.data.unit); 
      }

      return {
        text: message.text,
        type: message.m_type,
        cmd: message.cmd,
        data: message.data
      }
    }
    
  });

  addCommand({
    cmd: '/shorten',
    desc: 'Shorten the URL provided using Google URL Shortener.',
    create: function create(cmd, text) {
      var url = '',
        regExp = new RegExp(/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/, 'i');

      if ( !regExp.test(text) ) {
        bot.pushAlertMessage('Well, that seems to be an invalid URL format. Can you fix that ?', 'msg');
        return;
      }

      url = text.trim();

      axios.post('https://www.googleapis.com/urlshortener/v1/url?key=AIzaSyBNdsF8XwSOtG9lSvaMJiVG9SAW30mMY4s', {
          longUrl: url
        }).then(function (response) {
          data = response.data;

          if (data !== null) {
            message = {
              text: 'I have shortened your URL (' + url + ') using http://goo.gl',
              m_type: 'cmd',
              cmd: '/shorten',
              data: data,
              timestamp: Date.now()
            };

            fireUtil.addMessage(message);
          }
        }).catch(function (error) {
          console.log('ajax goo.gl error, ', error);
          // Push alert message
          bot.pushAlertMessage('Oops, seems there was some error shortening the url with goo.gl', 'msg');
        });
    },

    load: function (message) {
      return {
        text: message.text,
        type: message.m_type,
        cmd: message.cmd,
        data: message.data
      }
    }

  });

  // Check if notificaiton is enabled.
  if(window.Notification && Notification.permission === "denied") {
    Notification.requestPermission(function(status) {  // status is "granted", if accepted by user
      var n = new Notification('Slackbot', { 
        body: 'Hey there, i can now remind you with notifications',
        icon: '' // optional
      }); 
    });
  }

}

/**
 * Create a new Bot instance and add the supported commands
 */
var slackbot = new Bot(_);


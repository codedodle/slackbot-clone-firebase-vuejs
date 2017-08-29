/************************************************************
 * Vue Components
 ************************************************************/

/**
 * The Vue MessageItem Component
 */
Vue.component('message-item', {
  props: ['msgData'],
  template: `<li class="list-group-item">
    <div class="">
      <div class="message-profile">
        <img width="36" height="36" class="img-circle" 
          src="assets/bot.png" />
      </div>
      <div class="message-text row" :class="{'bot-message-text': isBotMessage}">
        <div class="col-md-12">
          <p>{{ msgText }}</p>

          <div v-if="type === 'cmd' && cmd === '/yesno'">
            <img class="img-thumbnail" :src="data.image" maxwidth="300px" maxheight="300px" />
          </div>

          <div v-if="type === 'cmd' && cmd === '/remind'">
            <p>You created reminder at - <b>{{ getReminderDateTime() }}</b> for <b>"{{data.subject}}"</b></p>
          </div>

          <div v-if="type === 'cmd' && cmd === '/shorten'">
            <p>Here is the short url - <b><a :href="data.id" target="_blank">{{ data.id }}</a></b> for the given long url</b></p>
          </div>          
        </div>
      </div>
    </div>
  </li>`,

  data: function () {
    if (this.msgData.m_type === 'cmd') {
      var command = slackbot.getCommand(this.msgData.cmd);

      if (command !== undefined) {
        return command.load(this.msgData);
      }
    }

    return {
      text: this.msgData.text,
      type: this.msgData.m_type,
      cmd: '',
      data: {}
    }
  },

  computed: {

    msgText: function () {
      if (this.text === undefined) {
        return '';
      }
      
      return this.text.charAt(0).toUpperCase() + this.text.slice(1);
    },

    isBotMessage: function () {
      return this.type === 'cmd';
    }

  },

  methods: {

    updateScroll: function () {
      var body = document.getElementsByTagName('body')[0];
      body.scrollTop = body.scrollHeight;
    },

    getReminderDateTime: function () {
      return new Date(this.data.createdAt).toDateString() + ' ' +
        new Date(this.data.createdAt).toTimeString();
    }

  },

  updated: function () {
    this.updateScroll();
  },

  mounted: function () {
    this.updateScroll();
  }

});

/**
 * The Vue HoverCommand Component
 */
Vue.component('hover-command', {
  props: ['command'],
  template: `<li class="list-group-item">
    <p class="hover-list-item">
      <strong class="pull-left">{{command.cmd}}</strong>
      <span class="pull-right">{{command.desc}}</span>
    </p>
  </li>`
});

var app = new Vue({
  el: '#app',

  data: {
    input: '',

    auth: {
      user: null,
      email: '',
      password: '',
      message: '',
      hasErrors: false
    },

    commands: [],
    hoverCommands: [],
    messages: [],
    attachEvents: false
  },

  methods: {

    /**
     * Authenticate the user
     *
     * @param object event
     */
    login: function (event) {
      var vm = this;
      vm.auth.message = '';
      vm.auth.hasErrors = false;

      if (vm.auth.email === '' || vm.auth.password === '') {
        alert('Please provide the email and password');
        return;
      }
      // Sign-in the user with the email and password
      firebase.auth().signInWithEmailAndPassword(vm.auth.email, vm.auth.password)
        .then(function (data) {
          vm.auth.user = firebase.auth().currentUser;
          //vm.loadMessages();
        }).catch(function(error) {
          vm.auth.message = error.message;
          vm.auth.hasErrors = true;
        });
    },

    /**
     * Create a new user account
     * 
     * @param object event
     */
    signUp: function (event) {
      var vm = this;
      vm.auth.message = '';
      vm.auth.hasErrors = false;

      if (vm.auth.email === '' || vm.auth.password === '') {
        alert('Please provide the email and password');
        return;
      }

      // Create a new user in firebase
      firebase.auth().createUserWithEmailAndPassword(vm.auth.email, vm.auth.password)
        .then(function (data) {
          vm.auth.message = 'Successfully created user';
          vm.auth.user = firebase.auth().currentUser;
          vm.auth.email = '';
          vm.auth.password = '';
          // Load the messages of the user
          //vm.loadMessages();
        }).catch(function(error) {
          vm.auth.message = error.message;
          vm.auth.hasErrors = true;
        });
    },

    /**
     * Signout the currently logged-in user
     */
    signOut: function () {
      this.messages = [];
      this.attachEvents = false;

      firebase.auth().signOut()
        .then(function(error) {
          console.log('signout response - ', error);
          this.auth.user = firebase.auth().currentUser;
          this.auth.message = 'User signed out Successfully';
        }.bind(this), function (error) {
          alert('Failed to signout user, try again later');
        });
    },

    /**
     * Handles user command inputs
     *
     */
    askBot: function (event) {
      var vm = this,
        bot = null;
      
      // Check if the input is a command
      if (/\/[a-z]+\s/.test(vm.input)) {
        response = slackbot.execCommand(vm.input);
      } else {
        response = fireUtil.addMessage({
          text: vm.input,
          m_type: 'msg',
          timestamp: Date.now(),
          callback: null
        });
      }

      if (response === null) {
        vm.messages.push({
          text: 'I am sorry, i do not recognized that command.'
        });
      }

      // Clear the input
      vm.input = '';
    },

    /**
     * Load the user's messages
     */
    attachFirebaseEvents: function () {
      if (this.attachEvents === true) {
        return;
      }

      var vm = this,
        messagesRef = firebase.database().ref('chats/' + vm.auth.user.uid + '/messages'),
        messages = [];

      messagesRef.once('value', function (snapshot) {
        console.log('messages value snapshot ', snapshot.val());
        if (snapshot.val() === null) {
          vm.messages.push({
            text: 'Hi, what can i do for you ?',
            m_type: 'msg'
          });
        }
      });

      messagesRef.on('child_added', function (snap) {
        console.log('message child added');
        vm.messages.push(snap.val());      
      });

      messagesRef.on('child_removed', function (snap) {
        console.log('child has been removed');
        var index = _.indexOf(vm.messages, snap.val());
        vm.messages.splice(index, 1);
      });

      messagesRef.on('child_changed', function (snap) {
        console.log('child has been changed');
      });

      this.attachEvents = true;
    },

    /**
     * Load the available commands based on the user input
     */
    loadCommands: function () {
      firebase.database().ref('/commands').once('value', function (snap) {
        this.commands = snap.val();
      }.bind(this));
    },

    /**
     * Dismiss the alert message
     */
    dismissAlert: function () {
      this.auth.message = '';
      this.auth.hasErrors = false;
    }

  },

  computed: {

    /**
     * Determines if the commands helper should be shown
     *
     * @return boolean
     */
    showHoverCommands: function () {
      return this.hoverCommands.length > 0;
    },

    /**
     * Determines if the user is authenticated
     *
     * @return boolean
     */
    isAuthenticated: function () {
      firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
          this.auth.user = user;
          // Attach firebase db events
          this.attachFirebaseEvents();
          // Load the commands
          this.loadCommands();
        } else {
          this.auth.user = null;
        }
      }.bind(this));

      return (this.auth.user !== null);
    }

  },

  watch: {

    /**
     * Watch the user input for changes
     *
     * @param string input
     */
    input: function (input) {
      if (input === '') {
        this.hoverCommands = [];
        return;
      }

      // Filter the commands based on the user input
      this.hoverCommands = _.filter(this.commands, function (cmdObj) {
        return _.startsWith(cmdObj.cmd, input);
      });
    }
  }

});

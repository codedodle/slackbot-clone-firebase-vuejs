/**
 * A small wrapper utility around the firebase database for the 
 * application's messaging functionality.
 */
var fireUtil = {

	/**
	 * Add a new message into the firebase realtime database
	 *
	 * @param Object data
	 * @return boolean
	 */
	addMessage: function addMessage(data) {
		if (firebase.auth().currentUser === null && data !== null) {
			return false;
		}

		var user = firebase.auth().currentUser,
			messagesRef = firebase.database().ref('chats/' + user.uid).child('messages');
			newMsgRef = messagesRef.push();

		newMsgRef.set(data);

		return true;
	},

	/**
	 * Remove a message from the firebase database for the current user.
	 * 
	 * @param String msgId
	 * @return boolean
	 */
	removeMessage: function removeMessage(msgId) {
		if (firebase.auth().currentUser === null && msgId !== null && msgId !== '') {
			return false;
		}

		var user = firebase.auth().currentUser,
			messageRef = firebase.database().ref('chats/' + user.uid + '/messages/' + msgId);

		messageRef.remove();
	},

	/**
	 * Update a message in the firebase database for the current user.
	 *
	 * @param String msgId
	 * @param Object data
	 * @return boolean
	 */
	updateMessage: function updateMessage(msgId, data) {
		if (firebase.auth().currentUser === null 
			&& msgId !== null && msgId !== '' && data !== null) {
			return false;
		}

		var user = firebase.auth().currentUser,
			messageRef = firebase.database().ref('chats/' + user.uid + '/messages/' + msgId);

		messageRef.update(data);		
	}

};
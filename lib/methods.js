Meteor.methods({
	'createMessage': function(message) {
		now = new Date();
		later = new Date();
		later.setSeconds(later.getSeconds() + 10);
		message.createdAt = Meteor.isServer 
			? now
			: later;
		Messages.insert(message);
	},
});

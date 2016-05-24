Meteor.publish("games", function (gameID) {
	return Games.find({_id: gameID});
});

Meteor.publish("players", function (gameID) {
	return Players.find({gameID: gameID});
});

Meteor.publish("messages", function (gameID) {
	return Messages.find({gameID: gameID});
});
/*
Meteor.publish("results", function () {
	return Results.find();
});
*/

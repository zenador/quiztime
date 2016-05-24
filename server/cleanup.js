function cleanUpCollections(){
	var cutOff = moment().subtract(72, 'hours').toDate();

	var numGamesRemoved = Games.remove({
		updatedAt: {$lt: cutOff}
	});

	var numPlayersRemoved = Players.remove({
		updatedAt: {$lt: cutOff}
	});
}

function cleanUpMessages(){
	var cutOff = moment().subtract(3, 'hours').toDate();

	var numMessagesRemoved = Messages.remove({
		createdAt: {$lt: cutOff}
	});
}

Meteor.startup(function () {
	/*
	// Delete all collections on startup
	Games.remove({});
	Players.remove({});
	Messages.remove({});
	*/
});

var MyCron = new Cron(3600000);//ms

MyCron.addJob(24, cleanUpCollections);//hour
MyCron.addJob(1, cleanUpMessages);//hour

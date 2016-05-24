Meteor.methods({
	'findGame': function(query) {
		var game = Games.findOne(query);
		return game;
	},
	'getPlayersSameName': function(gameID, playerName) {
		var playersSameName = Players.find({gameID: gameID, name: playerName}).count();
		return playersSameName;
	},
	'findPlayer': function(query) {
		var player = Players.findOne(query);
		return player;
	},
	'findPlayerAndGame': function(query) {
		var player = Players.findOne(query);
		if (player)
			var game = Games.findOne(player.gameID);
		else
			var game = null;
		return [player, game];
	},
	'messageFromWeb': function(chatID, text) {
		messageFromWeb(chatID, text);
	},
	'messageKeyboardFromWeb': function(chatID, text, array) {
		messageKeyboardFromWeb(chatID, text, array);
	},
	'getPoem': function() {
		var sqlite3 = Npm.require("sqlite3").verbose();
		var filePath = process.env.PWD + '/private/poems.db';
		var db = new sqlite3.Database(filePath);
		var dbAllSync = Meteor.wrapAsync(db.all.bind(db));

		var maxId = 0;//11476;
		dbAllSync("SELECT MAX(rowid) as maxId FROM poems;").forEach(function(row){
			maxId = row.maxId;
		});

		var text = null;
		var attempts = 0;
		while (text == null && attempts < 5) {
			var rowId = getRandom(maxId+1);
			dbAllSync("SELECT title, fulltext FROM poems WHERE rowid == "+rowId.toString()+";").forEach(function(row){
				text = row.fulltext;
			});
			attempts++;
		}

		db.close();

		if (!text) {
			return ["(SORRY, FAILED TO RETRIEVE QUESTION)", ""];
		}

		text = JSON.parse(text);

		var randIndex = getRandom(text.length-3)+3;
		var answer = normaliseAnswer(text[randIndex]);
		text[randIndex] = "???";
		var startLine = randIndex - 3;
		if (startLine < 0)
			startLine = 0;
		var endLine = randIndex+1;
		if (endLine > text.length)
			endLine = text.length;
		var extract = text.slice(startLine, endLine);
		var question = extract.join('\n').trim();
		return [question, answer];
	},
});

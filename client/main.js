Meteor.startup(function() {
/*
	WebFontConfig = {
		google: { families: [ 'Open+Sans:400,700:latin,latin-ext', 'Raleway:400,700'] }
	};
	(function() {
		var wf = document.createElement('script');
		wf.src = ('https:' == document.location.protocol ? 'https' : 'http') +
			'://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js';
		wf.type = 'text/javascript';
		wf.async = 'true';
		var s = document.getElementsByTagName('script')[0];
		s.parentNode.insertBefore(wf, s);
		//console.log("async fonts loaded", WebFontConfig);
	})();
*/
});

$( document ).ready(function() {
	var lastTouchY = 0;
	var preventPullToRefresh = false;

	$('body').on('touchstart', function (e) {
		if (e.originalEvent.touches.length != 1) { return; }
		lastTouchY = e.originalEvent.touches[0].clientY;
		preventPullToRefresh = window.pageYOffset == 0;
	});

	$('body').on('touchmove', function (e) {
		var touchY = e.originalEvent.touches[0].clientY;
		var touchYDelta = touchY - lastTouchY;
		lastTouchY = touchY;
		if (preventPullToRefresh) {
			// To suppress pull-to-refresh it is sufficient to preventDefault the first overscrolling touchmove.
			preventPullToRefresh = false;
			if (touchYDelta > 0) {
				e.preventDefault();
				return;
			}
		}
	});
});

window.addEventListener("beforeunload", function (e) {
	if ( (getGameState() == 'inProgress') || (getGameState() == 'waitingForPlayers') ) {
		if (isHost()) {
			var confirmationMessage = TAPi18n.__("ui.dialog.host close window");
		} else {
			var confirmationMessage = TAPi18n.__("ui.dialog.player close window");			
		}
		(e || window.event).returnValue = confirmationMessage; //Gecko + IE
		return confirmationMessage;                            //Webkit, Safari, Chrome
	}
});

Template.registerHelper('equals', function (a, b) {
	return a === b;
});

Template.registerHelper('lessThan', function (a, b) {
	return a < b;
});

Template.registerHelper('isYou', function (thisPlayerID) {
	var playerID = Session.get("playerID");
	if (playerID == thisPlayerID)
		return true;
	else
		return false;
});

Template.registerHelper('formatTime', function (time) {
	var isToday = moment(time).isSame(new Date(), "day");
	if (isToday) {
		return moment(time).format('h.mma');
	} else {
		return moment(time).format('h.mma DD-MM-YYYY');
	}
});

Template.main.helpers({
	whichView: function() {
		return Session.get('currentView');
	}
});

Template.main.events({
	'click button.btn-tooltip': function (event) {
		showInfoMessage($(event.target).attr('data-tooltip'));
	},
});

Template.startMenu.helpers({
	playerName: function() {
		return Session.get('playerName');
	},
	accessCode: function() {
		if (Session.get('prefillAccessCode'))
			return Session.get('prefillAccessCode');
		else
			return Session.get('accessCode');
	},
	playerAccessCode: function() {
		if (Session.get('prefillPlayerAccessCode'))
			return Session.get('prefillPlayerAccessCode');
		else
			return Session.get('playerAccessCode');
	},
	canResume: function() {
		return (Session.get('BKgameID') && Session.get('BKplayerID'));
	},	
});

Template.startMenu.events({
	'click button#newgame': function () {
		var playerName = $('#playerName').val();
		if (!playerName) {
			showErrorMessage(TAPi18n.__("ui.validation.form.player name"));
			return false;
		}

		var game = generateNewGame();
		if (!game)
			return false;

		var player = generateNewHostPlayer(game, playerName);

		Session.set("playerName", playerName);
		Session.set("accessCode", game.accessCode);
		Session.set("playerAccessCode", player.accessCode);
		Session.set("usurpCode", game.usurpCode);
		Session.set("gameID", game._id);
		Session.set("playerID", player._id);
		Session.set("currentView", "lobby");

		//showInfoMessage(TAPi18n.__("ui.validation.usurp code", game.usurpCode));

		Meteor.call('findGame', game._id, function(error, result) {
			if (error) {
				showErrorMessage(TAPi18n.__("ui.server connect error"));
			} else {
				var game = result;
				if (game)
					showInfoMessage("New game has been synced to server");
				else
					showErrorMessage("New game has not been synced to server");
			}
		});
	},
	'click button#joingame': function () {
		var playerName = $('#playerName').val().trim();
		if (!playerName) {
			showErrorMessage(TAPi18n.__("ui.validation.form.player name"));
			return false;
		}
		var accessCode = $('#accessCode').val().trim().toLowerCase();
		
		Meteor.call('findGame', {accessCode: accessCode}, function(error, result) {
			if (error) {
				showErrorMessage(TAPi18n.__("ui.server connect error"));
			} else {
				var game = result;
				if (game) {
					Meteor.call('getPlayersSameName', game._id, playerName, function(error, result) {
						if (error) {
							showErrorMessage(TAPi18n.__("ui.server connect error"));
						} else {
							var playersSameName = result;
							if (playersSameName) {
								showErrorMessage(TAPi18n.__("ui.validation.form.player name taken"));
								return false;
							}

							if (game.locked) {
								showErrorMessage(TAPi18n.__("ui.validation.form.game room locked"));
								return false;
							}

							var player = generateNewPlayer(game, playerName);

							Session.set("playerName", playerName);
							Session.set("accessCode", accessCode);
							Session.set("playerAccessCode", player.accessCode);
							Session.set("gameID", game._id);
							Session.set("playerID", player._id);
							Session.set("currentView", "lobby");
						}
					});
				} else {
					showErrorMessage(TAPi18n.__("ui.validation.form.access code"));
				}
			}
		});
	},
	'click button#resumegame': function () {
		var gameID = Session.get("BKgameID");
		var playerID = Session.get("BKplayerID");
		Session.set("gameID", gameID);
		Session.set("playerID", playerID);
		Session.set("currentView", "lobby");
	},
	'click button#rejoingame': function () {
		var accessCode = $('#playerAccessCode').val().trim().toLowerCase();
		
		Meteor.call('findPlayerAndGame', {accessCode: accessCode}, function(error, result) {
			if (error) {
				showErrorMessage(TAPi18n.__("ui.server connect error"));
			} else {
				var player = result[0];
				var game = result[1];
				if (player && game) {
					Session.set("playerName", player.name);
					Session.set("accessCode", game.accessCode);
					Session.set("playerAccessCode", player.accessCode);
					Session.set("gameID", game._id);
					Session.set("playerID", player._id);
					Session.set("currentView", "lobby");
				} else {
					showErrorMessage(TAPi18n.__("ui.validation.form.player access code"));
				}
			}
		});
	},
});

Template.accessCode.helpers({
	accessCode: function () {
		var game = getCurrentGame();
		if (!game) {
			return null;
		}
		return game.accessCode;
	},
	playerAccessCode: function () {
		var player = getCurrentPlayer();
		if (!player) {
			return null;
		}
		return player.accessCode;
	},
});

Template.lobby.helpers({
	game: function () {
		return getCurrentGame();
	},
	accessLink: function () {
		return getAccessLink();
	},
	/*
	player: function () {
		return getCurrentPlayer();
	},
	*/
	isHost: isHost,
	isGameState: function (state) {
		return getGameState() == state;
	},
});

Template.lobby.events({
	'click button': function () {//this must be before the specific buttons, otherwise messages may never appear (if they are cleared immediately)
		clearMessage();
	},
});

Template.playerList.helpers({
	players: function () {
		var game = getCurrentGame();
		if (!game) {
			return null;
		}
		var players = Players.find({gameID: game._id}).fetch();
		return players;
	},
	numPlayers: function () {
		var game = getCurrentGame();
		if (!game) {
			return null;
		}
		var numPlayers = Players.find({gameID: game._id}).count();
		return numPlayers;
	},
	isHost: isHost,
	roomIsLocked: function () {
		var game = getCurrentGame();
		if (!game) {
			return null;
		}
		return game.locked;
	},
	isGameState: function (state) {
		return getGameState() == state;
	},
	hidePlayerList: function () {
		var game = getCurrentGame();
		if (!game) {
			return null;
		}
		return game.hidePlayerList;
	},
});

Template.playerList.events({
	'click button.removePlayer': function () {
		var playerName = $(event.target).attr('data-playerName');
		var choice = confirm(TAPi18n.__("ui.dialog.remove player", playerName));
		if (choice == false)
			return false;
		var playerId = $(event.target).attr('data-playerId');
		Players.remove(playerId);
	},
	'click button.transferHost': function () {
		var playerName = $(event.target).attr('data-playerName');
		var choice = confirm(TAPi18n.__("ui.dialog.transfer host", playerName));
		if (choice == false)
			return false;
		var playerId = $(event.target).attr('data-playerId');
		Players.update(playerId, {$set: {isHost: true}});
		Players.update(getCurrentPlayer()._id, {$set: {isHost: false}});
	},
	'click button#lockGameRoom': function () {
		var game = getCurrentGame();
		if (!game) {
			return null;
		}
		if (game.locked) {
			Games.update(game._id, {$set: {locked: false}});
		} else {
			Games.update(game._id, {$set: {locked: true}});
		}
	},
	'click button#toggleAccess': function () {
		$('div.accessCode').toggleClass("hidden");
		if ($("#toggleAccess").text()==TAPi18n.__("ui.button.game menu.hide access"))
			$("#toggleAccess").text(TAPi18n.__("ui.button.game menu.show access"));
		else
			$("#toggleAccess").text(TAPi18n.__("ui.button.game menu.hide access"));
	},
});

function leaveGame () {
	var player = getCurrentPlayer();
	var game = getCurrentGame();

	if (game && player) {
		/*
		if (game.state == 'inProgress' && player.state != 0) {
			Games.update(game._id, {$set: {state: 'playerQuit'}});
		} else
		*/
		if (player.isHost) {
			var newHost = Players.findOne({gameID: game._id, isHost: false});
			if (newHost)
				Players.update(newHost._id, {$set: {isHost: true}});
			Players.update(player._id, {$set: {isHost: false}});
		}
	}

	//if (player && player.state != 0 && game && game.state != "over")
		Players.remove(player._id);
	Session.set("playerID", null);
	Session.set("gameID", null);
	Session.set("BKplayerID", null);
	Session.set("BKgameID", null);
	Session.set("currentView", "startMenu");
	Session.set("accessCode", null);
	Session.set("playerAccessCode", null);
}

function getAccessLink(){
	var game = getCurrentGame();
	if (!game){
		return;
	}
	return Meteor.settings.public.url + game.accessCode + "/";
}

function generateAccessCode(){
	var code = words[getRandom(words.length)]+" "+words[getRandom(words.length)]+" "+words[getRandom(words.length)];

	return code;
}

function generateUsurpCode(){
	var code = "";
	var possible = "abcdefghijklmnopqrstuvwxyz";

	for(var i=0; i < 6; i++){
		code += possible.charAt(getRandom(possible.length));
	}
	return code;
}

function getCurrentGame(){
	var gameID = Session.get("gameID");
	if (gameID) {
		return Games.findOne(gameID);
	}
}

function getCurrentPlayer(){
	var playerID = Session.get("playerID");

	if (playerID) {
		return Players.findOne(playerID);
	}
}

function isHost() {
	var player = getCurrentPlayer();
	if (!player) {
		return null;
	}
	return player.isHost;
}

function generateNewGame(){
	var game = {
		accessCode: generateAccessCode(),
		usurpCode: generateUsurpCode(),
		state: "waitingForPlayers",
		phase: "Not yet started",
		locked: false,
		currentQuestion: null,
		currentAnswer: null,
		lastRoundResult: null,
		questionSource: 'Players',
		scoringType: 'Correct',
		createdAt: new Date(),
		updatedAt: new Date(),
		telegram: null,
	};

	var gameID = Games.insert(game);
	game = Games.findOne(gameID);

	return game;
}

function generateNewPlayer(game, name){
	return generateNewPlayerFull(game, name, false);
}

function generateNewHostPlayer(game, name){
	return generateNewPlayerFull(game, name, true);
}

function generateNewPlayerFull(game, name, isHost){
	var player = {
		gameID: game._id,
		name: name,
		isHost: isHost,
		isAsker: false,
		submittedAnswer: null,
		chosenAnswer: null,
		lastRoundPick: "",
		lastRoundPickedBy: "",
		score: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		telegram: null,
		accessCode: generateAccessCode(),
	};

	var playerID = Players.insert(player);

	return Players.findOne(playerID);
}

Template.gameInfo.helpers({
	questionSource: function () {
		var game = getCurrentGame();
		if (!game) {
			return null;
		}
		return game.questionSource;
	},
	scoringType: function () {
		var game = getCurrentGame();
		if (!game) {
			return null;
		}
		return game.scoringType;
	},
});

Template.gameOptions.helpers({
	questionSource: function () {
		var game = getCurrentGame();
		if (!game) {
			return null;
		}
		return game.questionSource;
	},
	scoringType: function () {
		var game = getCurrentGame();
		if (!game) {
			return null;
		}
		return game.scoringType;
	},
	optionQnSource: function () {
		return optionQnSource;
	},
	optionScoring: function () {
		return optionScoring;
	},
});

Template.gameOptions.events({
	'change select#optionQnSource': function () {
		var game = getCurrentGame();
		if (!game)
			return null;
		var questionSource = $('select#optionQnSource').val();
		Games.update(game._id, {$set: {questionSource: questionSource}});
	},
	'change select#optionScoring': function () {
		var game = getCurrentGame();
		if (!game)
			return null;
		var scoringType = $('select#optionScoring').val();
		Games.update(game._id, {$set: {scoringType: scoringType}});
	},
});

Template.choiceBox.helpers({
	lastRoundPersonalResult: function () {
		var player = getCurrentPlayer();
		if (!player)
			return null;
		if (!player.lastRoundPick && !player.lastRoundPickedBy)
			return '';
		else
			return player.lastRoundPick+"<br>"+player.lastRoundPickedBy;
	},
	lastRoundResult: function () {
		var game = getCurrentGame();
		if (!game)
			return null;
		if (game.lastRoundResult)
			return game.lastRoundResult.replace(/\n/g, "<br>");
		else
			return '';
	},
	playersAnswersSubmitted: function () {
		var game = getCurrentGame();
		if (!game)
			return null;
		return getPlayersAnswersSubmitted(game);
	},
	playersAnswersNotSubmitted: function () {
		var game = getCurrentGame();
		if (!game)
			return null;
		var thosePlayers = Players.find({'gameID': game._id, submittedAnswer: null}).fetch();
		if (!thosePlayers || thosePlayers.length == 0) {
			return '0';
		} else {
			var thosePlayersNames = [];
			thosePlayers.forEach(function(thatPlayer){
				thosePlayersNames.push(thatPlayer.name);
			});
			return thosePlayersNames.length + ": " + thosePlayersNames.join(', ');
		}
	},
	playersAnswersChosen: function () {
		var game = getCurrentGame();
		if (!game)
			return null;
		return getPlayersAnswersChosen(game);
	},
	playersAnswersNotChosen: function () {
		var game = getCurrentGame();
		if (!game)
			return null;
		var thosePlayers = Players.find({'gameID': game._id, chosenAnswer: null}).fetch();
		if (!thosePlayers || thosePlayers.length == 0) {
			return '0';
		} else {
			var thosePlayersNames = [];
			thosePlayers.forEach(function(thatPlayer){
				thosePlayersNames.push(thatPlayer.name);
			});
			return thosePlayersNames.length + ": " + thosePlayersNames.join(', ');
		}
	},
	question: function () {
		var game = getCurrentGame();
		if (!game)
			return null;
		if (game.currentQuestion)
			return game.currentQuestion.replace(/\n/g, "<br>");
		else
			return '';
	},
	answers: function () {
		return getAnswers();
	},
	isHost: isHost,
	isAsker: function () {
		var player = getCurrentPlayer();
		if (!player)
			return null;
		return player.isAsker;
	},
	isGamePhase: function (phase) {
		return getGamePhase() == phase;
	},
	isSourcePlayers: function (phase) {
		var game = getCurrentGame();
		if (!game)
			return null;
		return game.questionSource == 'Players';
	},
});

function getAnswers() {
	var game = getCurrentGame();
	if (!game)
		return null;
	return getAnswersFor(game);
}

Template.choiceBox.events({
	'click button#submitQuestion': function () {
		var question = $('#question').val().trim();
		if (!question) {
			showErrorMessage(TAPi18n.__("ui.validation.form.question missing"));
			return false;
		}

		var game = getCurrentGame();
		var player = getCurrentPlayer();
		if (!game || !player)
			return null;

		submitQuestion(question, game, player);
	},
	'click button#submitAnswer': function () {
		var answer = normaliseAnswer($('#answer').val());
		if (!answer) {
			showErrorMessage(TAPi18n.__("ui.validation.form.answer missing"));
			return false;
		}

		var game = getCurrentGame();
		var player = getCurrentPlayer();
		if (!game || !player)
			return null;

		if (isAnswerRepeated(answer, game)) {
			showErrorMessage(TAPi18n.__("ui.validation.form.answer repeated"));
			return false;
		}

		$('div.action').css({"display":"none"});

		submitAnswer(answer, game, player);
	},
	'change #choiceBox input': function () {
		var answer = $("#choiceBox input[type='radio'][name='answerChoice']:checked").val();
		if (answer)
			$('button#chooseAnswer').prop("disabled", false);
		else
			$('button#chooseAnswer').prop("disabled", true);
	},
	'click button#chooseAnswer': function () {
		var game = getCurrentGame();
		var player = getCurrentPlayer();
		if (!game || !player)
			return null;
		var answer = $("#choiceBox input[type='radio'][name='answerChoice']:checked").val();

		if (isAnswerMine(answer, player)) {
			showErrorMessage(TAPi18n.__("ui.validation.form.answer from self"));
			return false;
		}

		$('div.action').css({"display":"none"});
		Players.update(player._id, {$set: {chosenAnswer: answer, updatedAt: new Date()}});
		$('button#chooseAnswer').prop("disabled", true);
		afterChoosingAnswer(game);
	},
	'click button#skipQuestion': function () {
		var game = getCurrentGame();
		if (!game)
			return null;
		moveToNextQuestion(game, true);
	},
});

function reqDoubleClick(event, displayChange) {
	var oldClickCount = parseInt($(event.target).attr('data-clickcount'));
	if (oldClickCount == 0) {
		setTimeout(function() {
			toggleDoubleClickStatus(event, oldClickCount, true, displayChange);
		}, 1000);
	}
	return toggleDoubleClickStatus(event, oldClickCount, false, displayChange);
}

function toggleDoubleClickStatus(event, oldClickCount, isOneWay, displayChange) {
	var newClickCount = 0;
	if (oldClickCount == 0 && !isOneWay) {
		newClickCount = 1;
	}
	$(event.target).attr('data-clickcount', newClickCount);
	if (newClickCount == 1) {
		if (displayChange) {
			//$(event.target).css('background-color', 'red');
			var currText = $(event.target).text();
			$(event.target).text(currText+" - Confirm");
		}
		return false;
	} else {
		if (displayChange) {
			//$(event.target).css('background-color', 'green');
			var currText = $(event.target).text();
			$(event.target).text(currText.replace(" - Confirm", ""));
		}
		return true;
	}
}
/*
function resetAllChoices() {
	var game = getCurrentGame();
	if (!game)
		return null;
	var chosenPlayers = Players.find({'gameID': game._id, chosenAnswer: {$ne: null}}).fetch();
	chosenPlayers.forEach(function(chosenPlayer){
		Players.update(chosenPlayer._id, {$set: {chosenAnswer: null, updatedAt: new Date()}});
	});
	Games.update(game._id, {$set: {lastRoundResult: [], updatedAt: new Date()}});
}
*/
function resetAllGameConditions() {
	var game = getCurrentGame();
	if (!game)
		return null;
	Games.update(game._id, {$set: {
		phase: 'Not yet started',
		currentQuestion: null,
		currentAnswer: null,
		lastRoundResult: null,
		updatedAt: new Date(),
	}});
}

function resetAllPlayerConditions() {
	var game = getCurrentGame();
	if (!game)
		return null;
	var players = Players.find({'gameID': game._id}).fetch();
	players.forEach(function(player){
		Players.update(player._id, {$set: {
			isAsker: false,
			submittedAnswer: null,
			chosenAnswer: null,
			lastRoundPick: "",
			lastRoundPickedBy: "",
			score: 0,
			updatedAt: new Date(),
		}});
	});
}

Template.chat.helpers({
	messages: function () {
		var game = getCurrentGame();
		if (!game) {
			return null;
		}
		var player = getCurrentPlayer();
		if (!player)
			return false;
		var messages = Messages.find({gameID: game._id}, {sort: {createdAt: -1}}).fetch();
		return messages;
	},
	isHost: isHost,
	isGameState: function (state) {
		return getGameState() == state;
	},
});

Template.chat.events({
	'click button#sendmsg': sendChatMsg,
	'keydown #msg': function (event) {
		if (event.keyCode == 13) {
			sendChatMsg();
			return false;
		}
	},
	'click button#toggleChat': function () {
		$('#chat').toggleClass("hidden");
		if ($("#toggleChat").text()==TAPi18n.__("ui.button.game menu.hide chat"))
			$("#toggleChat").text(TAPi18n.__("ui.button.game menu.show chat"));
		else
			$("#toggleChat").text(TAPi18n.__("ui.button.game menu.hide chat"));
	},
});

function sendChatMsg () {
	var msg = $('#msg').val().trim();
	if (!msg)
		return false;
	var game = getCurrentGame();
	if (!game)
		return;
	var player = getCurrentPlayer();
	if (!player)
		return false;
	var displayName = player.name;
	createMessage(msg, player._id, displayName, game._id);
	$('#msg').val('');
}

function createMessage(msg, senderID, displayName, gameID){
	var message = {
		content: msg,
		senderID: senderID,
		sender: displayName,
		gameID: gameID,
		createdAt: new Date()
	};

	//Messages.insert(message);
	Meteor.call('createMessage', message);
}

function showErrorMessage(msg) {
	FlashMessages.sendError(msg);
}

function showInfoMessage(msg) {
	FlashMessages.sendInfo(msg);
}

function clearMessage() {
	FlashMessages.clear();
}

Template.gameMenu.helpers({
	isHost: isHost,
	isGameState: function (state) {
		return getGameState() == state;
	},
});

Template.gameMenu.events({
	'click button#startgame': function () {
		var game = getCurrentGame();
		if (!game)
			return null;
		var players = Players.find({gameID: game._id}).fetch();
		
		Games.update(game._id, {$set: {state: 'inProgress', phase: 'Waiting for question', updatedAt: new Date()}});
		teleGameUpdate(game, TAPi18n.__("telegram.event.game started"));
		getQuestion(game);
	},
	'click button.endgame.ingame': function (event) {
		if (!reqDoubleClick(event, true))
			return false;
		endGame();
	},
	'click button.leavegame.inlobby': leaveGame,
	'click button.leavegame.ingame': function () {
		var player = getCurrentPlayer();
		var game = getCurrentGame();
		if (player && player.state != 0 && game && game.state == "inProgress") {
			var choice = confirm(TAPi18n.__("ui.dialog.player leave game"));
			if (choice == false)
				return false;
		}
		leaveGame();
	},
	'click button.preparegame.ingame': function () {
		var game = getCurrentGame();
		if (!game)
			return null;
		Games.update(game._id, {$set: {state: 'waitingForPlayers', hidePlayerList: false, updatedAt: new Date()}});
		resetAllGameConditions();
		resetAllPlayerConditions();
	},
});

function endGame() {
	var game = getCurrentGame();
	if (!game)
		return null;
	Games.update(game._id, {$set: {state: 'over', updatedAt: new Date()}});
	generateNewResult(game);
	teleGameUpdate(game, TAPi18n.__("telegram.event.game ended"));
}

function generateNewResult(game){
	var numPlayers = Players.find({gameID: game._id}).count();
	var result = {
		started: game.createdAt,
		ended: new Date(),
		numPlayers: numPlayers
	};

	Results.insert(result);
}

setTimeout(function() {
	Tracker.autorun(maintainIntegrityPlayer);
}, 000);

Tracker.autorun(autoSubscribe);

function autoSubscribe () {
	var gameID = Session.get("gameID");
	Meteor.subscribe("games", gameID);
	Meteor.subscribe("players", gameID);
	Meteor.subscribe("messages", gameID);
}
/*
function maintainIntegrityGame () {
	var gameID = Session.get("gameID");
	var playerID = Session.get("playerID");

	if (!gameID || !playerID) {
		return false;
	}

	var game = Games.findOne(gameID);
	if (!game) {
		kickSelfOutOfGame(gameID, playerID);
	}
}
*/
function maintainIntegrityPlayer () {
	var gameID = Session.get("gameID");
	var playerID = Session.get("playerID");

	if (!gameID || !playerID) {
		return;
	}

	var player = Players.findOne(playerID);
	//need the above to trigger the running of the following when necessary
	//need the following before taking action because client cannot query players directly in some cases

	Meteor.call('findPlayer', playerID, function(error, result) {
		if (error) {
			kickSelfOutOfGame(gameID, playerID);
			showErrorMessage(TAPi18n.__("ui.server connect error"));
		} else {
			var player = result;
			if (!player) {
				kickSelfOutOfGame(gameID, playerID);
			}
		}
	});
}

function kickSelfOutOfGame(gameID, playerID) {
	Session.set("gameID", null);
	Session.set("playerID", null);
	Session.set("BKgameID", gameID);
	Session.set("BKplayerID", playerID);
	Session.set("currentView", "startMenu");
}

function getGameState() {
	var game = Games.findOne(Session.get("gameID"), {fields: {'state': 1}});
	if (!game)
		return null;
	else
		return game.state;
}

function getGamePhase() {
	var game = Games.findOne(Session.get("gameID"), {fields: {'phase': 1}});
	if (!game)
		return null;
	else
		return game.phase;
}

Template.ruleBox.events({
	'click button#toggleIntro': function () {
		/*
		$('#ruleContent').hide();
		$('#guideContent').hide();
		*/
		$('#introContent').toggle();
	},
	/*
	'click button#toggleRules': function () {
		$('#introContent').hide();
		$('#guideContent').hide();
		$('#ruleContent').toggle();
	},
	'click button#toggleGuide': function () {
		$('#introContent').hide();
		$('#ruleContent').hide();
		$('#guideContent').toggle();
	},
	*/
});

Template.footer.helpers({
	versionNo: function () {
		return VERSION_NUMBER;
	}
});

Template.footer.events({
	'click #usurp': function (event) {
		if (!reqDoubleClick(event, false))
			return false;

		if ($('#accessCode').val())
			var usurpCode = $('#accessCode').val().trim().toLowerCase();
		else
			var usurpCode = '';
		if (usurpCode == '')
			usurpCode = Session.get("usurpCode");
		
		Meteor.call('findGame', {usurpCode: usurpCode}, function(error, result) {
			if (error) {
				showErrorMessage(TAPi18n.__("ui.server connect error"));
			} else {
				var game = result;
				if (!game)
					return false;

				if (Session.get("currentView") == "lobby") {
					if (Session.get("gameID") != game._id)
						return false;

					var player = getCurrentPlayer();
					if (!player)
						return false;

					var oldHost = Players.findOne({gameID: game._id, isHost: true});
					Players.update(oldHost._id, {$set: {isHost: false}});

					Players.update(player._id, {$set: {isHost: true}});
				} else {
					/*
					//for now, just usurp from within
					var playerName = $('#playerName').val().trim();
					if (!playerName) {
						return false;
					}

					var oldHost = Players.findOne({gameID: game._id, isHost: true});
					Players.update(oldHost._id, {$set: {isHost: false}});

					var player = generateNewHostPlayer(game, playerName);

					Session.set("playerName", playerName);
					Session.set("accessCode", game.accessCode);
					Session.set("playerAccessCode", player.accessCode);
					Session.set("usurpCode", game.usurpCode);
					Session.set("gameID", game._id);
					Session.set("playerID", player._id);
					Session.set("currentView", "lobby");
					*/
				}
			}
		});
	},
});

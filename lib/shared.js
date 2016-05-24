this.getPlayersAnswersSubmitted = function (game) {
	var thosePlayers = Players.find({'gameID': game._id, submittedAnswer: {$ne: null}}).fetch();
	if (!thosePlayers || thosePlayers.length == 0) {
		return '0';
	} else {
		var thosePlayersNames = [];
		thosePlayers.forEach(function(thatPlayer){
			thosePlayersNames.push(thatPlayer.name);
		});
		return thosePlayersNames.length + ": " + thosePlayersNames.join(', ');
	}
}

this.getPlayersAnswersChosen = function (game) {
	var thosePlayers = Players.find({'gameID': game._id, chosenAnswer: {$ne: null}}).fetch();
	if (!thosePlayers || thosePlayers.length == 0) {
		return '0';
	} else {
		var thosePlayersNames = [];
		thosePlayers.forEach(function(thatPlayer){
			thosePlayersNames.push(thatPlayer.name);
		});
		return thosePlayersNames.length + ": " + thosePlayersNames.join(', ');
	}
}

this.getQuestion = function (game) {
	if (game.questionSource == 'Poetry') {
		Meteor.call('getPoem', function(error, result) {
			if (error) {
				//showErrorMessage(TAPi18n.__("ui.server connect error"));
			} else {
				var question = result[0];
				var answer = result[1];
				if (question && answer)
					submitQuestionAndAnswer(question, answer, game);
			}
		});
	}
}

this.submitQuestionAndAnswer = function (question, answer, game) {
	Games.update(game._id, {$set: {currentQuestion: question, currentAnswer: answer, phase: 'Waiting for answers', updatedAt: new Date()}});

	teleGameUpdate(game, "New Question: \n"+question);
}

this.submitQuestion = function (question, game, player) {
	Players.update(player._id, {$set: {isAsker: true, updatedAt: new Date()}});
	Games.update(game._id, {$set: {currentQuestion: question, phase: 'Waiting for answers', updatedAt: new Date()}});

	teleGameUpdate(game, "New Question: \n"+question);
}

this.normaliseAnswer = function (answer) {
	return answer.trim().toLowerCase();
}

this.getRandom = function (length) {
	//return Math.floor(Math.random() * length);
	return Math.floor(Random.fraction() * length);
}

this.shuffleArray = function (array) {
	for (var i = array.length - 1; i > 0; i--) {
		//var j = Math.floor(Math.random() * (i + 1));
		var j = Math.floor(Random.fraction() * (i + 1));
		var temp = array[i];
		array[i] = array[j];
		array[j] = temp;
	}
	return array;
}

this.getAnswersFor = function (game) {
	var answers = [];
	var players = Players.find({'gameID': game._id, submittedAnswer: {$ne: null}}).fetch();
	if (!players || players.length == 0) {
		return '0';
	} else {
		players.forEach(function(thatPlayer){
			answers.push(thatPlayer.submittedAnswer);
		});
	}
	if (game.questionSource != 'Players') {
		answers.unshift(game.currentAnswer);
	}
	answers = shuffleArray(answers);
	return answers;
}

this.isAnswerRepeated = function (answer, game) {
	var currentAnswers = getAnswersFor(game);
	var tooSimilar = false;
	for (var i = 0; i < currentAnswers.length; i++) {
		var thisAnswer = currentAnswers[i];
		if (thisAnswer.replace(/\W/g, "") == answer.replace(/\W/g, "")) {
			tooSimilar = true;
			break;
		}
	}
	return tooSimilar;
}

this.isAnswerMine = function (answer, player) {
	return player.submittedAnswer == answer;
}

this.submitAnswer = function (answer, game, player) {
	Players.update(player._id, {$set: {submittedAnswer: answer, updatedAt: new Date()}});

	if (player.isAsker) {
		Games.update(game._id, {$set: {currentAnswer: answer, updatedAt: new Date()}});
	}

	var laggyPlayers = Players.find({'gameID': game._id, submittedAnswer: null}).count();
	if (laggyPlayers == 0) {
		Games.update(game._id, {$set: {phase: 'Waiting for answers to be chosen', updatedAt: new Date()}});

		var players = Players.find({'gameID': game._id}).fetch();
		players.forEach(function(thisPlayer){
			telePlayerKeyboardUpdate(thisPlayer, "All answers submitted, please choose one:", getAnswersFor(game));
		});
	}
}

this.afterChoosingAnswer = function (game) {
	var laggyPlayers = Players.find({'gameID': game._id, chosenAnswer: null}).count();
	if (laggyPlayers == 0) {
		var lastRoundResult = getLastRoundResult(game);
		game.lastRoundResult = lastRoundResult; //important because you need to pass it to next function
		Games.update(game._id, {$set: {lastRoundResult: lastRoundResult, updatedAt: new Date()}});

		moveToNextQuestion(game, false);
	}
}

this.moveToNextQuestion = function (game, isSkipped) {
	Games.update(game._id, {$set: {phase: 'Waiting for question', updatedAt: new Date()}});

	var players = Players.find({'gameID': game._id}).fetch();
	players.forEach(function(thisPlayer){
		Players.update(thisPlayer._id, {$set: {
			isAsker: false,
			submittedAnswer: null,
			chosenAnswer: null,
			updatedAt: new Date()
		}});
		if (isSkipped)
			telePlayerUpdate(thisPlayer, "Question skipped. Now waiting for next question...");
		else
			telePlayerUpdate(thisPlayer, thisPlayer.lastRoundPick+"\n"+thisPlayer.lastRoundPickedBy+"\n\nLast round results:\n"+game.lastRoundResult+"\n\nNow waiting for next question...");
	});

	getQuestion(game);
}

function checkPsychedList(game, player, text, answers) {
	if (player != null)
		var answer = player.submittedAnswer;
	else
		var answer = game.currentAnswer;
	var psychedPlayers = Players.find({'gameID': game._id, 'chosenAnswer': answer}).fetch();
	var psychedPlayersList = [];
	psychedPlayers.forEach(function(psychedPlayer){
		psychedPlayersList.push(psychedPlayer.name);
	});
	var psychedPlayersCount = psychedPlayersList.length;
	if (psychedPlayersCount == 1)
		var textPeople = '1 person';
	else
		var textPeople = psychedPlayersCount.toString()+' people';
	var textPeopleNames = '';
	if (psychedPlayersCount > 0) {
		textPeopleNames = ' (' + psychedPlayersList.join(', ') + ')';
		answers[answer] = psychedPlayersList;
	}
	var verb = 'scammed';
	if (game.questionSource == 'Players')
		verb = 'convinced';
	if (player != null)
		text += player.name + ' ' + verb + ' ' + textPeople + textPeopleNames + ' with "' + answer + '"\n';
	else
		text += textPeople + textPeopleNames + ' got the correct answer "' + answer + '"\n';
	return [text, answers];
}

function getLastRoundResult (game) {
	//ensure this runs only once as it does scoring too

	var players = Players.find({'gameID': game._id}).fetch();
	var text = '';
	var answers = {};

	var verb = 'scammed';
	if (game.questionSource == 'Players')
		verb = 'convinced';
	
	if (game.questionSource != 'Players') {
		var returned = checkPsychedList(game, null, text, answers);
		text = returned[0];
		answers = returned[1];
	}
	
	players.forEach(function(player){
		var returned = checkPsychedList(game, player, text, answers);
		text = returned[0];
		answers = returned[1];
		var psychedPlayers = answers[player.submittedAnswer];
		if (psychedPlayers == null)
			psychedPlayers = [];

		//giving points for being chosen
		var score = player.score;
		score += psychedPlayers.length;
		player.score = score; //necessary because score is updated again later
		if (psychedPlayers.length == 0)
			var lastRoundPickedBy = "You "+verb+" no one!";
		else
			var lastRoundPickedBy = "You "+verb+" "+psychedPlayers.join(', ')+"!";
		Players.update(player._id, {$set: {score: score, lastRoundPickedBy: lastRoundPickedBy, updatedAt: new Date()}});
	});

	//finding best answers
	if (game.scoringType == 'Correct') {
		var bestAnswers = [game.currentAnswer];
	} else if (game.scoringType == 'Popular') {
		var keys = Object.keys(answers);
		var mostVoted = keys.reduce(function(previousValue, currentValue){
			return answers[previousValue].length > answers[currentValue].length ? previousValue : currentValue;
		});
		var bestAnswers = keys.filter(function(currentValue){
			return answers[currentValue].length == answers[mostVoted].length;
		});
	} else if (game.scoringType == 'Rare') {
		var keys = Object.keys(answers);
		var leastVoted = keys.reduce(function(previousValue, currentValue){
			return answers[previousValue].length < answers[currentValue].length ? previousValue : currentValue;
		});
		var bestAnswers = keys.filter(function(currentValue){
			return answers[currentValue].length == answers[leastVoted].length;
		});
	}
	if (game.scoringType == 'Correct')
		var bestAnswerText = "Correct answer";
	else
		var bestAnswerText = "Best answer(s)";
	text += '\n '+bestAnswerText+': "' + bestAnswers.join('", "')+ '"';

	//giving points for choosing best answer
	players.forEach(function(player){
		var score = player.score;
		var lastRoundPick = "";

		var byName = "";
		var answerer = Players.find({'gameID': game._id, submittedAnswer: player.chosenAnswer}).fetch();
		if (answerer && answerer.length)
			byName = " by "+answerer[0].name;

		//if ($.inArray(player.chosenAnswer, bestAnswers) >= 0) {
		if (bestAnswers.indexOf(player.chosenAnswer) > -1) {
			score += 2;
			if (game.scoringType == 'Correct')
				lastRoundPick = "You picked the correct answer"+byName+"!";
			else
				lastRoundPick = "You picked the best answer"+byName+"!";
		} else {
			lastRoundPick = "You were "+verb+byName+"!";
		}
		Players.update(player._id, {$set: {score: score, lastRoundPick: lastRoundPick, updatedAt: new Date()}});
	});

	return text;
}

this.teleGameUpdate = function (game, text) {
	if (!game)
		game = getCurrentGame()
	if (!game)
		return;
	/*
	var chatID = game.telegram;
	if (chatID)
		return Meteor.call('messageFromWeb', chatID, text);
	*/
	var players = Players.find({'gameID': game._id}).fetch();
	players.forEach(function(thisPlayer){
		telePlayerUpdate(thisPlayer, text);
	});
};

this.telePlayerUpdate = function (player, text) {
	if (!player)
		player = getCurrentPlayer()
	if (!player)
		return;
	var chatID = player.telegram;
	if (chatID)
		return Meteor.call('messageFromWeb', chatID, text);
};

this.telePlayerKeyboardUpdate = function (player, text, array) {
	if (!player)
		player = getCurrentPlayer()
	if (!player)
		return;
	var chatID = player.telegram;
	if (chatID)
		return Meteor.call('messageKeyboardFromWeb', chatID, text, array);
};

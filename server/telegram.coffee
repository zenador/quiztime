linkPlayer = (c, u, o) ->
	if o.chat.type != "private"
		TelegramBot.send('Sorry, you can only link to players from a private chat with the bot', o.chat.id)
		return
	player = Players.findOne({telegram: o.chat.id})
	if player
		TelegramBot.send('You are already connected to a player, please /unlink first', o.chat.id)
		return
	if c.length < 4
		TelegramBot.send('Please put your player access code from the web app after /link', o.chat.id)
		return
	accessCode = c[1] + " " + c[2] + " " + c[3]
	accessCode = accessCode.trim().toLowerCase()
	player = Players.findOne({accessCode: accessCode})
	if player
		if player.telegram
			TelegramBot.send('You have been disconnected from your player', player.telegram)
		Players.update player._id, $set: telegram: o.chat.id, updatedAt: new Date
		TelegramBot.send('Joined as player '+player.name+'!', o.chat.id)
		game = Games.findOne(player.gameID)
		if game
			TelegramBot.send('Game state: '+game.state+'\nGame phase: '+game.phase, o.chat.id)
	else
		TelegramBot.send('Could not find player', o.chat.id)
		return

Meteor.startup ->
	TelegramBot.token = TELEGRAM_TOKEN
	TelegramBot.start()
	TelegramBot.addListener '/start', (c, u, o) ->
		'Welcome! Please type /help if you don\'t know how to use this bot'
	TelegramBot.addListener '/link', (c, u, o) ->
		linkPlayer(c, u, o)
		false
	TelegramBot.addListener '/unlink', (c, u, o) ->
		player = Players.findOne({telegram: o.chat.id})
		if !player
			return 'You are not linked to a player anyway'
		Players.update player._id, $set: telegram: null
		'Unlinked from player!'
	TelegramBot.addListener '/ask', (c, u, o) ->
		if c.length < 2
			return 'Please put your question after the command'
		player = Players.findOne({telegram: o.chat.id})
		if !player
			return 'Sorry, you are not linked to a player'
		game = Games.findOne(player.gameID)
		if !game
			return 'Sorry, your player is not in a game'
		if game.phase != 'Waiting for question'
			return 'Sorry, it\'s not time to ask a question yet'

		question = c[1..].join(' ')
		question = question.trim()

		TelegramBot.send('You have successfully submitted your question', o.chat.id)
		submitQuestion(question, game, player);
		return false
	TelegramBot.addListener '/answer', (c, u, o) ->
		if c.length < 2
			return 'Please put your answer after the command'
		player = Players.findOne({telegram: o.chat.id})
		if !player
			return 'Sorry, you are not linked to a player'
		game = Games.findOne(player.gameID)
		if !game
			return 'Sorry, your player is not in a game'
		if game.phase != 'Waiting for answers'
			return 'Sorry, it\'s not time to answer the question yet'

		answer = c[1..].join(' ')
		answer = normaliseAnswer(answer)

		if isAnswerRepeated(answer, game)
			return "Please change your answer, it's too similar to an already submitted answer"

		TelegramBot.send('You have successfully submitted your answer', o.chat.id)
		submitAnswer(answer, game, player);
		return false
	TelegramBot.addListener '/c', (c, u, o) ->
		if c.length < 2
			return 'Please put your choice after the command'
		player = Players.findOne({telegram: o.chat.id})
		if !player
			return 'Sorry, you are not linked to a player'
		game = Games.findOne(player.gameID)
		if !game
			return 'Sorry, your player is not in a game'
		if game.phase != 'Waiting for answers to be chosen'
			return 'Sorry, it\'s not time to choose answers yet'

		chosenAnswer = c[1..].join(' ')
		answers = getAnswersFor(game)
		index = answers.indexOf(chosenAnswer)
		if index == -1
			return 'Sorry, that\'s not a valid answer choice'

		if isAnswerMine(chosenAnswer, player)
			return "Don't pick your own answer"

		Players.update(player._id, {$set: {chosenAnswer: chosenAnswer, updatedAt: new Date()}});
		TelegramBot.send('You have successfully chosen an answer', o.chat.id)
		#TelegramBot.send("Who has voted so far:\n"+getPlayersAnswersChosen(game), game.telegram)
		afterChoosingAnswer(game)
		return false
	TelegramBot.addListener '/skip', (c, u, o) ->
		player = Players.findOne({telegram: o.chat.id})
		if !player
			return 'Sorry, you are not linked to a player'
		game = Games.findOne(player.gameID)
		if !game
			return 'Sorry, your player is not in a game'
		if game.phase == 'Waiting for question'
			return 'Sorry, there is no question to skip yet'
		if !player.isHost
			return 'Sorry, only the host may skip questions'

		TelegramBot.send('You have successfully skipped the question', o.chat.id)
		moveToNextQuestion(game, true)
		return false
	TelegramBot.addListener '/web', (c, u, o) ->
		url = WEB_URL
		player = Players.findOne({telegram: o.chat.id})
		if player
			return url+"player/"+player.accessCode.replace(/ /g, "%20")
		else
			return url
	TelegramBot.addListener '/help', (c, u, o) ->
		"For this to work optimally, please link your private chat with the bot to your web player with /link. Telegram doesn't provide a way for bots and users to privately exchange messages within a group chat. \n\n

		/link aaa bbb ccc \n
		Replace access code with the one for your player on the web app to link this chat to that player \n\n

		/unlink \n
		Unlink this chat from the current player \n\n

		/ask What? \n
		Submit a question for everyone to answer during the question-asking phase \n\n

		/answer This \n
		Submit your answer to the question during the answering phase \n\n

		/skip \n
		Skip the current question if you are the game host \n\n

		/web \n
		Get link to web app \n\n
		"
	return

chunkArray = (array, chunkSize) ->
	[].concat.apply [], array.map((elem, i) ->
		if i % chunkSize then [] else [ array.slice(i, i + chunkSize) ]
	)
	
makeKeyboard = (kb) ->
	JSON.stringify keyboard: kb, one_time_keyboard: true

@messageFromWeb = (chatID, text) ->
	TelegramBot.method 'sendMessage',
		chat_id: chatID
		text: cleanMsg(text)

@messageKeyboardFromWeb = (chatID, text, array) ->
	array = array.map((item, index) ->
		"/c "+item
	)
	kb = chunkArray(array, 1)
	TelegramBot.method 'sendMessage',
		chat_id: chatID
		text: cleanMsg(text)
		reply_markup: makeKeyboard(kb)

createLog = (gameID, msg) ->
	log = 
		content: msg
		gameID: gameID
		createdAt: new Date
	Logs.insert log
	return

cleanMsg = (msg) ->
	return String(msg).replace(/<br>/gi, '\n').replace(/&#44;/g, ',')

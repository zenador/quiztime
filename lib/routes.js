Router.route('/', function () {
	this.render('main');
	if (!Session.get("currentView")) {
		Session.set("currentView", "startMenu");
	}
	GAnalytics.pageview("main");
});

Router.route('/game/:accessCode', function () {
	this.render('main');
	if (!Session.get("gameID")) {
		Session.set("currentView", "startMenu");
		var accessCode = this.params.accessCode.trim().toLowerCase();
		Session.set("prefillAccessCode", accessCode);
	}
	//window.history.pushState({}, null, "/");
	window.history.replaceState({}, null, "/");
	GAnalytics.pageview("code-game");
});

Router.route('/player/:accessCode', function () {
	this.render('main');
	if (!Session.get("gameID")) {
		Session.set("currentView", "startMenu");
		var accessCode = this.params.accessCode.trim().toLowerCase();
		Session.set("prefillPlayerAccessCode", accessCode);
	}
	//window.history.pushState({}, null, "/");
	window.history.replaceState({}, null, "/");
	GAnalytics.pageview("code-player");
});

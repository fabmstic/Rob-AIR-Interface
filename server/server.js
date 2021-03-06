var fs = require('fs'),
    express = require('express'),
    https = require('https'),
    http = require('http'),
    url = require ('url');
var mysql = require('mysql');
var cookieParser = require('cookie-parser'),
    session = require('express-session');

var os = require('os');
var ifaces = os.networkInterfaces();
var ipwlan = "127.0.0.1";

Object.keys(ifaces).forEach(function (ifname) {
    var alias = 0
            ;

    ifaces[ifname].forEach(function (iface) {
        if ('IPv4' !== iface.family || iface.internal !== false) {
            // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
            return;
        }

        if (alias >= 1) {
            // this single interface has multiple ipv4 addresses
            console.log(ifname + ':' + alias, iface.address);
        } else {
            if (ifname.indexOf("wlan") !== -1){
                ipwlan = iface.address;
            }
            // this interface has only one ipv4 adress
            console.log(ifname, iface.address);
        }
    });
});



var hskey = fs.readFileSync('hacksparrow-key.pem');
var hscert = fs.readFileSync('hacksparrow-cert.pem');

var options = {
    key: hskey,
    cert: hscert
};

var app = new express();
var port = '8087';

var data = fs.readFileSync("config.json");
var json = JSON.parse(data);

json.IP_Locale = ipwlan ;
json.signal.webrtc = "http://" + json.IP_Public + ":8088";
json.signal.ros = "ws://" + json.IP_Public + ":9090";
fs.writeFile("config.json", JSON.stringify(json));

var isConnected = {}; //mapping each user to a boolean (connected/not connected)
var roomToUsers = {}; //mapping each room to its authenticated users
var userToRooms = {}; //mapping each authenticated user to its rooms
var listeOfUsers;
var connection = mysql.createConnection({
    host: 'localhost',
    user: json.mysql.user,
    password: json.mysql.password
});

//map the EJS template engine to ".html" files
app.engine('html', require('ejs').renderFile);

connection.connect(function (err) {
    if (err) {
        console.error(err.stack);
        return;
    }
});

connection.query('USE fablab', function (err, rows, field) {
    if (err) throw err;
});

//initializing the isConnected hash table
listOfUsers = connection.query('SELECT login FROM users');
listOfUsers.on('error', function (err) {
    console.log(err.stack);
    throw err;
});
console.log("checking the existing users");
console.log("initializing the isConnected hash table");
listOfUsers.on('result', function (row) {
    console.log(row.login + " not connected");
    isConnected[row.login] = false;
    userToRooms[row.login] = [];
});

app.use(express.static(__dirname));
app.use(require('body-parser')());

/* Init for Session */
app.use(cookieParser());
app.use(session({
    secret: '12545riezejkzekzekezjk8',
    key: '212245sssde',
    cookie: {
        secure: false
    }
}));


var print = function (structure) {
        for (var key in structure) {
            if (structure.hasOwnProperty(key)) {
                console.log(key + " : ");
                for (var i = 0; i < structure[key].length; i++) {
                    console.log(structure[key][i]);
                }
            }
        }
    }
    /**
     * Fonction pour afficher une vue en utilisant le layout layout.html
     * @param req, res: les mêmes que pour "apt.get(..., function(req, res){...})"
     * @param contentFile: nom du fichier de la vue
     * @param data: objet de données qui sont utilisées dans le fichier de vue
     */
var printPageWithLayout = function (req, res, contentFile, data) {
    if (typeof (data) == 'undefined') {
        data = {};
    }
    // Ajout des données de session dans data
    data.session = req.session;
    console.log("New layout: " + contentFile);

    //print(userToRooms);
    //print(roomToUsers);
    // Premier rendu: res.render(contentFile) créée la page html contentFile 
	// puis appel la fonction de callback avec la contenu dans la paramète "html"
    res.render(contentFile, data, function (err, html) {
        console.log(err);
        if (err) {
            res.redirect('/404');
        } else {
            // Second rendu: page principale càd la layout + html dans balide jsp "content"

	    if (req.session.isLogged) {

console.log('XXXXXXXXXXXXX');
console.log('XXXXXXXXXXXXX');
console.log('CONNECTED');
console.log('XXXXXXXXXXXXX');
console.log('XXXXXXXXXXXXX');

console.log('user : ' + req.session.name);

		var user = req.session.name;
		var user_type = req.session.userType;
		
		console.log('user_type='+user_type);
			var html_file;
			if (user_type=='user'){
console.log('user_type is USER');
				html_file = 'layout_user.html';
			}else if (user_type=='robot'){
console.log('user_type is ROBOT');
				html_file = 'layout_robot.html';
			}

			res.render(html_file, {
				content: html
		    });

	    } else {
console.log('XXXXXXXXXXXXX');
console.log('XXXXXXXXXXXXX');
console.log('NOT CONNECTED');
console.log('XXXXXXXXXXXXX');
console.log('XXXXXXXXXXXXX');
		    res.render('layout.html', {
		    	content: html,
		    });
	    };
	    // Second rendu END

        };
    });
};

/**
 * Home
 */
app.get('/', function (req, res) {
    if (req.session.isLogged) {
        console.log('Connecte');
        var user_type = req.session.userType;
        if (user_type === 'user') {
            printPageWithLayout(req, res, 'index.html');
        } else if (user_type === 'robot') {
            var conf = {};
            var data = fs.readFileSync("config.json");
            conf = JSON.parse(data);
            printPageWithLayout(req, res, 'index_robot.html', conf);

        }
    } else {
        console.log('Pas connecte');
	printPageWithLayout(req, res, 'login.html');
    };
    
});

app.post('/rob', function (req, res) {
    var conf = {};
    var data = fs.readFileSync("config.json");
    conf = JSON.parse(data);
    conf.IP_Public = req.body.IP_Public ;
    conf.signal.webrtc = "http://" + req.body.IP_Public + ":8088";
    conf.signal.ros = "ws://" + req.body.IP_Public + ":9090";
    fs.writeFile("config.json", JSON.stringify(conf));
    res.redirect('/');
});


/**
 * Pour les rooms
 */
app.get('/room/:name', function (req, res) {
    var roomName = req.params.name;
    var userName = req.session.name;
    var isLogged = req.session.isLogged;
    if (isLogged) {
        //dynamically checking initializing the room index
        if (typeof roomToUsers[roomName] === 'undefined') {
            roomToUsers[roomName] = [];
        }
        if (typeof userToRooms[userName] === 'undefined') {
            userToRooms[userName] = [];
        }
        //adding this user to the list of users connected to this room
        roomToUsers[roomName].push(userName);
        //adding this room to the list of rooms where this user is connected
        userToRooms[userName].push(roomName);

        var data = {
            room: roomName
        }
		
		//if it's the user --> go to room_user.htm (video chat + remote controls)
		//else if robot --> go to room_robot.html (only the video chat) 
		if (req.session.userType == 'user') {
			printPageWithLayout(req, res, 'room_user.html', data);
		} else {
			printPageWithLayout(req, res, 'room_robot.html', data);
		}
    } else {
        res.redirect('/login')
    }

});


/**
 * Profil utilisateur
 */
app.get('/profil', function (req, res) {
    if (req.session.isLogged) {
        console.log(session);
        var data = {
            name: req.session.name,
            mail: req.session.mail,
            fablab: req.session.fablab,
            adresse: req.session.adresse,
            ville: req.session.ville,
            cp: req.session.cp,
            lat: req.session.lat,
            log: req.session.log
        };
        printPageWithLayout(req, res, 'profil.html', data);
    } else {
        res.redirect('/login');
    };
});

/**
 * Permet l'affichage des utilisateurs connectés
 */
app.get('/users', function (req, res) {
    var data = {
        isConnected: isConnected
    };
    printPageWithLayout(req, res, 'liste_users.html', data);
});

/**
 * Permet l'affichage des differentes rooms
 * et des utilisateurs qui s'y trouvent
 */
app.get('/rooms', function (req, res) {
    var data = {
        roomToUsers: roomToUsers,
        userToRooms: userToRooms
    };
    printPageWithLayout(req, res, 'list_rooms.html', data);
});

/**
 * Profil d'un autre utilisateur
 */
app.get('/profil/:user', function (req, res) {
    if (req.session.isLogged) {
        var user = req.params.user;
        var data;
        var q = connection.query('SELECT * FROM users,fablab WHERE login= "' + 
                                 user + '" AND fablab.nom = users.fablab');
        q
            .on('error', function (err) {
                // TODO: afficher erreur
            })
            .on('result', function (row, index) {
                data = {
                    name: user,
                    mail: row.mail,
                    fablab: row.fablab,
                    adresse: row.adresse,
                    ville: row.ville,
                    cp: row.cp,
                    lat: row.latitude,
                    log: row.longitude
                };
                // printPageWithLayout(req, res, 'profil.html');
                // res.render('profil.html',{session:profil});
            })
            .on('end', function () {
                printPageWithLayout(req, res, 'profil.html', data);
            });
    } else {
        res.redirect('/');
    };
});

/**
 * Page de login
 */
app.get('/login', function (req, res) {
    if (req.session.isLogged) {
        console.log('Deja connecte');
        res.redirect('/');
    } else {
        console.log('Pas encore connecte');
        printPageWithLayout(req, res, 'login.html', data);
     }
});


/**
 * Cas pour traiter les autres pages
 */
app.get('/about', function (req, res) {
    printPageWithLayout(req, res, 'about.html');
});

/**
 * Cas pour traiter la deconnexion d'une room
 */
app.get('/leaving_room/:room', function (req, res) {
    if (req.session.name) {
        if (req.params.room) {
            console.log("server removing the link between the user and the room");
            //print(roomToUsers);
            var roomName = req.params.room;
            var login = req.session.name;
            console.log(login + " is leaving " + roomName);
            var index = roomToUsers[roomName].indexOf(login);
            roomToUsers[roomName].splice(index, 1);
            print(roomToUsers);
         }
    }
});

/**
 * Les autres formats doivent conduire à une erreur
 */
/*app.get('/*', function(req, res) {
  res.redirect('/404');
  });
 */

/*
 * Fonction de tratitement du login sur la page /login.html 
 */
app.post('/login/log', function (req, res) {

    console.log('Connexion de : ' + req.body.login + ' ');
    console.log('avec le mot de passe : ' + req.body.password + ' ');
    var login = req.body.login;
    var mail;
    var val;

    var query = connection.query('SELECT user_type, COUNT(*) AS res from users WHERE login= "' +
        req.body.login + '" AND pw="' + req.body.password + '"');

    query.on('error', function (err) {
        console.log(err.stack);
        throw err;
    });
    query.on('result', function (row, index) {
        val = row.res;

        if (val == 1) {
            var sess = req.session;
            sess.isLogged = true;
            sess.name = login;
			sess.userType = row.user_type;
            console.log("connexion correctly done for " + login);
            isConnected[login] = true;
	    
			res.redirect('/');

        } else {
            //res.render('login.html');
	    res.redirect('/');
        }
    });

    //debug function
    //printing who's connected
    query.on('end', function () {
        console.log('isConnected');
        for (var key in isConnected) {
            if (isConnected.hasOwnProperty(key)) {
                console.log(key + ' : ' + (isConnected[key] ? 'connected' : 'not connected'));
            }
        }

    });
});
/**
 * Pour les erreurs 404
 */
app.use(function(req, res, next){
    res.setHeader('Content-Type', 'text/plain');
    var page = url.parse(req.url).pathname;
   res.send(404, 'Page introuvable!');
});

http.createServer(app).listen(port);
https.createServer(options, app).listen(8086);
console.log('running on http://localhost:' + port);

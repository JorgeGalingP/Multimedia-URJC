// declaración de todas las variables del juego
var b2Vec2 = Box2D.Common.Math.b2Vec2;
var b2BodyDef = Box2D.Dynamics.b2BodyDef;
var b2Body = Box2D.Dynamics.b2Body;
var b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
var b2Fixture = Box2D.Dynamics.b2Fixture;
var b2World = Box2D.Dynamics.b2World;
var b2PolygonShape = Box2D.Collision.Shapes.b2PolygonShape;
var b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
var b2DebugDraw = Box2D.Dynamics.b2DebugDraw;

// comprobar el navegador en donde se ejecuta el juego
(function () {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
        window.cancelAnimationFrame =
            window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function (callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function () {
                    callback(currTime + timeToCall);
                },
                timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function (id) {
            clearTimeout(id);
        };
}());

// load inicializa el juego
$(window).load(function () {
    game.init();
});

var game = {
    // inicializamos todos los componentes
    init: function () {
        // Initialize objects
        levels.init();
        loader.init();
        mouse.init();

        // cargamos los sonidos al juego
        game.backgroundMusic = loader.loadSound('audio/gurdonark-kindergarten');

        game.slingshotReleasedSound = loader.loadSound("audio/released");
        game.bounceSound = loader.loadSound('audio/bounce');
        game.breakSound = {
            "glass": loader.loadSound('audio/glassbreak'),
            "wood": loader.loadSound('audio/woodbreak')
        };


        // sólo mostramos la pantalla de start y escondemos las demás
        $('.gamelayer').hide();
        $('#gamestartscreen').show();

        // ponemos el gamecanvas y el contexto del juego a 2d
        game.canvas = document.getElementById('gamecanvas');
        game.context = game.canvas.getContext('2d');
    },
    startBackgroundMusic: function () {
        var toggleImage = $("#togglemusic")[0];
        game.backgroundMusic.play();
        toggleImage.src = "images/icons/sound.png";
    },
    stopBackgroundMusic: function () {
        var toggleImage = $("#togglemusic")[0];
        toggleImage.src = "images/icons/nosound.png";
        game.backgroundMusic.pause();
        game.backgroundMusic.currentTime = 0;
    },
    toggleBackgroundMusic: function () {
        var toggleImage = $("#togglemusic")[0];
        if (game.backgroundMusic.paused) {
            game.backgroundMusic.play();
            toggleImage.src = "images/icons/sound.png";
        } else {
            game.backgroundMusic.pause();
            $("#togglemusic")[0].src = "images/icons/nosound.png";
        }
    },
    showLevelScreen: function () {
        $('.gamelayer').hide();
        $('#levelselectscreen').show('slow');
    },
    restartLevel: function () {
        window.cancelAnimationFrame(game.animationFrame);
        game.lastUpdateTime = undefined;
        levels.load(game.currentLevel.number);
    },
    startNextLevel: function () {
        window.cancelAnimationFrame(game.animationFrame);
        game.lastUpdateTime = undefined;
        levels.load(game.currentLevel.number + 1);
    },
    // modo intro del juego
    mode: "intro",

    // cordenadas del tirachinas
    slingshotX: 180,
    slingshotY: 280,
    start: function () {
        $('.gamelayer').hide();
        // mostramos el gamecanvas y la puntuación
        $('#gamecanvas').show();
        $('#scorescreen').show();

        game.startBackgroundMusic();

        game.mode = "intro";
        game.offsetLeft = 0;
        game.ended = false;
        game.animationFrame = window.requestAnimationFrame(game.animate, game.canvas);
    },

    maxSpeed: 3,
    minOffset: 0,
    maxOffset: 300,
    offsetLeft: 0,
    score: 0,

    panTo: function (newCenter) {
        if (Math.abs(newCenter - game.offsetLeft - game.canvas.width / 4) > 0 && game.offsetLeft <= game.maxOffset && game.offsetLeft >= game.minOffset) {

            var deltaX = Math.round((newCenter - game.offsetLeft - game.canvas.width / 4) / 2);
            if (deltaX && Math.abs(deltaX) > game.maxSpeed) {
                deltaX = game.maxSpeed * Math.abs(deltaX) / (deltaX);
            }
            game.offsetLeft += deltaX;
        } else {

            return true;
        }
        if (game.offsetLeft < game.minOffset) {
            game.offsetLeft = game.minOffset;
            return true;
        } else if (game.offsetLeft > game.maxOffset) {
            game.offsetLeft = game.maxOffset;
            return true;
        }
        return false;
    },
    countHeroesAndVillains: function () {
        game.heroes = [];
        game.villains = [];
        for (var body = box2d.world.GetBodyList(); body; body = body.GetNext()) {
            var entity = body.GetUserData();
            if (entity) {
                if (entity.type == "hero") {
                    game.heroes.push(body);
                } else if (entity.type == "villain") {
                    game.villains.push(body);
                }
            }
        }
    },
    mouseOnCurrentHero: function () {
        if (!game.currentHero) {
            return false;
        }
        var position = game.currentHero.GetPosition();
        var distanceSquared = Math.pow(position.x * box2d.scale - mouse.x - game.offsetLeft, 2) + Math.pow(position.y * box2d.scale - mouse.y, 2);
        var radiusSquared = Math.pow(game.currentHero.GetUserData().radius, 2);
        return (distanceSquared <= radiusSquared);
    },
    handlePanning: function () {
        if (game.mode == "intro") {
            if (game.panTo(700)) {
                game.mode = "load-next-hero";
            }
        }

        if (game.mode == "wait-for-firing") {
            if (mouse.dragging) {
                if (game.mouseOnCurrentHero()) {
                    game.mode = "firing";

                } else {
                    game.panTo(mouse.x + game.offsetLeft)
                }
            } else {
                game.panTo(game.slingshotX);
            }
        }

        if (game.mode == "firing") {
            if (mouse.down) {
                game.panTo(game.slingshotX);
                var distance = Math.sqrt(Math.pow(mouse.x - mouse.downX, 2) + Math.pow(mouse.y - mouse.downY, 2));
                var maxDistance = 130;
                if (maxDistance > distance) {
                    game.currentHero.SetPosition({
                        x: (mouse.x + game.offsetLeft) / box2d.scale,
                        y: mouse.y / box2d.scale
                    });
                } else {
                    var angle = Math.atan2(mouse.y - mouse.downY, mouse.x - mouse.downX);
                    game.currentHero.SetPosition({
                        x: (mouse.downX + maxDistance * Math.cos(angle) + game.offsetLeft) / box2d.scale,
                        y: (mouse.downY + maxDistance * Math.sin(angle)) / box2d.scale
                    });
                }
            } else {

                game.mode = "fired";
                game.slingshotReleasedSound.play();
                var impulseScaleFactor = 0.75;

                var slingshotCenterX = game.slingshotX + 35;
                var slingshotCenterY = game.slingshotY + 25;
                var impulse = new b2Vec2((slingshotCenterX - mouse.x - game.offsetLeft) * impulseScaleFactor, (slingshotCenterY - mouse.y) * impulseScaleFactor);
                game.currentHero.ApplyImpulse(impulse, game.currentHero.GetWorldCenter());


                game.currentHero.SetAngularDamping(0.5);
                game.currentHero.SetLinearDamping(0.1);

            }
        }

        // modo del juego en donde hemos disparado el cohete
        if (game.mode == "fired") {

            var heroX = game.currentHero.GetPosition().x * box2d.scale;
            game.panTo(heroX);

            // esperamos a que el cohete no se mueva o se vaya fuera de la pantalla para cargar el nuevo cohete 
            if (!game.currentHero.IsAwake() || heroX < 0 || heroX > game.currentLevel.foregroundImage.width) {
                // then delete the old hero
                box2d.world.DestroyBody(game.currentHero);
                game.currentHero = undefined;
                // and load next hero
                game.mode = "load-next-hero";
            }
        }


        if (game.mode == "load-next-hero") {
            game.countHeroesAndVillains();

            // comprobamos si el array de los planetas está lleno y si todos han sido eliminados, cambiamos el modo del juego a terminado
            if (game.villains.length == 0) {
                game.mode = "level-success";
                return;
            }

            // comprobamos si el array de los cohetes está lleno y si está vacio, hemos fallado
            if (game.heroes.length == 0) {
                game.mode = "level-failure"
                return;
            }

            // cargamos el cohete y esperamos a que el usuario pulse en el juego
            if (!game.currentHero) {
                game.currentHero = game.heroes[game.heroes.length - 1];
                game.currentHero.SetPosition({
                    x: 180 / box2d.scale,
                    y: 200 / box2d.scale
                });
                game.currentHero.SetLinearVelocity({
                    x: 0,
                    y: 0
                });
                game.currentHero.SetAngularVelocity(0);
                game.currentHero.SetAwake(true);
            } else {
                // esperamos a que el cohete no se mueva
                game.panTo(game.slingshotX);
                if (!game.currentHero.IsAwake()) {
                    game.mode = "wait-for-firing";
                }
            }
        }

        // cargamos la pantalla de final del juego si fallamos o acabamos el juego
        if (game.mode == "level-success" || game.mode == "level-failure") {
            if (game.panTo(0)) {
                game.ended = true;
                game.showEndingScreen();
            }
        }


    },
    showEndingScreen: function () {
        game.stopBackgroundMusic();
        if (game.mode == "level-success") {
            if (game.currentLevel.number < levels.data.length - 1) {
                $('#endingmessage').html('Nivel Completado. ¡Bien hecho!');
                $("#playnextlevel").show();
            } else {
                $('#endingmessage').html('Todos los niveles completados. ¡Bien hecho!');
                $("#playnextlevel").hide();
            }
        } else if (game.mode == "level-failure") {
            $('#endingmessage').html('¡Has perdido!. ¿Deseas continuar?');
            $("#playnextlevel").hide();
        }

        $('#endingscreen').show();
    },

    // animaciones de la pantalla y las entities
    animate: function () {
        game.handlePanning();

        var currentTime = new Date().getTime();
        var timeStep;
        if (game.lastUpdateTime) {
            timeStep = (currentTime - game.lastUpdateTime) / 1000;
            if (timeStep > 2 / 60) {
                timeStep = 2 / 60
            }
            box2d.step(timeStep);
        }
        game.lastUpdateTime = currentTime;


        // dibujamos el fondo
        game.context.drawImage(game.currentLevel.backgroundImage, game.offsetLeft / 4, 0, 640, 480, 0, 0, 640, 480);
        game.context.drawImage(game.currentLevel.foregroundImage, game.offsetLeft, 0, 640, 480, 0, 0, 640, 480);

        // dibujamos el tirachinas
        game.context.drawImage(game.slingshotImage, game.slingshotX - game.offsetLeft, game.slingshotY);

        // dibujamos todos los objetos
        game.drawAllBodies();

        // dibujamos la banda del tirachinas sólo cuando el modo del juego ha cambiado a "wait-for-firing" o "firing"
        if (game.mode == "wait-for-firing" || game.mode == "firing") {
            game.drawSlingshotBand();
        }

        game.context.drawImage(game.slingshotFrontImage, game.slingshotX - game.offsetLeft, game.slingshotY);

        if (!game.ended) {
            game.animationFrame = window.requestAnimationFrame(game.animate, game.canvas);
        }
    },
    drawAllBodies: function () {
        box2d.world.DrawDebugData();

        // iteramos en los entities y los dibujamos en el debug
        for (var body = box2d.world.GetBodyList(); body; body = body.GetNext()) {
            var entity = body.GetUserData();

            if (entity) {
                var entityX = body.GetPosition().x * box2d.scale;
                if (entityX < 0 || entityX > game.currentLevel.foregroundImage.width || (entity.health && entity.health < 0)) {
                    box2d.world.DestroyBody(body);
                    if (entity.type == "villain") {
                        game.score += entity.calories;
                        $('#score').html('Puntuación: ' + game.score);
                    }
                    if (entity.breakSound) {
                        entity.breakSound.play();
                    }
                } else {
                    entities.draw(entity, body.GetPosition(), body.GetAngle())
                }
            }
        }
    },
    drawSlingshotBand: function () {
        game.context.strokeStyle = "rgb(68,31,11)";
        game.context.lineWidth = 6;

        var radius = game.currentHero.GetUserData().radius;
        var heroX = game.currentHero.GetPosition().x * box2d.scale;
        var heroY = game.currentHero.GetPosition().y * box2d.scale;
        var angle = Math.atan2(game.slingshotY + 25 - heroY, game.slingshotX + 50 - heroX);

        var heroFarEdgeX = heroX - radius * Math.cos(angle);
        var heroFarEdgeY = heroY - radius * Math.sin(angle);



        // empezamos a dibujar en el contexto del juego
        game.context.beginPath();

        game.context.moveTo(game.slingshotX + 50 - game.offsetLeft, game.slingshotY + 25);

        game.context.lineTo(heroX - game.offsetLeft, heroY);
        game.context.stroke(); // cambiamos a stroke

        entities.draw(game.currentHero.GetUserData(), game.currentHero.GetPosition(), game.currentHero.GetAngle());

        game.context.beginPath();

        game.context.moveTo(heroFarEdgeX - game.offsetLeft, heroFarEdgeY);

        game.context.lineTo(game.slingshotX - game.offsetLeft + 10, game.slingshotY + 30)
        game.context.stroke();
    },

}

var levels = {
    // Niveles
    data: [
        { // Primer nivel
            foreground: 'fondo4',
            background: 'fondo4',
            entities: [
                {
                    type: "ground",
                    name: "dirt",
                    x: 500,
                    y: 440,
                    width: 2000,
                    height: 20,
                    isStatic: true
                },
                {
                    type: "ground",
                    name: "wood",
                    x: 185,
                    y: 390,
                    width: 300,
                    height: 80,
                    isStatic: true
                },
                {
                    type: "block",
                    name: "wood",
                    x: 520,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
				},
                {
                    type: "block",
                    name: "wood",
                    x: 620,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
				},
                {
                    type: "block",
                    name: "glass",
                    x: 570,
                    y: 317.5,
                    width: 100,
                    height: 25
                },
                {
                    type: "villain",
                    name: "planet1",
                    x: 570,
                    y: 305,
                    calories: 590
                },
                {
                    type: "hero",
                    name: "rocket1",
                    x: 80,
                    y: 405
                },
                {
                    type: "hero",
                    name: "rocket2",
                    x: 140,
                    y: 405
                },
		]
	 },
        { // Segundo nivel
            foreground: 'fondo4',
            background: 'fondo4',
            entities: [
                {
                    type: "ground",
                    name: "dirt",
                    x: 500,
                    y: 440,
                    width: 1000,
                    height: 20,
                    isStatic: true
                },
                {
                    type: "ground",
                    name: "wood",
                    x: 185,
                    y: 390,
                    width: 30,
                    height: 80,
                    isStatic: true
                },

                {
                    type: "block",
                    name: "wood",
                    x: 720,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "block",
                    name: "wood",
                    x: 620,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "block",
                    name: "wood",
                    x: 520,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "block",
                    name: "glass",
                    x: 570,
                    y: 317.5,
                    width: 100,
                    height: 25
                },
                {
                    type: "block",
                    name: "glass",
                    x: 670,
                    y: 317.5,
                    width: 100,
                    height: 25
                },

                {
                    type: "block",
                    name: "glass",
                    x: 570,
                    y: 255,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "block",
                    name: "glass",
                    x: 670,
                    y: 255,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "block",
                    name: "wood",
                    x: 620,
                    y: 192.5,
                    width: 100,
                    height: 25
                },

                {
                    type: "villain",
                    name: "planet1",
                    x: 615,
                    y: 155,
                    calories: 590
                },
                {
                    type: "villain",
                    name: "planet2",
                    x: 570,
                    y: 405,
                    calories: 420
                },
                {
                    type: "villain",
                    name: "planet3",
                    x: 665,
                    y: 400,
                    calories: 150
                },

                {
                    type: "hero",
                    name: "rocket1",
                    x: 30,
                    y: 415
                },
                {
                    type: "hero",
                    name: "rocket2",
                    x: 80,
                    y: 405
                },
                {
                    type: "hero",
                    name: "rocket3",
                    x: 140,
                    y: 405
                },
			]
		},
        { // Tercer nivel
            foreground: 'fondo4',
            background: 'fondo4',
            entities: [
                {
                    type: "ground",
                    name: "dirt",
                    x: 500,
                    y: 440,
                    width: 1000,
                    height: 20,
                    isStatic: true
                },
                {
                    type: "ground",
                    name: "wood",
                    x: 185,
                    y: 390,
                    width: 30,
                    height: 80,
                    isStatic: true
                },

                {
                    type: "block",
                    name: "wood",
                    x: 520,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "block",
                    name: "glass",
                    x: 520,
                    y: 280,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "villain",
                    name: "planet3",
                    x: 520,
                    y: 205,
                    calories: 590
                },

                {
                    type: "block",
                    name: "wood",
                    x: 620,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "block",
                    name: "glass",
                    x: 620,
                    y: 280,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "villain",
                    name: "planet2",
                    x: 620,
                    y: 205,
                    calories: 420
                },
                {
                    type: "villain",
                    name: "planet4",
                    x: 720,
                    y: 205,
                    calories: 420
                },
                {
                    type: "block",
                    name: "wood",
                    x: 720,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "block",
                    name: "glass",
                    x: 720,
                    y: 280,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "villain",
                    name: "planet5",
                    x: 820,
                    y: 205,
                    calories: 420
                },
                {
                    type: "block",
                    name: "wood",
                    x: 820,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "block",
                    name: "glass",
                    x: 820,
                    y: 280,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "hero",
                    name: "rocket1",
                    x: 30,
                    y: 415
                },
                {
                    type: "hero",
                    name: "rocket2",
                    x: 80,
                    y: 405
                },
                {
                    type: "hero",
                    name: "rocket3",
                    x: 140,
                    y: 405
                },
		]
	 },
        { // Cuerto nivel
            foreground: 'fondo4',
            background: 'fondo4',
            entities: [
                {
                    type: "ground",
                    name: "dirt",
                    x: 500,
                    y: 440,
                    width: 1000,
                    height: 20,
                    isStatic: true
                },
                {
                    type: "ground",
                    name: "wood",
                    x: 185,
                    y: 390,
                    width: 30,
                    height: 80,
                    isStatic: true
                },
                {
                    type: "block",
                    name: "wood",
                    x: 420,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "villain",
                    name: "planet3",
                    x: 420,
                    y: 300,
                    calories: 590
                },
                {
                    type: "block",
                    name: "wood",
                    x: 520,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "block",
                    name: "glass",
                    x: 520,
                    y: 280,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "villain",
                    name: "planet6",
                    x: 520,
                    y: 205,
                    calories: 420
                },
                {
                    type: "block",
                    name: "wood",
                    x: 620,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
                },
                {
                    type: "villain",
                    name: "planet4",
                    x: 620,
                    y: 300,
                    calories: 590
                },
                {
                    type: "hero",
                    name: "rocket1",
                    x: 30,
                    y: 415
                },
                {
                    type: "hero",
                    name: "rocket2",
                    x: 80,
                    y: 405
                },
                {
                    type: "hero",
                    name: "rocket3",
                    x: 140,
                    y: 405
                },
		]
	 },
        { // Quinto nivel
            foreground: 'fondo4',
            background: 'fondo4',
            entities: [
                {
                    type: "ground",
                    name: "dirt",
                    x: 500,
                    y: 440,
                    width: 2000,
                    height: 20,
                    isStatic: true
                },
                {
                    type: "ground",
                    name: "wood",
                    x: 185,
                    y: 390,
                    width: 300,
                    height: 80,
                    isStatic: true
                },
                {
                    type: "block",
                    name: "wood",
                    x: 400,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
				},
                {
                    type: "block",
                    name: "wood",
                    x: 400,
                    y: 280,
                    angle: 90,
                    width: 100,
                    height: 25
				},
                {
                    type: "block",
                    name: "wood",
                    x: 500,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
				},
                {
                    type: "block",
                    name: "wood",
                    x: 500,
                    y: 280,
                    angle: 90,
                    width: 100,
                    height: 25
				},
                {
                    type: "block",
                    name: "glass",
                    x: 450,
                    y: 220.5,
                    width: 122,
                    height: 25
                },
                {
                    type: "block",
                    name: "wood",
                    x: 530,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
				},
                {
                    type: "block",
                    name: "wood",
                    x: 620,
                    y: 380,
                    angle: 90,
                    width: 100,
                    height: 25
				},
                {
                    type: "block",
                    name: "glass",
                    x: 575,
                    y: 320.5,
                    width: 112,
                    height: 25
                },
                {
                    type: "block",
                    name: "glass",
                    x: 575,
                    y: 220.5,
                    width: 112,
                    height: 25
                },
                {
                    type: "block",
                    name: "wood",
                    x: 532,
                    y: 280,
                    angle: 90,
                    width: 100,
                    height: 25
				},
                {
                    type: "block",
                    name: "wood",
                    x: 620,
                    y: 280,
                    angle: 90,
                    width: 100,
                    height: 25
				},
                {
                    type: "block",
                    name: "wood",
                    x: 455,
                    y: 195,
                    angle: 90,
                    width: 100,
                    height: 25
				},
                {
                    type: "block",
                    name: "glass",
                    x: 455,
                    y: 140.5,
                    width: 112,
                    height: 25
                },
                {
                    type: "villain",
                    name: "planet5",
                    x: 450,
                    y: 390,
                    calories: 420
                },
                {
                    type: "villain",
                    name: "earth",
                    x: 575,
                    y: 180,
                    calories: 420
                },
                {
                    type: "villain",
                    name: "planet3",
                    x: 578,
                    y: 405,
                    calories: 420
                },
                {
                    type: "villain",
                    name: "planet2",
                    x: 575,
                    y: 290,
                    calories: 420
                },
                {
                    type: "hero",
                    name: "rocket1",
                    x: 80,
                    y: 405
                },
                {
                    type: "hero",
                    name: "rocket2",
                    x: 140,
                    y: 405
                },
                {
                    type: "hero",
                    name: "rocket3",
                    x: 200,
                    y: 405
                }
		]
	 },
	],

    // inicializamos la pantalla de selección de niveles
    init: function () {
        var html = "";
        for (var i = 0; i < levels.data.length; i++) {
            var level = levels.data[i];
            html += '<input type="button" value="' + (i + 1) + '">';
        };

        $('#levelselectscreen').html(html);

        $('#levelselectscreen input').click(function () {
            levels.load(this.value - 1);
            $('#levelselectscreen').hide();
        });
    },

    // cargamos el nivel elegido y todos los objetos que necesiten
    load: function (number) {
        // inicializamos el mundo de box2d
        box2d.init();

        // inicializamos el nivel elegido
        game.currentLevel = {
            number: number,
            hero: []
        };
        game.score = 0;
        $('#score').html('Score: ' + game.score);
        game.currentHero = undefined;
        var level = levels.data[number];


        // cargamos assets
        game.currentLevel.backgroundImage = loader.loadImage("images/backgrounds/" + level.background + ".png");
        game.currentLevel.foregroundImage = loader.loadImage("images/backgrounds/" + level.foreground + ".png");
        game.slingshotImage = loader.loadImage("images/slingshot.png");
        game.slingshotFrontImage = loader.loadImage("images/slingshot-front.png");

        // cargamos entities
        for (var i = level.entities.length - 1; i >= 0; i--) {
            var entity = level.entities[i];
            entities.create(entity);
        };

        // y cuando este todo cargado, cargamos el nivel y lo mostramos
        if (loader.loaded) {
            game.start()
        } else {
            loader.onload = game.start;
        }
    }
}

// nuevas entities
var entities = {
    definitions: {
        "glass": {
            fullHealth: 100,
            density: 2.4,
            friction: 0.4,
            restitution: 0.15,
        },
        "wood": {
            fullHealth: 500,
            density: 0.7,
            friction: 0.4,
            restitution: 0.4,
        },
        "dirt": {
            density: 3.0,
            friction: 1.5,
            restitution: 0.2,
        },
        "rocket1": {
            shape: "circle",
            radius: 15,
            density: 2.0,
            friction: 0.5,
            restitution: 0.4,
        },
        "rocket2": {
            shape: "circle",
            radius: 15,
            density: 2.0,
            friction: 0.5,
            restitution: 0.4,
        },
        "rocket3": {
            shape: "circle",
            radius: 15,
            density: 2.0,
            friction: 0.5,
            restitution: 0.4,
        },
        "planet1": {
            shape: "circle",
            radius: 20,
            fullHealth: 40,
            density: 2.0,
            friction: 0.5,
            restitution: 0.4,
        },
        "planet2": {
            shape: "circle",
            radius: 25,
            fullHealth: 40,
            density: 2.0,
            friction: 0.5,
            restitution: 0.4,
        },
        "planet3": {
            shape: "circle",
            radius: 30,
            fullHealth: 40,
            density: 2.0,
            friction: 0.5,
            restitution: 0.4,
        },
        "planet4": {
            shape: "circle",
            fullHealth: 40,
            radius: 30,
            density: 2.0,
            friction: 0.5,
            restitution: 0.4,
        },
        "planet5": {
            shape: "circle",
            radius: 35,
            fullHealth: 40,
            density: 2.0,
            friction: 0.5,
            restitution: 0.4,
        },
        "planet6": {
            shape: "circle",
            fullHealth: 35,
            radius: 20,
            density: 2.0,
            friction: 0.5,
            restitution: 0.4,
        },
        "earth": {
            shape: "circle",
            fullHealth: 60,
            radius: 40,
            density: 2.0,
            friction: 0.5,
            restitution: 0.4,
        },
    },
    // seleccionamos la entity y lo mostramos en el mundo box2d
    create: function (entity) {
        var definition = entities.definitions[entity.name];
        if (!definition) {
            console.log("Undefined entity name", entity.name);
            return;
        }
        switch (entity.type) {
            case "block": // rectangulos
                entity.health = definition.fullHealth;
                entity.fullHealth = definition.fullHealth;
                entity.shape = "rectangle";
                entity.sprite = loader.loadImage("images/entities/" + entity.name + ".png");
                entity.breakSound = game.breakSound[entity.name];
                box2d.createRectangle(entity, definition);
                break;
            case "ground": // rectangulos en la tierra
                // sin vida
                entity.shape = "rectangle";
                box2d.createRectangle(entity, definition);
                break;
            case "hero": // circulos para los cohetes
            case "villain": // y circulos para los planetas
                entity.health = definition.fullHealth;
                entity.fullHealth = definition.fullHealth;
                entity.sprite = loader.loadImage("images/entities/" + entity.name + ".png");
                entity.shape = definition.shape;
                entity.bounceSound = game.bounceSound;
                if (definition.shape == "circle") {
                    entity.radius = definition.radius;
                    box2d.createCircle(entity, definition);
                } else if (definition.shape == "rectangle") {
                    entity.width = definition.width;
                    entity.height = definition.height;
                    box2d.createRectangle(entity, definition);
                }
                break;
            default:
                console.log("Undefined entity type", entity.type);
                break;
        }
    },

    // cogemos la entity y su posición y lo dibujamos en el canvas
    draw: function (entity, position, angle) {
        game.context.translate(position.x * box2d.scale - game.offsetLeft, position.y * box2d.scale);
        game.context.rotate(angle);
        switch (entity.type) {
            case "block":
                game.context.drawImage(entity.sprite, 0, 0, entity.sprite.width, entity.sprite.height, -entity.width / 2 - 1, -entity.height / 2 - 1, entity.width + 2, entity.height + 2);
                break;
            case "villain":
            case "hero":
                if (entity.shape == "circle") {
                    game.context.drawImage(entity.sprite, 0, 0, entity.sprite.width, entity.sprite.height, -entity.radius - 1, -entity.radius - 1, entity.radius * 2 + 2, entity.radius * 2 + 2);
                } else if (entity.shape == "rectangle") {
                    game.context.drawImage(entity.sprite, 0, 0, entity.sprite.width, entity.sprite.height, -entity.width / 2 - 1, -entity.height / 2 - 1, entity.width + 2, entity.height + 2);
                }
                break;
            case "ground":
                break;
        }

        game.context.rotate(-angle);
        game.context.translate(-position.x * box2d.scale + game.offsetLeft, -position.y * box2d.scale);
    }

}

var box2d = {
    scale: 30,
    init: function () {
        // código para configurar correctamente el mundo de box2d
        var gravity = new b2Vec2(0, 9.8);
        var allowSleep = true;
        box2d.world = new b2World(gravity, allowSleep);

        // Setup debug draw
        var debugContext = document.getElementById('debugcanvas').getContext('2d');
        var debugDraw = new b2DebugDraw();
        debugDraw.SetSprite(debugContext);
        debugDraw.SetDrawScale(box2d.scale);
        debugDraw.SetFillAlpha(0.3);
        debugDraw.SetLineThickness(1.0);
        debugDraw.SetFlags(b2DebugDraw.e_shapeBit | b2DebugDraw.e_jointBit);
        box2d.world.SetDebugDraw(debugDraw);

        var listener = new Box2D.Dynamics.b2ContactListener;
        listener.PostSolve = function (contact, impulse) {
            var body1 = contact.GetFixtureA().GetBody();
            var body2 = contact.GetFixtureB().GetBody();
            var entity1 = body1.GetUserData();
            var entity2 = body2.GetUserData();

            var impulseAlongNormal = Math.abs(impulse.normalImpulses[0]);
            if (impulseAlongNormal > 5) {
                // si las entities tienen vida, entonces reducimos esa vida si son golpeados
                if (entity1.health) {
                    entity1.health -= impulseAlongNormal;
                }

                if (entity2.health) {
                    entity2.health -= impulseAlongNormal;
                }

                if (entity1.bounceSound) {
                    entity1.bounceSound.play();
                }

                if (entity2.bounceSound) {
                    entity2.bounceSound.play();
                }
            }
        };
        box2d.world.SetContactListener(listener);
    },
    step: function (timeStep) {
        box2d.world.Step(timeStep, 8, 3);
    },
    createRectangle: function (entity, definition) { // creamos los rectangulos
        var bodyDef = new b2BodyDef;
        if (entity.isStatic) {
            bodyDef.type = b2Body.b2_staticBody;
        } else {
            bodyDef.type = b2Body.b2_dynamicBody;
        }

        bodyDef.position.x = entity.x / box2d.scale;
        bodyDef.position.y = entity.y / box2d.scale;
        if (entity.angle) {
            bodyDef.angle = Math.PI * entity.angle / 180;
        }

        var fixtureDef = new b2FixtureDef;
        fixtureDef.density = definition.density;
        fixtureDef.friction = definition.friction;
        fixtureDef.restitution = definition.restitution;

        fixtureDef.shape = new b2PolygonShape;
        fixtureDef.shape.SetAsBox(entity.width / 2 / box2d.scale, entity.height / 2 / box2d.scale);

        var body = box2d.world.CreateBody(bodyDef);
        body.SetUserData(entity);

        var fixture = body.CreateFixture(fixtureDef);
        return body;
    },

    createCircle: function (entity, definition) { // creamos los circulos
        var bodyDef = new b2BodyDef;
        if (entity.isStatic) {
            bodyDef.type = b2Body.b2_staticBody;
        } else {
            bodyDef.type = b2Body.b2_dynamicBody;
        }

        bodyDef.position.x = entity.x / box2d.scale;
        bodyDef.position.y = entity.y / box2d.scale;

        if (entity.angle) {
            bodyDef.angle = Math.PI * entity.angle / 180;
        }
        var fixtureDef = new b2FixtureDef;
        fixtureDef.density = definition.density;
        fixtureDef.friction = definition.friction;
        fixtureDef.restitution = definition.restitution;

        fixtureDef.shape = new b2CircleShape(entity.radius / box2d.scale);

        var body = box2d.world.CreateBody(bodyDef);
        body.SetUserData(entity);

        var fixture = body.CreateFixture(fixtureDef);
        return body;
    },
}

var loader = {
    loaded: true,
    loadedCount: 0, // cantidad de assets cargados
    totalCount: 0,

    init: function () {
        // comprobamos el soporte del sonido tal y como pone en las diapositivas de la asignatura
        var mp3Support, oggSupport;
        var audio = document.createElement('audio');
        if (audio.canPlayType) {
            mp3Support = "" !== audio.canPlayType('audio/mpeg');
            oggSupport = "" !== audio.canPlayType('audio/ogg; codecs="vorbis"');
        } else {
            // no soportado
            mp3Support = false;
            oggSupport = false;
        }
        loader.soundFileExtn = oggSupport ? ".ogg" : mp3Support ? ".mp3" : undefined;


        var webMSupport, h264Support;
        var video = document.createElement('video');
        if (video.canPlayType) {
            h264Support = "" !== (video.canPlayType('video/mp4; codecs="avc1.42E01E"') || video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'));
            webMSupport = "" !== video.canPlayType('video/webm; codecs="vp8, vorbis"');
        } else {
            h264Support = false;
            webMSupport = false;
        }

        loader.videoFileExtn = webMSupport ? ".webm" : h264Support ? ".mp4" : undefined;
    },
    loadImage: function (url, callback) {
        this.totalCount++;
        loader.updateStatus();
        this.loaded = false;
        $('#loadingscreen').show();
        var image = new Image();
        image.src = url;
        image.onload = function (ev) {
            loader.itemLoaded(ev);
            if (callback) {
                callback(image);
            }
        };
        return image;
    },
    soundFileExtn: ".ogg",
    loadSound: function (url) {
        var audio = new Audio();
        if (!loader.soundFileExtn) {
            return audio;
        }

        this.totalCount++;
        loader.updateStatus();
        this.loaded = false;
        $('#loadingscreen').show();
        audio.addEventListener("canplaythrough", loader.itemLoaded, false);
        audio.preload = "auto";
        audio.src = url + loader.soundFileExtn;
        audio.load();
        return audio;
    },
    loadVideo: function (url) {
        var videoObject = document.createElement('video');
        if (!loader.videoFileExtn) {
            return videoObject;
        }
        this.totalCount++;
        loader.updateStatus();
        this.loaded = false;
        $('#loadingscreen').show();
        videoObject.addEventListener("canplaythrough", loader.itemLoaded, false);
        videoObject.preload = "auto";
        videoObject.src = url + loader.videoFileExtn;
        videoObject.load();
        return videoObject;
    },
    itemLoaded: function (e) {
        e.target.removeEventListener("canplaythrough", loader.itemLoaded, false);
        e.target.removeEventListener("canplay", loader.itemLoaded, false);
        e.target.removeEventListener("loadeddata", loader.itemLoaded, false);

        loader.loadedCount++;
        loader.updateStatus();
        if (loader.loadedCount === loader.totalCount) {
            loader.loaded = true;
            loader.loadedCount = 0;
            loader.totalCount = 0;
            $('#loadingscreen').hide();
            if (loader.onload) {
                loader.onload();
                loader.onload = undefined;
            }
        }
    },
    updateStatus: function () {
        $('#loadingmessage').html('Loading ' + loader.loadedCount + ' of ' + loader.totalCount + '...');
        var progress = loader.totalCount ? Math.round(100 * loader.loadedCount / loader.totalCount) : 100;
    }
};

// raton
var mouse = {
    x: 0,
    y: 0,
    down: false,
    init: function () {
        $('#gamecanvas').mousemove(mouse.mousemovehandler);
        $('#gamecanvas').mousedown(mouse.mousedownhandler);
        $('#gamecanvas').mouseup(mouse.mouseuphandler);
        $('#gamecanvas').mouseout(mouse.mouseuphandler);
    },
    mousemovehandler: function (ev) {
        var offset = $('#gamecanvas').offset();

        mouse.x = ev.pageX - offset.left;
        mouse.y = ev.pageY - offset.top;

        if (mouse.down) {
            mouse.dragging = true;
        }
    },
    mousedownhandler: function (ev) {
        mouse.down = true;
        mouse.downX = mouse.x;
        mouse.downY = mouse.y;
        ev.originalEvent.preventDefault();

    },
    mouseuphandler: function (ev) {
        mouse.down = false;
        mouse.dragging = false;
    }
}

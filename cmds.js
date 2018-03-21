
const {log,biglog, errorlog, colorize}=require("./out");
const Sequelize = require('sequelize');
const {models}=require ('./model');  //es model

/**
* Muestra la ayuda
*/
exports.helpCmd = (socket, rl) => {
	log(socket,'Comandos:');
	log(socket,"  h|help - Muestra esta ayuda.");
  log(socket,"  list - Listar los quizzes existentes");
  log(socket,"  show <id> - Muestra la pregunta y la respuesta del quiz indicado");
  log(socket,"  add - Añadir nuevo Quiz interactivamente. ");
  log(socket,"  delete <id> - Borrar el quiz indicado.");
	log(socket,"  edit <id> - Editar el quiz indicado");
	log(socket,"  test <id> - Probar el quiz indicado");
	log(socket,"  p|play - Jugar a una pregunta aleatoriamente todos los quizzes");
	log(socket,"  credits - Creditos");
	log(socket,"  q|quit - Salir del programa.");
	rl.prompt();
};
/**
* Salimos del programa
*/
exports.quitCmd = (socket, rl) =>{
	rl.close();
  socket.end();

};
/**
* Añadimos un nuevo quiz
*/
exports.addCmd = (socket,rl) => {
	makeQuestion(socket, rl, 'Introduzca una pregunta: ')
    .then(q => {
        return makeQuestion(socket, rl, 'Introduzca la respuesta: ')
        .then(a => {
            return {question: q, answer: a};
        });
    })
    .then(quiz => {
        return models.quiz.create(quiz);
    })
    .then((quiz) => {
  	    log(socket,` ${colorize('Se ha añadido.', 'magenta')}: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
    })
    .catch(Sequelize.ValidationError, error => {
        errorlog(socket,'El quiz es erróneo.');
        error.errors.forEach(({message}) => errorlog(socket, message));
    })
    .catch(error => {
        errorlog(socket, error.message);
    })
    .then(() => {
        rl.prompt();
	});		
};

/**
* Listamos todos los quizzes existentes
*/
exports.listCmd = (socket,rl) =>{

	models.quiz.findAll()
	.each(quiz => {
        log(socket, ` [${colorize(quiz.id, 'magenta')}]: ${quiz.question}`);
    })
    .catch(error => {
	    errorlog(socket, error.message);
    })
    .then(() => {
    rl.prompt();
    });
};

exports.showCmd = (socket,rl,id)=>{
	validateId(id)
    .then(id => models.quiz.findById(id))
    .then(quiz => {
        if (!quiz) {
            throw new Error(`No existe un quiz asociado al id=${id}.`);
        }
        log(socket,` [${colorize(quiz.id, 'magenta')}]: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
    })
    .catch(error => {
        errorlog(socket, error.message);
    })
    .then(() => {
        rl.prompt();
	});
};

/**
* probamos el Quiz indicado
*/
exports.testCmd = (socket,rl,id) =>{
	//log('Probar el quiz indicado');
	validateId(id)
    .then(id => models.quiz.findById(id))
    .then(quiz => {
        if (!quiz) {
            throw new Error(`No existe un quiz asociado al id=${id}.`);
        }
        makeQuestion(rl, quiz.question) //esto es una promesa
		.then(answer => { //respuesta 
			if(answer.toLowerCase().trim() === quiz.answer.toLowerCase().trim()) { //quito blancos y no distingue mayusculas y minusculas
				log(socket,'Su respuesta es correcta');
				biglog(socket,'Correcta', 'green');
				rl.prompt();
			}else{
				log(socket,'Su respuesta es incorrecta');
				biglog(socket,'Incorrecta', 'red');
				rl.prompt();
			}
		})
    })
    .catch(error => {
        errorlog(socket, error.message);
    })
	.then(() => {
		rl.prompt();
	})
};

/**
* Jugamos al Quiz indicado
*/
exports.playCmd = (socket,rl) => {

  		let score = 0; //acumulov el resultado
  		let toBePlayed = []; //array a rellenar con todas las preguntas de la BBDD. Como se consigue? Con una promesa

  		const playOne = () => {
        return new Promise ((resolve, reject) => {
  				if(toBePlayed.length === 0) {
            log(socket,' ¡No hay preguntas que responder!','red');
            log(socket,' Fin del examen. Aciertos: ');
  					resolve();
  					return;
  				}
  				let pos = Math.floor(Math.random()*toBePlayed.length);
  				let quiz = toBePlayed[pos];
  		    toBePlayed.splice(pos, 1); //lo borro porque ya no lo quiero más

  		    makeQuestion(rl, quiz.question)
  		    .then(answer => {
            if(answer.toLowerCase().trim() === quiz.answer.toLowerCase().trim()){
              score++;
  				    log(socket,`  CORRECTO - Lleva ${score} aciertos`);
  				    resolve(playOne());
            }else{
              log(socket,'  INCORRECTO ');
              log(socket,`  Fin del juego. Aciertos: ${score} `);
  				    resolve();
  			    }
  		    })
  	     })
  	  }
  		models.quiz.findAll({raw: true}) //el raw hace que enseñe un string solamente en lugar de todo el contenido
  		.then(quizzes => {
  			toBePlayed= quizzes;
      })
  		.then(() => {
  		 	return playOne(); //es necesario esperar a que la promesa acabe, por eso no es un return a secas
  		 })
  		.catch(e => {
  			errorlog(socket,"Error:" + e); //usar errorlog con colores
  		})
  		.then(() => {
  			biglog(socket, score, 'blue');
  			rl.prompt();
  		})
}

exports.deleteCmd =(socket,rl,id)=>{
	    validateId(id)
        .then(id => models.quiz.destroy({where: {id}}))
        .catch(error => {
            errorlog(socket, error.message);
        })
        .then(() => {
            rl.prompt();
	});
};

exports.editCmd =(socket,rl, id)=>{
	validateId(id)
  .then(id => models.quiz.findById(id))
  .then(quiz => {
    if(!quiz){
      throw new Error(`No existe un quiz asociado al id=${id}.`);
    }

    process.stdout.isTTY && setTimeout(() => {rl.write(quiz.question)}, 0);
    return makeQuestion(rl, 'Introduzca la pregunta: ')
    .then(q => {
      process.stdout.isTTY && setTimeout(() => {rl.write(quiz.answer)}, 0);
      return makeQuestion(rl, 'Introduzca la respuesta: ')
      .then(a => {
        quiz.question = q;
        quiz.answer = a;
        return quiz;
      });
    });
  })
  .then(quiz => {
    return quiz.save();
  })
  .then(quiz => {
    log(socket,` Se ha cambiado el quiz ${colorize(id, 'magenta')} por: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
  })
  .catch(Sequelize.ValidationError, error => {
    errorlog(socket,'El quiz es erroneo:');
    error.errors.forEach(({message}) => errorlog(socket, message));
  })
  .catch(error => {
    errorlog(socket, error.message);
  })
  .then(() =>{
     rl.prompt();
});	
	
};

exports.creditsCmd =(socket,rl) =>{
	log(socket,'Autores de la practica');
	log(socket,'Maria del Pilar Aguilera Manzanera', 'green');
	log(socket,'Miguel Lahera Hervilla', 'green');
	rl.prompt();
};

//Codigo de las promesas

const validateId = (id) => {
    return new Promise((resolve, reject) => {
        if (typeof id === "undefined") {
            reject(new Error(`Falta el parámetro <id>.`));
        } else {
            id = parseInt(id);
            if (Number.isNaN(id)) { //coger la parte entera y descartar lo demas
                reject(new Error(`El valor del parámetro <id> no es un número`));
            } else {
                resolve(id);
            }
        }
    });
};

const makeQuestion = (rl, text) => {
    return new Sequelize.Promise((resolve, reject) => {
        rl.question(colorize(text, 'red'), answer => {
            resolve(answer.toLowerCase().trim());
        });
    });
};
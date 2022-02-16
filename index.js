const express = require("express");
const mysql = require("mysql");

const app = express();

app.listen("9000", () => {
  console.log("Server started on port 9000 😇");
});

//----DATABASE----
//create the connection with xamp(mysql)
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "tododb",
});

//lorsque lutilisateur invoke cet url
app.get("/api/creer-table-user", (requestHTTP, responseHTTP) => {
  // console.log("create user table ...")
  //utiliser db pour executer des reqs
  db.query(
    `CREATE TABLE users 
        ( 
            id INT(11) NOT NULL AUTO_INCREMENT , 
            firstname VARCHAR(60) NOT NULL , 
            lastname VARCHAR(60) NOT NULL , 
            avatarURL VARCHAR(60) NOT NULL , 
            email VARCHAR(60) NOT NULL,
            role ENUM('DEV','LEADER','MANAGER') NOT NULL DEFAULT 'DEV' , 
            PRIMARY KEY (id), UNIQUE email (email) 
        ) `,
    (errorDB,resultatQury) => {
        if(errorDB) throw errorDB
      //envoyer une reponse vers le client
      responseHTTP.send("user table created 😃 !");
    }
  );
});

//lorsque lutilisateur invoke cet url
app.get("/api/creer-table-task", (requestHTTP, responseHTTP) => {
  // console.log("create todo table ...")
  //utiliser db pour executer des reqs
  db.query(
    `CREATE TABLE tasks 
                ( 
                    id INT(11) NOT NULL AUTO_INCREMENT , 
                    title VARCHAR(60) NOT NULL , 
                    description VARCHAR(225) NOT NULL , 
                    status ENUM('DONE','CANCELED','INPROGRESS','TODO') NOT NULL DEFAULT 'TODO' , 
                    startedAt DATETIME NOT NULL , 
                    doneAt DATETIME NOT NULL , 
                    userId int(11) NOT NULL,
                    PRIMARY KEY (id),
                    FOREIGN KEY (userId) REFERENCES users(id)
                )
     `,
    () => {
      //envoyer une reponse vers le client
      responseHTTP.send("task table created 😃 !");
    }
  );
});

const express = require("express")
const cors = require("cors")
const bp = require("body-parser")
const mysql = require("mysql")
const app = express()

//body could have diff types 
app.use(bp.urlencoded({ extended: true }))
//looks at requests where the Content-Type: application/json (Header)
app.use(bp.json())
//appliquer le cors comme middle ware 
app.use(cors())

//----DATABASE----
//create the connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'todo_dabase'
})

//Connect to mysql 
db.connect((err) => {
    if (err) throw err
    console.log("Mysql connected...")
})

//activer l'ecoute sur les requets http qui vont venir sur l'addresse http://localhost:9000
app.listen('9000', () => {
    console.log('Server started on port 9000 😇');
})

//--------------List Des Apis--------- 
//create todo table
app.get("/create-todo-table", (requestHTTP, responseHTTP) => {

    const onCreateTodoTableQuery = (err, QueryResult) => {

        if (err) throw err
        else {
            responseHTTP.send("table todo created and joined with user via (UserId column FK ) 😃 !")
            console.log(QueryResult);
        }
    }

    db.query(
        `CREATE TABLE todos 
                ( 
                    id INT(11) NOT NULL AUTO_INCREMENT , 
                    title VARCHAR(60) NOT NULL , 
                    description VARCHAR(225) NOT NULL , 
                    status ENUM('DONE','CANCELED','INPROGRESS','TODO') NOT NULL DEFAULT 'TODO' , 
                    createAt DATETIME NOT NULL , 
                    doneAt DATETIME NOT NULL , 
                    userId int(11) NOT NULL,
                    PRIMARY KEY (id),
                    FOREIGN KEY (userId) REFERENCES users(id)
                )

        `, onCreateTodoTableQuery)
})
//create user table
app.get("/create-user-table", (requestHTTP, responseHTTP) => {

    const onCreateUserTableQuery = (err, QueryResult) => {

        if (err) throw err
        else {
            responseHTTP.send("table user created 😃 !")
            console.log(QueryResult);
        }
    }

    db.query(
        `CREATE TABLE users 
                ( 
                    id INT(11) NOT NULL AUTO_INCREMENT , 
                    firstname VARCHAR(60) NOT NULL , 
                    lastname VARCHAR(60) NOT NULL , 
                    avatarURL VARCHAR(60) NOT NULL , 
                    email VARCHAR(60) NOT NULL,
                    password VARCHAR(225) NOT NULL,
                    role ENUM('DEV','LEADER','MANAGER') NOT NULL DEFAULT 'DEV' , 
                    PRIMARY KEY (id), UNIQUE email (email) 
                ) 
        `, onCreateUserTableQuery)

})




//create user req (register)
app.post("/api/register", (requestHTTP, responseHTTP) => {

    //fetch data from the api 
    let newUser = { ...requestHTTP.body }
    //verify if user exists or not 
    db.query(
        `SELECT * FROM users WHERE email='${newUser.email}'`,
        (err, QR_SELECT) => {
            if (err) throw err
            else {
                if (QR_SELECT.length > 0) {
                    responseHTTP.statusCode=403
                    responseHTTP.send({ msg: " Account already exist 🚨 !!" })
                    return
                }

                else {
                    //insert user
                    db.query(`INSERT INTO users SET ?`, newUser,
                        (err, QR_INSERT) => {
                            if (err) throw err
                            else {
                                responseHTTP.send({
                                    msg: "User Account created 😃 Please Verify your email 🚨 !",
                                    user: QR_INSERT
                                })
                            }
                        })
                }
            }
        }
    )



})


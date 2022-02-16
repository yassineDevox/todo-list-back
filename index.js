const express = require("express")
const cors = require("cors")
const bp = require("body-parser")
const mysql = require("mysql")
const bcrypt = require("bcrypt")
const randomString = require("randomstring")
const nodeMailer = require("nodemailer")
const { MAILGUN } = require("./tokens/mail-gun")
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
                    startAt DATETIME NOT NULL , 
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
                    is_account_verified TINYINT(1) NOT NULL DEFAULT 0,
                    verify_token VARCHAR(225) NOT NULL ,
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
                //if user is already exist 
                if (QR_SELECT.length > 0) {
                    responseHTTP.statusCode = 403
                    responseHTTP.send({ msg: " Account already exist 🚨 !!" })
                    return
                }

                else {

                    //crypt the password of the user using bycrypt
                    bcrypt.hash(newUser.password, 10)

                        .then((hashedPassword) => {

                            // password crypted 
                            newUser.password = hashedPassword

                            //generate token to verify email   
                            newUser.verify_token = randomString.generate()

                            //insert user
                            db.query(`INSERT INTO users SET ?`, newUser,
                                (err, QR_INSERT) => {
                                    if (err) throw err
                                    else {

                                        //send email to the address 
                                        //set the options for the mail we'll send to the user 
                                        const mailOptions = {
                                            from: "todoApp@GMC.com",
                                            to: newUser.email,
                                            subject: "Please Verify your email Account 😇 !!",
                                            html: `<a href="http://localhost:9000/api/auth/verify-email/${newUser.email}/code/${newUser.verify_token}">Verify My Email</a>`
                                        }

                                        //send email using nodemailer
                                        //configuer le transporteur 
                                        const transport = nodeMailer.createTransport({
                                            service: 'Mailgun',
                                            auth: {
                                                user: MAILGUN.username,
                                                pass: MAILGUN.password
                                            },
                                            tls: {
                                                rejectUnauthorized: false
                                            }
                                        })

                                        transport.sendMail(mailOptions, (err, info) => {

                                            if (err)
                                                console.log(err)
                                            else {
                                                //send msg to the client to verify his email box
                                                responseHTTP.send({
                                                    msg: "User Account created 😃 Please Verify your email 🚨 !",
                                                })
                                            }

                                        })

                                    }
                                }
                            )

                        })


                }
            }
        }
    )



})


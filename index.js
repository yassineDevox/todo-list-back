const express = require("express");
const mysql = require("mysql");
const bp = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const randomstring = require("randomstring");
const nodemailer = require("nodemailer");
const { MAILGUN } = require("./tokens/mail-gun");

const app = express();

//body could have diff types
app.use(bp.urlencoded({ extended: true }));
//looks at requests where the Content-Type: application/json (Header)
app.use(bp.json());
//appliquer le cors comme middle ware
app.use(cors());

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

db.connect(() => {
  console.log("mysql server is runing ... 😎");
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
            password VARCHAR(225) NOT NULL,
            verify_token VARCHAR(225) NOT NULL,
            is_account_verified tinyint(1) NOT NULL,
            expireDurration INT(2) NOT NULL,
            sendEmailAt DATETIME() NOT NULL current_timestamp(),
            role ENUM('DEV','LEADER','MANAGER') NOT NULL DEFAULT 'DEV' , 
            PRIMARY KEY (id), UNIQUE email (email) 
        ) `,
    (errorDB, resultatQuery) => {
      if (errorDB) throw errorDB;
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

//register api
app.post("/api/auth/register", (requestHTTP, responseHTTP) => {
  //fetch data from requesthttp
  console.log(requestHTTP.body);
  let data = requestHTTP.body;
  //validation of the data
  let error = false;
  Object.keys(data).forEach((k) => {
    if (data[k] === "") error = true;
  });

  if (error) {
    responseHTTP.statusCode = 403;
    responseHTTP.send({ msg: "Error Values are empty 😥 !" });
  } else if (data.password !== data.rPassword) {
    responseHTTP.statusCode = 403;
    responseHTTP.send({
      msg: "Error Password should match the repeated Password 😥 !",
    });
  } else {
    //est ce que lemail existe dans la base de donnee
    db.query(
      `SELECT id,firstname FROM USERS 
      WHERE email='${data.email}'`,
      (errorDB, resultatQuery) => {
        if (errorDB) throw errorDB;
        // console.log("resultat : ");
        // console.log(resultatQuery);
        if (resultatQuery.length > 0) {
          responseHTTP.statusCode = 403;
          responseHTTP.send({ msg: "Email is already exist 😥" });
        } else {
          //insertion du nouveau user

          //crypt password
          bcrypt.hash(data.password, 10, (err, hashedPassword) => {
            if (err) console.log(err);
            else {
              data.password = hashedPassword;

              //inserer le tout dans la base de donnee
              db.query(
                `INSERT INTO USERS (id, firstname, lastname, email, password, avatarURL,role)
                 VALUES (null,
                  '${data.firstname}',
                  '${data.lastname}',
                  '${data.email}',
                  '${data.password}',
                  '${data.avatarURL}',
                  '${data.role}'
                  )`,
                (err, resultatQuery) => {
                  if (err) throw err;
                  //envoyer un email vers la boite mail de lutilisateur
                  //generer le token
                  let emailToken = randomstring.generate();
                  //set is account verified to false
                  let isAccountVerified = false;

                  // update user's account
                  db.query(
                    `UPDATE USERS
                      SET verify_token = '${emailToken}',
                       is_account_verified = '${isAccountVerified}'
                       WHERE email='${data.email}'`,
                    (err, resultatQuery) => {
                      if (err) throw err;
                      //envoyer l'email vers la boite de lutilisateur
                      let transporter = nodemailer.createTransport({
                        host: "smtp.ethereal.email",
                        port: 587,
                        secure: false, // true for 465, false for other ports
                        auth: {
                          user: MAILGUN.username, // generated ethereal user
                          pass: MAILGUN.password, // generated ethereal password
                        },
                      });
                      //creer lobjet option
                      let mailOption = {
                        from: "todoList@gmc.ma", // sender address
                        to: data.email, // list of receivers
                        subject: "Merci de confirmer votre inscripition 😇", // Subject line
                        html: `
                            <a href=
                            "http://localhost:9000
                            /api/auth/verify-email/${data.email}/code/${data.token}">
                            Verify My Email 
                            </a>
                      `, // html body
                      };
                      //donner loption a sendmail pour faire laction
                      transporter.sendMail(mailOption, (err, info) => {
                        if (err) console.log(err);
                        else {
                          console.log(info);
                          //envoyer un msg de verification vers la partie client
                          responseHTTP.send({
                            msg: "Please verify your email 😄",
                          });
                        }
                      });
                    }
                  );
                }
              );
            }
          });
        }
      }
    );
  }
});

//verify-email api
app.get(
  "/api/auth/verify-email/:email/code/:token",
  (requestHTTP, responseHTTP) => {
    //recuperer l'email et token depuis lurl
    let { email, token } = requestHTTP.params;
    //query user by email and token
    db.query(
      `SELECT * FROM USERS 
       WHERE email='${email}'
       AND verify_token='${token}'
       `,
      (err, resultatQuery_1) => {
        if (err) throw err;
        else {
          //invalid token case
          if (resultatQuery_1.length === 0) {
            responseHTTP.statusCode = 403;
            responseHTTP.send("invalid token 😈");
          } else {
            //query set is accountverified to true
            db.query(
              `UPDATE USERS
                SET 
                 is_account_verified = true
                 WHERE email='${email}'
                 AND verify_token='${token}'`,
              (err, resultatQuery_2) => {
                if (err) throw err;
                else {
                  //envoyer un message html qui contient
                  //le lien vers la page login de frontend
                  responseHTTP.send(`
                    <h1>Merci pour votre inscription 😇</h1>
                    Bienvenu dear ${resultatQuery_1[0].firstname}
                    <br/> <a href="http://localhost:3000/">Login</a>
                  `);
                }
              }
            );
          }
        }
      }
    );
  }
);

//login api
app.post("/api/auth/login", (requestHTTP, responseHTTP) => {
  //fetch data login
  // console.log(requestHTTP.body)
  const { email, password } = requestHTTP.body;
  //validate data
  if (!email || !password) {
    responseHTTP.statusCode = 403;
    responseHTTP.send({ msg: "error empty values server side 😞" });
  }
  //validation metier
  db.query(
    `SELECT * FROM USERS 
     WHERE email='${email}'
     `,
    (err, resultatQuery) => {
      if (err) throw err;
      else {
        //email not found case
        if (resultatQuery.length === 0) {
          responseHTTP.statusCode = 404;
          responseHTTP.send({ msg: "email not found 😞" });
        } else {
          //compare password with hashedPassword
          const hashedPassword = resultatQuery[0].password;
          bcrypt.compare(password, hashedPassword, (err, res) => {
            if (res === false) {
              responseHTTP.statusCode = 403;
              responseHTTP.send({ msg: "invalid password 😞" });
            } else {
              //is account verified true
              if (!resultatQuery[0].is_account_verified) {
                responseHTTP.statusCode = 403;
                responseHTTP.send({
                  msg: "please verify your email address first 😅",
                });
              } else {
                //send user info to the client
                responseHTTP.statusCode = 201;
                let userInfos = { ...resultatQuery[0] };
                delete userInfos["password"];
                delete userInfos["verify_token"];
                delete userInfos["is_account_verified"];
                delete userInfos["sendEmailAt"];
                delete userInfos["expireDurration"];
                responseHTTP.send({ userInfos });
              }
            }
          });
        }
      }
    }
  );
});

//forget password api
app.post("/api/auth/forget-password", (requestHTTP, responseHTTP) => {
  //fetch data
  console.log(requestHTTP.body);
  const { email } = requestHTTP.body;
  //validate email
  if (!email) {
    responseHTTP.statusCode = 403;
    responseHTTP.send({ msg: "error empty values 😞" });
  } else {
    db.query(
      `SELECT * FROM USERS 
       WHERE email='${email}'
       `,
      (err, resultatQuery) => {
        if (err) throw err;
        else {
          //email not found
          if (resultatQuery.length === 0) {
            responseHTTP.statusCode = 404;
            responseHTTP.send({ msg: "email not found 😅" });
          } else {
            const isAccountVerified = resultatQuery[0].is_account_verified;
            if (!isAccountVerified) {
              responseHTTP.statusCode = 403;
              responseHTTP.send({
                msg: "please try to verify your email first 😅",
              });
            } else {
              //send email
              let forgetPassToken = randomstring.generate();
              let ResetPassFrontURL = `http://localhost:3000/resetPassword/code/${forgetPassToken}/email/${email}`;
              let expireDurration = 24;
              let sendEmailAt = new Date(Date.now());
              //concerver ca sur la base de donnee
              db.query(
                `UPDATE USERS
                SET 
                 verify_token = '${forgetPassToken}',
                 expireDurration = ${expireDurration},
                 sendEmailAt = '${sendEmailAt}'
                 WHERE email='${email}'
                 `,
                (err, resultatQuery) => {
                  if (err) throw err;
                  else {
                    //envoyer l'email vers la boite de lutilisateur
                    let transporter = nodemailer.createTransport({
                      host: "smtp.ethereal.email",
                      port: 587,
                      secure: false, // true for 465, false for other ports
                      auth: {
                        user: MAILGUN.username, // generated ethereal user
                        pass: MAILGUN.password, // generated ethereal password
                      },
                    });
                    //creer lobjet option
                    let mailOption = {
                      from: "todoList@gmc.ma", // sender address
                      to: email, // list of receivers
                      subject: "Reset Password 😇", // Subject line
                      html: `
                          <a href="${ResetPassFrontURL}">
                          Reset My Password
                          </a>
                          <p style="text-align-center">
                          the link will be expire after ${expireDurration} hours
                          </p>
                    `, // html body
                    };
                    //donner loption a sendmail pour faire laction
                    transporter.sendMail(mailOption, (err, info) => {
                      if (err) console.log(err);
                      else {
                        console.log(info);
                        //envoyer un msg de verification vers la partie client
                        responseHTTP.send({
                          msg: "please check your email dude 😄",
                        });
                      }
                    });
                  }
                }
              );
            }
          }
        }
      }
    );
  }
});

//reset pasword api
app.post(
  "/api/auth/reset-password/code/:code/email/:email",
  (requestHTTP, responseHTTP) => {
    //fetch data
    console.log(requestHTTP.body);
    const { password, repeatedPassword } = requestHTTP.body;
    //validation
    if (!rp || !p) {
      responseHTTP.statusCode = 403;
      responseHTTP.send({ msg: "error empty values 😞" });
    } else if (rp !== p) {
      responseHTTP.statusCode = 403;
      responseHTTP.send({ msg: "Passwords should be matched 😞" });
    } else {
      const { code, email } = requestHTTP.params;

      db.query(
        `SELECT * FROM USERS 
       WHERE email='${email}'
       AND verify_token='${code}'
       `,
        (err, resultatQuery) => {
          if (err) throw err;
          else {
            //invalid token case
            if (resultatQuery.length === 0) {
              responseHTTP.statusCode = 403;
              responseHTTP.send({
                msg: "invalid token or email 😈",
              });
            } else {
              //test if the token is expired
              const dateNow = new Date(Date.now());
              const expireDurration = resultatQuery[0].expireDurration;
              const sendEmailAt = resultatQuery[0].sendEmailAt;
              if (dateNow - sendEmailAt > expireDurration) {
                responseHTTP.statusCode = 403;
                responseHTTP.send({
                  msg: "token has been expired 😈",
                });
              } else {
                //crypt password
                bcrypt.hash(password, 10, (err, hashedPassword) => {
                  if (err) console.log(err);
                  else {
                    password = hashedPassword;
                    db.query(`UPDATE USERS
                                SET 
                                password = '${password}',
                                verify_token=''
                                WHERE email='${email}'`);
                  }
                });
              }
            }
          }
        }
      );
    }
  }
);

//___________________todo api___________

app.post("/api/todos", (requestHTTP, responseHTTP) => {
  //fetch data
  console.log(requestHTTP.body);
  const newTask = requestHTTP.body;
  //validation des donees

  //validation des donnee
  if (!newTask.title || !newTask.description || !newTask.status) {
    responseHTTP.statusCode = 403;
    responseHTTP.send({ msg: "Empty values error 😈 !" });
  } else if (
    newTask.status !== "DONE" &&
    newTask.status !== "CANCELED" &&
    newTask.status !== "INPROGRESS" &&
    newTask.status !== "TODO"
  ) {
    responseHTTP.statusCode = 403;
    responseHTTP.send({ msg: "Invalid status task value 😈 !" });
  } else {
    //is userId exist ?
    db.query(
      `SELECT * FROM USERS WHERE id=${newTask.userId}
        `,
      (err, resultatQuery) => {
        if (err) {
          responseHTTP.statusCode = 500;
          responseHTTP.send({ msg: "error database 🚨 !" });
          throw err;
        } else {
          if (resultatQuery.length === 0) {
            responseHTTP.statusCode = 404;
            responseHTTP.send({ msg: "UserId not found 😈 !" });
          } else {
            db.query(
              `INSERT INTO TASKS (id, title, description, status,startedAt,doneAt,userId)
                 VALUES (null,
                  '${newTask.title}',
                  '${newTask.description}',
                  '${newTask.status}',
                  CURRENT_TIMESTAMP,
                  CURRENT_TIMESTAMP,
                  ${newTask.userId}
                  )`,
              (err, resultatQuery_1) => {
                if (err) throw err;
                else {
                  console.log(resultatQuery_1);
                  responseHTTP.statusCode = 201;
                  responseHTTP.send({
                    msg: "todo added successfully 😇",
                    todoId: resultatQuery_1.insertId,
                  });
                }
              }
            );
          }
        }
      }
    );
  }
});
// /api/users/4/todos
app.get("/api/users/:userId/todos", (requestHTTP, responseHTTP) => {
  //fetch data userId
  const userID = requestHTTP.params.userId;
  //get all todos of userId
  db.query(
    `SELECT * FROM TASKS WHERE userId=${userID}`,
    (err, resultatQuery) => {
      if (err) throw err;
      else {
        responseHTTP.statusCode = 200;
        responseHTTP.send({ tasks: resultatQuery });
      }
    }
  );

  // console.log(userID)
});

// delete task api
app.delete("/api/users/:userId/todos/:todoId", (requestHTTP, responseHTTP) => {
  //fetch data from url using params
  // console.log(requestHTTP.params);
  const { todoId } = requestHTTP.params;
  //delete task from tasks table
  db.query(`DELETE FROM tasks WHERE id=${todoId}`, (err, resultatQuery) => {
    if (err) throw err;
    else {
      setTimeout(() => {
        console.log(resultatQuery);
        responseHTTP.statusCode = 200;
        responseHTTP.send({
          msg: "task deleted successfully 😎 !",
        });
      }, 1000);
    }
  });
});

// update task api
app.put("/api/users/:userId/todos/:todoId", (requestHTTP, responseHTTP) => {
  //fetch data from url using params
  console.log(requestHTTP.params, requestHTTP.body);
  const { todoId } = requestHTTP.params;
  const { updatedTask } = requestHTTP.body;
  //update task from tasks table

  let sql = `UPDATE tasks 
  SET title='${updatedTask.title}',
  description='${updatedTask.description}',
  status = '${updatedTask.status}'
   `;
  switch (updatedTask.status) {
    case "INPROGRESS":
      sql += `, startedAt = CURRENT_TIMESTAMP`;
      break;
    case "DONE":
      sql += `, doneAt = CURRENT_TIMESTAMP`;
      break;
  }
  sql += ` WHERE id=${todoId}`;
  sql = sql.replace("\n", "");

  db.query(sql, (err, resultatQuery) => {
    if (err) throw err;
    else {
      db.query(
        `SELECT startedAt, doneAt FROM TASKS WHERE id=${todoId}`,
        (err, resultatQuery1) => {
          if (err) throw err;
          else {
            setTimeout(() => {
              console.log(resultatQuery1);
              responseHTTP.statusCode = 201;
              responseHTTP.send({
                msg: "task updated successfully 😎 !",
                startedAt : resultatQuery1[0].startedAt,
                doneAt : resultatQuery1[0].doneAt
              });
            }, 1000);
          }
        }
      );
    }
  });
});

//get todo details 
app.get("/api/todos/:todoId",(requestHTTP,responseHTTP)=>{

  //fetch data 
  const {todoId} = requestHTTP.params
  //get task details 
  db.query(
    `SELECT * FROM TASKS WHERE id=${todoId}`
    ,(err,rq)=>{
      if(err) throw err 
      else {
        setTimeout(()=>{
          responseHTTP.statusCode = 200
          responseHTTP.send({
            todo : rq[0]
          })
        },1000)
      }
    })
})

require('dotenv').config();

const express = require('express');
// const mysql = require('mysql');
const app = express();

const port = process.env.PORT || 3000;


app.use(express.static('public'));

app.get('/', function(req, res){
  res.redirect('index.html');
});

app.listen(port, () => {console.log('UrbanWiki listening on port '+ port +'!')});



// var con = mysql.createConnection({
//   host: "localhost",
//   user: "node_user",
//   password: "pass"
// });


process.on('uncaughtException', function (err) {
  console.log(err);
}); 
// con.connect(function(err) {
//   if (err) throw err;
//   console.log("Connected!");
//   con.query("CREATE DATABASE mydb2", function (err, result) {
//     if (err) throw err;
//     console.log("Database created");
//   });
// });




app.use(function (req, res, next) {
  res.status(404).send("Sorry can't find that!")
})

app.use(function (err, req, res, next) {
  console.error(err.stack)
  res.status(500).send('Something broke!')
})

import * as express from "express";
import * as http from "http";
import * as bodyParser from "body-parser";
import * as mysql from "mysql";

let app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.set('view engine', 'pug');

let server = http.createServer(app);
let connect, connection;

if (process.env.OPEN_GOLINKS_GA_ID) {
  console.log(`Setting Google Analytics with Tracking Id = `, process.env.OPEN_GOLINKS_GA_ID);
  // Get the module
  let expressGoogleAnalytics = require('express-google-analytics');
  // Insert your Google Analytics Id, Shoule be something like 'UA-12345678-9'
  let analytics = expressGoogleAnalytics(process.env.OPEN_GOLINKS_GA_ID);

  //Add to express before your routes
  app.use(analytics);
}

if (process.env.CLEARDB_DATABASE_URL) {
  console.log(`Using MySQL`);
  connection = mysql.createConnection(process.env.CLEARDB_DATABASE_URL);
  connection.connect();
} else {
  console.log(`No MySQL specified`);
  process.exit(1);
}

function upsertLinkAsync(linkname, dest, cb) {
  let query = `
INSERT INTO golinks (linkname, dest, author)
VALUES ('${linkname}', '${dest}', 'system')
ON DUPLICATE KEY UPDATE
    dest = '${dest}',
    author = 'system';
    `;

  connection.query(query, function (err, rows, fields) {
    if (err) throw err;
    console.log('Result ', rows);
    cb(rows);
  })
}

function getLinkAsync(linkname, cb) {
  let query = `SELECT linkname, dest, author from golinks WHERE linkname='${linkname}';`;

  connection.query(query, function (err, rows, fields) {
    if (err) throw err;
    console.log('Result ', rows);
    if (rows.length > 0) {
      cb(rows[0].dest);
    } else {
      cb(null);
    }
  })
}

app.get('/:linkname([A-Za-z0-9-_]+)', function (req, res) {
  let linkname = req.params.linkname;
  getLinkAsync(linkname, function (dest) {
    if (dest) {
      console.log('redirect to golink:', dest);
      res.redirect(dest);
    } else {
      console.log('Not found', 'LINK_' + req.params.linkname);
      res.redirect(`/edit/${linkname}`);
    }
  });
});

app.get('/edit/:linkname([A-Za-z0-9-_]+)', function (req, res) {
  console.log(`Editing`);
  let linkname = req.params.linkname;
  getLinkAsync(linkname, function (dest) {
    console.log('Edit golink:', linkname, dest);
    res.render('edit', {linkname: linkname, old_dest: dest})
  });
});

app.post('/edit', function (req, res) {
  console.log(`Posting`, req);
  let linkname = req.body.linkname;
  let dest = req.body.dest;
  upsertLinkAsync(linkname, dest, function (rows) {
    console.log(`Done`);
    res.send('OK');
  });
});

let PORT = process.env.PORT || 3000;
console.log('Start listening on ', PORT);
app.listen(PORT);

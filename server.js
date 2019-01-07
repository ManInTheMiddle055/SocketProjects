console.log('Server-side code running');
var express = require('express');
var http = require('http')
const app = express();
var socketio = require('socket.io');
var mongojs = require('mongojs');
var ObjectID = mongojs.ObjectID;
var server = http.Server(app);
var websocket = socketio(server);
const url =  'mongodb://ec2-35-167-157-150.us-west-2.compute.amazonaws.com:27017/clicks';
var db = mongojs(process.env.MONGO_URL || url);
const MongoClient = require('mongodb').MongoClient;
app.use(express.static('public'));


MongoClient.connect(url, (err, database) => {
  if(err) {
    return console.log(err);
  }
 // start the express web server listening on 8080
  server.listen(3000, () => console.log('listening on *:3000'));

});

// serve the homepage
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// add a document to the DB collection recording the click event
app.post('/clicked', (req, res) => {
  const click = {clickTime: new Date()};
  console.log(click);
  console.log(db);


  db.collection('clicks').save(click, (err, result) => {
    if (err) {
      return console.log(err);
    }
    console.log('click added to db');
    res.sendStatus(201);
  });

_sendAndSaveMessage({
    text: "test message on Button clicked",
    createdAt: new Date(),
    user: { _id: 'WebClient' }
  }, null /* no socket */, true /* send from server */);


});



// get the click data from the database
app.get('/clicks', (req, res) => {
  db.collection('clicks').find().toArray((err, result) => {
    if (err) return console.log(err);
    res.send(result);
  });
});


app.get('/messages', (req, res) => {
  db.collection('messages').find().toArray((err, result) => {
    if (err) return console.log(err);
    res.send(result);
  });
});

// Mapping objects to easily map sockets and users.
var clients = {};
var users = {};

// This represents a unique chatroom.
// For this example purpose, there is only one chatroom;
var chatId = 1;

websocket.on('connection', (socket) => {
    clients[socket.id] = socket;
    console.log('Connection called')
    socket.on('userJoined', (userId) => onUserJoined(userId, socket));
    socket.on('message', (message) => onMessageReceived(message, socket));
});

// Event listeners.
// When a user joins the chatroom.
function onUserJoined(UserInfo, socket) {
  try {
    // The userId is null for new users.
    if (UserInfo) {
      var user = db.collection('users').insert(UserInfo, (err, user) => {
        socket.emit('userJoined', UserInfo._id);
        users[socket.id] = UserInfo._id;
        _sendExistingMessages(socket);
      });
    } 
  } catch(err) {
   console.log(err);
  }
}

// When a user sends a message in the chatroom.
function onMessageReceived(message, senderSocket) {
  var userId = users[senderSocket.id];
  // Safety check.
  if (!userId) return;
  _sendAndSaveMessage(message, senderSocket);
}

// Helper functions.
// Send the pre-existing messages to the user that just joined.
function _sendExistingMessages(socket) {
  var messages = db.collection('messages')
    .find({ chatId })
    .sort({ createdAt: 1 })
    .toArray((err, messages) => {
      // If there aren't any messages, then return.
      if (!messages.length) return;
      socket.emit('message', messages.reverse());
  });
}

// Save the message to the db and send all sockets but the sender.
function _sendAndSaveMessage(message, socket, fromServer) {
  var messageData = {
    text: message.text,
    user: message.user,
    createdAt: new Date(message.createdAt),
    chatId: chatId
  };

  db.collection('messages').insert(messageData, (err, message) => {
    // If the message is from the server, then send to everyone.
    var emitter = fromServer ? websocket : socket.broadcast;
    emitter.emit('message', [message]);
  });
}

// Allow the server to participate in the chatroom through stdin.
var stdin = process.openStdin();
stdin.addListener('data', function(d) {
  _sendAndSaveMessage({
    text: d.toString().trim(),
    createdAt: new Date(),
    user: { _id: 'Terminal' }
  }, null /* no socket */, true /* send from server */);
});

